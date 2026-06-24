import type { SupabaseClient } from '@supabase/supabase-js';

import { callPersona, type CallPersonaResult } from '@/lib/ai/anthropic-client';
import { getRoleWorstCaseMaxCostPerCallKrw } from '@/lib/ai/model-registry';
import { CORE_11_PERSONAS } from '@/lib/ai/prompts/personas';
import { acquireBatchLock, releaseBatchLock } from '@/lib/data/admin-batch-runs';
import { preflightHardcap } from '@/lib/cost/cost-logger';
import {
  type CanonicalSector,
  SECTOR_PERSONA_COUNT,
  resolveSlotTemplate,
} from '@/lib/screening/canonical-sectors';
import { assignBadge, isTopTier, type ConsensusBadge } from '@/lib/screening/consensus';
import {
  TIMEFRAMES,
  type Timeframe,
  type SelectionTrack,
  type PersonaScore,
  type TickerAggregate,
  type Tier1ScreeningResult,
  TRACK_TIMEFRAMES,
  TRACK_FRESH_POOL,
  TRACK_SELECT_COUNT,
  makeTier1ScreeningResultSchema,
  PersonaPanelSchema,
  assertPanelMatchesCore11,
  personaWeightFor,
} from '@/lib/screening/tier1-schema';
// TIER2_CALLS_PER_TICKER (25 = Core 11 + Sector 14) cost guard 상수는 canonical-sectors.ts에서 export.
// chair = Core 11 마지막 위원 (별도 추가 X — 본 PR scope 박제, OOS lift는 별도 PR).

export interface RunMonthlyPersonaEvalInput {
  month: string;
  tickers: string[];
  adminUserId: string;
  fetchFinancials: (ticker: string) => Promise<string>;
}

export interface PersonaEvalResult {
  byTicker: Record<string, CallPersonaResult[]>; // persona-major collected
  tier1AvailableByTicker: Record<string, boolean>;
  totalCalls: number;
}

export async function runMonthlyPersonaEval(
  input: RunMonthlyPersonaEvalInput
): Promise<PersonaEvalResult> {
  await acquireBatchLock(input.month);

  let callCountDone = 0;
  const byTicker: Record<string, CallPersonaResult[]> = {};
  const tier1Available: Record<string, boolean> = {};
  for (const t of input.tickers) {
    byTicker[t] = [];
    tier1Available[t] = true;
  }

  try {
    // preflight: 30 ticker × 11 persona = 330 reservations
    await preflightHardcap({
      month: input.month,
      callCount: input.tickers.length * CORE_11_PERSONAS.length,
    });

    // persona-major loop (11 outer sequential)
    for (const persona of CORE_11_PERSONAS) {
      const [warmTicker, ...rest] = input.tickers;
      if (!warmTicker) continue;

      const financials = await input.fetchFinancials(warmTicker);
      try {
        const warmResult = await callPersona({
          personaId: persona.id,
          ticker: warmTicker,
          financials,
          reflectionContext: '', // 첫달은 빈 문자열
          adminUserId: input.adminUserId,
        });
        byTicker[warmTicker].push(warmResult);
        callCountDone++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown';
        // W1a (D9): ai_call_failed:transient:* suffix 호환 — startsWith 매칭.
        if (msg === 'ai_key_unavailable' || msg.startsWith('ai_call_failed') || msg === 'ai_billing_exhausted') {
          tier1Available[warmTicker] = false;
        } else {
          throw err; // fatal
        }
      }

      // fan-out 29 tickers — Plan R2 BLOCKER 2: ticker 보존
      type FanoutItem =
        | { ticker: string; ok: true; result: CallPersonaResult }
        | { ticker: string; ok: false; error: unknown };
      const fanoutResults: FanoutItem[] = await Promise.all(
        rest.map(async (ticker): Promise<FanoutItem> => {
          try {
            const f = await input.fetchFinancials(ticker);
            const result = await callPersona({
              personaId: persona.id,
              ticker,
              financials: f,
              reflectionContext: '',
              adminUserId: input.adminUserId,
            });
            return { ticker, ok: true, result };
          } catch (err) {
            return { ticker, ok: false, error: err };
          }
        })
      );

      for (const item of fanoutResults) {
        if (item.ok) {
          byTicker[item.ticker].push(item.result);
          callCountDone++;
        } else {
          const msg = item.error instanceof Error ? item.error.message : 'unknown';
          if (['ai_key_unavailable', 'ai_billing_exhausted'].includes(msg) || msg.startsWith('ai_call_failed')) {
            tier1Available[item.ticker] = false; // ⚪ 대상 명시 (BLOCKER 2 해소)
          } else {
            throw item.error;
          }
        }
      }
    }

    await releaseBatchLock({
      month: input.month,
      status: 'succeeded',
      callCountDone,
    });

    return {
      byTicker,
      tier1AvailableByTicker: tier1Available,
      totalCalls: callCountDone,
    };
  } catch (err) {
    const errorCode = err instanceof Error ? err.message : 'unknown';
    await releaseBatchLock({
      month: input.month,
      status: 'failed',
      callCountDone,
      errorCode,
    });
    throw err;
  }
}

