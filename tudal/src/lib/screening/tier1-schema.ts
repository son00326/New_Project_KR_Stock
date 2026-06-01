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
/**
 * TickerAggregate. selected vs notSelected에서 의미 차이:
 *   - selected: assigned_by + assigned_timeframe 모두 non-null. assigned_timeframe = primary면 primary_timeframe, backfill이면 채워진 timeframe.
 *   - notSelected: assigned_by + assigned_timeframe 모두 null (선정 안 됨).
 *
 * 53차 §5 reviewer omxy R5 BLOCKER 1 정정 박제 — backfill row가 어떤 timeframe에 assign되었는지 명시.
 */
export const TickerAggregateSchema = z.object({
  ticker: z.string().min(1),
  sector: SectorSchema,
  weighted_scores: ScoresByTimeframeSchema,
  primary_timeframe: z.enum(TIMEFRAMES),
  consensus_badges_by_timeframe: ConsensusBadgesByTimeframeSchema,
  assigned_by: z.enum(['primary', 'backfill']).nullable(),
  assigned_timeframe: z.enum(TIMEFRAMES).nullable(),
  prompt_version_id: z.string().min(1),
  personas_version_id: z.string().min(1),
});
export type TickerAggregate = z.infer<typeof TickerAggregateSchema>;

/**
 * Panel output schema — Core 11 페르소나 각각 1회 호출 결과.
 * 53차 §5 reviewer omxy R5 BLOCKER 2 정정 박제 — callPersonaPanel 반환을 runtime 검증.
 *   - length = 11 (Core 11 보장)
 *   - persona_id 중복 0
 *
 * 추가 invariant: panel persona_id set이 production CORE_11과 exact 일치해야 함.
 * zod static schema로는 동적 import 불가 → `assertPanelMatchesCore11(panel, expectedIds)` 별도 호출.
 * 53차 §5 reviewer omxy R6 BLOCKER 1 정정 박제 — unknown persona ID (sector persona 등) silent ranking 왜곡 차단.
 */
export const PersonaPanelSchema = z
  .array(PersonaScoreSchema)
  .length(11, { message: 'panel_must_have_11_personas' })
  .refine(
    (panel) => new Set(panel.map((p) => p.persona_id)).size === panel.length,
    { message: 'panel_persona_ids_must_be_unique' }
  );
export type PersonaPanel = z.infer<typeof PersonaPanelSchema>;

/**
 * Panel persona_id가 production Core 11 expected set과 exact 일치하는지 검증.
 * 위반 시 throw 'panel_persona_ids_must_match_core11'.
 *
 * 사용 예 (persona-eval.ts):
 *   const panel = PersonaPanelSchema.parse(raw);
 *   assertPanelMatchesCore11(panel, CORE_11_PERSONAS.map((p) => p.id));
 */
export function assertPanelMatchesCore11(
  panel: PersonaPanel,
  expectedIds: readonly string[]
): void {
  const actual = new Set(panel.map((p) => p.persona_id));
  const expected = new Set(expectedIds);
  if (actual.size !== expected.size) {
    throw new Error('panel_persona_ids_must_match_core11');
  }
  for (const id of expected) {
    if (!actual.has(id)) {
      throw new Error('panel_persona_ids_must_match_core11');
    }
  }
}

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
 * PR-E (ADR D-7) — per-ticker AI 코멘트 + conviction (카드 산출물).
 * - comment_kr: assigned/primary timeframe 관점 1줄 — panel 최고-conviction persona rationale_kr (≤80자).
 * - conviction: panel 11명 평균 conviction (0~100, 카드 신뢰도).
 * TickerAggregate(53차 §5 locked invariant)는 무변경 — 본 보조 맵으로 분리 carry (회귀 표면 최소화).
 * degraded(⚪) ticker는 본 맵에 부재 → persist가 null 매핑.
 */
export const TickerCommentSchema = z.object({
  comment_kr: z.string(),
  conviction: z.number().min(0).max(100),
});
export type TickerComment = z.infer<typeof TickerCommentSchema>;

