// PR1 — runMonthlyBatchOrchestrator
// 53차 §5 spec + plan v8 (omxy R1~R8 CONVERGED, 20 BLOCKERS catch & fix)
//
// 책임: batch lock acquire → Tier 0 union (caller-provided source) → runTier1Screening
//      → persist (short_list_30) → degraded ⚪ commit_badge_only → release lock.
//      모든 I/O는 DI (8 fields). 본 모듈은 pure orchestration.
//
// B3 lesson (omxy R1): runTier1Screening은 Promise.allSettled 패턴 — 모든 panel call reject 시에도
// 30 selected ⚪ degraded success 반환. throw는 candidates invariant (length≠150 / duplicate / zod) 한정.
//
// B5 fix (omxy R1): badge-only commit은 ticker의 assigned_timeframe badge가 ⚪인 경우만.
//
// B2 fix (omxy R1): catch 분기에서 recordSchedulerFailAlert 먼저, release failed 다음, throw propagate.
import {
  runTier1Screening,
  type Tier1Candidate,
} from './persona-eval';
import type { PersonaScore, Tier1ScreeningResult } from './tier1-schema';

export interface OrchestratorLock {
  acquire: (month: string) => Promise<{ acquired: boolean; resumed: boolean }>;
  release: (input: {
    month: string;
    status: 'succeeded' | 'failed';
    callCountDone: number;
    errorCode?: string;
  }) => Promise<void>;
}

export interface RunMonthlyBatchOrchestratorInput {
  month: string; // YYYY-MM
  adminUserId: string;
  promptVersionId: string;
  personasVersionId: string;
  tier0Source: () => Promise<Tier1Candidate[]>;
  callPersonaPanel: (input: {
    ticker: string;
    financials: string;
  }) => Promise<PersonaScore[]>;
  fetchFinancials: (ticker: string) => Promise<string>;
  lock: OrchestratorLock;
  persist: (
    month: string,
    selected: Tier1ScreeningResult['selected'],
  ) => Promise<void>;
  commitBadgeOnly: (input: {
    month: string;
    ticker: string;
    badge: '⚪';
  }) => Promise<void>;
  /**
   * B2 fix (omxy R1) — 실패 시 scheduler_fail alert insert/emit.
   */
  recordSchedulerFailAlert: (input: {
    month: string;
    errorCode: string;
    callCountDone: number;
  }) => Promise<void>;
}

export interface OrchestratorOutcome {
  month: string;
  selectedCount: number;
  notSelectedCount: number;
  badgeOnlyCount: number;
  promptVersionId: string;
  personasVersionId: string;
}

export async function runMonthlyBatchOrchestrator(
  input: RunMonthlyBatchOrchestratorInput,
): Promise<OrchestratorOutcome> {
  await input.lock.acquire(input.month);

  let callCountDone = 0;
  try {
    const candidates = await input.tier0Source();
    if (candidates.length !== 150) {
      throw new Error(
        `tier1_candidates_must_be_150 (got ${candidates.length})`,
      );
    }

    // B3 lesson — runTier1Screening은 allSettled 패턴. throw는 invariant 한정.
    const result = await runTier1Screening({
      candidates,
      callPersonaPanel: input.callPersonaPanel,
      fetchFinancials: input.fetchFinancials,
      promptVersionId: input.promptVersionId,
      personasVersionId: input.personasVersionId,
    });
    callCountDone = candidates.length;

    await input.persist(input.month, result.selected);

    // B5 fix — badge-only commit은 assigned_timeframe badge가 ⚪인 경우만.
    let badgeOnlyCount = 0;
    for (const agg of result.selected) {
      if (agg.assigned_timeframe === null) continue;
      const assignedBadge =
        agg.consensus_badges_by_timeframe[agg.assigned_timeframe];
      if (assignedBadge === '⚪') {
        await input.commitBadgeOnly({
          month: input.month,
          ticker: agg.ticker,
          badge: '⚪',
        });
        badgeOnlyCount++;
      }
    }

    await input.lock.release({
      month: input.month,
      status: 'succeeded',
      callCountDone,
    });

    return {
      month: input.month,
      selectedCount: result.selected.length,
      notSelectedCount: result.notSelected.length,
      badgeOnlyCount,
      promptVersionId: input.promptVersionId,
      personasVersionId: input.personasVersionId,
    };
  } catch (err) {
    const errorCode = err instanceof Error ? err.message : 'unknown';
    // B2 fix — alert insert 먼저 (실패 시 swallow하되 원본 errorCode는 throw chain 보존)
    try {
      await input.recordSchedulerFailAlert({
        month: input.month,
        errorCode,
        callCountDone,
      });
    } catch (alertErr) {
      // eslint-disable-next-line no-console
      console.warn(
        '[orchestrator] scheduler_fail alert insert error:',
        alertErr,
      );
    }
    await input.lock.release({
      month: input.month,
      status: 'failed',
      callCountDone,
      errorCode,
    });
    throw err;
  }
}