// Tier 2 implementation (52차 D21) — Sector Board 14 personas per-ticker orchestration.
// SoT = ServicePlan-Admin §1A.5 D21 + ReportFramework §7.2/§7.3 v2.5 + 마이그 0019.
// omxy R1~R3 CONVERGED + 4 acceptance details (R3 acc#4: degraded semantics — RPC 호출 자체 skip).
//
// 본 함수는 per-ticker callable scaffold. caller wiring (cron/admin action 통합)은 별도 PR (R1 #7 OOS).
// production sector persona prompts (@/lib/ai/prompts/personas SECTOR_*) 는 후속 PR에서 정의.
// 본 PR 시점에는 mock fixture로만 동작 (mock-admin-committee-personas.ts 14×14 stub).

export interface RunSectorEvalInput {
  month: string;
  ticker: string;
  sector: CanonicalSector;
  sub_tags?: readonly string[];
  adminUserId: string;
  fetchFinancials: (ticker: string) => Promise<string>;
  // PR-T2a (Tier 2 → live 리포트 cron 경로) — service-role cost DI. 미지정 시 admin 경로 무회귀.
  //   present 시: preflight(callerKind:'service-role') + callPersona(costClient + costLogMonth=report month).
  costClient?: SupabaseClient;
}

export interface SectorEvalResult {
  ticker: string;
  sector: CanonicalSector;
  personaIds: string[];                    // length SECTOR_PERSONA_COUNT (14), slot 1~14 순서
  results: CallPersonaResult[];            // 성공 call results (length 0~14)
  available: boolean;                      // ALL 14 성공 시만 true (R2 B1 degraded semantic)
  degradedCount: number;                   // 실패 call count (0~14)
  totalCalls: number;                      // 성공 call count
}

/**
 * Sector Board 14 personas per-ticker eval.
 *
 * caller 책임 (omxy R2 B1 + R3 acc#4 박제):
 *   - 본 함수 호출 전 Core 11 (runMonthlyPersonaEval)이 ticker 성공 처리되어 있어야 함 (Core가 stock_reports row 생성)
 *   - available=false 시 commitSectorReport 호출 금지 (DB 오염 0)
 *   - tier2AvailableByTicker 영속 표시는 OOS — 본 함수 반환값만 사용
 *
 * sector persona ID 패턴: `sector-{sector}-slot-{slotIndex 1~14}`
 * production prompts (@/lib/ai/prompts/personas)에 sector 196 stub 정의 미존재 시 callPersona가
 * `unknown_persona_id:...` throw → 본 함수가 degradedCount++로 처리.
 */
