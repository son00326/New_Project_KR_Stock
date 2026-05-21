// tudal/src/lib/screening/tier1-schema.ts
//
// PR2 — Tier 1 AI 30 선정 screening schema (zod).
//
// SoT:
// - docs/superpowers/specs/2026-05-21-shortlist-report-flow-correction.md §1.1 (lock-in)
// - docs/superpowers/plans/2026-05-21-pr2-tier1-screening.md
//
// omxy 53차 §5 PR2 lock-in (R1~R4 CONVERGED, 9 BLOCKERS catch & fix).
//
// **Scope purity (PR2 박제)**:
// - in-memory schema only. DB persistence (assigned_by/version_id columns)는 PR1 wiring scope.
// - 마이그·writer·UI·cron·backlog 모두 OOS.
// - PR3b 권장: `sector_reference_backlog` DB table 도입 (referenceCoverage metadata SoT).

import { z } from 'zod';
import { CANONICAL_SECTORS } from './canonical-sectors';

/**
 * 시간대 enum. Tier 1 평가가 단/중/장 각각 산출.
 */
export const TIMEFRAMES = ['short', 'mid', 'long'] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

/**
 * 5종 consensus 배지 (D19 Q5b 박제, consensus.ts assignBadge 산출).
 */
const ConsensusBadgeSchema = z.union([
  z.literal('🟢'),
  z.literal('🔵'),
  z.literal('🟣'),
  z.literal('🟡'),
  z.literal('⚪'),
]);

/**
 * 시간대별 페르소나 가중치 (lock-in §1.1).
 * - 단기: Druckenmiller, Burry — 모멘텀·콘트라리언 단기 trader
 * - 중기: Lynch — GARP, 1~2년 horizon
 * - 장기: Buffett, Munger, Fisher, Pabrai — 복리·moat 장기 compound
 * 나머지 페르소나 weight 1.0 (대칭).
 *
 * Heavy 가중치 1.5x. Light 가중치 1.0x.
 *
 * IDs는 production CORE_11_PERSONAS와 동일 형식 (kebab-case) — 53차 §5 reviewer CR-01 정정 박제.
 * 정합성 invariant test = `__tests__/tier1-schema.test.ts` (CORE_11_PERSONAS import 후 includes 검증).
 */
export const TIMEFRAME_HEAVY_PERSONAS: Record<Timeframe, readonly string[]> = {
  short: ['stanley-druckenmiller', 'michael-burry'],
  mid: ['peter-lynch'],
  long: ['warren-buffett', 'charlie-munger', 'phil-fisher', 'mohnish-pabrai'],
} as const;

export const PERSONA_WEIGHT_HEAVY = 1.5;
export const PERSONA_WEIGHT_LIGHT = 1.0;

/**
 * 0-100 score schema (Tier 1 per-persona per-timeframe).
 */
const ScoreSchema = z.number().min(0).max(100);

/**
 * 각 페르소나의 timeframe별 score map.
 */
export const ScoresByTimeframeSchema = z.object({
  short: ScoreSchema,
  mid: ScoreSchema,
  long: ScoreSchema,
});

/**
 * Core 11 페르소나의 단일 평가 결과 (LLM 직접 반환).
 *
 * - persona_id: Core 11 lookup id (e.g. "warren_buffett")
 * - scores: timeframe별 0-100
 * - winning_timeframe: 본 persona가 최강이라 본 timeframe
 * - rationale_kr: ≤80자 (한국어 short rationale, audit용)
 * - conviction: 0-100 (신뢰도)
 */
export const PersonaScoreSchema = z.object({
  persona_id: z.string().min(1),
  scores: ScoresByTimeframeSchema,
  winning_timeframe: z.enum(TIMEFRAMES),
  rationale_kr: z
    .string()
    .max(80, { message: 'rationale_kr_too_long' }),
  conviction: z.number().min(0).max(100),
});
export type PersonaScore = z.infer<typeof PersonaScoreSchema>;

/**
 * Sector enum — null 허용 (Tier 0 sector 미정 또는 unknown).
 */
