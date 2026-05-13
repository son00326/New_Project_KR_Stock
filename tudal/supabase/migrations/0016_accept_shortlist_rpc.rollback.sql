-- =====================================================================
-- 0016_accept_shortlist_rpc.rollback.sql
-- =====================================================================
-- Rollback for 0016_accept_shortlist_rpc.sql.
-- 함수만 drop. 다른 데이터/스키마 영향 없음.
-- =====================================================================

drop function if exists public.accept_shortlist_with_snapshots(text, timestamptz, jsonb);
