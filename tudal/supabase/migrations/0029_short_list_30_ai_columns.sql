-- migration: 0029_short_list_30_ai_columns
-- purpose: PR-E (ADR D-7 / B4) — short_list_30에 Tier 1 AI 산출 컬럼 추가.
--   카드 산출물(ServicePlan-Admin §2 + D19(e)): 🔢 composite_score(기존) + 🤖 ai_score + 합의 배지 + AI 코멘트 1~2줄.
-- ref: docs/superpowers/specs/2026-05-31-realdata-realai-e2e-decisions.md §3 D-7 / §4 PR-E
--
-- 컬럼 source (TickerAggregate → upsertShortList30 매핑, PR-E impl):
--   consensus_badge        ← consensus_badges_by_timeframe[assigned_timeframe] (5종 배지)
--   ai_score               ← weighted_scores[assigned_timeframe] (0~100, 카드 🤖 점수)
--   weighted_score_{tf}    ← weighted_scores (단/중/장 전체, audit/정렬용)
--   winning_timeframe      ← primary_timeframe (argmax — ticker 본질 timeframe)
--   conviction             ← Tier 1 panel 평균 conviction (runTier1Screening 확장 carry, PR-E impl)
--   ai_comment_kr          ← assigned_timeframe 최고-conviction persona rationale_kr (PR-E impl)
--
-- 전부 NULLABLE — 기존 30 (Tier 0 단독 fallback) row 보존 + B93 canonical invariant 무영향.
-- 배지 알고리즘 = consensus.ts percentile-by-timeframe 단일 (ADR D-2). commit_persona_eval(0017)은
--   report-path(section_8 + votes) 전용 — 본 selection 컬럼과 disjoint (ADR B6).

alter table public.short_list_30
  add column if not exists consensus_badge text
    check (consensus_badge in ('🟢', '🔵', '🟣', '🟡', '⚪')),
  add column if not exists ai_score numeric,
  add column if not exists weighted_score_short numeric,
  add column if not exists weighted_score_mid numeric,
  add column if not exists weighted_score_long numeric,
  add column if not exists winning_timeframe text
    check (winning_timeframe in ('short', 'mid', 'long')),
  add column if not exists conviction numeric,
  add column if not exists ai_comment_kr text;

comment on column public.short_list_30.consensus_badge is
  'PR-E: assigned_timeframe의 5종 합의 배지(🟢강한합의/🔵숫자우세/🟣AI우세/🟡관망/⚪대기). consensus.ts assignBadge. NULL=Tier 0-only fallback.';
comment on column public.short_list_30.ai_score is
  'PR-E: 카드 🤖 AI 점수 = weighted_scores[assigned_timeframe] (0~100, 시간대별 페르소나 가중 평균).';
comment on column public.short_list_30.winning_timeframe is
  'PR-E: ticker 본질 timeframe = primary_timeframe (argmax weighted_scores).';
comment on column public.short_list_30.ai_comment_kr is
  'PR-E: AI 코멘트 1~2줄 (assigned_timeframe 최고-conviction persona rationale_kr).';
