-- 0037 rollback — claim RPC를 0027/0031 원문(IN-서브쿼리 형태)으로 복원.
-- ⚠️ 원문은 over-claim 결함(0037 헤더 참조)을 다시 노출한다 — 긴급 복구용으로만.

-- ───────────────────────── claim_next_report_jobs (0027 원문) ─────────────────────────
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

  -- 선행 sweep (R2 MEDIUM-1): crash-after-claim으로 stale running + attempts 소진된 row를 'failed' 고정 (무한 reclaim 차단)
  update public.report_batch_job
    set status = 'failed', last_error = 'attempts_exhausted', finished_at = now()
  where month = p_month
    and status = 'running'
    and claimed_at < now() - interval '10 minutes'
    and attempts >= 3;

  -- atomic claim: pending OR stale-running, attempts<3 (R2 MEDIUM-1)
  return query
  update public.report_batch_job
    set status = 'running', claimed_at = now(), started_at = now(), attempts = attempts + 1
  where id in (
    select id from public.report_batch_job
    where month = p_month
      and attempts < 3
      and (status = 'pending' or (status = 'running' and claimed_at < now() - interval '10 minutes'))
    order by ticker
    limit p_limit
    for update skip locked
  )
  returning *;
end;
$$;

revoke all on function public.claim_next_report_jobs(text, int) from public;
revoke all on function public.claim_next_report_jobs(text, int) from anon;
grant execute on function public.claim_next_report_jobs(text, int) to authenticated;
grant execute on function public.claim_next_report_jobs(text, int) to service_role;

-- ─────────────────────── claim_next_selection_jobs (0031 원문) ───────────────────────
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

  -- atomic claim: pending OR stale-running, attempts<3 (0027 R2 MEDIUM-1)
  return query
  update public.tier1_selection_job
    set status = 'running', claimed_at = now(), started_at = now(), attempts = attempts + 1
  where id in (
    select id from public.tier1_selection_job
    where period_key = p_period_key
      and attempts < 3
      and (status = 'pending' or (status = 'running' and claimed_at < now() - interval '10 minutes'))
    order by ticker
    limit p_limit
    for update skip locked
  )
  returning *;
end;
$$;

revoke all on function public.claim_next_selection_jobs(text, int) from public;
revoke all on function public.claim_next_selection_jobs(text, int) from anon;
grant execute on function public.claim_next_selection_jobs(text, int) to authenticated;
grant execute on function public.claim_next_selection_jobs(text, int) to service_role;
