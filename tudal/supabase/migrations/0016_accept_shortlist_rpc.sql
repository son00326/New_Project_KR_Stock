-- =====================================================================
-- 0016_accept_shortlist_rpc.sql
-- P3.2 (48차) — accept_shortlist_with_snapshots RPC
-- =====================================================================
-- 목적: acceptShortList의 portfolio_approval INSERT + portfolio_snapshot
-- bulk INSERT를 단일 트랜잭션으로 묶어 orphan approval (FixPlan-46 §P3.2,
-- Phase 2 G-1) 가능성을 차단한다. 함수 호출 자체가 단일 txn이므로 PL/pgSQL
-- exception handler가 발화하면 자동 rollback.
--
-- 보안:
--   - SECURITY DEFINER + set search_path = public, pg_temp
--   - 미인증(auth.uid() IS NULL) → auth_unavailable raise (먼저 검사: 미인증을
--     admin_required로 뭉개지 않고 기존 taxonomy auth_unavailable와 매핑 가능)
--   - 비-어드민 → admin_required raise
--   - p_snapshots는 반드시 jsonb array → invalid_snapshots raise
--   - p_admin_id는 함수 인자 아님; 내부 auth.uid()로 결정 (spoof 차단)
--   - REVOKE EXECUTE FROM PUBLIC + GRANT TO authenticated (0015a 정책 동일 패턴)
--
-- unique_violation 매핑:
--   - portfolio_approval_final_month_uniq (month) → 'already_finalized' return
--   - 기타 (snapshot side 등) → re-raise (예기치 못한 race; actions.ts에 raw 전달)
-- =====================================================================

begin;

create or replace function public.accept_shortlist_with_snapshots(
  p_month text,
  p_shortlist_generated_at timestamptz,
  p_snapshots jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := auth.uid();
  v_approval_id uuid;
  v_constraint text;
begin
  -- 1) 미인증 먼저 (auth_unavailable 매핑)
  if v_admin is null then
    raise exception 'auth_unavailable';
  end if;

  -- 2) admin 가드 (0010 raise_portfolio_dispute 패턴)
  if not public.is_admin() then
    raise exception 'admin_required';
  end if;

  -- 3) snapshot 입력 검증 (omxy round 2 권고: jsonb_typeof guard)
  if jsonb_typeof(p_snapshots) <> 'array' then
    raise exception 'invalid_snapshots';
  end if;

  -- 4) portfolio_approval INSERT (is_final=true → final_month_uniq 가드)
  insert into public.portfolio_approval (
    month,
    admin_id,
    approval_type,
    is_final,
    prev_portfolio_held,
    shortlist_generated_at,
    gating_auto_relief_active,
    reanalysis_count
  ) values (
    p_month::date,
    v_admin,
    'accept',
    true,
    false,
    p_shortlist_generated_at,
    false,
    0
  )
  returning id into v_approval_id;

  -- 5) portfolio_snapshot bulk INSERT (Day 0)
  -- 모든 컬럼 nullable이거나 default 있음 → 누락 필드는 default 적용.
  -- numeric NOT NULL default 0 컬럼은 누락 시 default 0 fallback.
  insert into public.portfolio_snapshot (
    date,
    month,
    ticker,
    entry_price,
    current_price,
    weight,
    is_cash,
    daily_return,
    total_return,
    kospi_return,
    alpha,
    sharpe
  )
  select
    (s->>'date')::date,
    (s->>'month')::date,
    s->>'ticker',
    coalesce((s->>'entry_price')::numeric, 0),
    coalesce((s->>'current_price')::numeric, 0),
    coalesce((s->>'weight')::numeric, 0),
    coalesce((s->>'is_cash')::boolean, false),
    coalesce((s->>'daily_return')::numeric, 0),
    coalesce((s->>'total_return')::numeric, 0),
    coalesce((s->>'kospi_return')::numeric, 0),
    coalesce((s->>'alpha')::numeric, 0),
    coalesce((s->>'sharpe')::numeric, 0)
  from jsonb_array_elements(p_snapshots) s;

  return jsonb_build_object(
    'approval_id', v_approval_id,
    'is_final', true
  );

exception
  when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'portfolio_approval_final_month_uniq' then
      -- 동시 accept race — actions.ts와 동일 의미.
      return jsonb_build_object(
        'error', 'already_finalized'
      );
    end if;
    -- snapshot side unique 또는 다른 constraint → re-raise (txn 자동 rollback).
    raise;
end;
$$;

-- 권한 (0015a 패턴): PUBLIC EXECUTE 제거 + authenticated만 명시 grant.
revoke execute on function public.accept_shortlist_with_snapshots(text, timestamptz, jsonb) from public;
grant execute on function public.accept_shortlist_with_snapshots(text, timestamptz, jsonb) to authenticated;

commit;
