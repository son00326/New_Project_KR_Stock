// PR5 — cron monthly-batch report-only worker (chunk driver).
// plan SoT: docs/superpowers/plans/2026-05-29-pr5-cron-monthly-batch-auto.md (omxy R1~R4 17 catch fix).
//
// 한 invocation = 1 chunk (CHUNK_N 종목 sequential). chunk-advance primary = daily cron 재호출(idempotent),
// self-continuation은 route의 optional accelerator. run-mutex는 route가 보유(단일 worker 보장 → cost 직렬화, R2 HIGH-1).
//
// 핵심 invariants:
//   - 순차 for-loop (병렬 fan-out 금지) — concurrent preflightHardcap race 차단 (R2 HIGH-1, §3.5).
//   - fail-closed step 0 (R2 HIGH-2 + R3 HIGH-1 + R3 MEDIUM-2): CRON_SYSTEM_USER_ID(UUID + auth.users 존재 via admin API)
//     + AI_COST_LOG_REAL_INSERT_ENABLED='true' + PR5_CRON_AUTO_ENABLED='true' — 첫 LLM 호출 전 abort.
//   - report-only: orchestrateFullReport(callerKind:'cron') → section_0~7 + appendix (cron UPSERT RPC). committee_votes = PR5b.
//   - idempotent skip: reportExistsAndCompleteForMonth (section_0 AND section_7).
//   - retry N=2 transient만 (full_report/critic/revise_llm_failed/429/529/network).
//   - alert enum CLOSED 12종: scheduler_fail / cost_warning / cost_hardcap만 사용 (enum 밖 신규 type 발행 금지).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShortListItem } from "@/types/admin";
import { getActiveShortList } from "@/lib/data/admin-shortlist";
import { reportExistsAndCompleteForMonth } from "@/lib/data/admin-reports";
import { orchestrateFullReport } from "@/lib/report/full-report-orchestrator";
import { enrichReportInput } from "@/lib/report/report-input-enricher";
import { retryWithBackoff } from "@/lib/report/retry-with-backoff";
import { preflightHardcap, getMonthlyTotal } from "@/lib/cost/cost-logger";
import { getOrchestrateBudgetKrw } from "@/lib/ai/model-registry";
import { insertPipelineHealth } from "@/lib/data/admin-pipeline-health-insert";
import { emitCostAlert } from "@/lib/data/admin-cost-alerts";
import { insertAlertEvents } from "@/lib/data/admin-alerts-insert";

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
  aborted: "cost_hardcap" | null;
  // W2a Task 9.5 (R3 HIGH-2 + R4 MED-5): 트랙 split로 일시 shortlist<30 가능. 502+critical false-alarm
  //   대신 not-ready clean skip — 텔레메트리(alert/pipeline-health) 발행 前 early-return. route는 200 skip.
  notReady?: { reason: "shortlist_not_ready" };
}

// PR-H scope 2: enqueue는 ticker만 사용하지만, chunk enrich(consensusBadge/aiScore/Tier0)를 위해
//   full ShortListItem row를 metaByTicker에 보존한다 (getActiveShortList가 이미 full row 반환).
interface BatchJobRow {
  id: string;
  ticker: string;
}

async function abortBeforeSpend(
  client: SupabaseClient,
  month: string,
  code: string,
): Promise<never> {
  try {
    await summarize(client, month, 0, 0, 1, [], `preflight_abort:${code}`);
  } catch (alertErr) {
    console.error(
      JSON.stringify({
        event: "report_worker_preflight_alert_failed",
        month,
        code,
        message:
          alertErr instanceof Error ? alertErr.message : String(alertErr),
      }),
    );
  }
  throw new Error(code);
}

async function markJob(
  client: SupabaseClient,
  args: {
    id: string;
    status: "pending" | "running" | "done" | "failed" | "deferred";
    reportId: string | null;
    error: string | null;
  },
): Promise<void> {
  const { error } = await client.rpc("mark_report_job", {
    p_id: args.id,
    p_status: args.status,
    p_report_id: args.reportId,
    p_error: args.error,
  });
  if (error) {
    throw new Error(`mark_report_job_failed:${error.code ?? "unknown"}`);
  }
}

async function deferOpenJobs(
  client: SupabaseClient,
  month: string,
  reason: string,
): Promise<void> {
  const { error } = await client
    .from("report_batch_job")
    .update({
      status: "deferred",
      last_error: reason,
      finished_at: new Date().toISOString(),
    })
    .eq("month", month)
    .in("status", ["pending", "running"]);
  if (error) {
    throw new Error(`report_batch_defer_failed:${error.code ?? "unknown"}`);
  }
}

