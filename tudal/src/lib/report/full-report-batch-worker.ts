// PR5 — cron monthly-batch report-only worker (chunk driver).
// plan SoT: docs/superpowers/plans/2026-05-29-pr5-cron-monthly-batch-auto.md (omxy R1~R4 17 catch fix).
//
// 한 invocation = 1 chunk (CHUNK_N 종목 sequential). chunk-advance primary = daily cron 재호출(idempotent),
// self-continuation은 route의 optional accelerator. run-mutex는 route가 보유(단일 worker 보장 → cost 직렬화, R2 HIGH-1).
//
// 핵심 invariants:
//   - 순차 for-loop (병렬 fan-out 금지) — concurrent preflightHardcap race 차단 (R2 HIGH-1, §3.5).
//   - fail-closed step 0 (R2 HIGH-2 + R3 HIGH-1 + R3 MEDIUM-2): CRON_SYSTEM_USER_ID(UUID + auth.users 존재 via admin API)
//     + AI_COST_LOG_REAL_INSERT_ENABLED='true' (false면 cost_log noop → hardcap fail-open) — 첫 LLM 호출 전 abort.
//   - report-only: orchestrateFullReport(callerKind:'cron') → section_0~7 + appendix (cron UPSERT RPC). committee_votes = PR5b.
//   - idempotent skip: reportExistsAndCompleteForMonth (section_0 AND section_7).
//   - retry N=2 transient만 (full_report/critic/revise_llm_failed/429/529/network).
//   - alert enum CLOSED 12종: scheduler_fail / cost_warning / cost_hardcap만 사용 (enum 밖 신규 type 발행 금지).
import type { SupabaseClient } from '@supabase/supabase-js';
import { getActiveShortList } from '@/lib/data/admin-shortlist';
import { reportExistsAndCompleteForMonth } from '@/lib/data/admin-reports';
import { orchestrateFullReport } from '@/lib/report/full-report-orchestrator';
import { retryWithBackoff } from '@/lib/report/retry-with-backoff';
import { preflightHardcap, getMonthlyTotal } from '@/lib/cost/cost-logger';
import { ORCHESTRATE_TOTAL_COST_BUDGET_KRW } from '@/lib/cost/pricing';
import { insertPipelineHealth } from '@/lib/data/admin-pipeline-health-insert';
import { emitCostAlert } from '@/lib/data/admin-cost-alerts';
import { insertAlertEvents } from '@/lib/data/admin-alerts-insert';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_CHUNK_SIZE = 3;

export interface ReportBatchWorkerInput {
  month: string; // YYYY-MM
  client: SupabaseClient; // service-role (route가 생성)
  chunkSize?: number;
}

export interface ReportBatchWorkerResult {
  month: string;
  claimed: number;
  done: number;
  skipped: number;
  failed: number;
  deferred: number;
  remaining: number; // 다음 chunk 필요 여부 판단 (pending + reclaimable running)
  aborted: 'cost_hardcap' | null;
}

interface ShortListLite {
  ticker: string;
  name: string;
  sector: string;
}

interface BatchJobRow {
  id: string;
  ticker: string;
}

/**
 * 1 chunk 처리. route가 run-mutex 보유 상태에서 호출 (단일 worker 보장).
 * step 0 fail-closed 검증 통과 후에만 LLM 경로 진입.
 */
