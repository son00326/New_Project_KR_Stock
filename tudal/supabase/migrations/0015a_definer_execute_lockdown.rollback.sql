-- ============================================================================
-- rollback for 0015a_definer_execute_lockdown.sql
-- 46차 FixPlan-46 §P0.1. baseline proacl로 복원 (anon + PUBLIC + authenticated 명시 grant 회복).
-- dev/staging 전용 — production rollback은 보안 후퇴라 사용자 명시 승인 필수.
-- ============================================================================

-- 1) is_admin: PUBLIC + anon 복구
grant execute on function public.is_admin() to public;
grant execute on function public.is_admin() to anon;

-- 2) raise_portfolio_dispute: anon 복구 (authenticated는 이미 baseline에 있었음 — no-op)
grant execute on function public.raise_portfolio_dispute(uuid, text) to anon;

-- 3) resolve_portfolio_dispute: anon 복구
grant execute on function public.resolve_portfolio_dispute(uuid) to anon;

-- 4) mark_alert_read: anon + authenticated 복구
grant execute on function public.mark_alert_read(uuid) to anon;
grant execute on function public.mark_alert_read(uuid) to authenticated;

-- 5) record_alert_exit_decision: anon + authenticated 복구
grant execute on function public.record_alert_exit_decision(uuid, text, text) to anon;
grant execute on function public.record_alert_exit_decision(uuid, text, text) to authenticated;
