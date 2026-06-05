-- 0034_portfolio_proposal.sql — W3b-2a: portfolio_proposal AI 자율 제안 영속.
-- D26 Q2 — proposePortfolio(Opus)가 생성한 PortfolioProposal{positions,cashWeight,rationale_kr}을 월당 1개 영속.
-- dormant 작성: production apply = USER 게이트 (PORTFOLIO_PROPOSAL_PERSIST_ENABLED 켜기 전 apply). 미적용 시
--   helper가 schema-missing 코드(42P01/42883/PGRST202/PGRST204/PGRST205)를 proposal_schema_missing로 fail-closed.
-- money-path 무접촉: Accept/snapshot/0016 RPC 무변경 (W3b-2b에서 Accept가 본 영속분을 소비).
-- rollback = 0034_portfolio_proposal.rollback.sql.
--
-- 보안(0016 패턴 동형):
--   - 두 RPC 모두 SECURITY DEFINER + set search_path = public, pg_temp
--   - 미인증(auth.uid() IS NULL) → auth_unavailable / 비-어드민 → admin_required
--   - created_by는 함수 인자 아님; auth.uid()로 결정(spoof 차단)
--   - 각 함수 REVOKE EXECUTE FROM public+anon + GRANT authenticated+service_role
--   - 직접 INSERT/UPDATE 차단: RLS는 SELECT policy(admin)만 + restrictive anon all=false →
--     mutation은 SECURITY DEFINER RPC 단일 경로(authenticated 직접 INSERT는 정책 부재로 deny).

begin;

create table if not exists public.portfolio_proposal (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  positions jsonb not null,
  cash_weight numeric(5, 4) not null,
  rationale_kr text not null,
  model text not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint portfolio_proposal_month_uniq unique (month),
  constraint portfolio_proposal_month_first_day_chk
    check (month = date_trunc('month', month)::date),
  constraint portfolio_proposal_positions_array_chk
    check (jsonb_typeof(positions) = 'array'),
  constraint portfolio_proposal_positions_len_chk
    check (jsonb_array_length(positions) between 1 and 30),
  constraint portfolio_proposal_cash_weight_chk
    check (cash_weight >= 0 and cash_weight <= 0.30),
  constraint portfolio_proposal_rationale_len_chk
    check (char_length(rationale_kr) <= 200),
  constraint portfolio_proposal_model_nonempty_chk
    check (model <> '')
);

create index if not exists portfolio_proposal_month_idx
  on public.portfolio_proposal (month);

alter table public.portfolio_proposal enable row level security;

-- SELECT: admin only (getProposalByMonth via session client, W3b-2b Accept consumer).
drop policy if exists "portfolio_proposal admin select" on public.portfolio_proposal;
create policy "portfolio_proposal admin select"
  on public.portfolio_proposal
  for select
  to authenticated
  using (public.is_admin());

-- anon 전면 차단(restrictive): 어떤 작업도 불가.
drop policy if exists "portfolio_proposal anon block" on public.portfolio_proposal;
create policy "portfolio_proposal anon block"
  on public.portfolio_proposal
  as restrictive
  for all
  to anon
  using (false);

-- ---------------------------------------------------------------------------
-- assert_portfolio_proposal_schema() — AI 호출 전 schema-ready preflight.
-- 0034 미적용이면 본 함수 자체가 부재 → PGRST202 → helper가 proposal_schema_missing.
-- 적용 후엔 auth/admin 가드만 통과시키고 true 반환(유료 제안 유실 방지용 경량 체크).
-- ---------------------------------------------------------------------------
create or replace function public.assert_portfolio_proposal_schema()
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'auth_unavailable';
  end if;
  if not public.is_admin() then
    raise exception 'admin_required';
  end if;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- upsert_portfolio_proposal — 월당 1개 영속(latest-only, 재생성=교체).
-- created_by=auth.uid()(spoof 차단). on conflict(month) do update로 데이터 컬럼 전체 교체,
--   created_at은 최초 시각 유지·created_by는 마지막 생성자로 갱신.
-- coarse validation(앱 PortfolioProposalSchema와 동일 의미)으로 직접 RPC caller도 방어 → proposal_invalid.
-- returns jsonb {id, created_at, updated_at} (PostgREST TABLE-return array 모호성 회피).
-- ---------------------------------------------------------------------------
create or replace function public.upsert_portfolio_proposal(
  p_month date,
  p_positions jsonb,
  p_cash_weight numeric,
  p_rationale_kr text,
  p_model text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := auth.uid();
  v_id uuid;
  v_created_at timestamptz;
  v_updated_at timestamptz;
begin
  if v_admin is null then
    raise exception 'auth_unavailable';
  end if;
  if not public.is_admin() then
    raise exception 'admin_required';
  end if;

  -- coarse validation (앱 schema와 동일 의미 — 직접 RPC caller 방어).
  if p_month is null or p_month <> date_trunc('month', p_month)::date then
    raise exception 'proposal_invalid:month';
  end if;
  if jsonb_typeof(p_positions) is distinct from 'array'
     or jsonb_array_length(p_positions) < 1
     or jsonb_array_length(p_positions) > 30 then
    raise exception 'proposal_invalid:positions';
  end if;
  if p_cash_weight is null or p_cash_weight < 0 or p_cash_weight > 0.30 then
    raise exception 'proposal_invalid:cash_weight';
  end if;
  if p_rationale_kr is null or char_length(p_rationale_kr) > 200 then
    raise exception 'proposal_invalid:rationale';
  end if;
  if p_model is null or p_model = '' then
    raise exception 'proposal_invalid:model';
  end if;

  insert into public.portfolio_proposal
    (month, positions, cash_weight, rationale_kr, model, created_by)
  values
    (p_month, p_positions, p_cash_weight, p_rationale_kr, p_model, v_admin)
  on conflict (month) do update set
    positions = excluded.positions,
    cash_weight = excluded.cash_weight,
    rationale_kr = excluded.rationale_kr,
    model = excluded.model,
    created_by = excluded.created_by,
    updated_at = now()
  returning id, created_at, updated_at
    into v_id, v_created_at, v_updated_at;

  return jsonb_build_object(
    'id', v_id,
    'created_at', v_created_at,
    'updated_at', v_updated_at
  );
end;
$$;

-- 권한 (0016 패턴): public+anon EXECUTE 제거 + authenticated/service_role 명시 grant.
revoke execute on function public.assert_portfolio_proposal_schema() from public;
revoke execute on function public.assert_portfolio_proposal_schema() from anon;
grant execute on function public.assert_portfolio_proposal_schema() to authenticated;
grant execute on function public.assert_portfolio_proposal_schema() to service_role;

revoke execute on function public.upsert_portfolio_proposal(date, jsonb, numeric, text, text) from public;
revoke execute on function public.upsert_portfolio_proposal(date, jsonb, numeric, text, text) from anon;
grant execute on function public.upsert_portfolio_proposal(date, jsonb, numeric, text, text) to authenticated;
grant execute on function public.upsert_portfolio_proposal(date, jsonb, numeric, text, text) to service_role;

commit;
