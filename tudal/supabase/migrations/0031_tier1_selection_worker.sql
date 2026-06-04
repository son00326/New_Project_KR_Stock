-- 0031_tier1_selection_worker.sql
-- Tier1 selection chunk worker — cron weekly/monthly-batch 자동 선정 (Core 11 AI panel over tier0 후보).
-- W2a (2026-06-04): 월단일키 → period_key/track (단기 주1회 's:YYYY-MM-DD' / 중장기 월1회 'm:YYYY-MM').
--   단발 runMonthlyBatchOrchestrator(Vercel 300s 초과)의 chunked 대체 경로. PR5 0027 report-batch 패턴.
--
-- 구성 (2 테이블 + 7 RPC):
--   1. tier1_selection_job   — per-ticker panel 진행/resume 상태 (claim/mark). 산출물 = panel_result jsonb (PersonaScore[] 11).
--   2. tier1_selection_run   — period_key별 독립 run-mutex (트랙별 동시 가동) + run_id fencing.
--   3. claim_next_selection_jobs / mark_selection_job
--   4. acquire_selection_worker_lock / release_selection_worker_lock / mark_selection_finalized
--   5. replace_shortlist_track / carry_short_into_month — 원자적 트랙 단위 shortlist writer (W2a 신규).
--
-- period_key 규약 (D3 / MED-5 exact CHECK):
--   short   → 's:YYYY-MM-DD' (주1회, ISO 주 시작일 등)
--   midlong → 'm:YYYY-MM'    (월1회)
--   track 컬럼('short'|'midlong')과 period_key prefix가 정합해야 한다 (track↔prefix CHECK).
--   month text 컬럼은 short_list_30 month(date) 파생 — 트랙 무관 'YYYY-MM' 유지.
--
-- scope guard (재해석 금지):
--   - short_list_30 schema 미변경 (writer는 0002+0012+0020+0029 컬럼 + 기존 RLS).
--   - cost_log schema 미변경 (called_by = CRON_SYSTEM_USER_ID auth.users UUID로 해소, 0027 R3 HIGH-3과 동일).
--   - pipeline_health grant 미추가 (service_role RLS bypass + Supabase 기본 table grant — 기존 cron INSERT helper와 동일).
--   - monthly_batch_runs / acquire_batch_lock_v2 미변경 (단발 cron 경로 전용 — 본 worker는 전용 mutex 사용).
--
-- 모든 신규 SECURITY DEFINER RPC: revoke public/anon + grant authenticated + grant service_role
--   + 내부 auth guard (service_role bypass / else is_admin, NULL-safe) + set search_path = public, pg_temp.
--   (CREATE OR REPLACE는 과거 grant 보존 → 명시 REVOKE/GRANT 재선언 필수, 0027 Kepler B2 lesson.)
--
-- dormant 재작성 (W2a): 0031은 미적용(dormant)이라 직접 전면 재작성. production apply = USER 게이트.

-- ===========================================================================
-- 1. tier1_selection_job — per-ticker panel 진행 상태 (period_key/track)
-- ===========================================================================
create table if not exists public.tier1_selection_job (
  id uuid primary key default gen_random_uuid(),
  month text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  period_key text not null,
  track text not null check (track in ('short', 'midlong')),
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
  unique (period_key, ticker),
  constraint tier1_selection_job_period_key_track_chk check (
    (track = 'short'   and period_key ~ '^s:\d{4}-\d{2}-\d{2}$') or
    (track = 'midlong' and period_key ~ '^m:\d{4}-\d{2}$')
  )
);

