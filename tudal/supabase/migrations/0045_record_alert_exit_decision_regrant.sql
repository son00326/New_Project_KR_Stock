-- migration: 0045_record_alert_exit_decision_regrant
-- purpose: S7c — record_alert_exit_decision(uuid,text,text) authenticated EXECUTE 재부여.
-- ref: Document/Service/Planning/ServicePlan-Admin.md §3.10 R3.10-14
--      docs/superpowers/specs/2026-06-27-s7c-s7d-alerts-monitoring.md §1.7
-- 배경: 0010이 authenticated grant했으나 0015a(46차 definer lockdown)가 "미사용 → least privilege"로
--       anon+authenticated revoke(0015a line 44-45, "필요 시 활성화 시점에 re-grant" 주석). S7c가 Exit
--       결정 기록 action을 실배선(/admin/alerts/[id]/actions.ts → supabase.rpc, authenticated 세션 client)하므로
--       이제 사용 → 0015a 예고대로 authenticated EXECUTE 재부여. anon은 revoke 유지(least privilege).
-- 함수는 SECURITY DEFINER + 내부 is_admin() self-gate라 authenticated grant 안전(비-admin은 함수 본문에서 admin_required).
-- 선행: 0010(함수 정의) · 0015a(revoke).
--
-- DORMANT (USER apply-only): 미적용 시 action이 42501(permission denied)로 fail-closed → 명시 에러 매핑.
--   EXIT_SIGNAL_ENABLED off(default)면 exit_signal alert 생성 0 → 기록 대상 없음(미적용 안전).

alter function public.record_alert_exit_decision(uuid, text, text)
  set search_path = public, pg_temp;

grant execute on function public.record_alert_exit_decision(uuid, text, text) to authenticated;
