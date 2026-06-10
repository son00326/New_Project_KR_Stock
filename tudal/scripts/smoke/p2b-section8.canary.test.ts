// ============================================================================
// P2b Section 8 + committee_votes live canary — REAL AI + REAL production Supabase.
//
// Verifies the dormant PR5b Section 8 canonical path live, at minimal cost, by
// driving ONE ticker of the 2026-06 AI-badged short_list_30 through the REAL
// report-worker chunk path (runGuardedReportChunk, chunkSize=1):
//   step-0 fail-closed gates (PR5_CRON_AUTO_ENABLED / AI_COST_LOG_REAL_INSERT_ENABLED
//   / CRON_SYSTEM_USER_ID + auth.users) → enqueue 30 report_batch_job (idempotent)
//   → reset_section8_eligible_jobs (flag-on; no-op on a fresh month)
//   → claim 1 (order by ticker → lowest ticker, deterministic) → body path:
//   enrichReportInput → orchestrateFullReport (writer Opus-4.8 → critic →
//   conditional revise → upsert_report_sections_0_7_cron RPC → critic findings
//   → sector backlog → commitSection8Step LAST: Core-11 vote-pass 11 calls →
//   commit_persona_eval_cron (0036): section_8 + 11 committee_votes + badge)
//   → mark job done → summarize (pipeline_health) → release run-mutex.
//
// SCOPE (honest boundary — cheap-smoke CF-2/CF-3 pattern): this is a WORKER-level
// canary, NOT route/cron coverage. It does NOT exercise the route GET wrapper
// (CRON_SECRET auth, the route's own PR5_CRON_AUTO_ENABLED 200-skip, self-continue),
// and chunkSize=1 deviates from the route default (3) for cost control. It injects
// three USER-owned prod flags locally (PR5_CRON_AUTO_ENABLED, PR5B_SECTION8_ENABLED,
// AI_COST_LOG_REAL_INSERT_ENABLED) that Vercel prod does NOT set — production crons
// stay dormant. The 29 untouched jobs remain `pending` = the natural P4 resume
// queue. ⚠️ That queue is inert ONLY while Vercel PR5_CRON_AUTO_ENABLED stays
// unset: if USER enables the PR5 flags (+keys) before 2026-07-01, the daily cron
// auto-bills the backlog at DEFAULT_CHUNK_SIZE=3/day (~₩1.5-2k/day) with no
// further human trigger. From 2026-07-01 the route's currentMonthYM() moves on
// and the June queue is orphaned (no latent billing).
//
// KNOWN TERMINAL STATES (disclosed — omxy R1 + blind-audit MED):
//   - Section8 SOFT-SKIP: runCore11ForTicker swallows any `ai_call_failed*`
//     (incl. transient 429/5xx after SDK-internal retries) → commitSection8Step
//     returns 'section8_unavailable' (⚪/null badge → 'section8_not_ready');
//     the orchestrator only console.info's non-committed statuses and the worker
//     marks the job done. Outcome: body fully billed + persisted, section_8 NULL,
//     result.done=1. This harness then REDs at the seam-D soft-skip check —
//     an HONEST RED, not a wiring bug. Recovery is production-side only:
//     the next flag-on chunk's reset_section8_eligible_jobs re-pends the job and
//     the needsSection8Only branch adds Section 8 at panel-only cost (the P4
//     30-report driver does this naturally). This harness stays blocked by its
//     single-shot guards — by design.
//   - retryWithBackoff worst case: a transient writer/critic/revise throw re-runs
//     the whole orchestrate up to 3 attempts = 3×(writer+critic)+revise+1×panel
//     (the panel is never re-billed inside one claim — its transients soft-skip).
//   - vitest timeout/kill mid-run: billing is NOT cancelled; the claimed job and
//     run-mutex are left for stale reclaim (10/15 min) and the in-flight call may
//     be billed by the provider without a cost_log row. Before ANY re-run,
//     reconcile cost_log against the provider console.
//
// SINGLE-SHOT: fail-closed pre-guards abort at $0 unless the month is in the
// exact pristine pre-canary state: stock_reports 0 / report_batch_job 0 (ANY
// status — failed/running/deferred residue also aborts) / committee_votes 0 /
// cost_log 0 report-path rows (full_report_writer|critic|revise). Re-running
// after ANY prior attempt (success, crash, or failure) therefore aborts at $0
// instead of claiming the next ticker and billing again. Intentional P4
// progression must go through a dedicated 30-report driver, not this canary.
// ⚠️ TOCTOU: the guards run before the run-mutex acquire — never launch two
// canaries concurrently; the residual race window is seconds wide but real.
//
// ⚠️ FIRST LIVE RUN OUTCOME (2026-06-10): seam A claimed=1 assert REDed because the
// PRE-0037 claim_next_report_jobs over-claimed 3 jobs on p_limit=1 (IN-subquery rescan
// — Postgres locking-subquery anti-pattern; reproduced in prod with raw SQL LIMIT 1 → 2
// rows). 3 tickers (000660/000990/007610) were fully committed+billed (₩1,695.83) and
// every post-claim seam verified CLEAN by manual SQL. Migration 0037 fixes both claim
// RPCs (report + selection) with a MATERIALIZED CTE; the claimed-exactness asserts in
// this harness are only deterministic once 0037 is applied.
//
// HOW TO RUN (intentional, real money ~₩400-1,500; post-hoc ceiling ₩10,000):
//   cd tudal && P2B_CANARY_CONFIRM=1 npx vitest run --config vitest.p2b.config.ts
// Without P2B_CANARY_CONFIRM=1 this test SKIPS and the cost/flag gates are NOT
// forced ($0). Not in `npm run test:ci`. NOTE: .env.local is authoritative —
// shell-exported SUPABASE_*/ANTHROPIC_*/OPENAI_* overrides are clobbered, so a
// confirmed run ALWAYS targets the production project recorded in .env.local.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { runGuardedReportChunk } from '@/lib/report/full-report-batch-worker';
import { getMonthlyTotal } from '@/lib/cost/cost-logger';
import { CORE_11_PERSONAS } from '@/lib/ai/prompts/personas';

