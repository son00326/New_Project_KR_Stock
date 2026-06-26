-- ============================================================================
-- 0042_m12a_ticker_assessment.rollback.sql
-- M12a durable ledger 테이블 롤백. 인덱스/정책은 테이블 drop으로 함께 제거.
-- ============================================================================
drop policy if exists "m12a_ticker_assessment admin all" on public.m12a_ticker_assessment;
drop table if exists public.m12a_ticker_assessment;