export async function runReportBatchChunk(
  input: ReportBatchWorkerInput,
): Promise<ReportBatchWorkerResult> {
  const { month, client } = input;
  const chunkSize = input.chunkSize ?? DEFAULT_CHUNK_SIZE;

  // ── step 0: fail-closed 선행 검증 (첫 LLM 호출 전, spend 0) ──────────────
  // (a) cost logging 강제 (R3 HIGH-1): false면 insertCostLog noop → getMonthlyTotal=0 → preflightHardcap fail-open.
  if (process.env.AI_COST_LOG_REAL_INSERT_ENABLED !== 'true') {
    throw new Error('cost_logging_disabled');
  }
  // (b) reserved cron-system user (R2 HIGH-2 + R3 HIGH-3 + R3 MEDIUM-2): cost_log.called_by FK auth.users.
  const adminUserId = process.env.CRON_SYSTEM_USER_ID;
  if (!adminUserId || !UUID_RE.test(adminUserId)) {
    throw new Error('cron_system_user_id_invalid');
  }
  // auth.users 존재 확인 — .from('auth.users')는 schema='public' default라 불가 → admin API (R3 MEDIUM-2).
  const { data: userData, error: userErr } =
    await client.auth.admin.getUserById(adminUserId);
  if (userErr || !userData?.user) {
    throw new Error('cron_system_user_not_found');
  }

  // ── enqueue idempotent: short_list_30 30 → report_batch_job (ON CONFLICT DO NOTHING) ──
  const shortList = (await getActiveShortList({ month, client })) as ShortListLite[];
  if (shortList.length > 0) {
    const enqueueRows = shortList.map((s) => ({ month, ticker: s.ticker }));
    const { error: enqErr } = await client
      .from('report_batch_job')
      .upsert(enqueueRows, { onConflict: 'month,ticker', ignoreDuplicates: true });
    if (enqErr) {
      throw new Error(`report_batch_enqueue_failed:${enqErr.code ?? 'unknown'}`);
    }
  }

  const metaByTicker = new Map<string, ShortListLite>(
    shortList.map((s) => [s.ticker, s]),
  );

  // ── batch preflight (best-effort, R4 MEDIUM-2): 남은 pending 수 기준 ──
  const { count: remainingBefore } = await client
    .from('report_batch_job')
    .select('id', { count: 'exact', head: true })
    .eq('month', month)
    .in('status', ['pending', 'running']);
  const pendingCount = remainingBefore ?? 0;
  const currentTotal = await getMonthlyTotal(month, { client });
  // hardcap 도달 시 chunk 진입 전 abort + alert (cost_hardcap).
  try {
    await preflightHardcap(
      {
        month,
        callCount: pendingCount,
        maxCostPerCallKrw: ORCHESTRATE_TOTAL_COST_BUDGET_KRW,
      },
      { client },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('cost_hardcap_40man')) {
      await emitCostAlert(
        {
          month,
          currentTotalKrw: currentTotal,
          projectedKrw: pendingCount * ORCHESTRATE_TOTAL_COST_BUDGET_KRW,
        },
        { client },
      );
      // 남은 pending을 deferred 표시 (이번 달 더 진행 안 함)
      await client
        .from('report_batch_job')
        .update({ status: 'deferred', last_error: 'cost_hardcap_40man', finished_at: new Date().toISOString() })
        .eq('month', month)
        .eq('status', 'pending');
      return {
        month,
        claimed: 0,
        done: 0,
        skipped: 0,
        failed: 0,
        deferred: pendingCount,
        remaining: 0,
        aborted: 'cost_hardcap',
      };
    }
    throw err;
  }

  // ── claim 1 chunk (atomic, SKIP LOCKED, attempts<3, stale sweep) ──
  const { data: claimed, error: claimErr } = await client.rpc(
    'claim_next_report_jobs',
    { p_month: month, p_limit: chunkSize },
  );
  if (claimErr) {
    throw new Error(`claim_next_report_jobs_failed:${claimErr.code ?? 'unknown'}`);
  }
  const jobs = (claimed ?? []) as BatchJobRow[];

  let done = 0;
  let skipped = 0;
  let failed = 0;
  const failedTickers: string[] = [];

  // ── 순차 처리 (병렬 fan-out 금지 — cost gate 직렬화, R2 HIGH-1) ──
  for (const job of jobs) {
    const meta = metaByTicker.get(job.ticker);
    // idempotent skip: 이미 완성된 본문이면 LLM 0
    const { complete } = await reportExistsAndCompleteForMonth(
      job.ticker,
      `${month}-01`,
      { client },
    );
    if (complete) {
      await client.rpc('mark_report_job', {
        p_id: job.id,
        p_status: 'done',
        p_report_id: null,
        p_error: null,
      });
      skipped += 1;
      continue;
    }
    if (!meta) {
      // short_list_30에 없는 stale job — failed 처리 (data drift)
      await client.rpc('mark_report_job', {
        p_id: job.id,
        p_status: 'failed',
        p_report_id: null,
        p_error: 'ticker_not_in_short_list',
      });
      failed += 1;
      failedTickers.push(job.ticker);
      continue;
    }

    try {
      const result = await retryWithBackoff(() =>
        orchestrateFullReport(
          {
            ticker: meta.ticker,
            name: meta.name,
            sector: meta.sector,
            month,
            tier1Verdict: 'HOLD',
            // report 생성 시 badge는 ⚪('AI 분석 대기') 불가 — reference caller(triggerFullReport)와 동일 '🟡'(관망/신규) stub.
            // 실 Tier 1 badge는 PR5b(committee votes) 연계 시 short_list_30/committee에서 source.
            consensusBadge: '🟡',
            financialsSummary: '',
            technicalsSummary: '',
            macroSummary: '',
            sectorReference: '',
            adminUserId,
          },
          { client, callerKind: 'cron' },
        ),
      );
      await client.rpc('mark_report_job', {
        p_id: job.id,
        p_status: 'done',
        p_report_id: result.reportId,
        p_error: null,
      });
      done += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // systemic abort: ai_key_unavailable / cost_hardcap_40man → 즉시 batch 중단
      if (msg.includes('ai_key_unavailable') || msg.includes('cost_hardcap_40man')) {
        await client.rpc('mark_report_job', {
          p_id: job.id,
          p_status: 'pending',
          p_report_id: null,
          p_error: msg,
        });
        await summarize(client, month, done, skipped, failed + 1, [...failedTickers, job.ticker], `systemic_abort:${msg}`);
        throw err;
      }
      // per-ticker 실패: 구조화 console.error (alert_event 발행 금지 — enum CLOSED, B78 격상)
      console.error(
        JSON.stringify({ event: 'ticker_full_report_failed', ticker: job.ticker, month, message: msg }),
      );
      await client.rpc('mark_report_job', {
        p_id: job.id,
        p_status: 'failed',
        p_report_id: null,
        p_error: msg,
      });
      failed += 1;
      failedTickers.push(job.ticker);
    }
  }

  // ── 남은 작업 수 (다음 chunk 필요 여부) ──
  const { count: remainingAfter } = await client
    .from('report_batch_job')
    .select('id', { count: 'exact', head: true })
    .eq('month', month)
    .in('status', ['pending', 'running']);
  const remaining = remainingAfter ?? 0;

  // ── 관측: pipeline_health 1 row + 조건부 summary alert ──
  await summarize(client, month, done, skipped, failed, failedTickers, null);

  return {
    month,
    claimed: jobs.length,
    done,
    skipped,
    failed,
    deferred: 0,
    remaining,
    aborted: null,
  };
}

