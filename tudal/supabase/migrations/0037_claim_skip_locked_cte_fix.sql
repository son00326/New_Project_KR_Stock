-- 0037 (74차 P2b live canary catch) — claim RPC over-claim fix: IN-subquery → MATERIALIZED CTE.
--
-- 결함 (production 실증, 2026-06-10):
--   claim_next_report_jobs / claim_next_selection_jobs 의 claim UPDATE가
--     `where id in (select id ... order by ticker limit p_limit for update skip locked)`
--   형태인데, Postgres는 locking(FOR UPDATE)이 든 IN-서브쿼리를 hashed semi-join으로
--   단일 평가하지 못하고 outer row 평가 중 재실행(rescan)할 수 있다. 재실행 시점에는
--   같은 UPDATE가 이미 바꾼 row(status='running')가 pending 필터에서 빠지므로 LIMIT이
--   매번 *다른* id를 반환 → p_limit 초과 over-claim (plan/통계 의존, 비결정).
--   실증: P2b live canary가 p_limit=1로 호출 → 단일 트랜잭션(claimed_at 동일)에서 3 jobs
--   claim + 3 full reports 과금(₩1,695.83, 의도 1). 동일 SQL 수동 재현 LIMIT 1 → 2행.
--
-- 영향:
--   - report 경로: cron/수동 chunk가 의도(chunkSize)보다 많은 종목을 한 invocation에서
--     처리 → 비용 과다 집행 + serverless 타임아웃 노출 (총 spend는 큐 크기로 bound).
--   - selection 경로: 동일 구조 (71차 cheap smoke chunkSize=1=1행은 plan 운에 의존했던 것).
--
-- 수정: 표준 skip-locked 큐 패턴 — `with picked as materialized (...)` 단일 평가 후
--   UPDATE ... FROM picked. MATERIALIZED가 CTE 1회 평가를 강제하므로 claim ≤ p_limit 보장.
--   semantics 외 변경 0 (필터/정렬/stale sweep/auth guard/grants 동일, returning shape 동일).
--
-- rollback: 0037_claim_skip_locked_cte_fix.rollback.sql (0027/0031 원문 복원).

-- ───────────────────────── claim_next_report_jobs (0027 → CTE) ─────────────────────────
create or replace function public.claim_next_report_jobs(p_month text, p_limit int)
returns setof public.report_batch_job
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
begin
  if p_month !~ '^[0-9]{4}-[0-9]{2}$' then
    raise exception 'invalid_month';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 30 then
    raise exception 'invalid_limit';
  end if;

  -- 내부 auth guard (service_role bypass / else admin) — 0021/0022 패턴
  v_role := coalesce((select auth.role()), '');
  if v_role <> 'service_role' then
    if auth.uid() is null then
      raise exception 'auth_unavailable';
    end if;
    if not public.is_admin() then
      raise exception 'admin_required';
    end if;
  end if;

  -- 선행 sweep (0027 R2 MEDIUM-1): crash-after-claim으로 stale running + attempts 소진된 row를 'failed' 고정 (무한 reclaim 차단)
  update public.report_batch_job
    set status = 'failed', last_error = 'attempts_exhausted', finished_at = now()
  where month = p_month
    and status = 'running'
    and claimed_at < now() - interval '10 minutes'
    and attempts >= 3;

  -- atomic claim (0037): MATERIALIZED CTE 단일 평가 — IN-서브쿼리 rescan over-claim 차단.
  return query
  with picked as materialized (
    select id from public.report_batch_job
    where month = p_month
      and attempts < 3
      and (status = 'pending' or (status = 'running' and claimed_at < now() - interval '10 minutes'))
    order by ticker
    limit p_limit
    for update skip locked
  )
  update public.report_batch_job j
    set status = 'running', claimed_at = now(), started_at = now(), attempts = j.attempts + 1
  from picked
  where j.id = picked.id
  returning j.*;
end;
$$;

revoke all on function public.claim_next_report_jobs(text, int) from public;
revoke all on function public.claim_next_report_jobs(text, int) from anon;
grant execute on function public.claim_next_report_jobs(text, int) to authenticated;
grant execute on function public.claim_next_report_jobs(text, int) to service_role;

-- ─────────────────────── claim_next_selection_jobs (0031 → CTE) ───────────────────────
create or replace function public.claim_next_selection_jobs(p_period_key text, p_limit int)
returns setof public.tier1_selection_job
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
begin
  -- period_key sanity (track↔prefix exact CHECK가 본 검증 — 여기선 약한 prefix sanity만)
  if p_period_key !~ '^[sm]:' then
    raise exception 'invalid_period_key';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 30 then
    raise exception 'invalid_limit';
  end if;

  -- 내부 auth guard (service_role bypass / else admin) — 0027 패턴
  v_role := coalesce((select auth.role()), '');
  if v_role <> 'service_role' then
    if auth.uid() is null then
      raise exception 'auth_unavailable';
    end if;
    if not public.is_admin() then
      raise exception 'admin_required';
    end if;
  end if;

  -- 선행 sweep (0027 R2 MEDIUM-1): crash-after-claim으로 stale running + attempts 소진된 row를 'failed' 고정 (무한 reclaim 차단)
  update public.tier1_selection_job
    set status = 'failed', last_error = 'attempts_exhausted', finished_at = now()
  where period_key = p_period_key
    and status = 'running'
    and claimed_at < now() - interval '10 minutes'
    and attempts >= 3;

  -- atomic claim (0037): MATERIALIZED CTE 단일 평가 — IN-서브쿼리 rescan over-claim 차단.
  return query
  with picked as materialized (
    select id from public.tier1_selection_job
    where period_key = p_period_key
      and attempts < 3
      and (status = 'pending' or (status = 'running' and claimed_at < now() - interval '10 minutes'))
    order by ticker
    limit p_limit
    for update skip locked
  )
  update public.tier1_selection_job j
    set status = 'running', claimed_at = now(), started_at = now(), attempts = j.attempts + 1
  from picked
  where j.id = picked.id
  returning j.*;
end;
$$;

revoke all on function public.claim_next_selection_jobs(text, int) from public;
revoke all on function public.claim_next_selection_jobs(text, int) from anon;
grant execute on function public.claim_next_selection_jobs(text, int) to authenticated;
grant execute on function public.claim_next_selection_jobs(text, int) to service_role;