export async function runSectorEval(input: RunSectorEvalInput): Promise<SectorEvalResult> {
  // R3 acc#3 cost guard: preflight 14 calls. PR-T2b model-aware — sector personas는 callPersona 기본
  //   resolveRole('tier1_panel') 사용(modelBinding 미지정)이라 동일 role worst-case 단가로 reservation.
  //   PR-T2a: costClient present(cron) 시 service-role cost 조회, 미지정 시 admin session(무회귀).
  await preflightHardcap(
    {
      month: input.month,
      callCount: SECTOR_PERSONA_COUNT,
      maxCostPerCallKrw: getRoleWorstCaseMaxCostPerCallKrw('tier1_panel'),
    },
    input.costClient ? { client: input.costClient, callerKind: 'service-role' } : {},
  );

  const slotTemplate = resolveSlotTemplate(input.sector, input.sub_tags ?? []);
  // 53차+: slot 13/14에서 sub_tag 매칭된 경우만 personaId에 sub_tag encode (dynamic resolution).
  // Pattern (기존 52차 박제와 backwards-compat — slot 1~12 + slot 13/14 no-match 그대로):
  //   slot 1~12 + slot 13/14 (no sub_tag match): `sector-${sector}-slot-${idx}` (= backup)
  //   slot 13~14 (sub_tag matched): `sector-${sector}-slot-${idx}-subtag-${subTag}`
  const personaIds = slotTemplate.map((slot) => {
    const base = `sector-${input.sector}-slot-${slot.slot_index}`;
    if (slot.slot_type === "sub_tag_overlay" && slot.sub_tag !== undefined) {
      return `${base}-subtag-${slot.sub_tag}`;
    }
    return base;
  });

  const financials = await input.fetchFinancials(input.ticker);

  // Parallel 14 calls — R1 #1 cost spike 750/month 분산
  type FanoutItem =
    | { ok: true; result: CallPersonaResult }
    | { ok: false; error: unknown };

  const fanoutResults: FanoutItem[] = await Promise.all(
    personaIds.map(async (personaId): Promise<FanoutItem> => {
      try {
        const result = await callPersona({
          personaId,
          ticker: input.ticker,
          financials,
          reflectionContext: '',
          adminUserId: input.adminUserId,
          // PR-T2a: cron 경로(costClient present)는 service-role cost insert + report month 정합.
          //   admin 경로(undefined)는 callPersona 기본(session client + UTC-now month) 무회귀.
          costClient: input.costClient,
          costLogMonth: input.costClient ? input.month : undefined,
        });
        return { ok: true, result };
      } catch (err) {
        return { ok: false, error: err };
      }
    }),
  );

  const results: CallPersonaResult[] = [];
  let degradedCount = 0;
  for (const item of fanoutResults) {
    if (item.ok) {
      results.push(item.result);
    } else {
      const msg = item.error instanceof Error ? item.error.message : 'unknown';
      // ai_key_unavailable / ai_call_failed / ai_billing_exhausted / unknown_persona_id (production prompts 부재)
      // 모두 degraded로 처리. fatal은 throw.
      if (
        msg === 'ai_key_unavailable' ||
        msg.startsWith('ai_call_failed') ||
        msg === 'ai_billing_exhausted' ||
        msg.startsWith('unknown_persona_id:')
      ) {
        degradedCount++;
      } else {
        throw item.error; // fatal — non-network/non-prompt 오류는 caller에 전파
      }
    }
  }

  const available = degradedCount === 0 && results.length === SECTOR_PERSONA_COUNT;

  return {
    ticker: input.ticker,
    sector: input.sector,
    personaIds,
    results,
    available,
    degradedCount,
    totalCalls: results.length,
  };
}

// ============================================================================
// PR2 — Tier 1 AI 30 선정 screening (53차 §5 lock-in, omxy R1~R4 CONVERGED).
//
// SoT:
// - docs/superpowers/specs/2026-05-21-shortlist-report-flow-correction.md §1.1
// - docs/superpowers/plans/2026-05-21-pr2-tier1-screening.md
//
// Scope purity (PR2 박제):
//   ✅ in-memory screening logic only.
//   ❌ DB write · cron wire · UI wire · writer touch · backlog table (PR1/PR3a/PR3b/PR4로 분리).
//
// PR3b 권장: sector_reference_backlog DB table 도입 (referenceCoverage metadata SoT).
// ============================================================================

