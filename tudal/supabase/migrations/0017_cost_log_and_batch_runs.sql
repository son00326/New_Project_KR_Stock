-- 0017_cost_log_and_batch_runs.sql
-- S7a: cost_log + monthly_batch_runs + 3 RPC (acquire_batch_lock + commit_persona_eval + commit_badge_only)
-- + stock_reports.consensus_badge 컬럼 + UNIQUE constraints
-- omxy Q2 + Q6 + Design R4 + Plan R3·R4 합의 박제

-- 1. cost_log 테이블
create table public.cost_log (
  id uuid primary key default gen_random_uuid(),
  month text not null,                          -- 'YYYY-MM'
  ticker text not null,                          -- 6자리 KRX
  persona_id text not null,
  prompt_version text not null,
  model text not null,
  input_tokens int not null default 0,
  cache_creation_input_tokens int not null default 0,
  cache_read_input_tokens int not null default 0,
  output_tokens int not null default 0,
  cost_krw numeric(12, 2) not null,
  prompt_cache_enabled boolean not null,
  called_at timestamptz not null default now(),
  called_by uuid not null references auth.users(id)
);

create index cost_log_month_idx on public.cost_log (month);
create index cost_log_called_at_idx on public.cost_log (called_at desc);

alter table public.cost_log enable row level security;

create policy "cost_log_admin_select" on public.cost_log
  for select to authenticated
  using ( public.is_admin() );

create policy "cost_log_admin_insert" on public.cost_log
  for insert to authenticated
  with check ( public.is_admin() and called_by = auth.uid() );

-- 2. monthly_batch_runs 테이블 (Design R4 lock)
create table public.monthly_batch_runs (
  month text primary key,
  status text not null check (status in ('running', 'succeeded', 'failed')),
  started_at timestamptz not null default now(),
  started_by uuid not null references auth.users(id),
  finished_at timestamptz,
  call_count_done int not null default 0,
  error_code text
);

alter table public.monthly_batch_runs enable row level security;

create policy "batch_runs_admin_select" on public.monthly_batch_runs
  for select to authenticated using ( public.is_admin() );

create policy "batch_runs_admin_insert" on public.monthly_batch_runs
  for insert to authenticated
  with check ( public.is_admin() and started_by = auth.uid() );

create policy "batch_runs_admin_update" on public.monthly_batch_runs
  for update to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );

-- 3. stock_reports.consensus_badge 컬럼 추가 (Plan R3 BLOCKER 4·7)
-- legacy nullable 호환, S7a 신규 row는 RPC가드로 non-null 강제
alter table public.stock_reports
  add column if not exists consensus_badge text
  check (consensus_badge in ('🟢', '🔵', '🟣', '🟡', '⚪'));

-- 4. stock_reports / committee_votes UNIQUE constraint
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'stock_reports_month_ticker_uniq') then
    alter table public.stock_reports
      add constraint stock_reports_month_ticker_uniq unique (month, ticker);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'committee_votes_report_persona_uniq') then
    alter table public.committee_votes
      add constraint committee_votes_report_persona_uniq unique (report_id, persona_id);
  end if;
end$$;