const CONFIRMED = process.env.P2B_CANARY_CONFIRM === '1';

// Spend sanity ceiling (₩) — POST-HOC AUDIT, not an in-run blocker (the in-run
// money guards are the three preflightHardcap reservations: worker batch /
// orchestrator per-attempt / section8-step 11×tier1_panel, hardcap ₩500k).
// Worst legit case ≈ 3×(writer+critic) + revise + 1×panel ≈ ₩2,600-4,500
// (panel transients soft-skip — never re-billed inside one claim). Anything
// above this ceiling means a runaway loop — fail loud for the post-run audit.
const SPEND_CEILING_KRW = 10_000;

const AI_BADGES = ['🟢', '🔵', '🟣', '🟡'] as const;

// route-local helper (report-worker/route.ts:35-39) — not exported, copied verbatim
// so the canary derives month through the same seam the cron route uses.
function currentMonthYM(): string {
  const now = new Date();
  const m = `${now.getUTCMonth() + 1}`.padStart(2, '0');
  return `${now.getUTCFullYear()}-${m}`;
}

interface Section8Shape {
  partA: unknown[];
  partB: unknown[];
  partC: {
    core_revote: { buy: number; hold: number; sell: number };
    verdict: 'BUY' | 'HOLD' | 'SELL';
    rationale: string[];
  };
  partD: Array<{ persona_id: string; vote: 'BUY' | 'HOLD' | 'SELL' }>;
}

