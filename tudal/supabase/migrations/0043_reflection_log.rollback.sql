-- ============================================================================
-- 0043_reflection_log.rollback.sql
-- purpose: 0043 reflection_log 롤백. policy → index → table 역순 drop.
--   DORMANT 마이그라 production 미적용 시 no-op(if exists). cost_log 등 타 테이블 무관.
-- ============================================================================

drop policy if exists "reflection_log admin all" on public.reflection_log;
drop index if exists public.reflection_log_track_period_idx;
drop index if exists public.reflection_log_month_idx;
drop table if exists public.reflection_log;
