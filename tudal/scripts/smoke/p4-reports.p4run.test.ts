// ============================================================================
// P4 FULL report run — REAL AI + REAL production Supabase.
//
// Drives the report_batch_job 2026-06 queue to COMPLETION through the real
// report-worker chunk path: loops runGuardedReportChunk until remaining === 0.
// Per chunk: acquire run-mutex → step-0 fail-closed gates → enqueue 30
// (idempotent) → reset_section8_eligible_jobs → claim ≤chunkSize (0037 exact)
// → per ticker: body (writer Opus-4.8 → critic → conditional revise → persist)
// → Section8 LAST (Core-11 vote-pass 11 calls → commit_persona_eval_cron:
// section_8 + 11 committee_votes) → mark done → summarize → release.
//
// COST/TIME: P2b measured ~₩565/ticker (writer ~₩100 + critic ~₩23 + revise
// ~₩200 + panel 11×opus-4-7 ~₩240) → 27 remaining ≈ ₩15.3k. Driver delta
// ceiling ₩40,000 (worker hardcap ₩500k is the in-run guard; the ceiling stops
// the DRIVER loop early on pricing/loop regressions). ~3.2-3.5 min/ticker
// sequential ≈ 95-120 min.
//
// RESUMABLE / IDEMPOTENT (NOT single-shot — unlike the P2b canary): done jobs
// are skipped at LLM 0 (reportExistsAndCompleteForMonth), pending jobs are
// claimed in ticker order. If this process dies, re-running continues. A crash
// mid-chunk leaves 'running' rows that are stale-reclaimed after 10 min — if a
// re-run starts inside that window the driver aborts with guidance (no spend).
//
// SCOPE (honest boundary): worker-level driver, NOT route/cron coverage (no
// CRON_SECRET / route flag-gate / self-continue). Injects three USER-owned prod
// flags locally (PR5_CRON_AUTO_ENABLED, PR5B_SECTION8_ENABLED,
// AI_COST_LOG_REAL_INSERT_ENABLED) — Vercel prod stays unset → crons dormant.
// PRECONDITION: migration 0037 (claim_skip_locked_cte_fix) production-applied
// (✅ 2026-06-10, ledger 20260610015408) — claim exactness depends on it.
//
// HOW TO RUN (intentional, real money ≈ ₩15k; delta ceiling ₩40k):
//   cd tudal && P4_FULL_RUN_CONFIRM=1 npx vitest run --config vitest.p4-run.config.ts
//   optional: P4_EXPECT_MONTH=<YYYY-MM> (default 2026-06)
//             P4_CHUNK_SIZE=<n> (default: omitted → worker default 3, route mirror)
//             P4_COST_CEILING_KRW=<n> (default 40000, run-delta)
//             P4_MAX_CHUNKS=<n> (default 30)
// Without P4_FULL_RUN_CONFIRM=1 this test SKIPS and the cost/flag gates are NOT
// forced ($0). Not in `npm run test:ci`. NOTE: .env.local is authoritative —
// shell SUPABASE_*/ANTHROPIC_*/OPENAI_* overrides are clobbered (prod target).
// ============================================================================
import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import {
  runGuardedReportChunk,
  type ReportBatchWorkerResult,
} from '@/lib/report/full-report-batch-worker';
import { getMonthlyTotal } from '@/lib/cost/cost-logger';
import {
  getOrchestrateBudgetKrw,
  getRoleWorstCaseMaxCostPerCallKrw,
} from '@/lib/ai/model-registry';
import { CORE_11_PERSONAS } from '@/lib/ai/prompts/personas';

const CONFIRMED = process.env.P4_FULL_RUN_CONFIRM === '1';
const UUID_RE = /^[0-9a-f-]{36}$/i;
const AI_BADGES = ['🟢', '🔵', '🟣', '🟡'] as const;

function readPositiveFiniteNumber(envName: string, defaultValue: number): number {
  const raw = process.env[envName];
  const value = raw == null ? defaultValue : Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(
      `[p4-run] invalid ${envName}=${raw ?? String(defaultValue)} (expected finite number > 0)`,
    );
  }
  return value;
}

