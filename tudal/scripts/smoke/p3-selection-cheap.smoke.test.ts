// ============================================================================
// P3 cheap selection smoke — REAL AI + REAL production Supabase.
//
// Verifies the Tier1 selection chunk plumbing end-to-end at minimal cost by
// running ONE midlong ticker through the Core-11 panel (chunkSize=1):
//   runGuardedSelectionChunk → acquire run-mutex → enqueue full midlong pool
//   → claim 1 → Core-11 panel (11 real callPersona) → cost_log INSERT x11
//   → mark job done → release lock. finalize/short_list_30 are NOT reached
//   (99 jobs remain pending), so the public shortlist is untouched.
//
// Cost: ~11 billable calls ≈ ₩537 (Sonnet x6 + GPT mid x5). ~100-120 dormant
// tier1_selection_job rows are seeded (idempotent ON CONFLICT) — resumable by
// the later full P3 run for the same period_key='m:2026-06'.
//
// HOW TO RUN (intentional, real money):
//   cd tudal && P3_SMOKE_CONFIRM=1 npx vitest run --config vitest.smoke.config.ts
// Without P3_SMOKE_CONFIRM=1 this test SKIPS (spends $0). Not in `npm run test:ci`.
//
// DI mirrors src/app/api/cron/monthly-batch/selection-worker/route.ts:143-211
// exactly (incl. incumbentsSource) so the smoke exercises the real cron path.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { runGuardedSelectionChunk } from '@/lib/screening/tier1-selection-batch-worker';
import { getTier0Candidates } from '@/lib/data/admin-tier0-candidates';
import {
  getIncumbents,
  buildIncumbentThesisContexts,
} from '@/lib/data/admin-shortlist-incumbents';
import {
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
import type { PersonaScore } from '@/lib/screening/tier1-schema';
import { CORE_11_PERSONAS } from '@/lib/ai/prompts/personas';
import { callPersona } from '@/lib/ai/anthropic-client';
import { fetchFinancialsSummary } from '@/lib/data/dart-financials';
import { preflightHardcap, getMonthlyTotal } from '@/lib/cost/cost-logger';
import { upsertShortListTrack } from '@/lib/data/admin-shortlist-persist';
import { runTier1Screening } from '@/lib/screening/persona-eval';
import { insertPipelineHealth } from '@/lib/data/admin-pipeline-health-insert';
import { insertAlertEvents } from '@/lib/data/admin-alerts-insert';
import { emitCostAlert } from '@/lib/data/admin-cost-alerts';

const CONFIRMED = process.env.P3_SMOKE_CONFIRM === '1';

// route-local helper (route.ts:87-95) — not exported, copied verbatim.
function renderJudgePanelSummary(finalPanel: readonly PersonaScore[]): string {
  const labelById = new Map(CORE_11_PERSONAS.map((p) => [p.id, p.label]));
  return renderPeerArguments(
    finalPanel.map((score) => ({
      label: labelById.get(score.persona_id) ?? score.persona_id,
      score,
    })),
  );
}

describe('P3 cheap selection smoke (REAL AI + REAL prod Supabase)', () => {
  it.runIf(CONFIRMED)(
    'runGuardedSelectionChunk(midlong, chunkSize=1): 11 real calls + full plumbing wired',
    async () => {
      const supabase = createServiceRoleClient();
      const cronSystemUserId = process.env.CRON_SYSTEM_USER_ID ?? '';

      // period derivation via the real seam (KST-corrected); assert it lands on the smoke target.
      const periodKey = currentMidlongPeriodKey(new Date());
      const month = monthYMOfPeriod(periodKey);
      expect(periodKey).toBe('m:2026-06');
      expect(month).toBe('2026-06');
      expect(cronSystemUserId).toMatch(/^[0-9a-f-]{36}$/i);

      const baseCostKrw = await getMonthlyTotal(month, {
        client: supabase,
        callerKind: 'service-role',
      });

      const out = await runGuardedSelectionChunk({
        month,
        track: 'midlong',
        periodKey,
        client: supabase,
        chunkSize: 1, // ⭐ exactly one ticker → 11 calls
        promptVersionId: process.env.PROMPT_VERSION_ID ?? 'render-user-prompt@v1',
        personasVersionId: process.env.PERSONAS_VERSION_ID ?? 'core11@v3.1',
        tier0Source: (opts) => getTier0Candidates({ track: 'midlong', ...opts }),
        incumbentsSource: (opts) => getIncumbents(opts),
        buildIncumbentContexts: (incumbents, opts) =>
          buildIncumbentThesisContexts(incumbents, opts),
        callPersonaPanel: makeCallPersonaPanel({
          callPersona,
          personas: CORE_11_PERSONAS,
          reflectionContext: '',
          adminUserId: cronSystemUserId,
          costClient: supabase,
          slotResolver: resolveTier1PanelSlot,
        }),
        callDebatePanel: makeCallDebatePanel({
          callPersona,
          personas: CORE_11_PERSONAS,
          reflectionContext: '',
          adminUserId: cronSystemUserId,
          costClient: supabase,
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
            costClient: supabase,
          }),
        callDualJudge: ({ ticker, month: jMonth, track: jTrack, finalPanel, reflectionContext }) =>
          callDualJudge({
            ticker,
            month: jMonth,
            track: jTrack,
            panelSummary: renderJudgePanelSummary(finalPanel),
            reflectionContext,
            adminUserId: cronSystemUserId,
            costClient: supabase,
          }),
        fetchFinancials: (ticker) => fetchFinancialsSummary(ticker, { client: supabase }),
        preflightHardcap,
        getMonthlyTotal,
        persist: (m, tr, selected, options) => upsertShortListTrack(m, tr, selected, options),
        runScreening: runTier1Screening,
        insertPipelineHealth,
        insertAlertEvents,
        emitCostAlert,
      });

      // ── seam A: chunk result shape ──
      expect(out.skipped).toBeUndefined();
      const result = out.result;
      expect(result).toBeDefined();
      if (!result) throw new Error('no result');
      expect(result.aborted).toBeNull();
      expect(result.claimed).toBe(1);
      expect(result.done).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.finalized).toBe(false); // 99 pending → no finalize/persist
      expect(result.r2Enqueued).toBe(0);
      expect(result.judgeEnqueued).toBe(0);
      expect(result.remaining).toBeGreaterThanOrEqual(99);

      // ── seam B: selection job lifecycle (enqueue + claim→done) ──
      const { data: jobs } = await supabase
        .from('tier1_selection_job')
        .select('ticker,status,round,panel_result,attempts')
        .eq('period_key', periodKey);
      expect(jobs && jobs.length).toBeGreaterThanOrEqual(100); // full midlong pool enqueued
      const doneJobs = (jobs ?? []).filter((j) => j.status === 'done');
      expect(doneJobs.length).toBe(1);
      const doneJob = doneJobs[0];
      expect(doneJob.round).toBe(1);
      expect(doneJob.attempts).toBe(1);
      expect(Array.isArray(doneJob.panel_result)).toBe(true);
      expect((doneJob.panel_result as unknown[]).length).toBe(11); // Core-11 scores persisted

      // ── seam C: run-mutex acquire/release with run_id fencing, NOT finalized ──
      const { data: run } = await supabase
        .from('tier1_selection_run')
        .select('status,run_id,finalized_at,track,month')
        .eq('period_key', periodKey)
        .single();
      expect(run?.status).toBe('succeeded');
      expect(run?.run_id).toBeTruthy();
      expect(run?.finalized_at).toBeNull();
      expect(run?.track).toBe('midlong');

      // ── seam D: cost_log INSERT x11, valid FK, multi-provider mix ──
      const { data: costRows } = await supabase
        .from('cost_log')
        .select('persona_id,model,ticker,cost_krw,called_by')
        .eq('month', month);
      expect(costRows && costRows.length).toBe(11);
      const calledByOk = (costRows ?? []).every((r) => r.called_by === cronSystemUserId);
      expect(calledByOk).toBe(true);
      const models = new Set((costRows ?? []).map((r) => r.model));
      // D28 mix: Sonnet x6 + GPT mid x5 (OPENAI present) → both providers wired.
      expect(models.has('claude-sonnet-4-6')).toBe(true);
      expect(models.has('gpt-5.4')).toBe(true);
      const summedKrw = (costRows ?? []).reduce((s, r) => s + Number(r.cost_krw), 0);
      expect(summedKrw).toBeGreaterThan(0);

      // ── seam E: monthly total reflects the spend (cost accounting wired) ──
      const afterCostKrw = await getMonthlyTotal(month, {
        client: supabase,
        callerKind: 'service-role',
      });
      expect(afterCostKrw - baseCostKrw).toBeCloseTo(summedKrw, 1);

      // ── seam F: pipeline_health success row ──
      const { data: ph } = await supabase
        .from('pipeline_health')
        .select('pipeline,status,error,started_at')
        .eq('pipeline', 'ai')
        .order('started_at', { ascending: false })
        .limit(1);
      expect(ph?.[0]?.status).toBe('success');

      // ── evidence dump (grep marker) ──
      const summary = {
        chunkResult: result,
        baseCostKrw,
        afterCostKrw,
        spentKrw: Number(summedKrw.toFixed(4)),
        enqueuedJobs: jobs?.length,
        doneTicker: doneJob.ticker,
        panelScoreCount: (doneJob.panel_result as unknown[]).length,
        runStatus: run?.status,
        runFinalizedAt: run?.finalized_at,
        costRows: (costRows ?? []).map((r) => ({
          persona: r.persona_id,
          model: r.model,
          ticker: r.ticker,
          krw: Number(Number(r.cost_krw).toFixed(4)),
        })),
        models: [...models],
        pipelineHealth: ph?.[0],
      };
      // eslint-disable-next-line no-console
      console.log('===P3_SMOKE_RESULT===\n' + JSON.stringify(summary, null, 2) + '\n===END===');
    },
  );

  it.skipIf(CONFIRMED)('guard: P3_SMOKE_CONFIRM not set → real smoke skipped ($0)', () => {
    expect(CONFIRMED).toBe(false);
  });
});
