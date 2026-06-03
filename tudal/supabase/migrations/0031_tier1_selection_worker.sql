-- 0031_tier1_selection_worker.sql
-- Tier1 selection chunk worker — cron monthly-batch 자동 30선정 (Core 11 AI panel over tier0_candidates_150 150).
-- 단발 runMonthlyBatchOrchestrator(Vercel 300s 초과)의 chunked 대체 경로. PR5 0027 report-batch 패턴 1:1 복제.
--
-- 구성 (2 테이블 + 4 RPC):
--   1. tier1_selection_job   — per-ticker panel 진행/resume 상태 (claim/mark). 산출물 = panel_result jsonb (PersonaScore[] 11).
--   2. tier1_selection_run   — 전용 run-mutex (selection의 monthly_batch_runs / acquire_batch_lock_v2와 분리, R2 HIGH-1) + run_id fencing (R3 MEDIUM-1)
--   3. claim_next_selection_jobs / mark_selection_job
--   4. acquire_selection_worker_lock / release_selection_worker_lock
--
-- PR5 0027 대비 차이:
--   - report_batch_job.report_id(stock_reports FK) → tier1_selection_job.panel_result jsonb (청크 산출물 = 11 PersonaScore 점수).
--   - bucket 컬럼 추가 (tier0 disjoint short/mid/long — 진단/관측용. finalize 랭킹은 별도 재SELECT한 candidates 사용).
--   - upsert_report_sections_0_7_cron 대응 RPC 불필요 — 30선정 persist는 기존 upsertShortList30(admin-shortlist-persist.ts) 재사용.
--     finalize(150/150 done 판정)는 worker TS가 panel_result 모아 runTier1Screening replay 1회 + upsertShortList30.
--
-- scope guard (재해석 금지):
--   - short_list_30 schema 미변경 (persist는 0029 AI 컬럼 + 기존 upsertShortList30).
--   - cost_log schema 미변경 (called_by = CRON_SYSTEM_USER_ID auth.users UUID로 해소, 0027 R3 HIGH-3과 동일).
--   - pipeline_health grant 미추가 (service_role RLS bypass + Supabase 기본 table grant — 기존 cron INSERT helper와 동일).
--   - monthly_batch_runs / acquire_batch_lock_v2 미변경 (단발 cron 경로 전용 — 본 worker는 전용 mutex 사용).
--
-- 모든 신규 SECURITY DEFINER RPC: revoke public/anon + grant authenticated + grant service_role
--   + 내부 auth guard (service_role bypass / else is_admin) + set search_path = public, pg_temp.
--   (CREATE OR REPLACE는 과거 grant 보존 → 명시 REVOKE 필수, 0027 Kepler B2 lesson.)

-- ===========================================================================
-- 1. tier1_selection_job — per-ticker panel 진행 상태
-- ===========================================================================
create table if not exists public.tier1_selection_job (
  id uuid primary key default gen_random_uuid(),
  month text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  ticker text not null check (ticker ~ '^[0-9]{6}$'),
  bucket text not null check (bucket in ('short', 'mid', 'long')),
  status text not null default 'pending'
    check (status in ('pending', 'running', 'done', 'failed', 'deferred')),
  attempts int not null default 0,
  last_error text,
  panel_result jsonb,
  claimed_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  unique (month, ticker)
);

create index if not exists tier1_selection_job_month_status_idx
  on public.tier1_selection_job (month, status);

alter table public.tier1_selection_job enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tier1_selection_job'
      and policyname = 'tier1_selection_job admin all'
  ) then
    create policy "tier1_selection_job admin all"
      on public.tier1_selection_job
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

-- ===========================================================================
-- 2. tier1_selection_run — 전용 run-mutex (selection의 monthly_batch_runs와 분리) + run_id fencing
-- ===========================================================================
create table if not exists public.tier1_selection_run (
  month text primary key check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  run_id uuid,
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'failed')),
  claimed_at timestamptz,
  finished_at timestamptz,
  finalized_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.tier1_selection_run enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tier1_selection_run'
      and policyname = 'tier1_selection_run admin all'
  ) then
    create policy "tier1_selection_run admin all"
      on public.tier1_selection_run
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

