-- rollback: 0050_tier0_factor_ranks
-- tier0_candidates_150.factor_ranks 컬럼 제거 (additive-only 마이그의 역연산 — 테이블/기존 데이터 무손실).

alter table public.tier0_candidates_150
  drop column if exists factor_ranks;
