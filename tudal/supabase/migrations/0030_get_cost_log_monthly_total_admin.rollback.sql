-- 0030 rollback — admin-only monthly SUM RPC drop.
-- 주의: cost-logger.ts getMonthlyTotal은 missing-function(PGRST202/42883) 시 paginated SELECT로
--   자동 폴백하므로 본 drop 후에도 session 경로는 pre-migration 동작(RLS-filtered SELECT)으로 복귀.
--   단 fail-open(non-admin undercount) risk가 다시 노출됨 → drop은 코드 revert와 짝으로만.
drop function if exists public.get_cost_log_monthly_total_admin(text);
