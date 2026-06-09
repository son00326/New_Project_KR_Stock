// ============================================================================
// P3 FULL selection run — REAL AI + REAL production Supabase.
//
// Drives the Tier1 selection chunk WORKER to completion for both period tracks
// (short s:<KST-monday> + midlong m:<YYYY-MM>) so short_list_30 becomes a real
// AI-selected list (consensus_badge / ai_score populated), replacing the current
// Tier0 fallback. This is the "풀 P3 AI 30-selection" go-live step (HANDOFF §0 한눈에).
//
// Per track it loops runGuardedSelectionChunk until result.finalized === true:
//   chunk → acquire run-mutex → enqueue fresh∪incumbent pool → preflightHardcap
//   → claim chunkSize → Core-11 panel (R1) → mark done → release.
//   When R1 fully terminal → enqueue R2 (debate) targets → … → enqueue round-3
//   judge (Opus per-ticker) → … → finalize: runTier1Screening replay (LLM 0) →
//   upsertShortListTrack(month, track, top) → mark_selection_finalized.
//
// COST/TIME (worst-case bounded by worker preflightHardcap @ ₩500,000):
//   R1  ~150-180 tickers × 11 (Sonnet×6 + GPT-5.4×5, concurrency 4) ≈ ₩13-16k
//   R2  ~per-track boundary∪variance subset × 11                    ≈ ₩3-7k
//   judge ~150-180 × 1 Opus-4.8                                     ≈ ₩6-20k
//   dual-judge ~per-track ±2 boundary (GPT top)                     ≈ small
//   → realistically ~₩2-5万, 60-120 min sequential (cross-ticker serialized).
//
// IDEMPOTENT / RESUMABLE: jobs persist (claim→done). If this process dies, re-running
// continues from where it left off (already-finalized tracks acquire→null→skipped).
// The worker does NOT clear cost_log; re-billing only happens for jobs that were
// deleted/never-done. The existing cheap-smoke artifact (m:2026-06, ₩86.98, ticker
// 000220, job/run rows DELETEd) means 000220's R1 will be re-billed once (~₩87) — accepted.
//
// HOW TO RUN (intentional, real money):
//   cd tudal && P3_FULL_RUN_CONFIRM=1 npx vitest run --config vitest.full-run.config.ts
//   optional: P3_FULL_TRACK=short|midlong|both (default both, sequential)
//             P3_FULL_CHUNK_SIZE=<n> (default 5)
//             P3_FULL_NOW=<ISO> (default now; period keys derived KST)
// Without P3_FULL_RUN_CONFIRM=1 this test SKIPS (spends $0). Not in `npm run test:ci`.
//
// DI mirrors src/app/api/cron/monthly-batch/selection-worker/route.ts (incl. incumbentsSource,
// judge/dual-judge) so the full run exercises the real worker DI path, but loops chunks
// directly (no route GET wrapper / CRON_SECRET / due-gate / self-continue).
// ============================================================================
import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import {
  runGuardedSelectionChunk,
  type RunTier1SelectionChunkInput,
  type Tier1SelectionChunkResult,
} from '@/lib/screening/tier1-selection-batch-worker';
import { getTier0Candidates } from '@/lib/data/admin-tier0-candidates';
import {
  getIncumbents,
  buildIncumbentThesisContexts,
} from '@/lib/data/admin-shortlist-incumbents';
import {
  currentShortPeriodKey,
  currentMidlongPeriodKey,
  monthYMOfPeriod,
} from '@/lib/screening/selection-period';
import {
  makeCallPersonaPanel,
  makeCallDebatePanel,
} from '@/lib/screening/persona-panel-adapter';
import { resolveTier1PanelSlot } from '@/lib/ai/model-registry';
import { callJudge, callDualJudge } from '@/lib/ai/judge-client';
import { renderPeerArguments } from '@/lib/ai/prompts/debate-round-template';
import type { PersonaScore, SelectionTrack } from '@/lib/screening/tier1-schema';
import { TRACK_FRESH_POOL } from '@/lib/screening/tier1-schema';
import { CORE_11_PERSONAS } from '@/lib/ai/prompts/personas';
import { callPersona } from '@/lib/ai/anthropic-client';
import { fetchFinancialsSummary } from '@/lib/data/dart-financials';
import { preflightHardcap, getMonthlyTotal } from '@/lib/cost/cost-logger';
import { upsertShortListTrack } from '@/lib/data/admin-shortlist-persist';
import { runTier1Screening } from '@/lib/screening/persona-eval';
import { insertPipelineHealth } from '@/lib/data/admin-pipeline-health-insert';
import { insertAlertEvents } from '@/lib/data/admin-alerts-insert';
import { emitCostAlert } from '@/lib/data/admin-cost-alerts';

