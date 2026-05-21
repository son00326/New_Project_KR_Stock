import { callPersona, type CallPersonaResult } from '@/lib/ai/anthropic-client';
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
  type PersonaScore,
  type TickerAggregate,
  type Tier1ScreeningResult,
  Tier1ScreeningResultSchema,
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
        if (msg === 'ai_key_unavailable' || msg === 'ai_call_failed' || msg === 'ai_billing_exhausted') {
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
          if (['ai_key_unavailable', 'ai_call_failed', 'ai_billing_exhausted'].includes(msg)) {
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
  // R3 acc#3 cost guard: preflight 14 calls (TIER2_CALLS_PER_TICKER에서 Core 11 부분은 caller가 별도 계산)
  await preflightHardcap({
    month: input.month,
    callCount: SECTOR_PERSONA_COUNT,
  });

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
        msg === 'ai_call_failed' ||
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
   * 150 candidates = Tier 0 short top 50 + mid top 50 + long top 50.
   * 한 ticker가 여러 bucket에 포함될 수 있음 (caller normalize 책임 — 본 함수는 ticker 중복 검사 X).
   */
  candidates: Tier1Candidate[];
  /**
   * 단일 ticker × Core 11 페르소나 panel call. 반환은 11 PersonaScore (timeframe별 score map 포함).
   * 실제 LLM 호출 wire는 caller scope (PR1 cron 또는 PR4 UI trigger).
   */
  callPersonaPanel: (input: { ticker: string; financials: string }) => Promise<PersonaScore[]>;
  fetchFinancials: (ticker: string) => Promise<string>;
  promptVersionId: string;
  personasVersionId: string;
}

const BADGE_PRIORITY: Record<ConsensusBadge, number> = {
  '🟢': 4,
  '🔵': 3,
  '🟣': 2,
  '🟡': 1,
  '⚪': 0,
};

function computeWeightedScores(personas: PersonaScore[]): Record<Timeframe, number> {
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

function computeTier1Ranks(aggregates: TickerAggregate[]): Record<Timeframe, Map<string, number>> {
  const out: Record<Timeframe, Map<string, number>> = {
    short: new Map(),
    mid: new Map(),
    long: new Map(),
  };
  for (const tf of TIMEFRAMES) {
    const sorted = [...aggregates].sort((a, b) => {
      if (b.weighted_scores[tf] !== a.weighted_scores[tf]) {
        return b.weighted_scores[tf] - a.weighted_scores[tf];
      }
      return a.ticker.localeCompare(b.ticker);
    });
    sorted.forEach((c, i) => out[tf].set(c.ticker, i + 1));
  }
  return out;
}

function compareForTimeframe(a: TickerAggregate, b: TickerAggregate, tf: Timeframe): number {
  if (a.weighted_scores[tf] !== b.weighted_scores[tf]) {
    return b.weighted_scores[tf] - a.weighted_scores[tf];
  }
  const aBadge = BADGE_PRIORITY[a.consensus_badges_by_timeframe[tf]];
  const bBadge = BADGE_PRIORITY[b.consensus_badges_by_timeframe[tf]];
  if (aBadge !== bBadge) return bBadge - aBadge;
  return a.ticker.localeCompare(b.ticker);
}

/**
 * Tier 1 AI 30 선정 screening (PR2 deliverable).
 *
 * 알고리즘 (5-step, omxy R4 lock-in):
 *   1. 150 candidates × callPersonaPanel = 150 panel calls (Core 11 페르소나 score matrix).
 *   2. server-side aggregate: timeframe별 페르소나 가중치 적용 (단 Druckenmiller/Burry 1.5x · 중 Lynch 1.5x · 장 Buffett/Munger/Fisher/Pabrai 1.5x).
 *   3. primary_timeframe = argmax(weighted_scores).
 *   4. timeframe별 primary 후보를 (weighted_score, badge, ticker) 순으로 정렬해 최대 10개 선발.
 *   5. <10 timeframe은 global unselected pool에서 해당 timeframe score 내림차순으로 backfill (short → mid → long 순).
 *
 * 반환: 30 selected + 120 notSelected + selectionMeta (counts + version id + generatedAt).
 *
 * scope purity: in-memory only. DB write 0. caller responsibility (PR1):
 *   - cost_log INSERT
 *   - short_list_30 row persist (assigned_by/version_id 컬럼 마이그)
 *   - acquireBatchLock / releaseBatchLock
 *   - preflightHardcap
 */
export async function runTier1Screening(
  input: RunTier1ScreeningInput
): Promise<Tier1ScreeningResult> {
  if (input.candidates.length !== 150) {
    throw new Error(`tier1_candidates_must_be_150 (got ${input.candidates.length})`);
  }

  const generatedAt = new Date().toISOString();

  // 1. Call panel for each ticker (parallel)
  const enriched = await Promise.all(
    input.candidates.map(async (c) => {
      const financials = await input.fetchFinancials(c.ticker);
      const personaScores = await input.callPersonaPanel({ ticker: c.ticker, financials });
      return { candidate: c, personaScores };
    })
  );

  // 2. Compute weighted_scores + primary_timeframe per ticker
  const aggregates: TickerAggregate[] = enriched.map((e) => {
    const weighted = computeWeightedScores(e.personaScores);
    const primary_timeframe = argmaxTimeframe(weighted);
    return {
      ticker: e.candidate.ticker,
      sector: e.candidate.sector,
      weighted_scores: weighted,
      primary_timeframe,
      // Placeholder — overwritten in step 3.
      consensus_badges_by_timeframe: { short: '⚪', mid: '⚪', long: '⚪' },
      assigned_by: 'primary' as const,
      prompt_version_id: input.promptVersionId,
      personas_version_id: input.personasVersionId,
    };
  });

  // 3. Compute consensus badges per timeframe (Tier 0 + Tier 1 ranking)
  const tier0Ranks = computeTier0Ranks(input.candidates);
  const tier1Ranks = computeTier1Ranks(aggregates);

  for (const agg of aggregates) {
    for (const tf of TIMEFRAMES) {
      const t0Rank = tier0Ranks[tf].get(agg.ticker);
      const t0Total = tier0Ranks[tf].size;
      const tier0IsTop = t0Rank != null && t0Total > 0 && isTopTier(t0Rank, t0Total);

      const t1Rank = tier1Ranks[tf].get(agg.ticker);
      const t1Total = tier1Ranks[tf].size;
      const tier1IsTop = t1Rank != null && t1Total > 0 && isTopTier(t1Rank, t1Total);

      // PR2 scope 박제: Tier 1 always available (caller responsibility — PR1 wire).
      // PR1 wiring 시 degraded ticker는 tier1Available=false 전달해야 ⚪ 배지 산출.
      agg.consensus_badges_by_timeframe[tf] = assignBadge({
        tier1Available: true,
        tier0IsTop,
        tier1IsTop,
      });
    }
  }

  // 4. Group by primary_timeframe + select top 10 per timeframe
  const byPrimary: Record<Timeframe, TickerAggregate[]> = { short: [], mid: [], long: [] };
  for (const agg of aggregates) byPrimary[agg.primary_timeframe].push(agg);

  const primarySelected: Record<Timeframe, TickerAggregate[]> = {
    short: [],
    mid: [],
    long: [],
  };
  for (const tf of TIMEFRAMES) {
    byPrimary[tf].sort((a, b) => compareForTimeframe(a, b, tf));
    primarySelected[tf] = byPrimary[tf].slice(0, 10);
  }

  // 5. Backfill timeframes with <10 from global unselected pool
  const primaryTickers = new Set(
    [
      ...primarySelected.short,
      ...primarySelected.mid,
      ...primarySelected.long,
    ].map((a) => a.ticker)
  );
  const pool: TickerAggregate[] = aggregates.filter((a) => !primaryTickers.has(a.ticker));

  const backfillCounts: Record<Timeframe, number> = { short: 0, mid: 0, long: 0 };
  const backfilled: Record<Timeframe, TickerAggregate[]> = { short: [], mid: [], long: [] };
  for (const tf of TIMEFRAMES) {
    const needed = 10 - primarySelected[tf].length;
    if (needed <= 0) continue;
    pool.sort((a, b) => compareForTimeframe(a, b, tf));
    const taken = pool.splice(0, needed);
    backfilled[tf] = taken;
    backfillCounts[tf] = taken.length;
  }

  // 6. Assemble selected[] ordered [short top10, mid top10, long top10]
  const selected: TickerAggregate[] = [];
  for (const tf of TIMEFRAMES) {
    for (const a of primarySelected[tf]) {
      selected.push({ ...a, assigned_by: 'primary' });
    }
    for (const a of backfilled[tf]) {
      selected.push({ ...a, assigned_by: 'backfill' });
    }
  }

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
  };

  return Tier1ScreeningResultSchema.parse(result);
}