-- 5. acquire_batch_lock RPC (Plan R3 BLOCKER 6 — caller-supplied uuid 위험 제거, 내부 auth.uid() 사용)
create or replace function public.acquire_batch_lock(p_month text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller uuid := auth.uid();
  v_inserted text;
  v_status text;
begin
  if v_caller is null then raise exception 'auth_unavailable'; end if;
  if not public.is_admin() then raise exception 'admin_required'; end if;

  insert into public.monthly_batch_runs (month, status, started_by)
  values (p_month, 'running', v_caller)
  on conflict (month) do nothing
  returning month into v_inserted;

  if v_inserted is not null then
    return jsonb_build_object('acquired', true, 'resumed', false);
  end if;

  select status into v_status from public.monthly_batch_runs where month = p_month;
  if v_status = 'running' then raise exception 'batch_already_running'; end if;
  if v_status = 'succeeded' then raise exception 'batch_already_completed'; end if;
  if v_status = 'failed' then
    update public.monthly_batch_runs
      set status='running', started_at=now(), started_by=v_caller,
          finished_at=null, error_code=null, call_count_done=0
      where month = p_month;
    return jsonb_build_object('acquired', true, 'resumed', true);
  end if;
  raise exception 'batch_lock_unknown_state';
end;
$$;

revoke execute on function public.acquire_batch_lock(text) from public;
revoke execute on function public.acquire_batch_lock(text) from anon;
grant execute on function public.acquire_batch_lock(text) to authenticated;

-- 6. commit_persona_eval RPC (full report — 🟢🔵🟣🟡 only)
create or replace function public.commit_persona_eval(
  p_month text,
  p_ticker text,
  p_section_8 jsonb,
  p_votes jsonb,
  p_consensus_badge text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_report_id uuid;
  v_caller uuid := auth.uid();
  v_vote_count int;
begin
  if v_caller is null then raise exception 'auth_unavailable'; end if;
  if not public.is_admin() then raise exception 'admin_required'; end if;

  -- omxy code-review R1 BLOCKER 1: null pass-through 차단 (PostgreSQL IF <null>는 true 아님)
  if p_votes is null or jsonb_typeof(p_votes) is distinct from 'array' then
    raise exception 'votes_must_be_array';
  end if;
  if jsonb_array_length(p_votes) is distinct from 11 then
    raise exception 'votes_length_must_be_11';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_votes) v
    where coalesce(v->>'vote', '') not in ('BUY', 'HOLD', 'SELL')
  ) then
    raise exception 'invalid_vote_value';
  end if;
  -- omxy R2 추가: persona_id/persona_layer/argument_excerpt null+empty 가드 (committee_votes argument_excerpt는 0003에서 nullable)
  if exists (
    select 1 from jsonb_array_elements(p_votes) v
    where coalesce(v->>'persona_id', '') = ''
       or coalesce(v->>'persona_layer', '') <> 'core'
       or coalesce(v->>'argument_excerpt', '') = ''
  ) then
    raise exception 'invalid_vote_row';
  end if;
  if p_consensus_badge is null or p_consensus_badge not in ('🟢', '🔵', '🟣', '🟡') then
    raise exception 'invalid_badge_for_full_report';
  end if;

  -- omxy final R1 BLOCKER: stock_reports schema (0003) = month date / generated_at only.
  -- created_at/updated_at 컬럼 미존재 → 명시적 date cast + generated_at 사용.
  insert into public.stock_reports (month, ticker, section_8, consensus_badge, generated_at)
  values (to_date(p_month || '-01', 'YYYY-MM-DD'), p_ticker, p_section_8, p_consensus_badge, now())
  on conflict (month, ticker) do update
    set section_8 = excluded.section_8,
        consensus_badge = excluded.consensus_badge,
        generated_at = now()
  returning id into v_report_id;

  delete from public.committee_votes where report_id = v_report_id;

  -- omxy R2 BLOCKER: committee_votes.vote check ('approve','reject','abstain') (0003 박제) 호환.
  -- section_8.partD.vote = BUY/HOLD/SELL (writer 산출물, AI 평가 의미) 유지.
  -- DB 저장은 운영 의사결정 의미로 매핑: BUY→approve / HOLD→abstain / SELL→reject.
  insert into public.committee_votes (report_id, persona_id, persona_layer, vote, argument_excerpt)
  select
    v_report_id,
    (v ->> 'persona_id')::text,
    (v ->> 'persona_layer')::text,
    case (v ->> 'vote')
      when 'BUY' then 'approve'
      when 'HOLD' then 'abstain'
      when 'SELL' then 'reject'
    end,
    (v ->> 'argument_excerpt')::text
  from jsonb_array_elements(p_votes) as v;

  get diagnostics v_vote_count = row_count;

  return jsonb_build_object(
    'success', true,
    'report_id', v_report_id,
    'votes_inserted', v_vote_count
  );
end;
$$;

revoke execute on function public.commit_persona_eval(text, text, jsonb, jsonb, text) from public;
revoke execute on function public.commit_persona_eval(text, text, jsonb, jsonb, text) from anon;
grant execute on function public.commit_persona_eval(text, text, jsonb, jsonb, text) to authenticated;

-- 7. commit_badge_only RPC (Plan R3 BLOCKER 7 — ⚪ 케이스 persistence)
create or replace function public.commit_badge_only(
  p_month text,
  p_ticker text,
  p_consensus_badge text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null then raise exception 'auth_unavailable'; end if;
  if not public.is_admin() then raise exception 'admin_required'; end if;
  -- omxy code-review R1 BLOCKER 1: null guard
  if p_consensus_badge is null or p_consensus_badge <> '⚪' then
    raise exception 'invalid_badge_for_badge_only';
  end if;

  -- omxy final R1 BLOCKER: stock_reports schema (0003) = month date / generated_at only.
  -- created_at/updated_at 컬럼 미존재 → 명시적 date cast + generated_at 사용.
  insert into public.stock_reports (month, ticker, consensus_badge, generated_at)
  values (to_date(p_month || '-01', 'YYYY-MM-DD'), p_ticker, p_consensus_badge, now())
  on conflict (month, ticker) do update
    set consensus_badge = excluded.consensus_badge,
        generated_at = now();

  return jsonb_build_object('success', true);
end;
$$;

revoke execute on function public.commit_badge_only(text, text, text) from public;
revoke execute on function public.commit_badge_only(text, text, text) from anon;
grant execute on function public.commit_badge_only(text, text, text) to authenticated;
