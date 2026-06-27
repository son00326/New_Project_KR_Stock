-- rollback: 0045_record_alert_exit_decision_regrant
-- 0015a 상태(authenticated revoke, service_role only)로 복귀.
revoke execute on function public.record_alert_exit_decision(uuid, text, text) from authenticated;
