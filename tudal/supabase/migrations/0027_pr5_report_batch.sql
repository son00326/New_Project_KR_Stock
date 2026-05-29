-- 0027_pr5_report_batch.sql
-- PR5 — cron monthly-batch 자동 리포트 생성 (report-only over 기존 short_list_30 30).
-- plan SoT: docs/superpowers/plans/2026-05-29-pr5-cron-monthly-batch-auto.md
-- omxy R-debate R1~R4 누적 17 catch fix 반영.
--
-- 구성 (2 테이블 + 5 RPC):
--   1. report_batch_job   — per-ticker 진행/resume 상태 (claim/mark)
--   2. report_worker_run  — 전용 run-mutex (selection의 monthly_batch_runs와 분리, R2 HIGH-1) + run_id fencing (R3 MEDIUM-1)
--   3. claim_next_report_jobs / mark_report_job
--   4. acquire_report_worker_lock / release_report_worker_lock
--   5. upsert_report_sections_0_7_cron — section_0~7 + appendix UPSERT (service_role, 0025 admin 버전의 cron 대응)
--
-- scope guard (재해석 금지):
--   - committee_votes / Section 8 partA/C/D (commit_persona_eval/commit_sector_personas grant) = PR5b (마이그 0028). 본 마이그 미포함.
--   - upsert_report_sections_0_7_admin (0025) service_role REVOKE 유지 — 본 마이그 미변경.
--   - cost_log schema 미변경 (called_by = reserved 'cron-system' auth.users UUID로 해소, R3 HIGH-3).
--   - pipeline_health grant 미추가 (service_role RLS bypass + Supabase 기본 table grant — 기존 cron INSERT helper와 동일).
--   - versioning 컬럼 / partial unique index 미변경 (overwrite-in-place 유지).
--
-- 모든 신규 SECURITY DEFINER RPC: revoke public/anon + grant authenticated + grant service_role
--   + 내부 auth guard (service_role bypass / else is_admin) + set search_path = public, pg_temp.
--   (CREATE OR REPLACE는 과거 grant 보존 → 명시 REVOKE 필수, omxy Kepler B2 lesson.)

-- ===========================================================================
-- 1. report_batch_job — per-ticker 진행 상태
-- ===========================================================================
create table if not exists public.report_batch_job (
  id uuid primary key default gen_random_uuid(),
  month text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  ticker text not null check (ticker ~ '^[0-9]{6}$'),
  status text not null default 'pending'
    check (status in ('pending', 'running', 'done', 'failed', 'deferred')),
  attempts int not null default 0,
  last_error text,
  report_id uuid references public.stock_reports(id),
  claimed_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  unique (month, ticker)
);

create index if not exists report_batch_job_month_status_idx
  on public.report_batch_job (month, status);

alter table public.report_batch_job enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'report_batch_job'
      and policyname = 'report_batch_job admin all'
  ) then
    create policy "report_batch_job admin all"
      on public.report_batch_job
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

-- ===========================================================================
-- 2. report_worker_run — 전용 run-mutex (selection의 monthly_batch_runs와 분리) + run_id fencing
-- ===========================================================================
create table if not exists public.report_worker_run (
  month text primary key check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  run_id uuid,
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'failed')),
  claimed_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.report_worker_run enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'report_worker_run'
      and policyname = 'report_worker_run admin all'
  ) then
    create policy "report_worker_run admin all"
      on public.report_worker_run
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

-- ===========================================================================
-- 3a. claim_next_report_jobs — atomic claim (SKIP LOCKED + attempts<3 + stale sweep)
-- ===========================================================================
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

