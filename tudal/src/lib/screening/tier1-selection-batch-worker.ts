// Tier1 selection chunk worker — cron monthly-batch 자동 30선정 (chunk driver).
// PR5 full-report-batch-worker.ts 패턴 1:1 복제 + finalize(replay) 단계 신규.
//
// WHY: tier0_candidates_150(150 후보)을 Core 11 AI panel(종목당 11콜 = 1650)로 평가 → 단/중/장 top10 = 30 선정.
//   단발 runMonthlyBatchOrchestrator는 1650콜이 한 invocation에 발생해 Vercel 300s 초과(NON-VIABLE).
//   → (A) fan-out 단계(청크별 종목당 11콜 → panel_result jsonb 큐 저장) ↔ (B) finalize 단계(150/150 terminal 시
//   runTier1Screening 1회 replay 호출 → 글로벌 rank/select/badge + upsertShortList30)로 2단계 분리.
//
// 한 invocation = 1 chunk (chunkSize 종목 sequential). chunk-advance primary = daily cron 재호출(idempotent),
// self-continuation은 route의 optional accelerator. run-mutex는 route(guarded)가 보유(단일 worker 보장 → cost 직렬화, 0027 R2 HIGH-1).
//
// 핵심 invariants:
//   - 순차 for-loop (병렬 fan-out 금지) — concurrent preflightHardcap race 차단 (0027 R2 HIGH-1).
//   - fail-closed step 0: SELECTION_CRON_AUTO_ENABLED + AI_COST_LOG_REAL_INSERT_ENABLED + CRON_SYSTEM_USER_ID
//     (UUID + auth.users 존재 via admin API) — 첫 LLM 호출 전 abort (flag-off + mock = cost 0 박제).
//   - 청크 산출물 = panel_result jsonb (PersonaScore[] 11). report_id(PR5) 대신.
//   - run-mutex 전용 (acquire/release_selection_worker_lock) — selection의 monthly_batch_runs / acquire_batch_lock_v2 미공유 (0027 R2 HIGH-1).
//   - retry N=2 transient만 (retryWithBackoff). systemic abort(ai_key_unavailable/cost_hardcap) throw.
//   - per-ticker fail = mark failed + console.error (alert_event 발행 금지 — enum CLOSED 12종, 0027 B78).
//   - finalize at remaining==0 & terminal==150: panel_result 모아 runTier1Screening replay 1회(LLM 0콜)
//     → upsertShortList30. degraded(failed/deferred) ticker는 replay 콜백 reject → runTier1Screening allSettled → ⚪ 자동.
//
// flag 계층: 단발 cron 경로의 MONTHLY_BATCH_CRON_AI_ENABLED(+preflightCronRealAi 4-gate)는 monthly-batch/route.ts
//   단발 경로 전용. 본 청크 워커는 별 경로이므로 신규 SELECTION_CRON_AUTO_ENABLED로 게이트 (step-0가 동일 4검증 수행 —
//   flag/cost-logging/cron-user UUID/실존. 단 ANTHROPIC_API_KEY 부재는 callPersona가 ai_key_unavailable throw로 처리).
//   둘은 독립 — 동시 활성 금지 운영 가이드(.env.example). default-off라 merge-safe (claim 0, LLM 0, spend 0).
import type { SupabaseClient } from "@supabase/supabase-js";
import { retryWithBackoff } from "@/lib/report/retry-with-backoff";
import { getRoleMaxCostPerCallKrw } from "@/lib/ai/model-registry";
import type { PersonaScore, Tier1ScreeningResult } from "@/lib/screening/tier1-schema";
import type { Tier1Candidate, RunTier1ScreeningInput } from "@/lib/screening/persona-eval";
import type { TickerCommentMap } from "@/lib/data/admin-shortlist-persist";
import type { PipelineHealthInsert } from "@/lib/data/admin-pipeline-health-insert";
import type { AlertEvent } from "@/types/admin";
import type { CostAlertContext } from "@/lib/data/admin-cost-alerts";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_CHUNK_SIZE = 3; // 3 ticker × 11콜 = 33콜/invocation
const CORE_11_CALLS_PER_TICKER = 11;
const EXPECTED_TOTAL = 150;