describe('P2b Section8 live canary (REAL AI + REAL prod Supabase)', () => {
  it.runIf(CONFIRMED)(
    'runGuardedReportChunk(chunkSize=1): 1 full report + section_8 + 11 committee_votes wired',
    async () => {
      const supabase = createServiceRoleClient();
      // lowercase once: Postgres normalizes uuid output to lowercase, so an uppercase
      // env value would pass every upstream gate but false-RED the called_by equality.
      const cronSystemUserId = (process.env.CRON_SYSTEM_USER_ID ?? '').toLowerCase();

      // month derivation via the real route seam (UTC); pin to the canary target month
      // (2026-06 = the month with 30 AI-badged rows from the 73차 full P3 run). A drifted
      // month (e.g. a July run) must fail loud, not silently canary a badge-less month.
      const month = currentMonthYM();
      const monthDate = `${month}-01`;
      expect(month).toBe('2026-06');
      expect(cronSystemUserId).toMatch(/^[0-9a-f-]{36}$/i);
      expect(process.env.PR5B_SECTION8_ENABLED).toBe('true');

      // ── single-shot fail-closed pre-guards (abort at $0 — see header) ──────────
      // (1) no stock_reports row for the canary month yet (this canary writes the FIRST).
      const { count: reportRows, error: reportErr } = await supabase
        .from('stock_reports')
        .select('*', { count: 'exact', head: true })
        .eq('month', monthDate);
      if (reportErr || reportRows == null) {
        throw new Error(
          `[p2b-canary] stock_reports baseline count failed for ${monthDate} ` +
            `(${reportErr?.message ?? 'null count'}) — aborting before spend (fail-closed).`,
        );
      }
      if (reportRows > 0) {
        throw new Error(
          `[p2b-canary] stock_reports already has ${reportRows} row(s) for ${monthDate} — ` +
            `the single-shot canary already ran; a re-run would claim the NEXT ticker and ` +
            `bill again. P4 (30 reports) must use its own driver.`,
        );
      }
      // (2) report_batch_job must be COMPLETELY empty for the month (verified production
      //     baseline = 0 rows). Checking only status='done' would let failed/deferred/
      //     pending/stale-running residue from a crashed prior attempt slip through and
      //     (a) bill the NEXT ticker, (b) break the lowest-ticker/attempts=1/remaining=29
      //     determinism asserts post-spend (blind-audit MED).
      const { count: jobRows0, error: jobRows0Err } = await supabase
        .from('report_batch_job')
        .select('*', { count: 'exact', head: true })
        .eq('month', month);
      if (jobRows0Err || jobRows0 == null) {
        throw new Error(
          `[p2b-canary] report_batch_job baseline count failed for ${month} ` +
            `(${jobRows0Err?.message ?? 'null count'}) — aborting before spend (fail-closed).`,
        );
      }
      if (jobRows0 > 0) {
        throw new Error(
          `[p2b-canary] report_batch_job already has ${jobRows0} row(s) for ${month} ` +
            `(expected 0 — pristine pre-canary queue). A prior canary attempt (done, failed, ` +
            `crashed or stale-running) already touched this month. Audit cost_log + job states ` +
            `before deciding anything; do NOT just re-run.`,
        );
      }
      // (3) committee_votes must still be at the production baseline 0 (P2b is the FIRST
      //     live committee_votes write — HANDOFF §0 audit). Non-zero = unexpected drift.
      const { count: votesBaseline, error: votesBaselineErr } = await supabase
        .from('committee_votes')
        .select('*', { count: 'exact', head: true });
      if (votesBaselineErr || votesBaseline == null) {
        throw new Error(
          `[p2b-canary] committee_votes baseline count failed ` +
            `(${votesBaselineErr?.message ?? 'null count'}) — aborting before spend (fail-closed).`,
        );
      }
      if (votesBaseline > 0) {
        throw new Error(
          `[p2b-canary] committee_votes already has ${votesBaseline} row(s) — production ` +
            `baseline drift (expected 0 before first live Section8). Audit before re-running.`,
        );
      }
      // (4) no report-path cost_log rows for the month yet. Covers the fail-BEFORE-first-
      //     persist escape (blind-audit HIGH→MED + omxy MED-2): e.g. writer billed, then
      //     critic fails persistently → 3 attempts billed, job failed, guards (1)-(3) all
      //     still green. The 73차 selection rows are panel/judge personas only, so any
      //     full_report_writer/critic/revise row for 2026-06 = a prior canary attempt.
      const { count: reportCostRows, error: reportCostErr } = await supabase
        .from('cost_log')
        .select('*', { count: 'exact', head: true })
        .eq('month', month)
        .in('persona_id', ['full_report_writer', 'critic', 'revise']);
      if (reportCostErr || reportCostRows == null) {
        throw new Error(
          `[p2b-canary] cost_log report-path baseline count failed for ${month} ` +
            `(${reportCostErr?.message ?? 'null count'}) — aborting before spend (fail-closed).`,
        );
      }
      if (reportCostRows > 0) {
        throw new Error(
          `[p2b-canary] cost_log already has ${reportCostRows} report-path row(s) ` +
            `(full_report_writer/critic/revise) for ${month} — a prior canary attempt billed ` +
            `without persisting a report. Reconcile cost_log + provider console before any re-run.`,
        );
      }
      // (5) the would-be-claimed ticker (lowest of the 30 — claim_next_report_jobs orders
      //     by ticker on a pristine queue) must be AI-badged, and the month must have the
      //     full 30 rows (worker not-ready gate mirror). $0 SELECT — avoids discovering a
      //     ⚪/null badge only after the body is billed (section8_not_ready soft-skip).
      const { data: slAll, error: slAllErr } = await supabase
        .from('short_list_30')
        .select('ticker,consensus_badge')
        .eq('month', monthDate)
        .order('ticker', { ascending: true });
      if (slAllErr || !slAll) {
        throw new Error(
          `[p2b-canary] short_list_30 baseline read failed for ${monthDate} ` +
            `(${slAllErr?.message ?? 'null data'}) — aborting before spend (fail-closed).`,
        );
      }
      if (slAll.length !== 30) {
        throw new Error(
          `[p2b-canary] short_list_30 has ${slAll.length} row(s) for ${monthDate} (expected 30) ` +
            `— worker would notReady-skip; nothing to canary.`,
        );
      }
      const expectedTicker = slAll[0].ticker as string;
      if (!AI_BADGES.includes(slAll[0].consensus_badge as (typeof AI_BADGES)[number])) {
        throw new Error(
          `[p2b-canary] would-be-claimed ticker ${expectedTicker} has badge ` +
            `'${slAll[0].consensus_badge}' (not AI-badged) — the body would bill and Section 8 ` +
            `would section8_not_ready soft-skip. Aborting before spend.`,
        );
      }
      // (6) side-effect-free cron-system user existence preflight. The worker's own step-0
      //     check aborts at $0 too, but via abortBeforeSpend → it would INSERT a failed
      //     pipeline_health row + a critical scheduler_fail alert_event into production.
      //     Verify here first so a misconfigured UUID pollutes nothing (blind-audit LOW).
      const { data: cronUser, error: cronUserErr } =
        await supabase.auth.admin.getUserById(cronSystemUserId);
      if (cronUserErr || !cronUser?.user) {
        throw new Error(
          `[p2b-canary] CRON_SYSTEM_USER_ID ${cronSystemUserId} not found in auth.users ` +
            `(${cronUserErr?.message ?? 'no user'}) — aborting before spend (fail-closed, ` +
            `side-effect-free).`,
        );
      }

      // ── cost baseline (delta-based: 2026-06 already holds the 73차 selection audit rows) ──
      const { count: baseCostRows, error: baseCostErr } = await supabase
        .from('cost_log')
        .select('*', { count: 'exact', head: true })
        .eq('month', month);
      if (baseCostErr || baseCostRows == null) {
        throw new Error(
          `[p2b-canary] cost_log baseline count failed for ${month} ` +
            `(${baseCostErr?.message ?? 'null count'}) — aborting before spend (fail-closed).`,
        );
      }
      const baseCostKrw = await getMonthlyTotal(month, {
        client: supabase,
        callerKind: 'service-role',
      });
      // DB-side watermark (blind-audit LOW): cost_log.called_at is DB now(), so comparing
      // against the LOCAL clock is unsound under skew. Anchor the delta on the month's
      // current max(called_at) instead (2026-06 holds the 73차 selection rows → non-null;
      // epoch fallback keeps a hypothetical empty month correct).
      const { data: wmRow, error: wmErr } = await supabase
        .from('cost_log')
        .select('called_at')
        .eq('month', month)
        .order('called_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (wmErr) {
        throw new Error(
          `[p2b-canary] cost_log watermark read failed (${wmErr.message}) — aborting before spend.`,
        );
      }
      const costWatermark = (wmRow?.called_at as string | null) ?? '1970-01-01T00:00:00Z';

      // ── the real worker path (route DI mirror: report-worker/route.ts:59-60; chunkSize=1
      //    is the canary's only deviation from the route default 3 — cost control) ──────────
      const out = await runGuardedReportChunk({ month, client: supabase, chunkSize: 1 });

      // ── seam A: guarded chunk result shape ──
      expect(out.skipped).toBeUndefined();
      const result = out.result;
      expect(result).toBeDefined();
      if (!result) throw new Error('no result');
      expect(result.aborted).toBeNull();
      expect(result.notReady).toBeUndefined();
      expect(result.claimed).toBe(1);
      expect(result.done).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.deferred).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.remaining).toBe(29); // 30 enqueued − 1 done

      // ── seam B: job lifecycle (enqueue 30 + deterministic claim → done + report_id) ──
      const { data: jobs } = await supabase
        .from('report_batch_job')
        .select('ticker,status,attempts,report_id,last_error')
        .eq('month', month);
      expect(jobs?.length).toBe(30);
      const doneJobRows = (jobs ?? []).filter((j) => j.status === 'done');
      expect(doneJobRows.length).toBe(1);
      const doneJob = doneJobRows[0];
      expect(doneJob.attempts).toBe(1);
      expect(doneJob.report_id).toBeTruthy();
      const doneTicker = doneJob.ticker as string;
      // claim_next_report_jobs orders by ticker — lowest ticker of the 30 (deterministic).
      const minTicker = (jobs ?? []).map((j) => j.ticker as string).sort()[0];
      expect(doneTicker).toBe(minTicker);
      // ...and it must be the ticker pre-guard (5) predicted from short_list_30 (pre-spend
      // badge check target) — pins the claim path end-to-end.
      expect(doneTicker).toBe(expectedTicker);
      const pendingCount = (jobs ?? []).filter((j) => j.status === 'pending').length;
      expect(pendingCount).toBe(29);

      // ── seam C: canonical badge source — done ticker is an AI-badged short_list_30 row ──
      const { data: slRow } = await supabase
        .from('short_list_30')
        .select('ticker,consensus_badge,ai_score')
        .eq('month', monthDate)
        .eq('ticker', doneTicker)
        .single();
      expect(slRow?.ticker).toBe(doneTicker);
      expect(AI_BADGES).toContain(slRow?.consensus_badge);

      // ── seam D: stock_reports row — body 0~7 + appendix + section_8 + badge + is_latest ──
      const { data: report } = await supabase
        .from('stock_reports')
        .select(
          'id,ticker,month,is_latest,consensus_badge,section_0,section_1,section_2,section_3,section_4,section_5,section_6,section_7,section_8,appendix',
        )
        .eq('month', monthDate)
        .eq('ticker', doneTicker)
        .eq('is_latest', true)
        .single();
      expect(report).toBeTruthy();
      if (!report) throw new Error('no report row');
      // Section8 SOFT-SKIP diagnosis BEFORE the bare assert (omxy R1 HIGH + blind-audit MED):
      // body-complete + section_8 null + job done = the disclosed 'section8_unavailable /
      // section8_not_ready' terminal state (a panel transient or badge gap — NOT a wiring
      // bug). Name it explicitly so the post-spend RED carries its own recovery path.
      if (report.section_8 === null) {
        throw new Error(
          `[p2b-canary] SECTION8 SOFT-SKIP: body for ${doneTicker} committed+billed but ` +
            `section_8 is null (worker job done). Cause = section8_unavailable (Core-11 ` +
            `transient/key/billing) or section8_not_ready (badge gap). Recovery = production ` +
            `path only: next flag-on chunk's reset_section8_eligible_jobs re-pends the job and ` +
            `needsSection8Only adds Section 8 at panel-only cost (P4 driver does this ` +
            `naturally). This canary stays blocked by its single-shot guards — by design. ` +
            `Check the commit_section8_skipped console line in the run output for the status.`,
        );
      }
      expect(report.id).toBe(doneJob.report_id);
      for (const key of [
        'section_0',
        'section_1',
        'section_2',
        'section_3',
        'section_4',
        'section_5',
        'section_6',
        'section_7',
        'appendix',
      ] as const) {
        expect(report[key], `${key} must be persisted non-null`).not.toBeNull();
      }
      expect(report.section_8, 'section_8 must be committed (P2b core seam)').not.toBeNull();
      expect(report.consensus_badge).toBe(slRow?.consensus_badge);

      // section_8 canonical shape (writer.buildSection8AndVotes contract).
      const s8 = report.section_8 as Section8Shape;
      expect(Array.isArray(s8.partD)).toBe(true);
      expect(s8.partD.length).toBe(11);
      const revote = s8.partC.core_revote;
      expect(revote.buy + revote.hold + revote.sell).toBe(11);
      expect(['BUY', 'HOLD', 'SELL']).toContain(s8.partC.verdict);
      // false-GREEN tripwire (blind-audit MED): writer.parseContent falls back to
      // {vote:'HOLD', one_line:'parse failed'} on malformed persona JSON — 11 such stubs
      // would still pass every shape/enum assert above. The canary's job is proving the
      // REAL seam, so any parse-stub entry fails loud.
      const parseStubs = s8.partD.filter(
        (d) => (d as { one_line?: string }).one_line === 'parse failed',
      );
      expect(parseStubs.length, 'partD contains parse-failed stub entries').toBe(0);

      // ── seam E: committee_votes 11 rows — Core-11 ids, enum-mapped, revote-consistent ──
      const { data: votes } = await supabase
        .from('committee_votes')
        .select('persona_id,persona_layer,vote')
        .eq('report_id', report.id);
      expect(votes?.length).toBe(11);
      expect((votes ?? []).every((v) => v.persona_layer === 'core')).toBe(true);
      const votePersonaIds = new Set((votes ?? []).map((v) => v.persona_id));
      const coreIds = new Set(CORE_11_PERSONAS.map((p) => p.id));
      expect(votePersonaIds).toEqual(coreIds);
      // 0036 RPC maps BUY→approve / HOLD→abstain / SELL→reject.
      const enumCounts = { approve: 0, abstain: 0, reject: 0 };
      for (const v of votes ?? []) {
        expect(['approve', 'abstain', 'reject']).toContain(v.vote);
        enumCounts[v.vote as keyof typeof enumCounts] += 1;
      }
      expect(enumCounts.approve).toBe(revote.buy);
      expect(enumCounts.abstain).toBe(revote.hold);
      expect(enumCounts.reject).toBe(revote.sell);

      // ── seam F: cost_log delta — writer + critic (+revise) + 11 Core-11 vote-pass calls ──
      const { data: newCost } = await supabase
        .from('cost_log')
        .select('persona_id,model,ticker,cost_krw,called_by,called_at')
        .eq('month', month)
        .gt('called_at', costWatermark);
      const deltaRows = newCost ?? [];
      // minimum: writer 1 + critic 1 + panel 11 = 13 (revise conditional; transient retries may add).
      expect(deltaRows.length).toBeGreaterThanOrEqual(13);
      expect(deltaRows.every((r) => r.called_by === cronSystemUserId)).toBe(true);
      expect(deltaRows.every((r) => r.ticker === doneTicker)).toBe(true);
      const deltaPersonas = new Set(deltaRows.map((r) => r.persona_id));
      expect(deltaPersonas.has('full_report_writer')).toBe(true);
      expect(deltaPersonas.has('critic')).toBe(true);
      for (const id of coreIds) {
        expect(deltaPersonas.has(id), `panel cost row missing for persona ${id}`).toBe(true);
      }
      const deltaModels = new Set(deltaRows.map((r) => r.model));
      expect(deltaModels.has('claude-opus-4-8')).toBe(true); // full_report writer (D28 ④)
      // Section8 vote-pass = callPersona without slot binding → registry tier1_panel preferred.
      expect(deltaModels.has('claude-opus-4-7')).toBe(true);
      if (process.env.OPENAI_API_KEY) {
        expect(deltaModels.has('gpt-5.4')).toBe(true); // critic preferred (GPT cross-review, D28 ⑤)
      }
      const spentKrw = deltaRows.reduce((s, r) => s + Number(r.cost_krw), 0);
      expect(spentKrw).toBeGreaterThan(0);
      expect(spentKrw).toBeLessThan(SPEND_CEILING_KRW);

      // ── seam G: monthly total reflects the spend (cost accounting wired) ──
      const afterCostKrw = await getMonthlyTotal(month, {
        client: supabase,
        callerKind: 'service-role',
      });
      expect(afterCostKrw - baseCostKrw).toBeCloseTo(spentKrw, 1);
      const { count: afterCostRows } = await supabase
        .from('cost_log')
        .select('*', { count: 'exact', head: true })
        .eq('month', month);
      expect((afterCostRows ?? 0) - baseCostRows).toBe(deltaRows.length);

      // ── seam H: run-mutex released with succeeded + run_id fencing ──
      const { data: run } = await supabase
        .from('report_worker_run')
        .select('status,run_id,claimed_at,finished_at')
        .eq('month', month)
        .single();
      expect(run?.status).toBe('succeeded');
      expect(run?.run_id).toBeTruthy();

      // ── seam I: pipeline_health success row (summarize wired) ──
      const { data: ph } = await supabase
        .from('pipeline_health')
        .select('pipeline,status,error,started_at')
        .eq('pipeline', 'ai')
        .order('started_at', { ascending: false })
        .limit(1);
      expect(ph?.[0]?.status).toBe('success');

      // ── evidence dump (grep marker) ──
      const summary = {
        month,
        chunkResult: result,
        doneTicker,
        reportId: report.id,
        badge: report.consensus_badge,
        section8: {
          partDCount: s8.partD.length,
          coreRevote: revote,
          verdict: s8.partC.verdict,
        },
        committeeVotes: enumCounts,
        baseCostKrw,
        afterCostKrw,
        spentKrw: Number(spentKrw.toFixed(4)),
        deltaCostRows: deltaRows.length,
        deltaModels: [...deltaModels],
        deltaPersonas: [...deltaPersonas],
        pendingJobs: pendingCount,
        runStatus: run?.status,
        pipelineHealth: ph?.[0],
      };
      console.log('===P2B_CANARY_RESULT===\n' + JSON.stringify(summary, null, 2) + '\n===END===');
    },
  );

  it.skipIf(CONFIRMED)(
    'guard: without P2B_CANARY_CONFIRM the live canary is skipped AND cost/flag gates are not forced ($0)',
    () => {
      expect(CONFIRMED).toBe(false);
      // SC-4 pattern: setup-env-p2b must NOT have force-enabled the billing/flag gates
      // without the confirm flag.
      expect(process.env.P2B_CANARY_CONFIRM).not.toBe('1');
      expect(process.env.PR5_CRON_AUTO_ENABLED).not.toBe('true');
      expect(process.env.PR5B_SECTION8_ENABLED).not.toBe('true');
      expect(process.env.AI_COST_LOG_REAL_INSERT_ENABLED).not.toBe('true');
    },
  );
});
