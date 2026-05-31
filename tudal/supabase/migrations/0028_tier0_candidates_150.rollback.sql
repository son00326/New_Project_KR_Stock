-- rollback: 0028_tier0_candidates_150
-- drop table cascade → 인덱스(month_ticker_uniq / month_bucket_rank_idx) + policy(admin all) 동반 제거.
-- 데이터 소실 주의: tier0_candidates_150 의 150-후보 시드가 전부 삭제된다 (재시드는 Python --emit-candidates).

drop table if exists public.tier0_candidates_150 cascade;