const SectorSchema = z.union([z.enum(CANONICAL_SECTORS), z.null()]);

/**
 * timeframe별 consensus badge map (5종 enum).
 */
export const ConsensusBadgesByTimeframeSchema = z.object({
  short: ConsensusBadgeSchema,
  mid: ConsensusBadgeSchema,
  long: ConsensusBadgeSchema,
});

/**
 * per-ticker aggregate (server-side 산출, 150개 모두).
 *
 * - weighted_scores: 시간대별 페르소나 가중치 적용 후 Core 11 weighted average
 * - primary_timeframe: argmax(weighted_scores). ticker의 본질적 timeframe.
 * - consensus_badges_by_timeframe: 시간대별 5종 배지 (assignBadge 결과)
 * - assigned_by: 'primary' = argmax timeframe에 자연 선발 / 'backfill' = 부족 timeframe에 보충
 * - prompt_version_id / personas_version_id: 재현성 (cost_log 또는 short_list_30 row 박제 — PR1 scope)
 */
export const TickerAggregateSchema = z.object({
  ticker: z.string().min(1),
  sector: SectorSchema,
  weighted_scores: ScoresByTimeframeSchema,
  primary_timeframe: z.enum(TIMEFRAMES),
  consensus_badges_by_timeframe: ConsensusBadgesByTimeframeSchema,
  assigned_by: z.enum(['primary', 'backfill']),
  prompt_version_id: z.string().min(1),
  personas_version_id: z.string().min(1),
});
export type TickerAggregate = z.infer<typeof TickerAggregateSchema>;

/**
 * Selection meta (산출 통계 + version id + timestamp).
 */
export const SelectionMetaSchema = z.object({
  shortCount: z.number().int().nonnegative(),
  midCount: z.number().int().nonnegative(),
  longCount: z.number().int().nonnegative(),
  backfillCounts: z.object({
    short: z.number().int().nonnegative(),
    mid: z.number().int().nonnegative(),
    long: z.number().int().nonnegative(),
  }),
  promptVersionId: z.string().min(1),
  personasVersionId: z.string().min(1),
  generatedAt: z.string().datetime(),
});
export type SelectionMeta = z.infer<typeof SelectionMetaSchema>;

/**
 * Tier1ScreeningResult — PR2 deliverable.
 *
 * 30 selected (10/timeframe) + 120 notSelected = 150 total.
 * refine: counts 일관성 검증.
 */
export const Tier1ScreeningResultSchema = z
  .object({
    selected: z.array(TickerAggregateSchema),
    notSelected: z.array(TickerAggregateSchema),
    selectionMeta: SelectionMetaSchema,
  })
  .refine((v) => v.selected.length === 30, { message: 'selected_must_be_30' })
  .refine((v) => v.notSelected.length === 120, { message: 'notSelected_must_be_120' })
  .refine(
    (v) =>
      v.selectionMeta.shortCount +
        v.selectionMeta.midCount +
        v.selectionMeta.longCount ===
      v.selected.length,
    { message: 'selectionMeta_count_mismatch' }
  )
  // 53차 §5 reviewer CR-02 정정 박제 — duplicate ticker silent corruption 차단.
  .refine(
    (v) => new Set(v.selected.map((a) => a.ticker)).size === v.selected.length,
    { message: 'selected_tickers_must_be_unique' }
  )
  .refine(
    (v) => new Set(v.notSelected.map((a) => a.ticker)).size === v.notSelected.length,
    { message: 'notSelected_tickers_must_be_unique' }
  );
export type Tier1ScreeningResult = z.infer<typeof Tier1ScreeningResultSchema>;

/**
 * Persona weight helper. heavy timeframe persona = 1.5x · light = 1.0x.
 */
export function personaWeightFor(personaId: string, timeframe: Timeframe): number {
  return TIMEFRAME_HEAVY_PERSONAS[timeframe].includes(personaId)
    ? PERSONA_WEIGHT_HEAVY
    : PERSONA_WEIGHT_LIGHT;
}