/**
 * Tier1ScreeningResult — PR2 deliverable.
 *
 * 30 selected (10/timeframe) + 120 notSelected = 150 total.
 * refine: counts 일관성 검증.
 *
 * PR-E: commentsByTicker (optional) — 성공 panel ticker별 AI 코멘트/conviction. 기존 refine 무영향.
 */
export const Tier1ScreeningResultSchema = z
  .object({
    selected: z.array(TickerAggregateSchema),
    notSelected: z.array(TickerAggregateSchema),
    selectionMeta: SelectionMetaSchema,
    commentsByTicker: z.record(z.string(), TickerCommentSchema).optional(),
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
  )
  // 53차 §5 reviewer omxy R5 BLOCKER 3 정정 박제 — selected ∩ notSelected = ∅ 보장.
  .refine(
    (v) => {
      const selSet = new Set(v.selected.map((a) => a.ticker));
      return v.notSelected.every((a) => !selSet.has(a.ticker));
    },
    { message: 'selected_and_notSelected_must_be_disjoint' }
  )
  // selected items는 assigned_by + assigned_timeframe 모두 non-null.
  .refine(
    (v) =>
      v.selected.every(
        (a) => a.assigned_by !== null && a.assigned_timeframe !== null
      ),
    { message: 'selected_must_have_assigned_metadata' }
  )
  // notSelected items는 assigned_by + assigned_timeframe 모두 null (선정 안 됨).
  .refine(
    (v) =>
      v.notSelected.every(
        (a) => a.assigned_by === null && a.assigned_timeframe === null
      ),
    { message: 'notSelected_must_have_null_assigned_metadata' }
  )
  // 53차 §5 reviewer omxy R6 BLOCKER 2 정정 박제 — selectionMeta count가 selected.assigned_timeframe 실 분포와 일치.
  .refine(
    (v) => {
      const shortActual = v.selected.filter((a) => a.assigned_timeframe === 'short').length;
      const midActual = v.selected.filter((a) => a.assigned_timeframe === 'mid').length;
      const longActual = v.selected.filter((a) => a.assigned_timeframe === 'long').length;
      return (
        v.selectionMeta.shortCount === shortActual &&
        v.selectionMeta.midCount === midActual &&
        v.selectionMeta.longCount === longActual
      );
    },
    { message: 'selectionMeta_counts_must_match_assigned_timeframe' }
  )
  // backfillCounts[tf] === selected.filter(backfill && assigned_timeframe===tf).length
  .refine(
    (v) => {
      const backfillByTf = (tf: Timeframe) =>
        v.selected.filter(
          (a) => a.assigned_by === 'backfill' && a.assigned_timeframe === tf
        ).length;
      return (
        v.selectionMeta.backfillCounts.short === backfillByTf('short') &&
        v.selectionMeta.backfillCounts.mid === backfillByTf('mid') &&
        v.selectionMeta.backfillCounts.long === backfillByTf('long')
      );
    },
    { message: 'selectionMeta_backfillCounts_must_match_assigned' }
  )
  // primary 선정은 assigned_timeframe === primary_timeframe.
  .refine(
    (v) =>
      v.selected.every(
        (a) => a.assigned_by !== 'primary' || a.assigned_timeframe === a.primary_timeframe
      ),
    { message: 'primary_assigned_timeframe_must_equal_primary_timeframe' }
  )
  // 53차 §5 reviewer omxy R7 BLOCKER 정정 박제 — 단기·중기·장기 각 10개 lock-in (Q1 §1.1) schema 보장.
  // shortCount=30/mid=0/long=0 corruption bypass 차단.
  .refine(
    (v) =>
      v.selectionMeta.shortCount === 10 &&
      v.selectionMeta.midCount === 10 &&
      v.selectionMeta.longCount === 10,
    { message: 'selectionMeta_timeframe_counts_must_be_10_each' }
  )
  // 53차 §5 reviewer omxy R7 optional 박제 — backfill row는 assigned_timeframe !== primary_timeframe 보장.
  // (생성 로직: ticker가 mid primary면 mid에 primary로 들어가지 backfill 안 됨.)
  .refine(
    (v) =>
      v.selected.every(
        (a) => a.assigned_by !== 'backfill' || a.assigned_timeframe !== a.primary_timeframe
      ),
    { message: 'backfill_assigned_timeframe_must_differ_from_primary' }
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
