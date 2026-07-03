-- migration: 0050_tier0_factor_ranks
-- purpose: G1 Funnel Reflection (D-1) — tier0_candidates_150에 per-factor rank exposure 계측 컬럼(additive).
--   Python producer `--emit-factor-ranks`(opt-in, default off)가 채움: {trend, foreign, earnings, quality, size}
--   percentile rank(0~100). TS funnel-reflection 로더가 factor↔실현수익 순위상관 입력으로 소비(0047 제안 로그).
-- ref: docs/superpowers/specs/2026-07-03-prelaunch-netnew-3-builds.md §2 D-1
--      docs/superpowers/specs/2026-06-28-g1-tier0-reflection-lab.md
-- 가드레일: diagnostic 계측 전용 — 예측 claim 아님(NO-CONFIG-PASSES 불변) · 자동 적용 경로 없음.
-- RLS/grant 무변경 — 0028 기존 정책("tier0_candidates_150 admin all")이 신규 컬럼에 그대로 적용.
-- NULL 허용 — 과거 월 rows는 NULL 유지(로더가 tier0_score 단일 pseudo-factor로 fail-soft fallback).
--
-- DORMANT (USER apply-only): Python opt-in flag off → 본 컬럼 미기록. 미적용 환경 SELECT 42703은
--   로더가 factor_ranks 없이 재조회(fail-soft).

alter table public.tier0_candidates_150
  add column if not exists factor_ranks jsonb;

comment on column public.tier0_candidates_150.factor_ranks is
  'G1 (D-1, 0050): per-factor percentile rank exposure ({trend,foreign,earnings,quality,size} 0~100). Python --emit-factor-ranks opt-in이 채움(default off → NULL). funnel reflection(0047) factor↔실현수익 상관 입력. diagnostic 계측 전용 — 예측 아님.';