export interface Tier1Candidate {
  ticker: string;
  sector: CanonicalSector | null;
  tier0_buckets: { short: boolean; mid: boolean; long: boolean };
  /**
   * Tier 0 raw score per timeframe (higher = better).
   * null = ticker is NOT a Tier 0 candidate in that timeframe.
   */
  tier0_scores: { short: number | null; mid: number | null; long: number | null };
}

export interface RunTier1ScreeningInput {
  /**
   * W2a — 선정 트랙. short = 단기(주간, 활성 timeframe ['short'], 후보 50 → 10 selected) /
   * midlong = 중장기(월간, 활성 timeframe ['mid','long'], 후보 100 → 20 selected).
   */
  track: SelectionTrack;
  /**
   * 트랙별 fresh 후보 풀. short=50(전부 bucket short) / midlong=100(mid 50 + long 50).
   * 53차 §5 reviewer CR-02 정정 박제: ticker 중복 시 함수가 entry에서 throw —
   * caller (W2a worker) Tier 0 union 시 dedup 책임. tier0_buckets 다중 true는 dedup 후 단일 row로 표현.
   */
  candidates: Tier1Candidate[];
  /**
   * 단일 ticker × Core 11 페르소나 panel call. 반환은 11 PersonaScore (timeframe별 score map 포함).
   * 실제 LLM 호출 wire는 caller scope (PR1 cron 또는 PR4 UI trigger).
   * Promise reject 시 본 함수가 settled 처리 → tier1AvailableByTicker[ticker]=false로 자동 fallback.
   */
  callPersonaPanel: (input: {
    ticker: string;
    financials: string;
    /** W2b (D27 Q5) — incumbent thesis context per-call 주입. 미지정 = 비-incumbent. */
    reflectionContext?: string;
  }) => Promise<PersonaScore[]>;
  fetchFinancials: (ticker: string) => Promise<string>;
  promptVersionId: string;
  personasVersionId: string;
  /**
   * 선택적 per-ticker tier1 availability override (53차 §5 reviewer WR-02 정정 박제 — caller seam).
   * 미지정 ticker는 default true. callPersonaPanel reject 발생 시 본 함수가 자동 false로 표시 (settled handling).
   * PR1 wire 시 degraded ticker (LLM 키 미발급/billing 소진 등)를 caller가 사전 false로 명시 가능.
   */
  tier1AvailableByTicker?: Readonly<Record<string, boolean>>;
  /**
   * W1b (D28 ③ / D4) — per-ticker 최종 judge 점수 (debate_judge verdict).
   * 주입 ticker는 weighted_scores = judge 점수(최종 SoT), 미주입/degraded는 기존 결정론 consensus fallback.
   * available=false(⚪)는 judge 있어도 ⚪ 유지 (degraded 우선).
   */
  judgeScoresByTicker?: Readonly<Record<string, Record<Timeframe, number>>>;
}

const BADGE_PRIORITY: Record<ConsensusBadge, number> = {
  '🟢': 4,
  '🔵': 3,
  '🟣': 2,
  '🟡': 1,
  '⚪': 0,
};

// W1a (D3) — debate-round.computeR2Targets가 소비 (export 승격, 시그니처 무변경).
export function computeWeightedScores(personas: PersonaScore[]): Record<Timeframe, number> {
  const result: Record<Timeframe, number> = { short: 0, mid: 0, long: 0 };
  for (const tf of TIMEFRAMES) {
    let weightedSum = 0;
    let weightTotal = 0;
    for (const p of personas) {
      const w = personaWeightFor(p.persona_id, tf);
      weightedSum += w * p.scores[tf];
      weightTotal += w;
    }
    result[tf] = weightTotal > 0 ? weightedSum / weightTotal : 0;
  }
  return result;
}

function argmaxTimeframe(scores: Record<Timeframe, number>): Timeframe {
  // Deterministic tie-break: short > mid > long (TIMEFRAMES 선언 순서).
  if (scores.short >= scores.mid && scores.short >= scores.long) return 'short';
  if (scores.mid >= scores.long) return 'mid';
  return 'long';
}