function readPositiveInteger(envName: string, defaultValue: number): number {
  const value = readPositiveFiniteNumber(envName, defaultValue);
  if (!Number.isInteger(value)) {
    throw new Error(`[p4-run] invalid ${envName}=${value} (expected positive integer)`);
  }
  return value;
}

// run-DELTA ceiling (not absolute month total — 2026-06 already carries the 73차/74차 audit rows).
const COST_CEILING_KRW = readPositiveFiniteNumber('P4_COST_CEILING_KRW', 40_000);
// 27 pending / 3 per chunk = 9 nominal; retries/stale-reclaims headroom → 30.
const MAX_CHUNKS = readPositiveInteger('P4_MAX_CHUNKS', 30);
// route mirror: route passes NO chunkSize (worker default 3). Override only when env-set.
const CHUNK_SIZE: number | undefined = process.env.P4_CHUNK_SIZE
  ? readPositiveInteger('P4_CHUNK_SIZE', 3)
  : undefined;

// route-local helper (report-worker/route.ts:35-39) — not exported, copied verbatim
// so the driver derives month through the same seam the cron route uses.
function currentMonthYM(): string {
  const now = new Date();
  const m = `${now.getUTCMonth() + 1}`.padStart(2, '0');
  return `${now.getUTCFullYear()}-${m}`;
}

interface Section8Shape {
  partC: {
    core_revote: { buy: number; hold: number; sell: number };
    verdict: 'BUY' | 'HOLD' | 'SELL';
  };
  partD: Array<{ persona_id: string; vote: string; one_line?: string }>;
}

interface JobStatusCounts {
  total: number;
  pending: number;
  running: number;
  done: number;
  failed: number;
  deferred: number;
}

async function loadJobCounts(client: SupabaseClient, month: string): Promise<JobStatusCounts> {
  const { data, error } = await client
    .from('report_batch_job')
    .select('status')
    .eq('month', month);
  if (error) throw new Error(`[p4-run] report_batch_job read failed: ${error.message}`);
  const rows = data ?? [];
  const count = (s: string) => rows.filter((r) => r.status === s).length;
  return {
    total: rows.length,
    pending: count('pending'),
    running: count('running'),
    done: count('done'),
    failed: count('failed'),
    deferred: count('deferred'),
  };
}