const CONFIRMED = process.env.P3_FULL_RUN_CONFIRM === '1';
const UUID_RE = /^[0-9a-f-]{36}$/i;

// Belt-and-suspenders cost ceiling ON TOP of the worker's preflightHardcap (₩500k). A single full
// run is expected ~₩2-5万; this aborts the DRIVER (no further chunks) far below the hardcap so a
// pricing/loop regression cannot silently burn toward ₩500k. Override via env if intentional.
const DRIVER_COST_CEILING_KRW = Number(process.env.P3_FULL_COST_CEILING_KRW ?? 200_000);
// Generous per-track iteration cap: pool ≤120 × 3 rounds / chunkSize ≥3 ≈ 120 chunks. 600 = ~5×.
const MAX_CHUNKS_PER_TRACK = Number(process.env.P3_FULL_MAX_CHUNKS ?? 600);
const CHUNK_SIZE = Number(process.env.P3_FULL_CHUNK_SIZE ?? 5);

function resolveTracks(): SelectionTrack[] {
  const raw = (process.env.P3_FULL_TRACK ?? 'both').toLowerCase();
  if (raw === 'short') return ['short'];
  if (raw === 'midlong') return ['midlong'];
  if (raw === 'both') return ['short', 'midlong'];
  throw new Error(`[p3-full] invalid P3_FULL_TRACK=${raw} (expected short|midlong|both)`);
}

function resolveNow(): Date {
  const raw = process.env.P3_FULL_NOW;
  if (!raw) return new Date();
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`[p3-full] invalid P3_FULL_NOW=${raw}`);
  }
  return parsed;
}

// route-local helper (selection-worker/route.ts:87-95) — not exported, copied verbatim.
function renderJudgePanelSummary(finalPanel: readonly PersonaScore[]): string {
  const labelById = new Map(CORE_11_PERSONAS.map((p) => [p.id, p.label]));
  return renderPeerArguments(
    finalPanel.map((score) => ({
      label: labelById.get(score.persona_id) ?? score.persona_id,
      score,
    })),
  );
}

// Full DI block — verbatim mirror of selection-worker/route.ts:143-211 (and cheap smoke), so the
// driver exercises the identical real worker path. Only month/track/periodKey/chunkSize vary per call.
function buildChunkInput(args: {
  month: string;
  track: SelectionTrack;
  periodKey: string;
  client: SupabaseClient;
  cronSystemUserId: string;
}): RunTier1SelectionChunkInput {
  const { month, track, periodKey, client, cronSystemUserId } = args;
  return {
    month,
    track,
    periodKey,
    client,
    chunkSize: CHUNK_SIZE,
    promptVersionId: process.env.PROMPT_VERSION_ID ?? 'render-user-prompt@v1',
    personasVersionId: process.env.PERSONAS_VERSION_ID ?? 'core11@v3.1',
    tier0Source: (opts) => getTier0Candidates({ track, ...opts }),
    incumbentsSource: (opts) => getIncumbents(opts),
    buildIncumbentContexts: (incumbents, opts) =>
      buildIncumbentThesisContexts(incumbents, opts),
    callPersonaPanel: makeCallPersonaPanel({
      callPersona,
      personas: CORE_11_PERSONAS,
      reflectionContext: '',
      adminUserId: cronSystemUserId,
      costClient: client,
      slotResolver: resolveTier1PanelSlot,
    }),
    callDebatePanel: makeCallDebatePanel({
      callPersona,
      personas: CORE_11_PERSONAS,
      reflectionContext: '',
      adminUserId: cronSystemUserId,
      costClient: client,
      slotResolver: resolveTier1PanelSlot,
    }),
    callJudgePanel: ({ ticker, month: jMonth, track: jTrack, finalPanel, reflectionContext }) =>
      callJudge({
        ticker,
        month: jMonth,
        track: jTrack,
        panelSummary: renderJudgePanelSummary(finalPanel),
        reflectionContext,
        adminUserId: cronSystemUserId,
        costClient: client,
      }),
    callDualJudge: ({ ticker, month: jMonth, track: jTrack, finalPanel, reflectionContext }) =>
      callDualJudge({
        ticker,
        month: jMonth,
        track: jTrack,
        panelSummary: renderJudgePanelSummary(finalPanel),
        reflectionContext,
        adminUserId: cronSystemUserId,
        costClient: client,
      }),
    fetchFinancials: (ticker) => fetchFinancialsSummary(ticker, { client }),
    preflightHardcap,
    getMonthlyTotal,
    persist: (m, tr, selected, options) => upsertShortListTrack(m, tr, selected, options),
    runScreening: runTier1Screening,
    insertPipelineHealth,
    insertAlertEvents,
    emitCostAlert,
  };
}