function computeTier0Ranks(candidates: Tier1Candidate[]): Record<Timeframe, Map<string, number>> {
  const out: Record<Timeframe, Map<string, number>> = {
    short: new Map(),
    mid: new Map(),
    long: new Map(),
  };
  for (const tf of TIMEFRAMES) {
    const scored = candidates
      .filter((c) => c.tier0_scores[tf] != null)
      .map((c) => ({ ticker: c.ticker, score: c.tier0_scores[tf] as number }));
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.ticker.localeCompare(b.ticker);
    });
    scored.forEach((c, i) => out[tf].set(c.ticker, i + 1));
  }
  return out;
}

/**
 * Rank tickers per timeframe by `weighted_scores[tf]` desc, ticker alphabetical tie-break.
 * Generic over any record carrying `ticker` + `weighted_scores` (TickerAggregate / partial).
 */
function computeTier1Ranks(
  rows: ReadonlyArray<{ ticker: string; weighted_scores: Record<Timeframe, number> }>
): Record<Timeframe, Map<string, number>> {
  const out: Record<Timeframe, Map<string, number>> = {
    short: new Map(),
    mid: new Map(),
    long: new Map(),
  };
  for (const tf of TIMEFRAMES) {
    const sorted = [...rows].sort((a, b) => {
      if (b.weighted_scores[tf] !== a.weighted_scores[tf]) {
        return b.weighted_scores[tf] - a.weighted_scores[tf];
      }
      return a.ticker.localeCompare(b.ticker);
    });
    sorted.forEach((c, i) => out[tf].set(c.ticker, i + 1));
  }
  return out;
}

// W2a — production Tier1 per-timeframe ranking comparator (weighted_score desc · badge priority desc ·
// ticker asc). Track 1 forward-shadow(shadow-harness-arms.ts)가 counterfactual 재정렬에 **동일 객체**로
// 재사용한다 (additive export — runTier1Screening 동작/시그니처 불변, I-3 유지). 재구현 금지(drift 차단).
export function compareForTimeframe(a: TickerAggregate, b: TickerAggregate, tf: Timeframe): number {
  if (a.weighted_scores[tf] !== b.weighted_scores[tf]) {
    return b.weighted_scores[tf] - a.weighted_scores[tf];
  }
  const aBadge = BADGE_PRIORITY[a.consensus_badges_by_timeframe[tf]];
  const bBadge = BADGE_PRIORITY[b.consensus_badges_by_timeframe[tf]];
  if (aBadge !== bBadge) return bBadge - aBadge;
  return a.ticker.localeCompare(b.ticker);
}

/**
 * Tier 1 AI 트랙별 선정 screening (W2a Task 3 — track 파라미터화).
 *
 * 알고리즘 (5-step, omxy R4 lock-in, 트랙 활성 timeframe subset에 일반화):
 *   1. N candidates × callPersonaPanel = N panel calls (Core 11 페르소나 score matrix).
 *      short: N=50 / midlong: N=100. (count는 caller가 enqueue 수로 보장; 여기선 distinct + 트랙 pool 길이만 강하게 검증, 최종 정합은 schema가 검증.)
 *   2. server-side aggregate: timeframe별 페르소나 가중치 적용 (단 Druckenmiller/Burry 1.5x · 중 Lynch 1.5x · 장 Buffett/Munger/Fisher/Pabrai 1.5x).
 *   3. primary_timeframe = argmax(weighted_scores) (전 timeframe 대상 — ticker 본질적 timeframe).
 *   4. **트랙 활성 timeframe**(TRACK_TIMEFRAMES[track])별 primary 후보를 (weighted_score, badge, ticker) 순으로 정렬해 최대 10개 선발.
 *   5. <10 활성 timeframe은 **트랙 활성 tf의 global unselected pool 내에서만** 해당 timeframe score 내림차순으로 backfill (cross-track 차용 금지).
 *
 * 반환: short=10 selected + 40 notSelected / midlong=20 selected + 80 notSelected + selectionMeta (counts + version id + generatedAt).
 *
 * scope purity: in-memory only. DB write 0. caller responsibility (W2a worker):
 *   - cost_log INSERT
 *   - short_list_30 row persist (assigned_by/version_id 컬럼 마이그)
 *   - acquireBatchLock / releaseBatchLock
 *   - preflightHardcap
 */