// run-mutex로 보호된 chunk 실행 (R2 HIGH-1 + R3 HIGH-2). route + admin trigger 공용 entry —
// acquire_report_worker_lock(run_id) → chunk → release(run_id fencing). manual trigger도 반드시 이 경로 (mutex 우회 0).
export interface GuardedChunkOutput {
  skipped?: 'already_running';
  result?: ReportBatchWorkerResult;
}

export async function runGuardedReportChunk(
  input: ReportBatchWorkerInput,
): Promise<GuardedChunkOutput> {
  const { month, client } = input;
  const { data: runId, error: lockErr } = await client.rpc(
    'acquire_report_worker_lock',
    { p_month: month },
  );
  if (lockErr) {
    throw new Error(`acquire_lock_failed:${lockErr.code ?? 'unknown'}`);
  }
  if (!runId) {
    return { skipped: 'already_running' }; // 다른 non-stale worker 보유 중
  }
  try {
    const result = await runReportBatchChunk(input);
    await client.rpc('release_report_worker_lock', {
      p_month: month,
      p_run_id: runId,
      p_status: 'succeeded',
    });
    return { result };
  } catch (err) {
    // run_id fencing: stale reclaim 후 늦게 깨어난 old worker는 p_run_id 불일치로 no-op.
    await client.rpc('release_report_worker_lock', {
      p_month: month,
      p_run_id: runId,
      p_status: 'failed',
    });
    throw err;
  }
}

// pipeline_health row + (실패 시) scheduler_fail summary alert. 전 종목 성공이면 alert 0.
async function summarize(
  client: SupabaseClient,
  month: string,
  done: number,
  skipped: number,
  failed: number,
  failedTickers: string[],
  systemicError: string | null,
): Promise<void> {
  const processed = done + skipped + failed;
  const status = failed === 0 && systemicError === null ? 'success' : 'failed';
  await insertPipelineHealth(
    {
      pipeline: 'ai',
      status,
      error:
        status === 'failed'
          ? `${done} done / ${skipped} skipped / ${failed} failed${failedTickers.length ? `: ${failedTickers.join(',')}` : ''}${systemicError ? ` (${systemicError})` : ''}`
          : null,
    },
    { client },
  );

  if (status === 'failed') {
    const nowIso = new Date().toISOString();
    await insertAlertEvents(
      [
        {
          alertType: 'scheduler_fail',
          ticker: null,
          severity: 'critical',
          triggerReason: `cron monthly-report ${month}: ${done} done, ${failed} failed${failedTickers.length ? ` [${failedTickers.join(',')}]` : ''}${systemicError ? ` ${systemicError}` : ''} (processed ${processed})`,
          signalSentAt: nowIso,
          outcomeAt: null,
          t7PriceChange: null,
          decisionRecorded: null,
          decisionMemo: null,
        },
      ],
      { client },
    );
  }
}