async function emitCostAlertBestEffort(
  ctx: Parameters<typeof emitCostAlert>[0],
  options: Parameters<typeof emitCostAlert>[1],
): Promise<void> {
  try {
    await emitCostAlert(ctx, options);
  } catch (err) {
    console.error(
      JSON.stringify({
        event: "report_worker_cost_alert_failed",
        month: ctx.month,
        message: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}

async function resetJobForSystemicAbort(
  client: SupabaseClient,
  jobId: string,
  message: string,
): Promise<void> {
  const { error } = await client
    .from("report_batch_job")
    .update({
      status: "pending",
      attempts: 0,
      last_error: message,
      claimed_at: null,
      started_at: null,
      finished_at: null,
    })
    .eq("id", jobId);
  if (error) {
    throw new Error(`report_job_reset_failed:${error.code ?? "unknown"}`);
  }
}

async function releaseWorkerLock(
  client: SupabaseClient,
  month: string,
  runId: string,
  status: "succeeded" | "failed",
): Promise<void> {
  const { error } = await client.rpc("release_report_worker_lock", {
    p_month: month,
    p_run_id: runId,
    p_status: status,
  });
  if (error) {
    throw new Error(
      `release_report_worker_lock_failed:${error.code ?? "unknown"}`,
    );
  }
}

/**
 * 1 chunk 처리. route가 run-mutex 보유 상태에서 호출 (단일 worker 보장).
 * step 0 fail-closed 검증 통과 후에만 LLM 경로 진입.
 */
export async function runReportBatchChunk(
  input: ReportBatchWorkerInput,
): Promise<ReportBatchWorkerResult> {
  const { month, client } = input;
  const monthDate = `${month}-01`;
  const chunkSize = input.chunkSize ?? DEFAULT_CHUNK_SIZE;

  // ── step 0: fail-closed 선행 검증 (첫 LLM 호출 전, spend 0) ──────────────
  // (a0) cron UPSERT feature flag 강제: route gate 우회(manual/direct entry)도 spend 0으로 fail-closed.
  if (process.env.PR5_CRON_AUTO_ENABLED !== "true") {
    return await abortBeforeSpend(client, month, "pr5_cron_auto_disabled");
  }
  // (a) cost logging 강제 (R3 HIGH-1): false면 insertCostLog noop → getMonthlyTotal=0 → preflightHardcap fail-open.
  if (process.env.AI_COST_LOG_REAL_INSERT_ENABLED !== "true") {
    return await abortBeforeSpend(client, month, "cost_logging_disabled");
  }
  // (b) reserved cron-system user (R2 HIGH-2 + R3 HIGH-3 + R3 MEDIUM-2): cost_log.called_by FK auth.users.
  const adminUserId = process.env.CRON_SYSTEM_USER_ID;
  if (!adminUserId || !UUID_RE.test(adminUserId)) {
    return await abortBeforeSpend(client, month, "cron_system_user_id_invalid");
  }
  const cronSystemUserId: string = adminUserId;
  // auth.users 존재 확인 — .from('auth.users')는 schema='public' default라 불가 → admin API (R3 MEDIUM-2).
  const { data: userData, error: userErr } =
    await client.auth.admin.getUserById(cronSystemUserId);
  if (userErr || !userData?.user) {
    return await abortBeforeSpend(client, month, "cron_system_user_not_found");
  }

  // ── enqueue idempotent: short_list_30 30 → report_batch_job (ON CONFLICT DO NOTHING) ──
  // short_list_30.month is a date column (YYYY-MM-DD); report_batch_job.month stays YYYY-MM.
  const shortList = (await getActiveShortList({
    month: monthDate,
    client,
  })) as ShortListItem[];
  if (shortList.length === 0) {
    console.info(
      JSON.stringify({
        event: "short_list_not_seeded",
        month,
      }),
    );
    return {
      month,
      claimed: 0,
      done: 0,
      skipped: 0,
      failed: 0,
      deferred: 0,
      remaining: 0,
      aborted: null,
    };
  }
  if (shortList.length !== 30) {
    // W2a Task 9.5 (R3 HIGH-2 + R4 MED-5): 트랙 split로 일시 1~29행 가능 → fail-closed(502+critical alert)
    //   대신 not-ready clean skip. summarize/alert/pipeline-health 발행 前 early-return (false-alarm 차단, spend 0).
    return {
      month,
      claimed: 0,
      done: 0,
      skipped: 0,
      failed: 0,
      deferred: 0,
      remaining: 0,
      aborted: null,
      notReady: { reason: "shortlist_not_ready" },
    };
  }
  if (shortList.length > 0) {
    const enqueueRows = shortList.map((s) => ({ month, ticker: s.ticker }));
    const { error: enqErr } = await client
      .from("report_batch_job")
      .upsert(enqueueRows, {
        onConflict: "month,ticker",
        ignoreDuplicates: true,
      });
    if (enqErr) {
      throw new Error(
        `report_batch_enqueue_failed:${enqErr.code ?? "unknown"}`,
      );
    }
  }

  const metaByTicker = new Map<string, ShortListItem>(
    shortList.map((s) => [s.ticker, s]),
  );

  // ── claim 1 chunk (atomic, SKIP LOCKED, attempts<3, stale sweep) ──
  const { data: claimed, error: claimErr } = await client.rpc(
    "claim_next_report_jobs",
    { p_month: month, p_limit: chunkSize },
  );
  if (claimErr) {
    throw new Error(
      `claim_next_report_jobs_failed:${claimErr.code ?? "unknown"}`,
    );
  }
  const jobs = (claimed ?? []) as BatchJobRow[];

  // ── batch preflight (best-effort, R4 MEDIUM-2): 남은 pending 수 기준 ──
  const { count: remainingBefore, error: remainingBeforeErr } = await client
    .from("report_batch_job")
    .select("id", { count: "exact", head: true })
    .eq("month", month)
    .in("status", ["pending", "running"]);
  if (remainingBeforeErr) {
    throw new Error(
      `report_batch_count_failed:${remainingBeforeErr.code ?? "unknown"}`,
    );
  }
  const pendingCount = remainingBefore ?? 0;
  // STEP-2: service-role client → 직접 SELECT(RLS bypass) 유지. admin-only RPC 미경유(worker 무회귀).
  const currentTotal = await getMonthlyTotal(month, { client, callerKind: 'service-role' });
  // W0 D28 ③: registry worst-case 합산 (writer+critic+revise) — critic GPT resolve 시 Haiku 고정 상수 undercount 차단.
  const orchestrateBudgetKrw = getOrchestrateBudgetKrw();
  const projectedKrw = pendingCount * orchestrateBudgetKrw;
  // hardcap 도달 시 chunk 진입 전 abort + alert (cost_hardcap).
  try {
    await preflightHardcap(
      {
        month,
        callCount: pendingCount,
        maxCostPerCallKrw: orchestrateBudgetKrw,
      },
      // STEP-2: preflightHardcap이 options를 getMonthlyTotal로 전파 → service-role 직접 SELECT 고정.
      { client, callerKind: 'service-role' },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("cost_hardcap_exceeded")) {
      // 남은 pending/running을 먼저 deferred 표시해야 alert insert 장애가 month-stop을 막지 않는다.
      await deferOpenJobs(client, month, "cost_hardcap_exceeded");
      await emitCostAlertBestEffort(
        {
          month,
          currentTotalKrw: currentTotal,
          projectedKrw,
        },
        { client },
      );
      await summarize(
        client,
        month,
        0,
        0,
        1,
        [],
        "systemic_abort:cost_hardcap_exceeded",
      );
      return {
        month,
        claimed: 0,
        done: 0,
        skipped: 0,
        failed: 0,
        deferred: pendingCount,
        remaining: 0,
        aborted: "cost_hardcap",
      };
    }
    throw err;
  }
  await emitCostAlertBestEffort(
    {
      month,
      currentTotalKrw: currentTotal,
      projectedKrw,
    },
    { client },
  );
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
      await markJob(client, {
        id: job.id,
        status: "done",
        reportId: null,
        error: null,
      });
      skipped += 1;
      continue;
    }
    if (!meta) {
      // short_list_30에 없는 stale job — failed 처리 (data drift)
      await markJob(client, {
        id: job.id,
        status: "failed",
        reportId: null,
        error: "ticker_not_in_short_list",
      });
      failed += 1;
      failedTickers.push(job.ticker);
      continue;
    }

    try {
      // PR-H scope 2: stub("HOLD"/"🟡"/"") → enrichReportInput(row) 실값 (short_list_30 배지/점수 +
      //   DART 재무, cost 0 SELECT). financials SELECT 에러는 throw → per-ticker isolation(아래 catch).
      //   미캐시 ticker는 graceful. macroSummary는 S7b 전까지 "근거 부족"(enrich 내부 고정).
      const enrich = await enrichReportInput(meta, { client });
      const result = await retryWithBackoff(() =>
        orchestrateFullReport(
          {
            ticker: meta.ticker,
            name: meta.name,
            sector: meta.sector,
            month,
            tier1Verdict: enrich.tier1Verdict,
            consensusBadge: enrich.consensusBadge,
            financialsSummary: enrich.financialsSummary,
            technicalsSummary: enrich.technicalsSummary,
            macroSummary: enrich.macroSummary,
            sectorReference: enrich.sectorReference,
            adminUserId: cronSystemUserId,
          },
          { client, callerKind: "cron" },
        ),
      );
      await markJob(client, {
        id: job.id,
        status: "done",
        reportId: result.reportId,
        error: null,
      });
      done += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // systemic abort: ai_key_unavailable / cost_hardcap_exceeded → 즉시 batch 중단
      if (
        msg.includes("ai_key_unavailable") ||
        msg.includes("cost_hardcap_exceeded")
      ) {
        if (msg.includes("cost_hardcap_exceeded")) {
          await deferOpenJobs(client, month, "cost_hardcap_exceeded");
          const currentTotalAfter = await getMonthlyTotal(month, { client, callerKind: 'service-role' });
          await emitCostAlertBestEffort(
            {
              month,
              currentTotalKrw: currentTotalAfter,
              projectedKrw: orchestrateBudgetKrw,
            },
            { client },
          );
        } else {
          await resetJobForSystemicAbort(client, job.id, msg);
        }
        await summarize(
          client,
          month,
          done,
          skipped,
          failed + 1,
          [...failedTickers, job.ticker],
          `systemic_abort:${msg}`,
        );
        throw err;
      }
      // per-ticker 실패: 구조화 console.error (alert_event 발행 금지 — enum CLOSED, B78 격상)
      console.error(
        JSON.stringify({
          event: "ticker_full_report_failed",
          ticker: job.ticker,
          month,
          message: msg,
        }),
      );
      await markJob(client, {
        id: job.id,
        status: "failed",
        reportId: null,
        error: msg,
      });
      failed += 1;
      failedTickers.push(job.ticker);
    }
  }

  // ── 남은 작업 수 (다음 chunk 필요 여부) ──
  const { count: remainingAfter, error: remainingAfterErr } = await client
    .from("report_batch_job")
    .select("id", { count: "exact", head: true })
    .eq("month", month)
    .in("status", ["pending", "running"]);
  if (remainingAfterErr) {
    throw new Error(
      `report_batch_count_failed:${remainingAfterErr.code ?? "unknown"}`,
    );
  }
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
  skipped?: "already_running";
  result?: ReportBatchWorkerResult;
}

export async function runGuardedReportChunk(
  input: ReportBatchWorkerInput,
): Promise<GuardedChunkOutput> {
  const { month, client } = input;
  const { data: runId, error: lockErr } = await client.rpc(
    "acquire_report_worker_lock",
    { p_month: month },
  );
  if (lockErr) {
    throw new Error(`acquire_lock_failed:${lockErr.code ?? "unknown"}`);
  }
  if (!runId) {
    return { skipped: "already_running" }; // 다른 non-stale worker 보유 중
  }
  let chunkSucceeded = false;
  try {
    const result = await runReportBatchChunk(input);
    await releaseWorkerLock(client, month, runId as string, "succeeded");
    chunkSucceeded = true;
    return { result };
  } catch (err) {
    if (!chunkSucceeded) {
      // run_id fencing: stale reclaim 후 늦게 깨어난 old worker는 p_run_id 불일치로 no-op.
      try {
        await releaseWorkerLock(client, month, runId as string, "failed");
      } catch (releaseErr) {
        console.error(
          JSON.stringify({
            event: "report_worker_lock_release_failed",
            month,
            message:
              releaseErr instanceof Error
                ? releaseErr.message
                : String(releaseErr),
          }),
        );
      }
    }
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
  const status = failed === 0 && systemicError === null ? "success" : "failed";
  await insertPipelineHealth(
    {
      pipeline: "ai",
      status,
      error:
        status === "failed"
          ? `${done} done / ${skipped} skipped / ${failed} failed${failedTickers.length ? `: ${failedTickers.join(",")}` : ""}${systemicError ? ` (${systemicError})` : ""}`
          : null,
    },
    { client },
  );

  if (status === "failed") {
    const nowIso = new Date().toISOString();
    await insertAlertEvents(
      [
        {
          alertType: "scheduler_fail",
          ticker: null,
          severity: "critical",
          triggerReason: `cron monthly-report ${month}: ${done} done, ${failed} failed${failedTickers.length ? ` [${failedTickers.join(",")}]` : ""}${systemicError ? ` ${systemicError}` : ""} (processed ${processed})`,
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