export async function runTier1Screening(
  input: RunTier1ScreeningInput
): Promise<Tier1ScreeningResult> {
  const { track } = input;
  // W2b (D27 Q5) — pool 동적화: fresh(TRACK_FRESH_POOL) ∪ incumbent-only(≤TRACK_SELECT_COUNT).
  // fresh 정확 count는 caller(worker)가 union 전에 보장. 여기는 range + distinct만 강하게,
  // 최종 count 정합은 makeTier1ScreeningResultSchema(track, candidates.length)가 검증.
  const minPool = TRACK_FRESH_POOL[track];
  const maxPool = minPool + TRACK_SELECT_COUNT[track];
  if (input.candidates.length < minPool || input.candidates.length > maxPool) {
    throw new Error(
      `tier1_candidates_pool_out_of_range:${track}:${input.candidates.length}`
    );
  }
  // 53차 §5 reviewer CR-02 정정 박제 — duplicate ticker silent corruption 차단.
  const distinctTickers = new Set(input.candidates.map((c) => c.ticker));
  if (distinctTickers.size !== input.candidates.length) {
    throw new Error(
      `tier1_candidates_have_duplicate_tickers (distinct=${distinctTickers.size}/${input.candidates.length})`
    );
  }
  const activeBuckets = new Set<Timeframe>(TRACK_TIMEFRAMES[track]);
  for (const c of input.candidates) {
    const buckets = TIMEFRAMES.filter((tf) => c.tier0_buckets[tf]);
    if (buckets.length !== 1 || !activeBuckets.has(buckets[0])) {
      throw new Error(
        `tier1_candidates_track_bucket_impurity:${track}:${c.ticker}:${buckets.join(',') || 'none'}`
      );
    }
  }

  const generatedAt = new Date().toISOString();

  // 1. Call panel for each ticker (settled — 53차 §5 reviewer WR-03 정정 박제).
  // 단일 ticker fail이 batch 전체 reject 시키지 않도록 allSettled. concurrency cap은 callPersonaPanel
  // 구현측 책임 (PR1 wiring 시 결정 — Anthropic rate limit / DART quota 고려).
  type EnrichedItem = { candidate: Tier1Candidate; personaScores: PersonaScore[] | null };
  const enrichedSettled = await Promise.allSettled(
    input.candidates.map(async (c): Promise<EnrichedItem> => {
      const financials = await input.fetchFinancials(c.ticker);
      const raw = await input.callPersonaPanel({ ticker: c.ticker, financials });
      // 53차 §5 reviewer omxy R5 BLOCKER 2 + R6 BLOCKER 1 정정 박제 — runtime panel validation.
      // PersonaPanelSchema: length=11 + unique persona_id.
      // assertPanelMatchesCore11: exact set equality vs production CORE_11_PERSONAS (unknown/sector id 차단).
      // 위반 시 throw → Promise.allSettled catch → null fallback → ⚪ 자동.
      const personaScores = PersonaPanelSchema.parse(raw);
      assertPanelMatchesCore11(
        personaScores,
        CORE_11_PERSONAS.map((p) => p.id)
      );
      return { candidate: c, personaScores };
    })
  );
  const enriched: EnrichedItem[] = enrichedSettled.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    return { candidate: input.candidates[i], personaScores: null };
  });

  // 2. Compute weighted_scores + primary_timeframe per ticker (53차 §5 reviewer WR-05 immutable build).
  const ZERO_SCORES: Record<Timeframe, number> = { short: 0, mid: 0, long: 0 };
  type EnrichedAggregate = {
    ticker: string;
    sector: TickerAggregate['sector'];
    weighted_scores: Record<Timeframe, number>;
    primary_timeframe: Timeframe;
    available: boolean;
  };
  const partial: EnrichedAggregate[] = enriched.map((e) => {
    if (e.personaScores === null) {
      // Degraded ticker — Tier 1 unavailable. weighted_scores=0 (lowest), primary=short (deterministic).
      return {
        ticker: e.candidate.ticker,
        sector: e.candidate.sector,
        weighted_scores: ZERO_SCORES,
        primary_timeframe: 'short' as Timeframe,
        available: false,
      };
    }
    const overrideAvail = input.tier1AvailableByTicker?.[e.candidate.ticker];
    const available = overrideAvail !== undefined ? overrideAvail : true;
    // 53차 §5 reviewer omxy R5 Warning 정정 박제 — degraded ticker는 selection ranking에서도 제외
    // (badge ⚪뿐 아니라 weighted_score zero → 자연스럽게 ranking 하위). caller가 unavailable 명시 시
    // Tier 1 데이터 신뢰 불가 → score 사용 금지 (전체 일관성: panel fail 케이스와 동일 처리).
    if (!available) {
      return {
        ticker: e.candidate.ticker,
        sector: e.candidate.sector,
        weighted_scores: ZERO_SCORES,
        primary_timeframe: 'short' as Timeframe,
        available: false,
      };
    }
    // W1b (D4) — judge verdict 있으면 최종 점수 SoT로 대체 (consensus는 fallback).
    const judge = input.judgeScoresByTicker?.[e.candidate.ticker];
    const weighted = judge ?? computeWeightedScores(e.personaScores);
    const primary_timeframe = argmaxTimeframe(weighted);
    return {
      ticker: e.candidate.ticker,
      sector: e.candidate.sector,
      weighted_scores: weighted,
      primary_timeframe,
      available: true,
    };
  });

  // PR-E (ADR D-7) — per-ticker AI 코멘트/conviction (카드 산출물). available(non-⚪) ticker만.
  //   comment_kr = panel 최고-conviction persona rationale_kr (tie-break persona_id asc, 결정적).
  //   conviction = panel 11명 평균 (0~100, 소수 2자리 반올림).
  // TickerAggregate(locked) 무변경 — 별도 보조 맵으로 carry (Tier1ScreeningResult.commentsByTicker).
  const availableByTicker = new Map(partial.map((p) => [p.ticker, p.available]));
  const commentsByTicker: Record<string, { comment_kr: string; conviction: number }> = {};
  for (const e of enriched) {
    if (e.personaScores === null) continue;
    if (!availableByTicker.get(e.candidate.ticker)) continue; // override-false 제외
    const scores = e.personaScores;
    const avgConviction =
      scores.reduce((sum, p) => sum + p.conviction, 0) / scores.length;
    const top = scores.reduce((best, p) =>
      p.conviction > best.conviction ||
      (p.conviction === best.conviction && p.persona_id < best.persona_id)
        ? p
        : best,
    );
    commentsByTicker[e.candidate.ticker] = {
      comment_kr: top.rationale_kr,
      conviction: Math.round(avgConviction * 100) / 100,
    };
  }

  // 3. Compute consensus badges per timeframe (Tier 0 + Tier 1 ranking) — immutable aggregate build.
  const tier0Ranks = computeTier0Ranks(input.candidates);
  const tier1Ranks = computeTier1Ranks(partial);

  const aggregates: TickerAggregate[] = partial.map((p) => {
    const badges: Record<Timeframe, ConsensusBadge> = { short: '⚪', mid: '⚪', long: '⚪' };
    for (const tf of TIMEFRAMES) {
      const t0Rank = tier0Ranks[tf].get(p.ticker);
      const t0Total = tier0Ranks[tf].size;
      const tier0IsTop = t0Rank != null && t0Total > 0 && isTopTier(t0Rank, t0Total);

      const t1Rank = tier1Ranks[tf].get(p.ticker);
      const t1Total = tier1Ranks[tf].size;
      const tier1IsTop = t1Rank != null && t1Total > 0 && isTopTier(t1Rank, t1Total);

      badges[tf] = assignBadge({
        tier1Available: p.available,
        tier0IsTop,
        tier1IsTop,
      });
    }
    // assigned_by + assigned_timeframe은 selection 단계에서 set (selected) / notSelected는 null 유지.
    return {
      ticker: p.ticker,
      sector: p.sector,
      weighted_scores: p.weighted_scores,
      primary_timeframe: p.primary_timeframe,
      consensus_badges_by_timeframe: badges,
      assigned_by: null,
      assigned_timeframe: null,
      prompt_version_id: input.promptVersionId,
      personas_version_id: input.personasVersionId,
    };
  });

  // W2a — 트랙 활성 timeframe subset. short=['short'] / midlong=['mid','long'].
  // step 4~6은 전 TIMEFRAMES가 아닌 활성 tf만 순회 (cross-track 차용 금지).
  const activeTfs = TRACK_TIMEFRAMES[track];

  // 4. Group by primary_timeframe + select top 10 per **active** timeframe.
  // primary_timeframe은 전 timeframe argmax (ticker 본질). 활성 tf가 primary가 아니면
  // 해당 ticker는 unselected pool로 흘러가 backfill 후보가 된다.
  const byPrimary: Record<Timeframe, TickerAggregate[]> = { short: [], mid: [], long: [] };
  for (const agg of aggregates) byPrimary[agg.primary_timeframe].push(agg);

  const primarySelected: Record<Timeframe, TickerAggregate[]> = {
    short: [],
    mid: [],
    long: [],
  };
  for (const tf of activeTfs) {
    byPrimary[tf].sort((a, b) => compareForTimeframe(a, b, tf));
    primarySelected[tf] = byPrimary[tf].slice(0, 10);
  }

  // 5. Backfill active timeframes with <10 from global unselected pool (활성 tf 내에서만).
  // pool 정렬은 활성 timeframe별 재정렬 + splice 누적 — activeTfs 선언 순서(short / mid→long) 박제.
  const primaryTickers = new Set(
    activeTfs.flatMap((tf) => primarySelected[tf]).map((a) => a.ticker)
  );
  const pool: TickerAggregate[] = aggregates.filter((a) => !primaryTickers.has(a.ticker));

  const backfillCounts: Record<Timeframe, number> = { short: 0, mid: 0, long: 0 };
  const backfilled: Record<Timeframe, TickerAggregate[]> = { short: [], mid: [], long: [] };
  for (const tf of activeTfs) {
    const needed = 10 - primarySelected[tf].length;
    if (needed <= 0) continue;
    pool.sort((a, b) => compareForTimeframe(a, b, tf));
    const taken = pool.splice(0, needed);
    backfilled[tf] = taken;
    backfillCounts[tf] = taken.length;
  }

  // 6. Assemble selected[] ordered by active timeframe (short / mid→long).
  // selected items: assigned_by + assigned_timeframe 모두 non-null로 set.
  // assigned_timeframe = primary면 primary_timeframe, backfill이면 채워진 (활성) timeframe (tf).
  const selected: TickerAggregate[] = [];
  for (const tf of activeTfs) {
    for (const a of primarySelected[tf]) {
      selected.push({ ...a, assigned_by: 'primary', assigned_timeframe: tf });
    }
    for (const a of backfilled[tf]) {
      selected.push({ ...a, assigned_by: 'backfill', assigned_timeframe: tf });
    }
  }

  // notSelected items: assigned_by + assigned_timeframe 모두 null 유지 (aggregates 초기값).
  const selectedTickers = new Set(selected.map((a) => a.ticker));
  const notSelected = aggregates.filter((a) => !selectedTickers.has(a.ticker));

  const result: Tier1ScreeningResult = {
    selected,
    notSelected,
    selectionMeta: {
      shortCount: primarySelected.short.length + backfilled.short.length,
      midCount: primarySelected.mid.length + backfilled.mid.length,
      longCount: primarySelected.long.length + backfilled.long.length,
      backfillCounts,
      promptVersionId: input.promptVersionId,
      personasVersionId: input.personasVersionId,
      generatedAt,
    },
    commentsByTicker,
  };

  // W2a — 트랙별 schema factory로 최종 검증 (count/disjoint/active-tf purity 등 트랙별 동등 강도).
  return makeTier1ScreeningResultSchema(track, input.candidates.length).parse(result);
}