create index if not exists tier1_selection_job_period_key_status_idx
  on public.tier1_selection_job (period_key, status);

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
-- 2. tier1_selection_run — period_key별 독립 run-mutex + run_id fencing
--    (D6/HIGH-3) expected_total 컬럼 신설하지 않음 — finalize는 job count로 판정.
-- ===========================================================================
create table if not exists public.tier1_selection_run (
  period_key text primary key,
  track text not null,
  month text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  run_id uuid,
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'failed')),
  claimed_at timestamptz,
  finished_at timestamptz,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  constraint tier1_selection_run_period_key_track_chk check (
    (track = 'short'   and period_key ~ '^s:\d{4}-\d{2}-\d{2}$') or
    (track = 'midlong' and period_key ~ '^m:\d{4}-\d{2}$')
  )
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
-- 4a. acquire_selection_worker_lock — period_key별 run-mutex (atomic ON CONFLICT + stale reclaim + run_id fencing)
--    returns run_id (acquired) OR null (다른 non-stale worker 보유 중)
--    (HIGH-3) p_expected_total 인자 제거 — finalize는 job count로 판정.
-- ===========================================================================
create or replace function public.acquire_selection_worker_lock(
  p_period_key text,
  p_track text,
  p_month text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_run_id uuid;
begin
  if p_period_key !~ '^[sm]:' then
    raise exception 'invalid_period_key';
  end if;
  if p_track not in ('short', 'midlong') then
    raise exception 'invalid_track';
  end if;
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
  -- finalized_at이 있으면 해당 period 최종 persist 완료 상태이므로 후속 cron은 null 반환(반복 finalize/write 차단).
  -- 재획득 시 finished_at = null reset (0027 R4 LOW-1).
  -- SRC-1 rationale: stale window(15min)는 worker function의 max wall-clock(Vercel maxDuration 300s)을
  --   반드시 초과해야 한다. 그래야 hard-timeout kill로 release가 못 돈 worker의 lock을 다음 invocation이
  --   회수하되, 정상 실행 중인 worker를 조기 reclaim하지 않는다. 15min은 300s 대비 충분한 margin.
  insert into public.tier1_selection_run (period_key, track, month, run_id, status, claimed_at, finished_at)
  values (p_period_key, p_track, p_month, gen_random_uuid(), 'running', now(), null)
  on conflict (period_key) do update
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

revoke all on function public.acquire_selection_worker_lock(text, text, text) from public;
revoke all on function public.acquire_selection_worker_lock(text, text, text) from anon;
grant execute on function public.acquire_selection_worker_lock(text, text, text) to authenticated;
grant execute on function public.acquire_selection_worker_lock(text, text, text) to service_role;

-- ===========================================================================
-- 4b. release_selection_worker_lock — fencing-safe (run_id 일치 owner만)
-- ===========================================================================
create or replace function public.release_selection_worker_lock(
  p_period_key text,
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
  where period_key = p_period_key and run_id = p_run_id;
end;
$$;

revoke all on function public.release_selection_worker_lock(text, uuid, text) from public;
revoke all on function public.release_selection_worker_lock(text, uuid, text) from anon;
grant execute on function public.release_selection_worker_lock(text, uuid, text) to authenticated;
grant execute on function public.release_selection_worker_lock(text, uuid, text) to service_role;

-- ===========================================================================
-- 4c. mark_selection_finalized — period 최종 persist 완료 마킹 (run_id fencing)
--    finalized_at 세팅 후 후속 acquire_selection_worker_lock은 null 반환(반복 finalize/write 차단).
-- ===========================================================================
create or replace function public.mark_selection_finalized(
  p_period_key text,
  p_run_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
begin
  v_role := coalesce((select auth.role()), '');
  if v_role <> 'service_role' then
    if auth.uid() is null then
      raise exception 'auth_unavailable';
    end if;
    if not public.is_admin() then
      raise exception 'admin_required';
    end if;
  end if;

  -- run_id fencing: stale reclaim 후 깨어난 old worker가 p_run_id 불일치로 no-op
  update public.tier1_selection_run
    set finalized_at = now()
  where period_key = p_period_key and run_id = p_run_id;
end;
$$;

revoke all on function public.mark_selection_finalized(text, uuid) from public;
revoke all on function public.mark_selection_finalized(text, uuid) from anon;
grant execute on function public.mark_selection_finalized(text, uuid) to authenticated;
grant execute on function public.mark_selection_finalized(text, uuid) to service_role;

-- ===========================================================================
-- 5a. replace_shortlist_track — 원자적 트랙 단위 shortlist writer (W2a 신규)
--    단일 트랜잭션: 내부 authz guard + p_rows 내부 검증 + cross-bucket overlap + atomic DELETE+INSERT
--    + midlong carry fold. (R1 H1/M4 + R2 H1/H2/M4 + R3 H3/M4 + R4 H1/M4)
-- ===========================================================================
create or replace function public.replace_shortlist_track(p_month date, p_track text, p_rows jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_buckets text[] := case p_track when 'short' then array['short']
                                   when 'midlong' then array['mid','long'] else null end;
  v_expected int := case p_track when 'short' then 10 when 'midlong' then 20 else -1 end;
  v_new_tickers text[];
begin
  -- (R2 HIGH-1 + R4 MED-4) 내부 authz, NULL-safe (둘 다 NULL이면 raise — bypass 차단)
  if not (coalesce(auth.role(),'') = 'service_role' or coalesce(public.is_admin(), false)) then
    raise exception 'not_authorized';
  end if;
  if v_buckets is null then raise exception 'replace_shortlist_track_bad_track:%', p_track; end if;
  -- (R4 HIGH-1) p_rows NULL/non-array 방어 — DELETE 전 (NULL이면 jsonb_array_length NULL → 비교 통과 → 트랙 전멸 차단)
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'replace_shortlist_track_rows_null_or_nonarray'; end if;
  -- (R2 MED-4) p_rows 내부 검증 (직접호출 우회 corruption 차단)
  if jsonb_array_length(p_rows) <> v_expected then
    raise exception 'replace_shortlist_track_count:%:%', p_track, jsonb_array_length(p_rows); end if;
  if exists (select 1 from jsonb_array_elements(p_rows) e
             where not ((e->>'bucket') = any(v_buckets)) or (e->>'ticker') !~ '^\d{6}$'
                or coalesce(e->>'rank','') !~ '^\d+$') then
    raise exception 'replace_shortlist_track_row_invalid'; end if;
  if exists (select 1 from jsonb_array_elements(p_rows) e
             where (e->>'rank')::int < 1 or (e->>'rank')::int > 10) then
    raise exception 'replace_shortlist_track_row_invalid'; end if;
  select array_agg(distinct e->>'ticker') into v_new_tickers from jsonb_array_elements(p_rows) e;
  if array_length(v_new_tickers,1) <> v_expected then
    raise exception 'replace_shortlist_track_dup_ticker'; end if;
  if exists (
    select 1
      from unnest(v_buckets) b(bucket)
      left join (
        select e->>'bucket' as bucket,
               count(*) as row_count,
               count(distinct (e->>'rank')::int) as rank_count
          from jsonb_array_elements(p_rows) e
         group by e->>'bucket'
      ) stats using (bucket)
     where coalesce(stats.row_count, 0) <> 10
        or coalesce(stats.rank_count, 0) <> 10
  ) then
    raise exception 'replace_shortlist_track_bucket_rank_mismatch'; end if;
  -- (R1 MED-4) cross-bucket overlap: 신규 ticker가 동일 month 다른 bucket에 존재 → abort
  if exists (select 1 from short_list_30 s
             where s.month=p_month and s.ticker=any(v_new_tickers) and not (s.bucket=any(v_buckets))) then
    raise exception 'shortlist_track_cross_bucket_overlap'; end if;
  -- (R3 HIGH-3) atomic: 트랙 전행 DELETE + INSERT(fresh created_at) — 생존 ticker도 created_at 갱신(쿨다운 우회 차단)
  delete from short_list_30 s where s.month=p_month and s.bucket=any(v_buckets);
  -- (R3 MED-4) 컬럼 매핑 = 0002+0012+0020+0029 전부 (assigned_by/prompt_version_id/personas_version_id 포함)
  insert into short_list_30
    (month, ticker, bucket, rank, assigned_by, prompt_version_id, personas_version_id,
     delta_status, delta_reason, name, sector, composite_score, signal_label,
     consensus_badge, ai_score, weighted_score_short, weighted_score_mid, weighted_score_long,
     winning_timeframe, conviction, ai_comment_kr, created_at)
  select p_month, e->>'ticker', e->>'bucket', (e->>'rank')::int,
         e->>'assigned_by', e->>'prompt_version_id', e->>'personas_version_id',
         coalesce(e->>'delta_status','new'), e->>'delta_reason', e->>'name', e->>'sector',
         (e->>'composite_score')::numeric, e->>'signal_label',
         e->>'consensus_badge', (e->>'ai_score')::numeric,
         (e->>'weighted_score_short')::numeric, (e->>'weighted_score_mid')::numeric,
         (e->>'weighted_score_long')::numeric, e->>'winning_timeframe',
         (e->>'conviction')::numeric, e->>'ai_comment_kr', now()
    from jsonb_array_elements(p_rows) e;
  -- (R2 HIGH-2) midlong은 동일 트랜잭션에서 carry (별도 RPC 2회 호출 금지)
  if p_track = 'midlong' then perform carry_short_into_month(p_month); end if;
end; $$;
revoke execute on function public.replace_shortlist_track(date,text,jsonb) from public, anon;
grant  execute on function public.replace_shortlist_track(date,text,jsonb) to authenticated, service_role;

-- ===========================================================================
-- 5b. carry_short_into_month — (D8) best-effort short bridge, replace의 midlong txn 내부 호출.
--    midlong 월선정 시 직전 월 short를 'hold'로 carry (cross-track total 관측용). cold-start/졸업 정당 no-op.
-- ===========================================================================
create or replace function public.carry_short_into_month(p_month date)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_src date;
begin
  if not (coalesce(auth.role(),'')='service_role' or coalesce(public.is_admin(),false)) then
    raise exception 'not_authorized'; end if;   -- (R4 MED-4) NULL-safe
  if exists (select 1 from short_list_30 where month=p_month and bucket='short') then return; end if;
  select max(month) into v_src from short_list_30 where month < p_month and bucket='short';
  if v_src is null then return; end if;                       -- (R2 MED-5) cold-start no-op (정당)
  -- 직전 short 전 컬럼 복사, month/created_at/delta_status만 교체 (0020 컬럼 포함, NOT NULL 보존)
  insert into short_list_30
    (month, ticker, bucket, rank, assigned_by, prompt_version_id, personas_version_id,
     delta_status, delta_reason, name, sector, composite_score, signal_label,
     consensus_badge, ai_score, weighted_score_short, weighted_score_mid, weighted_score_long,
     winning_timeframe, conviction, ai_comment_kr, created_at)
  select p_month, c.ticker, 'short', c.rank, c.assigned_by, c.prompt_version_id, c.personas_version_id,
         'hold', c.delta_reason, c.name, c.sector, c.composite_score, c.signal_label,
         c.consensus_badge, c.ai_score, c.weighted_score_short, c.weighted_score_mid,
         c.weighted_score_long, c.winning_timeframe, c.conviction, c.ai_comment_kr, now()
    from short_list_30 c
   where c.month=v_src and c.bucket='short'
     and not exists (select 1 from short_list_30 x where x.month=p_month and x.ticker=c.ticker) -- (R2 HIGH-3) 졸업 ticker 제외
  on conflict (month, ticker) do nothing;
end; $$;
revoke execute on function public.carry_short_into_month(date) from public, anon;
grant  execute on function public.carry_short_into_month(date) to authenticated, service_role;

comment on table public.tier1_selection_job is
  'Tier1 selection chunk worker — per-ticker Core 11 panel 진행/resume 큐. period_key/track (short=s:YYYY-MM-DD 주1회 / midlong=m:YYYY-MM 월1회). panel_result jsonb = PersonaScore[] 11. 단발 orchestrator(Vercel 300s 초과)의 chunked 대체. finalize는 worker TS가 panel_result 모아 runTier1Screening replay 1회 + replace_shortlist_track. PR5 0027 report_batch_job 패턴.';
comment on table public.tier1_selection_run is
  'Tier1 selection period_key별 독립 run-mutex (트랙별 동시 가동, monthly_batch_runs / acquire_batch_lock_v2와 분리) + run_id fencing. period당 1행 = single worker 보장. finalized_at 이후 후속 acquire는 null로 반복 finalize/write 차단. (D6) expected_total 컬럼 없음 — finalize는 job count로 판정.';
comment on function public.replace_shortlist_track(date,text,jsonb) is
  'W2a: 원자적 트랙 단위 shortlist writer. short(10) / midlong(mid+long 20). 단일 트랜잭션 내부 authz + p_rows 검증 + cross-bucket overlap abort + 트랙 전행 DELETE+INSERT(fresh created_at) + midlong carry fold. TS는 호출 계약만, atomic 로직은 RPC 책임.';
comment on function public.carry_short_into_month(date) is
  'W2a: (D8) midlong 월선정 트랜잭션 내부 best-effort short carry. 직전 월 short를 hold로 복사(졸업 ticker 제외, cold-start no-op). cross-track total=30 hard-raise 안 함 — 소비자(report worker) clean-abort 게이트.';
