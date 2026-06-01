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
  /**
   * PR-E (omxy §2.0a 설계 합의) — 실 AI 호출 전 fail-closed 비용 가드.
   * lock + tier0Source + 150-invariant 통과 후, runTier1Screening 직전 1회 호출.
   * caller(admin)는 isCostLoggingEnabled + ANTHROPIC_API_KEY + preflightHardcap(1650) 주입.
   * cron caller(PR-G)는 preflightCronRealAi 4-gate(flag/cost/key/CRON_SYSTEM_USER_ID) 주입 —
   *   MONTHLY_BATCH_CRON_AI_ENABLED off(default) 시 monthly_batch_cron_ai_disabled throw (실 AI 0회, cost 0).
   * callCount = candidates.length * 11 (Core 11 panel 실 Anthropic 호출 수).
   */
  preflight: (input: { month: string; callCount: number }) => Promise<void>;
  callPersonaPanel: (input: {
    ticker: string;
    financials: string;
  }) => Promise<PersonaScore[]>;
  fetchFinancials: (ticker: string) => Promise<string>;
  lock: OrchestratorLock;
  persist: (
    month: string,
    selected: Tier1ScreeningResult['selected'],
    // PR-E — 성공 panel ticker별 AI 코멘트/conviction (degraded는 부재). persist가 short_list_30 매핑.
    commentsByTicker?: Tier1ScreeningResult['commentsByTicker'],
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

    // PR-E (omxy §2.0a 합의) — 실 AI 호출 전 fail-closed 비용 가드. 통과 못하면 여기서 throw
    //   (callPersonaPanel 0회 → cost 0). cron(PR-G)은 MONTHLY_BATCH_CRON_AI_ENABLED off(default) 시 차단.
    await input.preflight({
      month: input.month,
      callCount: candidates.length * 11, // Core 11 panel = 150*11 = 1650 실 Anthropic 호출 예상.
    });

    // B3 lesson — runTier1Screening은 allSettled 패턴. throw는 invariant 한정.
    const result = await runTier1Screening({
      candidates,
      callPersonaPanel: input.callPersonaPanel,
      fetchFinancials: input.fetchFinancials,
      promptVersionId: input.promptVersionId,
      personasVersionId: input.personasVersionId,
    });
    // callCountDone = ticker/panel 단위 진행 수 (candidates.length). 실 Anthropic 호출 수(×11)가 아님
    //   (omxy §2.0a non-blocking note). cost 정확도는 cost_log(per-call row)가 SoT.
    callCountDone = candidates.length;

    // PR-E (omxy §2.0a 합의) — post-screening 완결성 게이트. degraded(panel 실패/override) ticker가
    //   하나라도 있으면(commentsByTicker < 150) tier1Ranks/배지/30선정이 왜곡되므로 persist 금지(fail-closed).
    //   PR1 B3 "degraded ⚪ success" 계약 supersede — 실 AI path는 150/150 완결 시에만 short_list_30 기록.
    const completedPanels = Object.keys(result.commentsByTicker ?? {}).length;
    if (completedPanels !== candidates.length) {
      throw new Error(
        `tier1_panel_incomplete:${completedPanels}/${candidates.length}`,
      );
    }

    await input.persist(input.month, result.selected, result.commentsByTicker);

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