describe('P4 FULL report run (REAL AI + REAL prod Supabase, ≈₩15k, ~95-120min)', () => {
  it.runIf(CONFIRMED)(
    'drives report_batch_job to completion → 30 reports section_0~8 + 330 committee_votes',
    async () => {
      const supabase = createServiceRoleClient();
      const cronSystemUserId = (process.env.CRON_SYSTEM_USER_ID ?? '').toLowerCase();

      // month derivation via the real route seam (UTC); pin to the expected month so a
      // drifted run (e.g. July) fails loud at $0 instead of orphan-enqueueing a new month.
      const month = currentMonthYM();
      const monthDate = `${month}-01`;
      const expectedMonth = process.env.P4_EXPECT_MONTH ?? '2026-06';
      expect(month).toBe(expectedMonth);
      expect(cronSystemUserId).toMatch(UUID_RE);
      expect(process.env.PR5B_SECTION8_ENABLED).toBe('true');

      // ── $0 pre-guards ──────────────────────────────────────────────────────
      // (1) cron-system user exists — side-effect-free (worker step-0 would log a failed
      //     pipeline_health row + critical alert on this; verify cleanly first).
      const { data: cronUser, error: cronUserErr } =
        await supabase.auth.admin.getUserById(cronSystemUserId);
      if (cronUserErr || !cronUser?.user) {
        throw new Error(
          `[p4-run] CRON_SYSTEM_USER_ID ${cronSystemUserId} not found in auth.users ` +
            `(${cronUserErr?.message ?? 'no user'}) — aborting before spend.`,
        );
      }
      // (2) short_list_30: exactly 30 rows, ALL AI-badged. A ⚪/null badge would soft-skip
      //     Section8 (done with section_8 null) — fail loud before any spend.
      const { data: slRows, error: slErr } = await supabase
        .from('short_list_30')
        .select('ticker,consensus_badge')
        .eq('month', monthDate)
        .order('ticker', { ascending: true });
      if (slErr || !slRows) {
        throw new Error(`[p4-run] short_list_30 read failed (${slErr?.message ?? 'null'})`);
      }
      expect(slRows.length).toBe(30);
      const unbadged = slRows.filter(
        (r) => !AI_BADGES.includes(r.consensus_badge as (typeof AI_BADGES)[number]),
      );
      if (unbadged.length > 0) {
        throw new Error(
          `[p4-run] ${unbadged.length} short_list_30 row(s) not AI-badged ` +
            `(${unbadged.map((r) => `${r.ticker}:${r.consensus_badge}`).join(', ')}) — ` +
            `their Section8 would soft-skip. Aborting before spend.`,
        );
      }
      const badgeByTicker = new Map(slRows.map((r) => [r.ticker as string, r.consensus_badge]));
      // (3) queue sanity — RESUME-tolerant (any pending/done mix is fine) but fail-closed on
      //     states that need a human: failed (unclaimable — permanent without manual reset),
      //     deferred (badge gap — contradicts guard 2), running (a live/crashed worker; claims
      //     skip them for 10 min → re-run after the stale window or find the live process).
      const preCounts = await loadJobCounts(supabase, month);
      if (preCounts.total > 30) {
        throw new Error(`[p4-run] report_batch_job has ${preCounts.total} rows (>30) — audit first.`);
      }
      if (preCounts.failed > 0 || preCounts.deferred > 0) {
        throw new Error(
          `[p4-run] queue not driveable: failed=${preCounts.failed} deferred=${preCounts.deferred} ` +
            `— failed/deferred jobs are not reclaimable by claim; manual audit/reset first.`,
        );
      }
      // running rows: STALE (claimed_at older than the DB's 10-min claim window) is a normal
      // crashed-run resume state — claim_next_report_jobs reclaims them (0037), so let the
      // drive loop proceed. NON-stale running = live worker or too-fresh crash → abort at $0.
      // attempts>=3 stale rows would be swept to 'failed' at next claim → audit first instead.
      // ⚠️ clock basis (omxy R2 MED): the DB judges staleness with ITS now(); we only have the
      // local clock here (no migration-free way to read DB now() via PostgREST). A local clock
      // running AHEAD of the DB could misjudge a live worker's fresh claim as stale (false-pass
      // → duplicate-spend path). Mitigation: widen the abort window to 10min + 5min skew margin
      // = 15min — anything claimed within the last 15 LOCAL minutes aborts. False-abort only
      // widens the wait (=$0-safe); false-pass would need >5min local-ahead skew (NTP drift is
      // seconds). 15min also matches the run-mutex stale window, covering the lock-expired edge.
      if (preCounts.running > 0) {
        const { data: runningRows, error: runningErr } = await supabase
          .from('report_batch_job')
          .select('ticker,claimed_at,attempts')
          .eq('month', month)
          .eq('status', 'running');
        if (runningErr || !runningRows) {
          throw new Error(`[p4-run] running-row read failed (${runningErr?.message ?? 'null'})`);
        }
        const SKEW_MARGIN_MS = 5 * 60 * 1000;
        const abortCutoffMs = Date.now() - (10 * 60 * 1000 + SKEW_MARGIN_MS);
        const nonStale = runningRows.filter(
          (r) => new Date(r.claimed_at as string).getTime() > abortCutoffMs,
        );
        if (nonStale.length > 0) {
          throw new Error(
            `[p4-run] ${nonStale.length} 'running' row(s) claimed within the last 15 local ` +
              `minutes (${nonStale.map((r) => r.ticker).join(', ')}) — a live worker or a crash ` +
              `inside the stale window (10min DB + 5min skew margin). Wait it out and re-run ` +
              `(resumable). Aborting before spend.`,
          );
        }
        const exhausted = runningRows.filter((r) => (r.attempts as number) >= 3);
        if (exhausted.length > 0) {
          throw new Error(
            `[p4-run] stale 'running' row(s) with attempts>=3 ` +
              `(${exhausted.map((r) => r.ticker).join(', ')}) — next claim would sweep them to ` +
              `'failed' permanently. Manual audit/reset first. Aborting before spend.`,
          );
        }
        // stale(+margin) + attempts<3 → proceed; the first chunk's claim reclaims them
        // (the claim RPC re-checks staleness with DB now() — the authoritative judge).
      }

      // ── baselines (delta-based: month already carries 73차/74차 audit rows) ──
      const baseCostKrw = await getMonthlyTotal(month, {
        client: supabase,
        callerKind: 'service-role',
      });
      const { count: baseCostRows, error: baseCostRowsErr } = await supabase
        .from('cost_log')
        .select('*', { count: 'exact', head: true })
        .eq('month', month);
      if (baseCostRowsErr || baseCostRows == null) {
        throw new Error(`[p4-run] cost_log baseline count failed — aborting before spend.`);
      }
      // DB-side watermark (cost_log.called_at = DB now(); local clock unsound under skew).
      const { data: wmRow, error: wmErr } = await supabase
        .from('cost_log')
        .select('called_at')
        .eq('month', month)
        .order('called_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (wmErr) throw new Error(`[p4-run] cost watermark read failed (${wmErr.message})`);
      const costWatermark = (wmRow?.called_at as string | null) ?? '1970-01-01T00:00:00Z';
      const baseDone = preCounts.done;

      console.log(
        `===P4_RUN_PLAN=== ${JSON.stringify({
          month,
          preCounts,
          baseCostKrw: Number(baseCostKrw.toFixed(2)),
          ceilingKrw: COST_CEILING_KRW,
          chunkSize: CHUNK_SIZE ?? 'worker-default(3)',
          maxChunks: MAX_CHUNKS,
        })}`,
      );

      // ── drive loop (P3 full-run pattern) ──────────────────────────────────
      // reservation-style ceiling (omxy R1 MED + R3): a chunk's TRUE worst case includes
      // retryWithBackoff re-running the whole orchestrate (writer+critic+revise AND the
      // Section8 11-call vote-pass, since Section8 runs inside orchestrate) up to 3 attempts.
      // perTickerWorst = 3 × (orchestrate budget + 11 × tier1_panel worst). Abort BEFORE a
      // chunk whose worst case could push the run delta past the ceiling — a true pre-spend
      // stop even under maximal retries.
      const MAX_ORCHESTRATE_ATTEMPTS = 3; // retry-with-backoff.ts: retries default 2 → 3 attempts
      const perTickerWorstKrw =
        MAX_ORCHESTRATE_ATTEMPTS *
        (getOrchestrateBudgetKrw() +
          CORE_11_PERSONAS.length * getRoleWorstCaseMaxCostPerCallKrw('tier1_panel'));
      const effectiveChunkSize = CHUNK_SIZE ?? 3; // worker DEFAULT_CHUNK_SIZE mirror
      let chunks = 0;
      let lastResult: ReportBatchWorkerResult | null = null;
      for (;;) {
        if (chunks >= MAX_CHUNKS) {
          throw new Error(
            `[p4-run] exceeded MAX_CHUNKS=${MAX_CHUNKS} without completion — investigate job statuses`,
          );
        }
        // driver-level run-delta ceiling — reserve next chunk's worst case up front.
        const totalNow = await getMonthlyTotal(month, { client: supabase, callerKind: 'service-role' });
        const deltaNow = totalNow - baseCostKrw;
        const nextChunkWorst = effectiveChunkSize * perTickerWorstKrw;
        if (deltaNow + nextChunkWorst > COST_CEILING_KRW) {
          throw new Error(
            `[p4-run] driver cost ceiling: run delta ₩${deltaNow.toFixed(2)} + next-chunk worst ` +
              `₩${nextChunkWorst.toFixed(2)} > ₩${COST_CEILING_KRW} — aborting before next chunk ` +
              `(queue is resumable; raise P4_COST_CEILING_KRW only if intentional)`,
          );
        }

        const out = await runGuardedReportChunk({
          month,
          client: supabase,
          ...(CHUNK_SIZE !== undefined ? { chunkSize: CHUNK_SIZE } : {}),
        });
        chunks += 1;

        if (out.skipped) {
          // sequential driver never overlaps itself → foreign lock or <15min stale from a
          // crashed run. No finalize concept here (unlike selection) — always investigate.
          throw new Error(
            `[p4-run] acquire returned already_running (chunk#${chunks}) — foreign worker or ` +
              `crashed run within the 15-min lock stale window. Wait and re-run (resumable).`,
          );
        }
        const r = out.result;
        if (!r) throw new Error(`[p4-run] chunk#${chunks} returned no result`);
        lastResult = r;
        console.log(
          `===P4_RUN_PROGRESS=== chunk#${chunks} ` +
            JSON.stringify({
              claimed: r.claimed,
              done: r.done,
              skipped: r.skipped,
              failed: r.failed,
              deferred: r.deferred,
              remaining: r.remaining,
              aborted: r.aborted,
            }),
        );

        if (r.notReady) {
          throw new Error(`[p4-run] worker notReady: ${r.notReady.reason} — shortlist drift?`);
        }
        if (r.aborted) {
          throw new Error(`[p4-run] worker aborted: ${r.aborted}`);
        }
        if (r.failed > 0) {
          // per-ticker failure: attempts<3 jobs stay 'failed' (NOT reclaimable by claim) →
          // continuing would end with <30 done. Stop immediately with the failed tickers
          // visible in the chunk log + report_batch_job.last_error for diagnosis.
          throw new Error(
            `[p4-run] chunk#${chunks} had ${r.failed} per-ticker failure(s) — failed jobs are not ` +
              `reclaimable; audit report_batch_job.last_error before re-running.`,
          );
        }
        if (r.remaining === 0) break;
        // stall guard: no claim + no work and not finished → stuck running rows (stale window).
        if (r.claimed === 0 && r.done === 0 && r.skipped === 0) {
          throw new Error(
            `[p4-run] stalled (claimed=0, no progress, remaining=${r.remaining}) — likely 'running' ` +
              `rows inside the 10-min job-stale window from a crashed run. Wait 10 min and re-run.`,
          );
        }
      }

      // ── final verification ─────────────────────────────────────────────────
      // jobs: all 30 done, nothing else.
      const postCounts = await loadJobCounts(supabase, month);
      expect(postCounts).toEqual({
        total: 30,
        pending: 0,
        running: 0,
        done: 30,
        failed: 0,
        deferred: 0,
      });

      // reports: 30 rows, every section + appendix + section_8 non-null, is_latest, badge match,
      // Section8 shape + parse-stub tripwire (writer.parseContent fallback = 'parse failed').
      const { data: reports, error: repErr } = await supabase
        .from('stock_reports')
        .select(
          'id,ticker,is_latest,consensus_badge,section_0,section_1,section_2,section_3,section_4,section_5,section_6,section_7,section_8,appendix',
        )
        .eq('month', monthDate);
      if (repErr || !reports) throw new Error(`[p4-run] stock_reports read failed`);
      expect(reports.length).toBe(30);
      const verdictCounts = { BUY: 0, HOLD: 0, SELL: 0 };
      for (const rep of reports) {
        expect(rep.is_latest, `${rep.ticker} is_latest`).toBe(true);
        for (const key of [
          'section_0',
          'section_1',
          'section_2',
          'section_3',
          'section_4',
          'section_5',
          'section_6',
          'section_7',
          'section_8',
          'appendix',
        ] as const) {
          expect(rep[key], `${rep.ticker}.${key} must be non-null`).not.toBeNull();
        }
        expect(rep.consensus_badge, `${rep.ticker} badge`).toBe(badgeByTicker.get(rep.ticker as string));
        const s8 = rep.section_8 as Section8Shape;
        expect(s8.partD.length, `${rep.ticker} partD`).toBe(11);
        const revote = s8.partC.core_revote;
        expect(revote.buy + revote.hold + revote.sell, `${rep.ticker} revote sum`).toBe(11);
        expect(['BUY', 'HOLD', 'SELL']).toContain(s8.partC.verdict);
        verdictCounts[s8.partC.verdict] += 1;
        const stubs = s8.partD.filter((d) => d.one_line === 'parse failed');
        expect(stubs.length, `${rep.ticker} partD parse-failed stubs`).toBe(0);
      }

      // committee_votes: 11 per report, 330 total, core layer, Core-11 id set.
      const reportIds = reports.map((r) => r.id as string);
      const { data: votes, error: votesErr } = await supabase
        .from('committee_votes')
        .select('report_id,persona_id,persona_layer,vote')
        .in('report_id', reportIds);
      if (votesErr || !votes) throw new Error(`[p4-run] committee_votes read failed`);
      expect(votes.length).toBe(330);
      expect(votes.every((v) => v.persona_layer === 'core')).toBe(true);
      expect(votes.every((v) => ['approve', 'abstain', 'reject'].includes(v.vote as string))).toBe(true);
      const coreIds = new Set(CORE_11_PERSONAS.map((p) => p.id));
      const byReport = new Map<string, Set<string>>();
      for (const v of votes) {
        const set = byReport.get(v.report_id as string) ?? new Set<string>();
        set.add(v.persona_id as string);
        byReport.set(v.report_id as string, set);
      }
      for (const [rid, ids] of byReport) {
        expect(ids, `report ${rid} persona id set`).toEqual(coreIds);
      }

      // cost accounting: delta rows beyond the watermark, all by cron user, spend within ceiling.
      // RESUME-tolerant (omxy R1 MED): no strict lower bound on row count or spend — a re-run on
      // an already-complete queue legitimately bills ₩0, and a crash-after-commit-before-mark
      // resume can mark a job done at LLM 0. The essential correctness is the 30 complete
      // reports + 330 votes asserted above; cost checks here are accounting-consistency only.
      const { data: newCost, error: newCostErr } = await supabase
        .from('cost_log')
        .select('persona_id,model,ticker,cost_krw,called_by')
        .eq('month', month)
        .gt('called_at', costWatermark);
      if (newCostErr || !newCost) throw new Error(`[p4-run] cost_log delta read failed`);
      const newDone = 30 - baseDone;
      expect(newCost.every((r) => r.called_by === cronSystemUserId)).toBe(true);
      const spentKrw = newCost.reduce((s, r) => s + Number(r.cost_krw), 0);
      expect(spentKrw).toBeLessThanOrEqual(COST_CEILING_KRW);
      const afterCostKrw = await getMonthlyTotal(month, {
        client: supabase,
        callerKind: 'service-role',
      });
      expect(afterCostKrw - baseCostKrw).toBeCloseTo(spentKrw, 1);
      const deltaModels = new Set(newCost.map((r) => r.model));
      if (newCost.length > 0) {
        expect(deltaModels.has('claude-opus-4-8')).toBe(true); // writer
        expect(deltaModels.has('claude-opus-4-7')).toBe(true); // Section8 vote-pass (tier1_panel preferred)
        if (process.env.OPENAI_API_KEY) {
          expect(deltaModels.has('gpt-5.4')).toBe(true); // critic
        }
      }

      // run-mutex released + pipeline_health success.
      const { data: run } = await supabase
        .from('report_worker_run')
        .select('status,run_id')
        .eq('month', month)
        .single();
      expect(run?.status).toBe('succeeded');
      const { data: ph } = await supabase
        .from('pipeline_health')
        .select('pipeline,status,started_at')
        .eq('pipeline', 'ai')
        .order('started_at', { ascending: false })
        .limit(1);
      expect(ph?.[0]?.status).toBe('success');

      // ── evidence dump (grep marker) ──
      const summary = {
        month,
        chunks,
        lastChunk: lastResult,
        jobs: postCounts,
        reports: reports.length,
        verdictCounts,
        votesTotal: votes.length,
        newDoneThisRun: newDone,
        baseCostKrw: Number(baseCostKrw.toFixed(2)),
        afterCostKrw: Number(afterCostKrw.toFixed(2)),
        spentKrw: Number(spentKrw.toFixed(2)),
        deltaCostRows: newCost.length,
        deltaModels: [...deltaModels],
        runStatus: run?.status,
      };
      console.log('===P4_RUN_RESULT===\n' + JSON.stringify(summary, null, 2) + '\n===END===');
    },
  );

  it.skipIf(CONFIRMED)(
    'guard: without P4_FULL_RUN_CONFIRM the run is skipped AND cost/flag gates are not forced ($0)',
    () => {
      expect(CONFIRMED).toBe(false);
      expect(process.env.P4_FULL_RUN_CONFIRM).not.toBe('1');
      expect(process.env.PR5_CRON_AUTO_ENABLED).not.toBe('true');
      expect(process.env.PR5B_SECTION8_ENABLED).not.toBe('true');
      expect(process.env.AI_COST_LOG_REAL_INSERT_ENABLED).not.toBe('true');
    },
  );
});