// DI 시그니처 (cron route가 실 구현 주입, 테스트가 mock 주입).
type Tier0Source = (opts: {
  month: string;
  client: SupabaseClient;
}) => Promise<Tier1Candidate[]>;
type CallPersonaPanel = (input: {
  ticker: string;
  financials: string;
}) => Promise<PersonaScore[]>;
type FetchFinancials = (ticker: string) => Promise<string>;
type PreflightHardcap = (
  args: {
    month: string;
    callCount?: number;
    maxCostPerCallKrw?: number;
    lines?: Array<{ callCount: number; maxCostPerCallKrw: number }>;
  },
  opts: { client: SupabaseClient; callerKind: "service-role" },
) => Promise<unknown>;
type GetMonthlyTotal = (
  month: string,
  opts: { client: SupabaseClient; callerKind: "service-role" },
) => Promise<number>;
type RunScreening = (
  input: RunTier1ScreeningInput,
) => Promise<Tier1ScreeningResult>;
type Persist = (
  month: string,
  selected: Tier1ScreeningResult["selected"],
  options: { client: SupabaseClient; commentsByTicker?: TickerCommentMap },
) => Promise<void>;
type InsertPipelineHealth = (
  row: PipelineHealthInsert,
  opts: { client: SupabaseClient },
) => Promise<void>;
type InsertAlertEvents = (
  events: Array<Omit<AlertEvent, "id" | "isRead">>,
  opts: { client: SupabaseClient },
) => Promise<void>;
type EmitCostAlert = (
  ctx: CostAlertContext,
  opts: { client: SupabaseClient },
) => Promise<void>;

export interface RunTier1SelectionChunkInput {
  month: string; // YYYY-MM
  client: SupabaseClient; // service-role (route가 생성)
  chunkSize?: number;
  promptVersionId: string;
  personasVersionId: string;
  // DI:
  tier0Source: Tier0Source;
  callPersonaPanel: CallPersonaPanel;
  fetchFinancials: FetchFinancials;
  preflightHardcap: PreflightHardcap;
  getMonthlyTotal: GetMonthlyTotal;
  persist: Persist;
  runScreening: RunScreening;
  insertPipelineHealth: InsertPipelineHealth;
  insertAlertEvents: InsertAlertEvents;
  emitCostAlert: EmitCostAlert;
}

export interface Tier1SelectionChunkResult {
  month: string;
  claimed: number;
  done: number;
  skipped: number;
  failed: number;
  deferred: number;
  remaining: number; // pending + reclaimable running
  finalized: boolean; // 이 invocation에서 finalize+persist 수행 여부
  aborted: "cost_hardcap" | null;
}

interface SelectionJobRow {
  id: string;
  ticker: string;
}

interface SelectionFullRow {
  ticker: string;
  status: string;
  panel_result: PersonaScore[] | null;
}

