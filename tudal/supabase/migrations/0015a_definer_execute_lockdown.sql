-- ============================================================================
-- 0015a — definer_execute_lockdown
-- 46차 FixPlan-46 §P0.1 + omxy 합의 Round 1.
-- 목적: SECURITY DEFINER 함수 5종 중 anon EXECUTE 회수 + 미사용 함수의 authenticated EXECUTE도
-- least-privilege로 회수. 활성 admin RPC + RLS 내부 호출 함수만 authenticated GRANT 유지.
--
-- baseline proacl (46차 SELECT):
--   is_admin()                                  : =X(PUBLIC),anon=X,authenticated=X,service_role=X
--   mark_alert_read(uuid)                       : anon=X,authenticated=X,service_role=X        [미사용]
--   raise_portfolio_dispute(uuid,text)          : anon=X,authenticated=X,service_role=X        [ACTIVE]
--   record_alert_exit_decision(uuid,text,text)  : anon=X,authenticated=X,service_role=X        [미사용]
--   resolve_portfolio_dispute(uuid)             : anon=X,authenticated=X,service_role=X        [ACTIVE]
--
-- 적용 후 expected proacl:
--   is_admin()                                  : authenticated=X,service_role=X               [RLS 내부 호출]
--   mark_alert_read(uuid)                       : service_role=X                                [닫음]
--   raise_portfolio_dispute(uuid,text)          : authenticated=X,service_role=X               [admin RPC]
--   record_alert_exit_decision(uuid,text,text)  : service_role=X                                [닫음]
--   resolve_portfolio_dispute(uuid)             : authenticated=X,service_role=X               [admin RPC]
--
-- 적용 후 advisor expected: anon WARN 5 → 0 / authenticated WARN 5 → 3 / 총 11 → 4 (HIBP 1 + auth 3).
-- 최근 마이그 0012/0013/0014 패턴 따름 — explicit begin/commit 없음 (apply_migration이 wrap).
-- ============================================================================

-- 1) is_admin: PUBLIC + anon revoke + authenticated GRANT 유지 (RLS 본문 호출).
revoke execute on function public.is_admin() from public;
revoke execute on function public.is_admin() from anon;
grant  execute on function public.is_admin() to authenticated;

-- 2) raise_portfolio_dispute: anon revoke + authenticated GRANT 유지 (admin-approvals.ts:143 ACTIVE).
revoke execute on function public.raise_portfolio_dispute(uuid, text) from anon;
grant  execute on function public.raise_portfolio_dispute(uuid, text) to authenticated;

-- 3) resolve_portfolio_dispute: anon revoke + authenticated GRANT 유지 (admin-approvals.ts:156 ACTIVE).
revoke execute on function public.resolve_portfolio_dispute(uuid) from anon;
grant  execute on function public.resolve_portfolio_dispute(uuid) to authenticated;

-- 4) mark_alert_read: 미사용 → anon + authenticated 둘 다 revoke (least privilege).
--    필요 시 활성화 시점에 re-grant.
revoke execute on function public.mark_alert_read(uuid) from anon;
revoke execute on function public.mark_alert_read(uuid) from authenticated;

-- 5) record_alert_exit_decision: 미사용 (TODO 주석만) → anon + authenticated 둘 다 revoke.
revoke execute on function public.record_alert_exit_decision(uuid, text, text) from anon;
revoke execute on function public.record_alert_exit_decision(uuid, text, text) from authenticated;
