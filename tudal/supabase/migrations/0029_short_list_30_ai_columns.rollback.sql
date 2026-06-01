-- rollback: 0029_short_list_30_ai_columns
-- PR-E AI 컬럼 8종 제거. 기존 Tier 0 fallback 컬럼(composite_score 등)은 무영향.
-- 데이터 주의: AI 산출 배지/점수/코멘트가 채워진 경우 소실 (재산출은 runMonthlyBatchOrchestrator).

alter table public.short_list_30
  drop column if exists consensus_badge,
  drop column if exists ai_score,
  drop column if exists weighted_score_short,
  drop column if exists weighted_score_mid,
  drop column if exists weighted_score_long,
  drop column if exists winning_timeframe,
  drop column if exists conviction,
  drop column if exists ai_comment_kr;
