-- rollback: 0050_tier0_factor_ranks
-- tier0_candidates_150.factor_ranks 컬럼 제거 (additive-only 마이그의 역연산).
-- ⚠️ 데이터 의미(omxy mig R1 정밀화): row/테이블은 보존되나 factor_ranks에 기록된 "값"은
--   drop과 함께 소실된다. producer --emit-factor-ranks 활성 이후의 rollback = 계측 데이터 손실.
--   (non-null 0인 dormant 상태의 rollback만 무손실.)

alter table public.tier0_candidates_150
  drop column if exists factor_ranks;