async function runFinalizedAt(
  client: SupabaseClient,
  periodKey: string,
): Promise<string | null | undefined> {
  const { data } = await client
    .from('tier1_selection_run')
    .select('finalized_at')
    .eq('period_key', periodKey)
    .maybeSingle();
  return data?.finalized_at ?? null;
}

interface TrackDriveOutcome {
  track: SelectionTrack;
  periodKey: string;
  month: string;
  chunks: number;
  finalized: boolean;
  lastResult: Tier1SelectionChunkResult | null;
}

async function driveTrackToFinalize(args: {
  client: SupabaseClient;
  cronSystemUserId: string;
  track: SelectionTrack;
  periodKey: string;
  month: string;
}): Promise<TrackDriveOutcome> {
  const { client, cronSystemUserId, track, periodKey, month } = args;
  let chunks = 0;
  let lastResult: Tier1SelectionChunkResult | null = null;
  let finalized = false;

  for (;;) {
    if (chunks >= MAX_CHUNKS_PER_TRACK) {
      throw new Error(
        `[p3-full] ${track} ${periodKey} exceeded MAX_CHUNKS_PER_TRACK=${MAX_CHUNKS_PER_TRACK} without finalize`,
      );
    }
    // driver-level cost ceiling (below worker hardcap) — abort BEFORE the next chunk's spend.
    const totalBefore = await getMonthlyTotal(month, { client, callerKind: 'service-role' });
    if (totalBefore > DRIVER_COST_CEILING_KRW) {
      throw new Error(
        `[p3-full] driver cost ceiling exceeded: month ${month} total ₩${totalBefore.toFixed(2)} > ₩${DRIVER_COST_CEILING_KRW} — aborting before next chunk`,
      );
    }

    const out = await runGuardedSelectionChunk(
      buildChunkInput({ month, track, periodKey, client, cronSystemUserId }),
    );
    chunks += 1;

    if (out.skipped) {
      // sequential driver never overlaps itself → 'already_running' means either a prior run
      // already finalized this period (acquire null-guards on finalized_at) or a foreign worker
      // holds the lock. Disambiguate via finalized_at.
      const fin = await runFinalizedAt(client, periodKey);
      if (fin) {
        finalized = true;
        console.log(
          `===P3_FULL_PROGRESS=== ${track} ${periodKey} skipped(already finalized at ${fin}) chunks=${chunks}`,
        );
        break;
      }
      throw new Error(
        `[p3-full] ${track} ${periodKey} acquire returned already_running but run not finalized — foreign lock?`,
      );
    }

    const r = out.result;
    if (!r) throw new Error(`[p3-full] ${track} ${periodKey} chunk returned no result`);
    lastResult = r;
    console.log(
      `===P3_FULL_PROGRESS=== ${track} ${periodKey} chunk#${chunks} ` +
        JSON.stringify({
          claimed: r.claimed,
          done: r.done,
          failed: r.failed,
          deferred: r.deferred,
          r2Enqueued: r.r2Enqueued,
          judgeEnqueued: r.judgeEnqueued,
          remaining: r.remaining,
          finalized: r.finalized,
          aborted: r.aborted,
        }),
    );

    if (r.aborted) {
      throw new Error(`[p3-full] ${track} ${periodKey} worker aborted: ${r.aborted}`);
    }
    if (r.finalized) {
      finalized = true;
      break;
    }
    // stall guard: a chunk that claimed nothing AND enqueued nothing AND did not finalize means
    // there is no forward progress (empty pool / unexpected terminal-but-unfinalized state).
    if (r.claimed === 0 && r.r2Enqueued === 0 && r.judgeEnqueued === 0) {
      throw new Error(
        `[p3-full] ${track} ${periodKey} stalled (claimed=0, no enqueue, not finalized; remaining=${r.remaining}) — investigate job statuses`,
      );
    }
  }

  return { track, periodKey, month, chunks, finalized, lastResult };
}

