-- 0030_get_cost_log_monthly_total_admin.sql
-- STEP-2 cost_log fail-open hardening — admin-only server-side monthly SUM RPC.
-- spec: STEP-2 (plan omxy CONVERGED) · W-cost-log-admin-assertion + W-cost-log-pagination-snapshot.
-- 본질 = SESSION(admin JWT) caller가 cost_log RLS using(is_admin())의 non-admin silent-0
--        fail-open(undercount → 40만원 hardcap 무력화 = 무제한 burn)을 fail-closed raise로 전환.
--        + getMonthlyTotal pagination undercount를 server-side SUM(transaction snapshot)으로 제거.
--
-- ★ service-role(cron/worker) 경로는 본 RPC를 호출하지 않는다 (cost-logger.ts callerKind='service-role'
--   분기로 직접 SELECT 유지 — service_role은 RLS bypass라 이미 전 row 가시 = undercount 없음).
--   따라서 본 RPC는 admin-only: 3-grant (revoke public/anon + grant authenticated) + service_role GRANT 금지 + 명시 REVOKE.
--   CREATE OR REPLACE FUNCTION은 과거 잘못 부여된 권한을 보존할 수 있음 (0025 omxy R1 Kepler B2 lesson)
--   → 미부여(grant 누락)만으론 약함 → 명시 revoke all from service_role 강제.
--
-- guard 동등성: cost-logger.ts getMonthlyTotal 본체의 non-finite/negative fail-closed guard를
--   server-side로 동일 강제 (numeric NaN 불가하나, NULL/음수 방어 명시 — financial integrity).
--   0017 schema에 cost_krw>=0 CHECK 부재 → 음수 row가 monthly total을 낮춰 hardcap 우회시킬 risk를
--   RPC 안에서 raise로 fail-closed (app-level guard와 일관).

create or replace function public.get_cost_log_monthly_total_admin(
  p_month text
)
returns numeric
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller uuid;
  v_total numeric;
  v_negative_exists boolean;
begin
  -- input regex guard (0025 패턴 동일 — PostgreSQL POSIX regex portability)
  if p_month !~ '^[0-9]{4}-[0-9]{2}$' then
    raise exception 'invalid_month';
  end if;

  -- admin-only auth (service_role bypass 분기 부재 — service-role caller는 본 RPC 미경유).
  v_caller := auth.uid();
  if v_caller is null then
    raise exception 'auth_unavailable';
  end if;
  if not public.is_admin() then
    raise exception 'admin_required';
  end if;

  -- financial integrity guard: 음수 cost_krw row가 1개라도 있으면 fail-closed
  -- (0017 schema에 cost_krw>=0 CHECK 부재 → hardcap undercount 우회 차단).
  select exists (
    select 1 from public.cost_log
    where month = p_month and cost_krw < 0
  ) into v_negative_exists;
  if v_negative_exists then
    raise exception 'cost_log_select_failed_negative_cost_krw';
  end if;

  -- server-side SUM — transaction snapshot (pagination / row-limit / parallel-insert page skew 무관).
  -- PostgREST aggregate disabled 이슈는 RPC(plpgsql)에는 적용 안 됨.
  -- 빈 month → SUM=NULL → coalesce 0 (PostgreSQL IF-null guard).
  select coalesce(sum(cost_krw), 0)
    into v_total
    from public.cost_log
    where month = p_month;

  if v_total is null then
    v_total := 0;
  end if;

  return v_total;
end;
$$;

-- 3-grant (admin-only — service_role 의도적 미부여 + 명시 REVOKE, 0025 패턴).
-- CREATE OR REPLACE는 과거 권한 보존 → 명시 REVOKE 강제 (grant 누락만으론 약함).
-- Supabase가 신규 public.* 함수에 anon default grant 자동 부여 → 'revoke from public' 단독 불충분
--   → 'revoke from anon' 명시 필수 (48차 + 0016 line130 lesson).
revoke all on function public.get_cost_log_monthly_total_admin(text) from public;
revoke all on function public.get_cost_log_monthly_total_admin(text) from anon;
revoke all on function public.get_cost_log_monthly_total_admin(text) from service_role;  -- 명시 REVOKE: cron/worker는 본 RPC 미경유(직접 SELECT, RLS bypass)
grant execute on function public.get_cost_log_monthly_total_admin(text) to authenticated;

comment on function public.get_cost_log_monthly_total_admin(text) is
  'STEP-2 cost_log fail-open hardening — admin-only server-side monthly SUM. SESSION(admin) caller만 경유 (RLS using(is_admin()) non-admin silent-0 fail-open을 raise로 fail-closed). service-role(cron/worker)은 RLS bypass라 본 RPC 미경유 — cost-logger.ts callerKind=service-role 분기로 직접 SELECT 유지. service_role grant 의도적 미부여 + 명시 REVOKE. 음수/NULL cost_krw fail-closed. transaction snapshot SUM = pagination undercount 제거(W-cost-log-pagination-snapshot).';