-- ===========================================================================
-- 3a. claim_next_selection_jobs — atomic claim (SKIP LOCKED + attempts<3 + stale sweep)
--    INVARIANT (SRC-2): MUST be called ONLY while holding acquire_selection_worker_lock
--    (single-claimer serialization). The 10-minute job stale-reclaim below is safe only
--    under that mutex — a hypothetical second concurrent claimer could reclaim a still-
--    in-flight (>10min) job and double-orchestrate (duplicate LLM spend). The sole caller
--    chain today is selection-worker route → runGuardedSelectionChunk(lock) → runTier1SelectionChunk.
-- ===========================================================================
create or replace function public.claim_next_selection_jobs(p_month text, p_limit int)
returns setof public.tier1_selection_job
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
  where month = p_month
    and status = 'running'
    and claimed_at < now() - interval '10 minutes'
    and attempts >= 3;

  -- atomic claim: pending OR stale-running, attempts<3 (0027 R2 MEDIUM-1)
  return query
  update public.tier1_selection_job
    set status = 'running', claimed_at = now(), started_at = now(), attempts = attempts + 1
  where id in (
    select id from public.tier1_selection_job
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

revoke all on function public.claim_next_selection_jobs(text, int) from public;
revoke all on function public.claim_next_selection_jobs(text, int) from anon;
grant execute on function public.claim_next_selection_jobs(text, int) to authenticated;
grant execute on function public.claim_next_selection_jobs(text, int) to service_role;

-- ===========================================================================
-- 3b. mark_selection_job — set terminal status (panel_result 페이로드 저장)
-- ===========================================================================
create or replace function public.mark_selection_job(
  p_id uuid,
  p_status text,
  p_panel_result jsonb,
  p_error text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
begin
  if p_status not in ('pending', 'running', 'done', 'failed', 'deferred') then
    raise exception 'invalid_status';
  end if;

  v_role := coalesce((select auth.role()), '');
  if v_role <> 'service_role' then
    if auth.uid() is null then
      raise exception 'auth_unavailable';
    end if;
    if not public.is_admin() then
      raise exception 'admin_required';
    end if;
  end if;

  update public.tier1_selection_job
    set status = p_status,
        panel_result = coalesce(p_panel_result, panel_result),
        last_error = p_error,
        finished_at = case when p_status in ('done', 'failed', 'deferred') then now() else finished_at end
  where id = p_id
    -- SRC-3: terminal 'done'을 failed/deferred로 silent 재오픈 금지 (idempotent no-op).
    -- single-worker serialization 하에서 benign하나, out-of-order 호출(부분 chunk 후 재시도 등)에
    -- 대한 방어. 'done' 행에 done 재기록(idempotent)이나 다른 비-terminal 전이는 허용.
    and not (status = 'done' and p_status in ('failed', 'deferred'));

  if not found then
    -- 0 rows: 진짜 부재 vs 이미 'done'인데 failed/deferred 시도(guard no-op) 구분.
    if not exists (select 1 from public.tier1_selection_job where id = p_id) then
      raise exception 'selection_job_not_found';
    end if;
    -- else: terminal 'done' 보호로 인한 정상 no-op (예외 아님).
  end if;
end;
$$;

revoke all on function public.mark_selection_job(uuid, text, jsonb, text) from public;
revoke all on function public.mark_selection_job(uuid, text, jsonb, text) from anon;
grant execute on function public.mark_selection_job(uuid, text, jsonb, text) to authenticated;
grant execute on function public.mark_selection_job(uuid, text, jsonb, text) to service_role;

-- ===========================================================================
-- 4a. acquire_selection_worker_lock — 전용 run-mutex (atomic ON CONFLICT + stale reclaim + run_id fencing)
--    returns run_id (acquired) OR null (다른 non-stale worker 보유 중)
-- ===========================================================================
create or replace function public.acquire_selection_worker_lock(p_month text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_run_id uuid;
begin
  if p_month !~ '^[0-9]{4}-[0-9]{2}$' then
    raise exception 'invalid_month';
  end if;

  v_role := coalesce((select auth.role()), '');
  if v_role <> 'service_role' then
    if auth.uid() is null then
      raise exception 'auth_unavailable';
    end if;
    if not public.is_admin() then
      raise exception 'admin_required';
    end if;
  end if;

  -- atomic acquire: 신규 OR 비-running OR stale(15min) running만 획득. run_id 새로 발급 (0027 R3 MEDIUM-1 fencing).
  -- finalized_at이 있으면 월 최종 persist 완료 상태이므로 후속 cron은 null 반환(반복 finalize/write 차단).
  -- 재획득 시 finished_at = null reset (0027 R4 LOW-1).
  -- SRC-1 rationale: stale window(15min)는 worker function의 max wall-clock(Vercel maxDuration 300s)을
  --   반드시 초과해야 한다. 그래야 hard-timeout kill로 release가 못 돈 worker의 lock을 다음 invocation이
  --   회수하되, 정상 실행 중인 worker를 조기 reclaim하지 않는다. 15min은 300s 대비 충분한 margin.
  insert into public.tier1_selection_run (month, run_id, status, claimed_at, finished_at)
  values (p_month, gen_random_uuid(), 'running', now(), null)
  on conflict (month) do update
    set run_id = gen_random_uuid(),
        status = 'running',
        claimed_at = now(),
        finished_at = null
    where public.tier1_selection_run.finalized_at is null
      and (
        public.tier1_selection_run.status <> 'running'
        or public.tier1_selection_run.claimed_at < now() - interval '15 minutes'
      )
  returning run_id into v_run_id;

  return v_run_id; -- null이면 다른 non-stale worker 보유 중
end;
$$;

revoke all on function public.acquire_selection_worker_lock(text) from public;
revoke all on function public.acquire_selection_worker_lock(text) from anon;
grant execute on function public.acquire_selection_worker_lock(text) to authenticated;
grant execute on function public.acquire_selection_worker_lock(text) to service_role;

-- ===========================================================================
-- 4b. release_selection_worker_lock — fencing-safe (run_id 일치 owner만)
-- ===========================================================================
create or replace function public.release_selection_worker_lock(
  p_month text,
  p_run_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
begin
  if p_status not in ('succeeded', 'failed') then
    raise exception 'invalid_status';
  end if;

  v_role := coalesce((select auth.role()), '');
  if v_role <> 'service_role' then
    if auth.uid() is null then
      raise exception 'auth_unavailable';
    end if;
    if not public.is_admin() then
      raise exception 'admin_required';
    end if;
  end if;

  -- run_id fencing (0027 R3 MEDIUM-1): stale reclaim 후 늦게 깨어난 old worker가 p_run_id 불일치로 no-op
  update public.tier1_selection_run
    set status = p_status, finished_at = now()
  where month = p_month and run_id = p_run_id;
end;
$$;

revoke all on function public.release_selection_worker_lock(text, uuid, text) from public;
revoke all on function public.release_selection_worker_lock(text, uuid, text) from anon;
grant execute on function public.release_selection_worker_lock(text, uuid, text) to authenticated;
grant execute on function public.release_selection_worker_lock(text, uuid, text) to service_role;

comment on table public.tier1_selection_job is
  'Tier1 selection chunk worker — per-ticker Core 11 panel 진행/resume 큐. panel_result jsonb = PersonaScore[] 11. 단발 orchestrator(Vercel 300s 초과)의 chunked 대체. finalize(150/150 done)는 worker TS가 panel_result 모아 runTier1Screening replay 1회 + upsertShortList30. PR5 0027 report_batch_job 패턴.';
comment on table public.tier1_selection_run is
  'Tier1 selection 전용 run-mutex (monthly_batch_runs / acquire_batch_lock_v2와 분리, 0027 R2 HIGH-1) + run_id fencing. 월당 1행 = single worker 보장. finalized_at 이후 후속 acquire는 null로 반복 finalize/write 차단.';
