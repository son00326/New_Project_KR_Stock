-- migration: 0044_alert_exit_outcome
-- purpose: S7c M15 T+7 outcome — exit_signal alert_event에 t7_price_change/outcome_at 적재 RPC.
-- ref: Document/Service/Planning/ServicePlan-Admin.md §3.10 R3.10-12 (IM-3 Exit 신뢰도 입력)
--      docs/superpowers/specs/2026-06-27-s7c-s7d-alerts-monitoring.md §1.6
-- 선행: 0010 (alert_event + t7_price_change/outcome_at 컬럼).
--
-- DORMANT (USER apply-only): 코드 flag EXIT_OUTCOME_ENABLED off → cron이 RPC 미호출 → 미적용 안전.
-- cron(/api/cron/exit-outcome) 전용 → service_role만 grant (public/anon/authenticated 모두 revoke).
-- idempotent: 이미 적재된(outcome_at not null) 건은 WHERE에서 제외 → 재실행 no-op.

create or replace function public.record_alert_exit_outcome(
  p_alert_id uuid,
  p_t7_price_change numeric,
  p_outcome_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_updated int;
begin
  update public.alert_event
  set
    t7_price_change = p_t7_price_change,
    outcome_at = coalesce(p_outcome_at, now())
  where id = p_alert_id
    and alert_type = 'exit_signal'
    and outcome_at is null;

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

-- 3종 grant 세트 (memory feedback_supabase_security_definer_pattern):
-- Supabase가 신규 public 함수에 authenticated EXECUTE 자동 부여 → 명시 revoke 필수.
-- cron 전용이므로 authenticated도 revoke, service_role만 허용.
revoke execute on function public.record_alert_exit_outcome(uuid, numeric, timestamptz) from public;
revoke execute on function public.record_alert_exit_outcome(uuid, numeric, timestamptz) from anon;
revoke execute on function public.record_alert_exit_outcome(uuid, numeric, timestamptz) from authenticated;
grant execute on function public.record_alert_exit_outcome(uuid, numeric, timestamptz) to service_role;