async function abortBeforeSpend(
  input: RunTier1SelectionChunkInput,
  code: string,
): Promise<never> {
  try {
    await summarize(input, 0, 0, 1, [], `preflight_abort:${code}`);
  } catch (alertErr) {
    console.error(
      JSON.stringify({
        event: "selection_worker_preflight_alert_failed",
        month: input.month,
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
    panelResult: PersonaScore[] | null;
    error: string | null;
  },
): Promise<void> {
  const { error } = await client.rpc("mark_selection_job", {
    p_id: args.id,
    p_status: args.status,
    p_panel_result: args.panelResult,
    p_error: args.error,
  });
  if (error) {
    throw new Error(`mark_selection_job_failed:${error.code ?? "unknown"}`);
  }
}

async function deferOpenJobs(
  client: SupabaseClient,
  month: string,
  reason: string,
): Promise<void> {
  const { error } = await client
    .from("tier1_selection_job")
    .update({
      status: "deferred",
      last_error: reason,
      finished_at: new Date().toISOString(),
    })
    .eq("month", month)
    .in("status", ["pending", "running"]);
  if (error) {
    throw new Error(`selection_defer_failed:${error.code ?? "unknown"}`);
  }
}

async function emitCostAlertBestEffort(
  input: RunTier1SelectionChunkInput,
  ctx: CostAlertContext,
): Promise<void> {
  try {
    await input.emitCostAlert(ctx, { client: input.client });
  } catch (err) {
    console.error(
      JSON.stringify({
        event: "selection_worker_cost_alert_failed",
        month: input.month,
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
    .from("tier1_selection_job")
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
    throw new Error(`selection_job_reset_failed:${error.code ?? "unknown"}`);
  }
}

async function releaseSelectionLock(
  client: SupabaseClient,
  month: string,
  runId: string,
  status: "succeeded" | "failed",
): Promise<void> {
  const { error } = await client.rpc("release_selection_worker_lock", {
    p_month: month,
    p_run_id: runId,
    p_status: status,
  });
  if (error) {
    throw new Error(
      `release_selection_worker_lock_failed:${error.code ?? "unknown"}`,
    );
  }
}

async function markSelectionFinalized(
  client: SupabaseClient,
  month: string,
): Promise<void> {
  const { error } = await client
    .from("tier1_selection_run")
    .update({ finalized_at: new Date().toISOString() })
    .eq("month", month)
    .is("finalized_at", null);
  if (error) {
    throw new Error(`selection_finalize_mark_failed:${error.code ?? "unknown"}`);
  }
}

async function countOpenJobs(
  client: SupabaseClient,
  month: string,
): Promise<number> {
  const { count, error } = await client
    .from("tier1_selection_job")
    .select("id", { count: "exact", head: true })
    .eq("month", month)
    .in("status", ["pending", "running"]);
  if (error) {
    throw new Error(`selection_count_failed:${error.code ?? "unknown"}`);
  }
  return count ?? 0;
}

/**
 * 1 chunk 처리. route가 run-mutex 보유 상태에서 호출 (단일 worker 보장).
 * step 0 fail-closed 검증 통과 후에만 LLM 경로 진입.
 */
export async function runTier1SelectionChunk(
  input: RunTier1SelectionChunkInput,
): Promise<Tier1SelectionChunkResult> {
  const { month, client } = input;
  const chunkSize = input.chunkSize ?? DEFAULT_CHUNK_SIZE;

  // ── step 0: fail-closed 선행 검증 (첫 LLM 호출 전, spend 0) ──────────────
  // (a0) 청크 워커 feature flag 강제: route gate 우회(manual/direct entry)도 spend 0으로 fail-closed.
  if (process.env.SELECTION_CRON_AUTO_ENABLED !== "true") {
    return await abortBeforeSpend(input, "selection_cron_auto_disabled");
  }
  // (a) cost logging 강제 (0027 R3 HIGH-1): false면 insertCostLog noop → getMonthlyTotal=0 → preflightHardcap fail-open.
  if (process.env.AI_COST_LOG_REAL_INSERT_ENABLED !== "true") {
    return await abortBeforeSpend(input, "cost_logging_disabled");
  }
  // (b) reserved cron-system user (0027 R2 HIGH-2 + R3 HIGH-3): cost_log.called_by FK auth.users.
  const adminUserId = process.env.CRON_SYSTEM_USER_ID;
  if (!adminUserId || !UUID_RE.test(adminUserId)) {
    return await abortBeforeSpend(input, "cron_system_user_id_invalid");
  }
  const cronSystemUserId: string = adminUserId;
  const { data: userData, error: userErr } =
    await client.auth.admin.getUserById(cronSystemUserId);
  if (userErr || !userData?.user) {
    return await abortBeforeSpend(input, "cron_system_user_not_found");
  }

  // ── enqueue idempotent: tier0_candidates_150 150 → tier1_selection_job (ON CONFLICT DO NOTHING) ──
  const candidates = await input.tier0Source({ month, client });
  if (candidates.length === 0) {
    console.info(
      JSON.stringify({ event: "tier0_candidates_not_seeded", month }),
    );
    return {
      month,
      claimed: 0,
      done: 0,
      skipped: 0,
      failed: 0,
      deferred: 0,
      remaining: 0,
      finalized: false,
      aborted: null,
    };
  }
  if (candidates.length !== EXPECTED_TOTAL) {
    return await abortBeforeSpend(
      input,
      `tier0_candidates_invalid_count:${candidates.length}`,
    );
  }
  // tier0_candidates_150.month는 date(YYYY-MM-01), tier1_selection_job.month는 YYYY-MM.
  const enqueueRows = candidates.map((c) => ({
    month,
    ticker: c.ticker,
    bucket: bucketOf(c),
  }));
  const { error: enqErr } = await client
    .from("tier1_selection_job")
    .upsert(enqueueRows, {
      onConflict: "month,ticker",
      ignoreDuplicates: true,
    });
  if (enqErr) {
    throw new Error(`selection_enqueue_failed:${enqErr.code ?? "unknown"}`);
  }

  // ── claim 1 chunk (atomic, SKIP LOCKED, attempts<3, stale sweep) ──
  const { data: claimed, error: claimErr } = await client.rpc(
    "claim_next_selection_jobs",
    { p_month: month, p_limit: chunkSize },
  );
  if (claimErr) {
    throw new Error(
      `claim_next_selection_jobs_failed:${claimErr.code ?? "unknown"}`,
    );
  }
  const jobs = (claimed ?? []) as SelectionJobRow[];

  // ── batch preflight (남은 pending+running × 11콜) ──
  const pendingCount = await countOpenJobs(client, month);
  const reservationJobCount = Math.max(pendingCount, jobs.length);
  const callCount = reservationJobCount * CORE_11_CALLS_PER_TICKER;
  // W0 D28 ③ model-aware reservation: tier1_panel 역할 단가 (W1 토론 mix로 진화할 단일 지점).
  const tier1MaxCostPerCallKrw = getRoleMaxCostPerCallKrw("tier1_panel");
  if (callCount > 0) {
    const currentTotal = await input.getMonthlyTotal(month, {
      client,
      callerKind: "service-role",
    });
    const projectedKrw = callCount * tier1MaxCostPerCallKrw;
    try {
      await input.preflightHardcap(
        {
          month,
          lines: [{ callCount, maxCostPerCallKrw: tier1MaxCostPerCallKrw }],
        },
        { client, callerKind: "service-role" },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("cost_hardcap_exceeded")) {
        // 남은 pending/running을 먼저 deferred 표시해야 alert insert 장애가 month-stop을 막지 않는다.
        await deferOpenJobs(client, month, "cost_hardcap_exceeded");
        await emitCostAlertBestEffort(input, {
          month,
          currentTotalKrw: currentTotal,
          projectedKrw,
        });
        await summarize(input, 0, 0, 1, [], "systemic_abort:cost_hardcap_exceeded");
        return {
          month,
          claimed: 0,
          done: 0,
          skipped: 0,
          failed: 0,
          deferred: reservationJobCount,
          remaining: 0,
          finalized: false,
          aborted: "cost_hardcap",
        };
      }
      throw err;
    }
    await emitCostAlertBestEffort(input, {
      month,
      currentTotalKrw: currentTotal,
      projectedKrw,
    });
  }

  let done = 0;
  let failed = 0;
  const failedTickers: string[] = [];

  // ── 순차 처리 (병렬 fan-out 금지 — cost gate 직렬화, 0027 R2 HIGH-1) ──
  for (const job of jobs) {
    try {
      const panel = await retryWithBackoff(async () => {
        const financials = await input.fetchFinancials(job.ticker);
        return input.callPersonaPanel({ ticker: job.ticker, financials });
      });
      await markJob(client, {
        id: job.id,
        status: "done",
        panelResult: panel,
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
          const currentTotalAfter = await input.getMonthlyTotal(month, {
            client,
            callerKind: "service-role",
          });
          await emitCostAlertBestEffort(input, {
            month,
            currentTotalKrw: currentTotalAfter,
            projectedKrw: tier1MaxCostPerCallKrw,
          });
        } else {
          await resetJobForSystemicAbort(client, job.id, msg);
        }
        await summarize(
          input,
          done,
          0,
          failed + 1,
          [...failedTickers, job.ticker],
          `systemic_abort:${msg}`,
        );
        throw err;
      }
      // per-ticker 실패: 구조화 console.error (alert_event 발행 금지 — enum CLOSED, 0027 B78)
      console.error(
        JSON.stringify({
          event: "ticker_persona_panel_failed",
          ticker: job.ticker,
          month,
          message: msg,
        }),
      );
      await markJob(client, {
        id: job.id,
        status: "failed",
        panelResult: null,
        error: msg,
      });
      failed += 1;
      failedTickers.push(job.ticker);
    }
  }

  // ── 남은 작업 수 (forward-progress / finalize 판정) ──
  const remaining = await countOpenJobs(client, month);

  // ── finalize 판정: remaining==0 & terminal==150 → replay 30선정 + persist ──
  let finalized = false;
  if (remaining === 0) {
    finalized = await finalizeSelection(input, candidates);
  }

  // ── 관측: pipeline_health 1 row + 조건부 summary alert ──
  await summarize(input, done, 0, failed, failedTickers, null);

  return {
    month,
    claimed: jobs.length,
    done,
    skipped: 0,
    failed,
    deferred: 0,
    remaining,
    finalized,
    aborted: null,
  };
}

// disjoint bucket: tier0_buckets 중 true인 단일 timeframe.
function bucketOf(c: Tier1Candidate): "short" | "mid" | "long" {
  if (c.tier0_buckets.short) return "short";
  if (c.tier0_buckets.mid) return "mid";
  return "long";
}

/**
 * 150/150 terminal 도달 시 finalize: 저장된 panel_result를 replay 콜백으로 runTier1Screening에 주입해
 * 글로벌 rank/select/badge 1회 실행(LLM 0콜) → upsertShortList30(30 selected).
 * degraded(failed/deferred/panel null) ticker는 replay 콜백 reject → runTier1Screening allSettled → ⚪ 자동.
 * @returns true = finalize+persist 수행 / false = terminal!=150 (아직 미완성, 다음 chunk 대기)
 */
async function finalizeSelection(
  input: RunTier1SelectionChunkInput,
  candidates: Tier1Candidate[],
): Promise<boolean> {
  const { month, client } = input;
  // 전체 rows 1회 SELECT (ticker, status, panel_result).
  const { data, error } = await client
    .from("tier1_selection_job")
    .select("ticker, status, panel_result")
    .eq("month", month);
  if (error) {
    throw new Error(`selection_finalize_select_failed:${error.code ?? "unknown"}`);
  }
  const rows = (data ?? []) as SelectionFullRow[];
  const terminal = rows.filter((r) =>
    r.status === "done" || r.status === "failed" || r.status === "deferred",
  );
  // 150/150 terminal 게이트 (단발 orchestrator의 completedPanels!==150 throw를 staging-count 게이트로 이전).
  if (terminal.length !== EXPECTED_TOTAL) {
    return false;
  }

  // replay map: status='done' & panel_result 존재만. degraded는 부재 → 콜백 reject → ⚪.
  const storedPanels = new Map<string, PersonaScore[]>();
  for (const r of rows) {
    if (r.status === "done" && r.panel_result) {
      storedPanels.set(r.ticker, r.panel_result);
    }
  }

  // candidates 재공급 (computeTier0Ranks가 원본 candidates 필요 — persona-eval.ts).
  // W2a Task 3 — runScreening(runTier1Screening)이 track 필수화. period_key/track 재구성은
  //   Task 8 scope로 input에서 track 전파 예정. 여기서는 signature compat만 (legacy midlong).
  const result = await input.runScreening({
    track: "midlong",
    candidates,
    promptVersionId: input.promptVersionId,
    personasVersionId: input.personasVersionId,
    fetchFinancials: async () => "", // replay 미사용
    callPersonaPanel: async ({ ticker }) => {
      const stored = storedPanels.get(ticker);
      if (!stored) {
        throw new Error("panel_missing"); // degraded → allSettled catch → ⚪
      }
      return stored; // LLM 0콜, cost 0
    },
  });

  await input.persist(month, result.selected, {
    client,
    commentsByTicker: result.commentsByTicker,
  });
  await markSelectionFinalized(client, month);
  return true;
}

// run-mutex로 보호된 chunk 실행 (0027 R2 HIGH-1 + R3 HIGH-2). route + admin trigger 공용 entry —
// acquire_selection_worker_lock(run_id) → chunk → release(run_id fencing). manual trigger도 반드시 이 경로 (mutex 우회 0).
export interface GuardedSelectionChunkOutput {
  skipped?: "already_running";
  result?: Tier1SelectionChunkResult;
}

export async function runGuardedSelectionChunk(
  input: RunTier1SelectionChunkInput,
): Promise<GuardedSelectionChunkOutput> {
  const { month, client } = input;
  const { data: runId, error: lockErr } = await client.rpc(
    "acquire_selection_worker_lock",
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
    const result = await runTier1SelectionChunk(input);
    await releaseSelectionLock(client, month, runId as string, "succeeded");
    chunkSucceeded = true;
    return { result };
  } catch (err) {
    if (!chunkSucceeded) {
      // run_id fencing: stale reclaim 후 늦게 깨어난 old worker는 p_run_id 불일치로 no-op.
      try {
        await releaseSelectionLock(client, month, runId as string, "failed");
      } catch (releaseErr) {
        console.error(
          JSON.stringify({
            event: "selection_worker_lock_release_failed",
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
  input: RunTier1SelectionChunkInput,
  done: number,
  skipped: number,
  failed: number,
  failedTickers: string[],
  systemicError: string | null,
): Promise<void> {
  const { month, client } = input;
  const processed = done + skipped + failed;
  const status = failed === 0 && systemicError === null ? "success" : "failed";
  await input.insertPipelineHealth(
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
    await input.insertAlertEvents(
      [
        {
          alertType: "scheduler_fail",
          ticker: null,
          severity: "critical",
          triggerReason: `cron tier1-selection ${month}: ${done} done, ${failed} failed${failedTickers.length ? ` [${failedTickers.join(",")}]` : ""}${systemicError ? ` ${systemicError}` : ""} (processed ${processed})`,
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