-- ===========================================================================
-- 3b. mark_report_job — set terminal status
-- ===========================================================================
create or replace function public.mark_report_job(
  p_id uuid,
  p_status text,
  p_report_id uuid,
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

  update public.report_batch_job
    set status = p_status,
        report_id = coalesce(p_report_id, report_id),
        last_error = p_error,
        finished_at = case when p_status in ('done', 'failed', 'deferred') then now() else finished_at end
  where id = p_id;
end;
$$;

revoke all on function public.mark_report_job(uuid, text, uuid, text) from public;
revoke all on function public.mark_report_job(uuid, text, uuid, text) from anon;
grant execute on function public.mark_report_job(uuid, text, uuid, text) to authenticated;
grant execute on function public.mark_report_job(uuid, text, uuid, text) to service_role;

-- ===========================================================================
-- 4a. acquire_report_worker_lock — 전용 run-mutex (atomic ON CONFLICT + stale reclaim + run_id fencing)
--    returns run_id (acquired) OR null (다른 non-stale worker 보유 중)
-- ===========================================================================
create or replace function public.acquire_report_worker_lock(p_month text)
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

  -- atomic acquire: 신규 OR 비-running OR stale(15min) running만 획득. run_id 새로 발급 (R3 MEDIUM-1 fencing).
  -- R4 LOW-1: 재획득 시 finished_at = null reset.
  insert into public.report_worker_run (month, run_id, status, claimed_at, finished_at)
  values (p_month, gen_random_uuid(), 'running', now(), null)
  on conflict (month) do update
    set run_id = gen_random_uuid(),
        status = 'running',
        claimed_at = now(),
        finished_at = null
    where public.report_worker_run.status <> 'running'
       or public.report_worker_run.claimed_at < now() - interval '15 minutes'
  returning run_id into v_run_id;

  return v_run_id; -- null이면 다른 non-stale worker 보유 중
end;
$$;

revoke all on function public.acquire_report_worker_lock(text) from public;
revoke all on function public.acquire_report_worker_lock(text) from anon;
grant execute on function public.acquire_report_worker_lock(text) to authenticated;
grant execute on function public.acquire_report_worker_lock(text) to service_role;

-- ===========================================================================
-- 4b. release_report_worker_lock — fencing-safe (run_id 일치 owner만)
-- ===========================================================================
create or replace function public.release_report_worker_lock(
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

  -- run_id fencing (R3 MEDIUM-1): stale reclaim 후 늦게 깨어난 old worker가 p_run_id 불일치로 no-op
  update public.report_worker_run
    set status = p_status, finished_at = now()
  where month = p_month and run_id = p_run_id;
end;
$$;

revoke all on function public.release_report_worker_lock(text, uuid, text) from public;
revoke all on function public.release_report_worker_lock(text, uuid, text) from anon;
grant execute on function public.release_report_worker_lock(text, uuid, text) to authenticated;
grant execute on function public.release_report_worker_lock(text, uuid, text) to service_role;

-- ===========================================================================
-- 5. upsert_report_sections_0_7_cron — section_0~7 + appendix UPSERT (service_role 버전)
--    0025 admin UPSERT의 cron 대응: service_role bypass + grant. INSERT-if-missing (B65/B67 근본원인 해소).
--    보존 컬럼 (UPDATE 분기 미터치): section_8 / consensus_badge / version / schema_version / is_latest / regen_*.
-- ===========================================================================
create or replace function public.upsert_report_sections_0_7_cron(
  p_ticker text,
  p_month text,
  p_section_0 jsonb,
  p_section_1 jsonb,
  p_section_2 jsonb,
  p_section_3 jsonb,
  p_section_4 jsonb,
  p_section_5 jsonb,
  p_section_6 jsonb,
  p_section_7 jsonb,
  p_appendix jsonb
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_report_id uuid;
begin
  if p_ticker !~ '^[0-9]{6}$' then
    raise exception 'invalid_ticker';
  end if;
  if p_month !~ '^[0-9]{4}-[0-9]{2}$' then
    raise exception 'invalid_month';
  end if;

  -- service_role direct (cron, route layer가 CRON_SECRET + flag 검증 후 진입) OR authenticated admin (방어적)
  v_role := coalesce((select auth.role()), '');
  if v_role <> 'service_role' then
    if auth.uid() is null then
      raise exception 'auth_unavailable';
    end if;
    if not public.is_admin() then
      raise exception 'admin_required';
    end if;
  end if;

  insert into public.stock_reports (
    ticker, month,
    section_0, section_1, section_2, section_3,
    section_4, section_5, section_6, section_7,
    appendix, generated_at
  ) values (
    p_ticker, to_date(p_month || '-01', 'YYYY-MM-DD'),
    p_section_0, p_section_1, p_section_2, p_section_3,
    p_section_4, p_section_5, p_section_6, p_section_7,
    p_appendix, now()
  )
  on conflict (ticker, month) where is_latest = true do update
    set section_0 = excluded.section_0,
        section_1 = excluded.section_1,
        section_2 = excluded.section_2,
        section_3 = excluded.section_3,
        section_4 = excluded.section_4,
        section_5 = excluded.section_5,
        section_6 = excluded.section_6,
        section_7 = excluded.section_7,
        appendix = excluded.appendix,
        generated_at = now()
  returning id into v_report_id;

  if v_report_id is null then
    raise exception 'upsert_report_sections_0_7_cron_failed_no_returning';
  end if;

  return json_build_object('success', true, 'report_id', v_report_id);
end;
$$;

revoke all on function public.upsert_report_sections_0_7_cron(text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from public;
revoke all on function public.upsert_report_sections_0_7_cron(text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from anon;
grant execute on function public.upsert_report_sections_0_7_cron(text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.upsert_report_sections_0_7_cron(text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to service_role;

comment on function public.upsert_report_sections_0_7_cron(text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) is
  'PR5 — cron report-only UPSERT (section_0~7 + appendix). service_role direct (cron route CRON_SECRET + PR5_CRON_AUTO_ENABLED guard) OR authenticated admin. section_8/consensus_badge/version/schema_version/is_latest/regen_* preserve. 0025 admin UPSERT의 cron 대응 (service_role bypass + grant). committee_votes/Section8 = PR5b.';