describe('P3 FULL selection run (REAL AI + REAL prod Supabase, ~₩2-5만, 60-120min)', () => {
  it.runIf(CONFIRMED)(
    'drives configured tracks to finalize → short_list_30 AI-selected',
    async () => {
      const supabase = createServiceRoleClient();
      const cronSystemUserId = process.env.CRON_SYSTEM_USER_ID ?? '';
      expect(cronSystemUserId).toMatch(UUID_RE);

      const now = resolveNow();
      const tracks = resolveTracks();
      const plan = tracks.map((track) => {
        const periodKey =
          track === 'short' ? currentShortPeriodKey(now) : currentMidlongPeriodKey(now);
        return { track, periodKey, month: monthYMOfPeriod(periodKey) };
      });
      console.log(
        `===P3_FULL_PLAN=== ${JSON.stringify({ now: now.toISOString(), plan, chunkSize: CHUNK_SIZE })}`,
      );

      // Precondition: tier0_candidates_150 seeded for each derived month/track fresh pool.
      // The worker aborts (tier0_candidates_invalid_count) if not exactly the fresh pool, but
      // assert up-front so a wrong-month/un-seeded run fails loud before any spend.
      for (const p of plan) {
        const fresh = await getTier0Candidates({ track: p.track, month: p.month, client: supabase });
        expect(
          fresh.length,
          `tier0 fresh pool for ${p.track} ${p.month}: got ${fresh.length}, want ${TRACK_FRESH_POOL[p.track]}`,
        ).toBe(TRACK_FRESH_POOL[p.track]);
      }

      const baseCostKrw = await getMonthlyTotal(plan[0].month, {
        client: supabase,
        callerKind: 'service-role',
      });
      expect(baseCostKrw).toBeLessThan(DRIVER_COST_CEILING_KRW);

      const outcomes: TrackDriveOutcome[] = [];
      for (const p of plan) {
        const outcome = await driveTrackToFinalize({
          client: supabase,
          cronSystemUserId,
          track: p.track,
          periodKey: p.periodKey,
          month: p.month,
        });
        expect(outcome.finalized, `${p.track} ${p.periodKey} must finalize`).toBe(true);
        outcomes.push(outcome);
      }

      // ── evidence dump (grep marker) ──
      const months = [...new Set(plan.map((p) => p.month))];
      const costByMonth: Record<string, number> = {};
      for (const m of months) {
        costByMonth[m] = await getMonthlyTotal(m, { client: supabase, callerKind: 'service-role' });
      }
      const { data: sl30 } = await supabase
        .from('short_list_30')
        .select('ticker,bucket,consensus_badge,ai_score');
      const badged = (sl30 ?? []).filter((r) => r.consensus_badge != null).length;
      const aiScored = (sl30 ?? []).filter((r) => r.ai_score != null).length;

      const summary = {
        outcomes: outcomes.map((o) => ({
          track: o.track,
          periodKey: o.periodKey,
          chunks: o.chunks,
          finalized: o.finalized,
        })),
        baseCostKrw,
        costByMonth,
        shortList30: { total: sl30?.length ?? 0, badged, aiScored },
      };
      console.log('===P3_FULL_RESULT===\n' + JSON.stringify(summary, null, 2) + '\n===END===');

      // Every driven track finalized. Full short_list_30 AI population is asserted separately
      // (a single-track run only contributes its bucket); when both tracks ran, all 30 are AI-badged.
      if (resolveTracks().length === 2) {
        expect(sl30?.length ?? 0).toBe(30);
        expect(badged).toBe(30);
        expect(aiScored).toBe(30);
      }
    },
  );

  it.skipIf(CONFIRMED)(
    'guard: without P3_FULL_RUN_CONFIRM the real run is skipped AND cost gates are not forced ($0)',
    () => {
      expect(CONFIRMED).toBe(false);
      expect(process.env.P3_FULL_RUN_CONFIRM).not.toBe('1');
      expect(process.env.AI_COST_LOG_REAL_INSERT_ENABLED).not.toBe('true');
      expect(process.env.SELECTION_CRON_AUTO_ENABLED).not.toBe('true');
    },
  );
});
