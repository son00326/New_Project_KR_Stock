// Tier1 selection chunk worker — cron monthly-batch 자동 30선정 (chunk driver).
// PR5 full-report-batch-worker.ts 패턴 1:1 복제 + finalize(replay) 단계 신규.
//
// WHY: 트랙별 fresh 후보(short 50 / midlong 100)를 Core 11 AI panel(종목당 11콜)로 평가 → 트랙 top(short 10 / midlong 20) 선정.
//   구 단발 orchestrator(전 콜 1 invocation, 300s 초과 NON-VIABLE — W1b에서 제거)의 chunked 대체.
//   → (A) fan-out 단계(청크별 종목당 11콜 → panel_result jsonb 큐 저장) ↔ (B) finalize 단계(nonTerminal===0 && terminal>0 시
//   runTier1Screening 1회 replay 호출 → 글로벌 rank/select/badge + upsertShortListTrack)로 2단계 분리. (W2a period_key/track)
//
// 한 invocation = 1 chunk (chunkSize 종목 sequential). chunk-advance = route의 after() self-continue가
// primary accelerator(B-SEL-CRON: opt-out 기본 ON, load-bearing — daily 단독으론 period 완주 불가) +
// daily cron 재호출(idempotent resume, period-scoped due-gate). run-mutex는 route(guarded)가 보유(단일 worker 보장 → cost 직렬화, 0027 R2 HIGH-1).
//
// 핵심 invariants:
//   - 순차 for-loop (병렬 fan-out 금지) — concurrent preflightHardcap race 차단 (0027 R2 HIGH-1).
//   - fail-closed step 0: SELECTION_CRON_AUTO_ENABLED + AI_COST_LOG_REAL_INSERT_ENABLED + CRON_SYSTEM_USER_ID
//     (UUID + auth.users 존재 via admin API) — 첫 LLM 호출 전 abort (flag-off + mock = cost 0 박제).
//   - 청크 산출물 = panel_result jsonb (PersonaScore[] 11). report_id(PR5) 대신.
//   - run-mutex 전용 (acquire/release_selection_worker_lock) — selection의 monthly_batch_runs / acquire_batch_lock_v2 미공유 (0027 R2 HIGH-1).
//   - retry N=2 transient만 (retryWithBackoff). systemic abort(ai_key_unavailable/cost_hardcap) throw.
//   - per-ticker fail = mark failed + console.error (alert_event 발행 금지 — enum CLOSED 12종, 0027 B78).
//   - finalize 게이트 = nonTerminal(pending+running+deferred)===0 && terminal(done+failed)>0 (period_key 필터): panel_result 모아
//     runTier1Screening({track}) replay 1회(LLM 0콜) → upsertShortListTrack + mark_selection_finalized(run_id fencing).
//     deferred는 nonTerminal로 finalize 차단(R2 MED-6). degraded(failed/panel null) ticker는 replay 콜백 reject → allSettled → ⚪ 자동.
//   - (R4 HIGH-2) preflightHardcap을 claim/reset 前에 먼저: fail 시 claim·reset 안 함(attempts 미소진, deferred 유지).
//     pass 시에만 deferred→pending 재개(attempts 보존) → claim (deadlock 해소).
//
// flag 계층: 단발 cron 경로의 MONTHLY_BATCH_CRON_AI_ENABLED(+preflightCronRealAi 4-gate)는 monthly-batch/route.ts
//   단발 경로 전용. 본 청크 워커는 별 경로이므로 신규 SELECTION_CRON_AUTO_ENABLED로 게이트 (step-0가 동일 4검증 수행 —
//   flag/cost-logging/cron-user UUID/실존. 단 ANTHROPIC_API_KEY 부재는 callPersona가 ai_key_unavailable throw로 처리).
//   둘은 독립 — 동시 활성 금지 운영 가이드(.env.example). default-off라 merge-safe (claim 0, LLM 0, spend 0).
import type { SupabaseClient } from "@supabase/supabase-js";
import { retryWithBackoff } from "@/lib/report/retry-with-backoff";
import {
  getTier1PanelWorstSlotCostKrw,
  getRoleWorstCaseMaxCostPerCallKrw,
} from "@/lib/ai/model-registry";
import { isJudgeVerdict, type JudgeVerdict } from "@/lib/ai/judge-client";
import {
  computeDualJudgeBoundary,
  isDualJudgeDisagreement,
} from "@/lib/screening/judge-stage";
import type {
  PersonaScore,
  SelectionTrack,
  Tier1ScreeningResult,
} from "@/lib/screening/tier1-schema";
import { TRACK_FRESH_POOL, TRACK_SELECT_COUNT } from "@/lib/screening/tier1-schema";
import type { Tier1Candidate, RunTier1ScreeningInput } from "@/lib/screening/persona-eval";
import {
  mergeFreshWithIncumbents,
  type IncumbentInfo,
} from "@/lib/screening/incumbent-merge";
import {
  computeR2Targets,
  pickFinalPanels,
  type R1PanelRow,
} from "@/lib/screening/debate-round";
import type {
  IncumbentMetadataMap,
  TickerCommentMap,
} from "@/lib/data/admin-shortlist-persist";
import type { PipelineHealthInsert } from "@/lib/data/admin-pipeline-health-insert";
import type { AlertEvent } from "@/types/admin";
import type { CostAlertContext } from "@/lib/data/admin-cost-alerts";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_CHUNK_SIZE = 3; // 3 ticker × 11콜 = 33콜/invocation
const CORE_11_CALLS_PER_TICKER = 11;

// DI 시그니처 (cron route가 실 구현 주입, 테스트가 mock 주입).
type Tier0Source = (opts: {
  month: string;
  client: SupabaseClient;
}) => Promise<Tier1Candidate[]>;
type CallPersonaPanel = (input: {
  ticker: string;
  financials: string;
  /** W2b (D27 Q5) — incumbent thesis context per-call 주입. 미지정 = 비-incumbent. */
  reflectionContext?: string;
}) => Promise<PersonaScore[]>;
// W2b (D27 Q5) — incumbent 식별 + per-ticker thesis context builder DI.
type IncumbentsSource = (opts: {
  track: SelectionTrack;
  month: string;
  client: SupabaseClient;
}) => Promise<IncumbentInfo[]>;
type BuildIncumbentContexts = (
  incumbents: readonly IncumbentInfo[],
  opts: { client: SupabaseClient },
) => Promise<Record<string, string>>;
// W1a (D5/D6) — R2 반박 라운드 패널 (makeCallDebatePanel 주입).
type CallDebatePanel = (input: {
  ticker: string;
  financials: string;
  reflectionContext?: string;
  r1Panel: readonly PersonaScore[];
}) => Promise<PersonaScore[]>;
// W1b (D28 ③) — per-ticker 최종 judge + 경계 dual-judge (judge-client 주입).
type CallJudgePanel = (input: {
  ticker: string;
  month: string;
  track: SelectionTrack;
  finalPanel: readonly PersonaScore[];
  reflectionContext?: string;
}) => Promise<JudgeVerdict>;
type CallDualJudge = CallJudgePanel;
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
// W2a Task 8 — upsertShortListTrack 시그니처 (monthYM, track, selected, options).
//   rolling writer: short bucket만 주간 in-place 교체, midlong은 carry RPC 내부 처리.
type Persist = (
  monthYM: string,
  track: SelectionTrack,
  selected: Tier1ScreeningResult["selected"],
  options: {
    client: SupabaseClient;
    commentsByTicker?: TickerCommentMap;
    // W2b (D27 Q5) — delta_status hold/new 실계산 + incumbent-only display meta 보존.
    incumbentTickers?: ReadonlySet<string>;
    incumbentMetadataByTicker?: IncumbentMetadataMap;
  },
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
  month: string; // YYYY-MM (short_list_30.month 파생)
  track: SelectionTrack; // 'short' | 'midlong' (W2a 주간/월간 split)
  periodKey: string; // 's:YYYY-MM-DD'(주) | 'm:YYYY-MM'(월) — job/run 큐 독립 mutex 키
  client: SupabaseClient; // service-role (route가 생성)
  // 내부 — runGuardedSelectionChunk가 acquire 후 주입. finalize의 mark_selection_finalized run_id fencing용.
  runId?: string;
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
  // W2b (D27 Q5) — incumbent union + per-ticker thesis context.
  incumbentsSource: IncumbentsSource;
  buildIncumbentContexts: BuildIncumbentContexts;
  // W1a (D26 Q4) — R2 반박 라운드 패널.
  callDebatePanel: CallDebatePanel;
  // W1b (D28 ③) — judge/dual-judge.
  callJudgePanel: CallJudgePanel;
  callDualJudge: CallDualJudge;
}

export interface Tier1SelectionChunkResult {
  month: string;
  claimed: number;
  done: number;
  skipped: number;
  failed: number;
  deferred: number;
  r2Enqueued: number;
  judgeEnqueued: number; // W1b — 이번 invocation에서 enqueue한 round=3 judge jobs 수
  remaining: number; // pending + reclaimable running
  finalized: boolean; // 이 invocation에서 finalize+persist 수행 여부
  aborted: "cost_hardcap" | null;
}

interface SelectionJobRow {
  id: string;
  ticker: string;
  // W1a/W1b — claim RPC는 returns setof tier1_selection_job + returning * 라 0032/0033 후 자동 포함.
  //   미적용(0032 전) 호환: undefined → 1 간주.
  round?: 1 | 2 | 3;
}

interface SelectionFullRow {
  ticker: string;
  status: string;
  // W1b (D4) — round 1/2 = PersonaScore[], round 3 = JudgeVerdict (이형 공존 — round별 type guard로만 해석).
  panel_result: PersonaScore[] | JudgeVerdict | null;
  round?: 1 | 2 | 3; // DB default 1 동형 (미지정 시 1 간주)
}

function isRoundSchemaMissingError(error: {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}): boolean {
  const code = error.code ?? "";
  const text = [error.message, error.details, error.hint].filter(Boolean).join(" ");
  return (
    code === "42P10" ||
    ((code === "42703" || code === "PGRST204") && /round/i.test(text))
  );
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
    panelResult: PersonaScore[] | JudgeVerdict | null;
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
  periodKey: string,
  reason: string,
): Promise<void> {
  const { error } = await client
    .from("tier1_selection_job")
    .update({
      status: "deferred",
      last_error: reason,
      finished_at: new Date().toISOString(),
    })
    .eq("period_key", periodKey)
    .in("status", ["pending", "running"]);
  if (error) {
    throw new Error(`selection_defer_failed:${error.code ?? "unknown"}`);
  }
}

// (R4 HIGH-2 / R3 HIGH-1) preflight pass 시 deferred → pending 재개 (attempts 보존 — reset 아님).
//   예산 회복 사이클에서 deferred stuck job을 다시 claim 가능하게 만든다.
async function resumeDeferredJobs(
  client: SupabaseClient,
  periodKey: string,
): Promise<void> {
  const { error } = await client
    .from("tier1_selection_job")
    .update({ status: "pending" })
    .eq("period_key", periodKey)
    .eq("status", "deferred");
  if (error) {
    throw new Error(`selection_resume_failed:${error.code ?? "unknown"}`);
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
  periodKey: string,
  runId: string,
  status: "succeeded" | "failed",
): Promise<void> {
  const { error } = await client.rpc("release_selection_worker_lock", {
    p_period_key: periodKey,
    p_run_id: runId,
    p_status: status,
  });
  if (error) {
    throw new Error(
      `release_selection_worker_lock_failed:${error.code ?? "unknown"}`,
    );
  }
}

// finalize 완료 마킹 — run_id fencing RPC (마이그 0031). 후속 acquire는 finalized_at null 가드로 null 반환.
async function markSelectionFinalized(
  client: SupabaseClient,
  periodKey: string,
  runId: string,
): Promise<void> {
  const { error } = await client.rpc("mark_selection_finalized", {
    p_period_key: periodKey,
    p_run_id: runId,
  });
  if (error) {
    throw new Error(`selection_finalize_mark_failed:${error.code ?? "unknown"}`);
  }
}

// period_key 필터 count 헬퍼 4종 (D6 finalize 게이트 + preflight reservation).
async function countByStatus(
  client: SupabaseClient,
  periodKey: string,
  statuses: string[],
  rounds?: number[], // W1b — round-aware reservation (미지정 = 전 라운드)
): Promise<number> {
  let query = client
    .from("tier1_selection_job")
    .select("id", { count: "exact", head: true })
    .eq("period_key", periodKey)
    .in("status", statuses);
  if (rounds) {
    query = query.in("round", rounds);
  }
  const { count, error } = await query;
  if (error) {
    if (isRoundSchemaMissingError(error)) {
      throw new Error("selection_round_schema_missing");
    }
    throw new Error(`selection_count_failed:${error.code ?? "unknown"}`);
  }
  return count ?? 0;
}

const countOpenJobs = (client: SupabaseClient, periodKey: string) =>
  countByStatus(client, periodKey, ["pending", "running"]);
const countNonTerminalJobs = (client: SupabaseClient, periodKey: string) =>
  countByStatus(client, periodKey, ["pending", "running", "deferred"]);
const countTerminalJobs = (client: SupabaseClient, periodKey: string) =>
  countByStatus(client, periodKey, ["done", "failed"]);

// W1a — period 전체 rows 1회 SELECT (R2 trigger 계산 + finalize replay 공용).
async function selectPeriodRows(
  client: SupabaseClient,
  periodKey: string,
): Promise<SelectionFullRow[]> {
  const { data, error } = await client
    .from("tier1_selection_job")
    .select("ticker, status, panel_result, round")
    .eq("period_key", periodKey);
  if (error) {
    if (isRoundSchemaMissingError(error)) {
      throw new Error("selection_round_schema_missing");
    }
    throw new Error(`selection_finalize_select_failed:${error.code ?? "unknown"}`);
  }
  return (data ?? []) as SelectionFullRow[];
}

/**
 * 1 chunk 처리. route가 run-mutex 보유 상태에서 호출 (단일 worker 보장).
 * step 0 fail-closed 검증 통과 후에만 LLM 경로 진입.
 */
export async function runTier1SelectionChunk(
  input: RunTier1SelectionChunkInput,
): Promise<Tier1SelectionChunkResult> {
  const { month, track, periodKey, client } = input;
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

  // ── enqueue idempotent: fresh ∪ incumbent 후보 → tier1_selection_job (period_key/track, ON CONFLICT DO NOTHING) ──
  const fresh = await input.tier0Source({ month, client });
  if (fresh.length === 0) {
    console.info(
      JSON.stringify({ event: "tier0_candidates_not_seeded", month, track, periodKey }),
    );
    return {
      month,
      claimed: 0,
      done: 0,
      skipped: 0,
      failed: 0,
      deferred: 0,
      r2Enqueued: 0,
      judgeEnqueued: 0,
      remaining: 0,
      finalized: false,
      aborted: null,
    };
  }
  // W2a — 저장 expected_total 없음(D6). fresh 후보 수 = 트랙 fresh pool (short 50 / midlong 100).
  if (fresh.length !== TRACK_FRESH_POOL[track]) {
    return await abortBeforeSpend(
      input,
      `tier0_candidates_invalid_count:${fresh.length}`,
    );
  }
  // W2b (D27 Q5) — incumbent union. 조회 실패는 throw 전파(무심사 탈락 금지 — silent drop이
  // incumbent를 평가에서 누락시키면 안 됨). cold start []는 fresh-only.
  // 부분 그룹(예: short 9/10)은 carry_short_into_month가 midlong 졸업 ticker를 제외하는 정당 상태이므로
  // 허용 — `> TRACK_SELECT_COUNT`만 corruption 방어 fail-closed.
  let incumbents: IncumbentInfo[];
  try {
    incumbents = await input.incumbentsSource({ track, month, client });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return await abortBeforeSpend(input, message);
  }
  const expectedIncumbents = TRACK_SELECT_COUNT[track];
  if (incumbents.length > expectedIncumbents) {
    return await abortBeforeSpend(
      input,
      `incumbents_count_exceeded:${incumbents.length}>${expectedIncumbents}`,
    );
  }
  const candidates = mergeFreshWithIncumbents(fresh, incumbents);
  const incumbentTickers = new Set(incumbents.map((i) => i.ticker));
  const incumbentMetadataByTicker: IncumbentMetadataMap = Object.fromEntries(
    incumbents.map((i) => [
      i.ticker,
      {
        name: i.name,
        compositeScore: i.compositeScore,
        signalLabel: i.signalLabel,
      },
    ]),
  );
  // tier0_candidates.month는 date(YYYY-MM-01), tier1_selection_job.month는 YYYY-MM. period_key/track 명시.
  const enqueueRows = candidates.map((c) => ({
    month,
    period_key: periodKey,
    track,
    ticker: c.ticker,
    bucket: bucketOf(c),
    round: 1, // W1a — R1 채점 라운드 (R2는 R1 완료 후 worker가 대상만 enqueue)
  }));
  const { error: enqErr } = await client
    .from("tier1_selection_job")
    .upsert(enqueueRows, {
      onConflict: "period_key,ticker,round",
      ignoreDuplicates: true,
    });
  if (enqErr) {
    if (isRoundSchemaMissingError(enqErr)) {
      throw new Error("selection_round_schema_missing");
    }
    throw new Error(`selection_enqueue_failed:${enqErr.code ?? "unknown"}`);
  }

  // ── (R4 HIGH-2) preflight를 claim/reset 前으로 — budget 초과 사이클에서 attempts 미소진 ──
  // W1b (D6) — round-aware positive-count lines: tier1(r1+r2) jobs × 11 × worst-slot +
  //   judge(round 3) jobs × 1 × judge 단가. preflightHardcap은 빈/0 라인 reject(fail-open 차단)이라
  //   positive-count 라인만 구성, 라인 0개면 preflight 자체 skip.
  const tier1MaxCostPerCallKrw = getTier1PanelWorstSlotCostKrw();
  const judgeMaxCostPerCallKrw = getRoleWorstCaseMaxCostPerCallKrw("debate_judge");
  const tier1ReservationJobs =
    (await countByStatus(client, periodKey, ["pending", "running"], [1, 2])) +
    (await countByStatus(client, periodKey, ["deferred"], [1, 2]));
  const judgeReservationJobs =
    (await countByStatus(client, periodKey, ["pending", "running"], [3])) +
    (await countByStatus(client, periodKey, ["deferred"], [3]));
  const reservationLines: Array<{ callCount: number; maxCostPerCallKrw: number }> = [];
  if (tier1ReservationJobs > 0) {
    reservationLines.push({
      callCount: tier1ReservationJobs * CORE_11_CALLS_PER_TICKER,
      maxCostPerCallKrw: tier1MaxCostPerCallKrw,
    });
  }
  if (judgeReservationJobs > 0) {
    reservationLines.push({
      callCount: judgeReservationJobs,
      maxCostPerCallKrw: judgeMaxCostPerCallKrw,
    });
  }
  if (reservationLines.length > 0) {
    const currentTotal = await input.getMonthlyTotal(month, {
      client,
      callerKind: "service-role",
    });
    const projectedKrw = reservationLines.reduce(
      (s, l) => s + l.callCount * l.maxCostPerCallKrw,
      0,
    );
    try {
      await input.preflightHardcap(
        {
          month,
          lines: reservationLines,
        },
        { client, callerKind: "service-role" },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("cost_hardcap_exceeded")) {
        // preflight fail → claim·reset 안 함(attempts 미소진). 남은 open만 deferred 표시.
        //   deferred는 그대로 유지(예산 회복 시 재개). alert insert 장애가 stop을 막지 않도록 defer 먼저.
        await deferOpenJobs(client, periodKey, "cost_hardcap_exceeded");
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
          deferred: tier1ReservationJobs + judgeReservationJobs,
          r2Enqueued: 0,
          judgeEnqueued: 0,
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
    // preflight pass 시에만 deferred → pending 재개(attempts 보존) → claim 진입 (deadlock 해소).
    await resumeDeferredJobs(client, periodKey);
  }

  // ── claim 1 chunk (atomic, SKIP LOCKED, attempts<3, stale sweep) — preflight pass 후 ──
  const { data: claimed, error: claimErr } = await client.rpc(
    "claim_next_selection_jobs",
    { p_period_key: periodKey, p_limit: chunkSize },
  );
  if (claimErr) {
    throw new Error(
      `claim_next_selection_jobs_failed:${claimErr.code ?? "unknown"}`,
    );
  }
  const jobs = (claimed ?? []) as SelectionJobRow[];

  // W2b (D27 Q5) — incumbent thesis context (claimed에 incumbent가 있을 때만 1회 빌드, ≤3 query).
  let incumbentContextByTicker: Record<string, string> = {};
  if (jobs.some((j) => incumbentTickers.has(j.ticker))) {
    incumbentContextByTicker = await input.buildIncumbentContexts(incumbents, {
      client,
    });
  }

  // W1a (D4/D5) — claimed에 R2 job이 있으면 R1 done panel을 1회 로드 (반박 라운드 입력).
  // W1b — round=3(judge)는 최종 panel(R2-우선/R1 fallback) 입력 필요 → 같은 rows에서 빌드.
  const r1PanelByTicker = new Map<string, PersonaScore[]>();
  let finalPanelByTicker = new Map<string, PersonaScore[]>();
  if (jobs.some((j) => (j.round ?? 1) >= 2)) {
    const rows = await selectPeriodRows(client, periodKey);
    const r2Done = new Map<string, PersonaScore[]>();
    for (const r of rows) {
      if (r.status !== "done" || !r.panel_result) continue;
      const round = r.round ?? 1;
      if (round === 1) r1PanelByTicker.set(r.ticker, r.panel_result as PersonaScore[]);
      else if (round === 2) r2Done.set(r.ticker, r.panel_result as PersonaScore[]);
      // round 3(JudgeVerdict)은 chunk 입력 아님 — finalize에서만 소비 (D4 이형 분리).
    }
    finalPanelByTicker = pickFinalPanels(r1PanelByTicker, r2Done);
  }

  let done = 0;
  let failed = 0;
  const failedTickers: string[] = [];

  // ── 순차 처리 (병렬 fan-out 금지 — cost gate 직렬화, 0027 R2 HIGH-1) ──
  for (const job of jobs) {
    try {
      const jobRound = job.round ?? 1;
      // W1a — round=2(반박)는 R1 done panel 필수 / W1b — round=3(judge)는 최종 panel 필수.
      //   부재 시 spend 0으로 failed 처리.
      if (jobRound === 2 && !r1PanelByTicker.has(job.ticker)) {
        await markJob(client, {
          id: job.id,
          status: "failed",
          panelResult: null,
          error: `debate_r1_panel_missing:${job.ticker}`,
        });
        failed += 1;
        failedTickers.push(job.ticker);
        continue;
      }
      if (jobRound === 3 && !finalPanelByTicker.has(job.ticker)) {
        await markJob(client, {
          id: job.id,
          status: "failed",
          panelResult: null,
          error: `judge_panel_missing:${job.ticker}`,
        });
        failed += 1;
        failedTickers.push(job.ticker);
        continue;
      }
      const panel = await retryWithBackoff(async () => {
        if (jobRound === 3) {
          // W1b — judge: financials 불필요(패널 요약 판정), incumbent ctx 동반.
          return input.callJudgePanel({
            ticker: job.ticker,
            month,
            track,
            finalPanel: finalPanelByTicker.get(job.ticker)!,
            reflectionContext: incumbentContextByTicker[job.ticker],
          });
        }
        const financials = await input.fetchFinancials(job.ticker);
        if (jobRound === 2) {
          return input.callDebatePanel({
            ticker: job.ticker,
            financials,
            reflectionContext: incumbentContextByTicker[job.ticker],
            r1Panel: r1PanelByTicker.get(job.ticker)!,
          });
        }
        return input.callPersonaPanel({
          ticker: job.ticker,
          financials,
          // W2b — incumbent만 직전 thesis 컨텍스트 주입. 비-incumbent는 undefined(adapter default '').
          reflectionContext: incumbentContextByTicker[job.ticker],
        });
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
          await deferOpenJobs(client, periodKey, "cost_hardcap_exceeded");
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
          periodKey,
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
  //   remaining = open(pending+running) — self-continue accelerator gate용.
  let remaining = await countOpenJobs(client, periodKey);
  let r2Enqueued = 0;
  let judgeEnqueued = 0;

  // ── finalize 게이트: nonTerminal(pending+running+deferred)===0 && terminal(done+failed)>0 ──
  //   (R2 MED-6) deferred는 nonTerminal로 finalize 차단(degraded 조기 finalize 방지). 빈 풀(terminal 0) 미발동.
  let finalized = false;
  const nonTerminal = await countNonTerminalJobs(client, periodKey);
  if (nonTerminal === 0) {
    const terminal = await countTerminalJobs(client, periodKey);
    if (terminal > 0) {
      // W1a (D4) — R1 완료 시점: 저장 panel의 순수 함수로 R2 대상 결정(멱등 재계산, 플래그 불필요).
      const rows = await selectPeriodRows(client, periodKey);
      const r1Rows: R1PanelRow[] = rows
        .filter((r) => (r.round ?? 1) === 1)
        .map((r) => ({
          ticker: r.ticker,
          // round=1 rows의 panel_result는 PersonaScore[] (JudgeVerdict는 round=3 전용 — D4).
          panel: r.status === "done" ? (r.panel_result as PersonaScore[] | null) : null,
        }));
      const targets = computeR2Targets(r1Rows, track);
      const round2Tickers = new Set(
        rows.filter((r) => (r.round ?? 1) === 2).map((r) => r.ticker),
      );
      const missing = targets.filter((tk) => !round2Tickers.has(tk));
      if (missing.length > 0) {
        // R2 반박 라운드 enqueue (대상만, idempotent) — 이번 invocation은 finalize 안 함.
        const bucketByTicker = new Map(candidates.map((c) => [c.ticker, bucketOf(c)]));
        const unknownMissing = missing.filter((tk) => !bucketByTicker.has(tk));
        if (unknownMissing.length > 0) {
          throw new Error(`r2_enqueue_failed:target_not_in_candidates:${unknownMissing.join(",")}`);
        }
        const knownMissing = missing;
        if (knownMissing.length > 0) {
          const r2Rows = knownMissing.map((tk) => ({
            month,
            period_key: periodKey,
            track,
            ticker: tk,
            bucket: bucketByTicker.get(tk)!,
            round: 2,
          }));
          const { error: r2Err } = await client
            .from("tier1_selection_job")
            .upsert(r2Rows, {
              onConflict: "period_key,ticker,round",
              ignoreDuplicates: true,
          });
          if (r2Err) {
            if (isRoundSchemaMissingError(r2Err)) {
              throw new Error("selection_round_schema_missing");
            }
            throw new Error(`r2_enqueue_failed:${r2Err.code ?? "unknown"}`);
          }
          r2Enqueued = knownMissing.length;
          remaining = await countOpenJobs(client, periodKey);
        }
      } else {
        // W1b (D1) — R2 단계 충족(targets 0 포함) → judge 단계로 전진.
        const r1DoneMap = new Map<string, PersonaScore[]>();
        const r2DoneMap = new Map<string, PersonaScore[]>();
        for (const r of rows) {
          if (r.status !== "done" || !r.panel_result) continue;
          const round = r.round ?? 1;
          if (round === 1) r1DoneMap.set(r.ticker, r.panel_result as PersonaScore[]);
          else if (round === 2) r2DoneMap.set(r.ticker, r.panel_result as PersonaScore[]);
        }
        const finalPanels = pickFinalPanels(r1DoneMap, r2DoneMap);
        const round3Tickers = new Set(
          rows.filter((r) => (r.round ?? 1) === 3).map((r) => r.ticker),
        );
        const missingJudge = [...finalPanels.keys()].filter(
          (tk) => !round3Tickers.has(tk),
        );
        if (finalPanels.size > 0 && missingJudge.length > 0) {
          // round=3 judge jobs enqueue (대상 = 최종 panel 보유 ticker, idempotent) — finalize 안 함.
          const bucketByTicker = new Map(candidates.map((c) => [c.ticker, bucketOf(c)]));
          const unknownJudge = missingJudge.filter((tk) => !bucketByTicker.has(tk));
          if (unknownJudge.length > 0) {
            // 후보 밖 ticker silent skip은 finalize 영구 정지(W1a R7 HIGH 동형) → fail-closed.
            throw new Error(
              `judge_enqueue_failed:target_not_in_candidates:${unknownJudge.join(",")}`,
            );
          }
          const judgeRows = missingJudge.map((tk) => ({
            month,
            period_key: periodKey,
            track,
            ticker: tk,
            bucket: bucketByTicker.get(tk)!,
            round: 3,
          }));
          const { error: judgeErr } = await client
            .from("tier1_selection_job")
            .upsert(judgeRows, {
              onConflict: "period_key,ticker,round",
              ignoreDuplicates: true,
            });
          if (judgeErr) {
            if (isRoundSchemaMissingError(judgeErr)) {
              throw new Error("selection_round_schema_missing");
            }
            throw new Error(`judge_enqueue_failed:${judgeErr.code ?? "unknown"}`);
          }
          judgeEnqueued = missingJudge.length;
          remaining = await countOpenJobs(client, periodKey);
        } else {
          // judge 전부 terminal(nonTerminal==0) 또는 finalPanels 0 → 최종 finalize.
          // W1b (D4) — round=3 done verdict만 type guard로 수집 (R1/R2 panel map과 이형 분리).
          const judgeScoresByTicker: Record<string, Record<"short" | "mid" | "long", number>> = {};
          const judgeVerdictByTicker = new Map<string, JudgeVerdict>();
          for (const r of rows) {
            if ((r.round ?? 1) !== 3 || r.status !== "done") continue;
            if (isJudgeVerdict(r.panel_result)) {
              judgeVerdictByTicker.set(r.ticker, r.panel_result);
              judgeScoresByTicker[r.ticker] = r.panel_result.scores;
            }
          }
          // W1b (D3) — dual-judge: judge 점수 경계(rank 9..12)만, 전용 positive-count preflight,
          //   실패/hardcap = skip(관측층 — 선정 차단 금지). 최종은 항상 Opus verdict.
          const judgeScoresMap = new Map(Object.entries(judgeScoresByTicker));
          const dualTargets = computeDualJudgeBoundary(judgeScoresMap, track);
          if (dualTargets.length > 0) {
            try {
              if (
                dualTargets.some((tk) => incumbentTickers.has(tk)) &&
                Object.keys(incumbentContextByTicker).length === 0
              ) {
                incumbentContextByTicker = await input.buildIncumbentContexts(incumbents, {
                  client,
                });
              }
              await input.preflightHardcap(
                {
                  month,
                  lines: [
                    {
                      callCount: dualTargets.length,
                      maxCostPerCallKrw:
                        getRoleWorstCaseMaxCostPerCallKrw("dual_judge_gpt"),
                    },
                  ],
                },
                { client, callerKind: "service-role" },
              );
              for (const tk of dualTargets) {
                try {
                  const gptVerdict = await input.callDualJudge({
                    ticker: tk,
                    month,
                    track,
                    finalPanel: finalPanels.get(tk) ?? [],
                    reflectionContext: incumbentContextByTicker[tk],
                  });
                  const opusVerdict = judgeVerdictByTicker.get(tk);
                  if (opusVerdict && isDualJudgeDisagreement(opusVerdict, gptVerdict)) {
                    console.info(
                      JSON.stringify({
                        event: "dual_judge_disagreement",
                        month,
                        periodKey,
                        track,
                        ticker: tk,
                        opus: opusVerdict.scores,
                        gpt: gptVerdict.scores,
                      }),
                    );
                  }
                } catch (dualErr) {
                  // 개별 dual 콜 실패 = best-effort 관측층 — 선정 진행.
                  console.error(
                    JSON.stringify({
                      event: "dual_judge_call_failed",
                      month,
                      periodKey,
                      ticker: tk,
                      message:
                        dualErr instanceof Error ? dualErr.message : String(dualErr),
                    }),
                  );
                }
              }
            } catch (preErr) {
              // hardcap 등 preflight 실패 → dual 전체 skip (Opus 단독 최종).
              console.info(
                JSON.stringify({
                  event: "dual_judge_skipped_hardcap",
                  month,
                  periodKey,
                  track,
                  count: dualTargets.length,
                  message: preErr instanceof Error ? preErr.message : String(preErr),
                }),
              );
            }
          }
          finalized = await finalizeSelection(
            input,
            candidates,
            incumbentTickers,
            incumbentMetadataByTicker,
            rows,
            judgeScoresByTicker,
          );
        }
      }
    }
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
    r2Enqueued,
    judgeEnqueued,
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
 * finalize 게이트(nonTerminal===0 && terminal>0)는 caller가 판정. 여기서는 저장된 panel_result를
 * replay 콜백으로 runTier1Screening({track})에 주입해 글로벌 rank/select/badge 1회 실행(LLM 0콜)
 * → upsertShortListTrack(month, track, selected). degraded(failed/deferred/panel null)는 콜백 reject → ⚪ 자동.
 * → mark_selection_finalized(periodKey, runId) run_id fencing 마킹.
 * @returns true = finalize+persist 수행.
 */
async function finalizeSelection(
  input: RunTier1SelectionChunkInput,
  candidates: Tier1Candidate[],
  incumbentTickers: ReadonlySet<string>,
  incumbentMetadataByTicker: IncumbentMetadataMap,
  rows: SelectionFullRow[],
  judgeScoresByTicker: Record<string, Record<"short" | "mid" | "long", number>>,
): Promise<boolean> {
  const { month, track, periodKey, client } = input;

  // B-SEL-CRON (finding 16) — stale 재개 가드: 같은 트랙에서 더 최신(period_key 사전식=시간순) period가
  //   이미 finalize됐으면 persist를 skip한다. 수동 ?now=<과거 window> 재개로 옛 period를 finalize하면
  //   replace_shortlist_track(p_month, bucket)이 트랙 전행 DELETE+INSERT라(0031 5a) 더 최신 주차의
  //   현행 shortlist(리포트·포트폴리오 money-path 입력)를 stale 선정으로 silent 덮어쓴다.
  //   정상 전진(주2 > 주1)은 미발동 — period_key가 더 큰 finalized 행이 있을 때만(역순 재개) 차단.
  //   skip 시에도 mark_selection_finalized로 이 period를 종착시켜 always-due 일일 재시도를 멈춘다.
  //   NOTE(conservative): 월경계 cross-resume(예 s:2026-06-29 후 s:2026-07-06 finalized)는 실제로는
  //   서로 다른 short_list_30.month라 clobber가 아니지만, period_key 기준으로 보수적 skip한다 —
  //   과거 month의 stale write는 무의미(read는 latest-month)하므로 month-정밀 가드 대신 단순 차단 유지.
  const { data: newerFinalized, error: newerErr } = await client
    .from("tier1_selection_run")
    .select("period_key")
    .eq("track", track)
    .gt("period_key", periodKey)
    .not("finalized_at", "is", null)
    .limit(1);
  if (newerErr) {
    throw new Error(`stale_period_guard_failed:${newerErr.code ?? "unknown"}`);
  }
  if (newerFinalized && newerFinalized.length > 0) {
    console.warn(
      JSON.stringify({
        event: "selection_stale_period_finalize_skipped",
        track,
        periodKey,
        newerFinalized: newerFinalized[0].period_key,
      }),
    );
    await markSelectionFinalized(client, periodKey, input.runId ?? "");
    return false; // persist 안 함 (더 최신 shortlist 보존)
  }

  // W1a (D6) — replay map: round=2 done 우선 / round=1 fallback (R2 실패는 R1 유지 graceful).
  //   degraded(양 라운드 모두 부재)는 콜백 reject → ⚪ 자동.
  const r1Map = new Map<string, PersonaScore[]>();
  const r2Map = new Map<string, PersonaScore[]>();
  for (const r of rows) {
    if (r.status !== "done" || !r.panel_result) continue;
    const round = r.round ?? 1;
    // W1b (D4) — round=3(JudgeVerdict)은 panel map에 절대 미혼입 (judgeScoresByTicker로만 소비).
    if (round === 3) continue;
    if (round === 2) {
      r2Map.set(r.ticker, r.panel_result as PersonaScore[]);
    } else {
      r1Map.set(r.ticker, r.panel_result as PersonaScore[]);
    }
  }
  const storedPanels = pickFinalPanels(r1Map, r2Map);

  // candidates 재공급 (computeTier0Ranks가 원본 candidates 필요 — persona-eval.ts). 트랙 전파.
  const result = await input.runScreening({
    track,
    candidates,
    // W1b (D4) — judge 최종 점수 SoT (부재 ticker는 consensus fallback).
    judgeScoresByTicker,
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

  // rolling writer: short bucket만 주간 in-place 교체, midlong carry는 RPC 내부 (R2 HIGH-2).
  await input.persist(month, track, result.selected, {
    client,
    commentsByTicker: result.commentsByTicker,
    // W2b (D27 Q5) — delta_status hold/new 실계산 + incumbent-only display meta 보존 (D9).
    incumbentTickers,
    incumbentMetadataByTicker,
  });
  // W2b (D6) — removed는 행 materialize 불가(트랙 count gate 10/20 + always-30) → 구조화 로그.
  const selectedSet = new Set(result.selected.map((s) => s.ticker));
  const removed = [...incumbentTickers].filter((t) => !selectedSet.has(t));
  if (removed.length > 0) {
    console.info(
      JSON.stringify({
        event: "incumbent_removed",
        month,
        periodKey,
        track,
        tickers: removed,
      }),
    );
  }
  await markSelectionFinalized(client, periodKey, input.runId ?? "");
  return true;
}

// run-mutex로 보호된 chunk 실행 (0027 R2 HIGH-1 + R3 HIGH-2). route + admin trigger 공용 entry —
// acquire_selection_worker_lock(run_id) → chunk → release(run_id fencing). manual trigger도 반드시 이 경로 (mutex 우회 0).
export interface GuardedSelectionChunkOutput {
  // B-SEL-CRON — acquire null 2형 구분: already_finalized(정상 종착, period-scoped daily 재시도의
  //   cheap no-op) vs already_running(다른 non-stale worker 보유 중). 구분 실패 시 보수적 already_running.
  skipped?: "already_running" | "already_finalized";
  result?: Tier1SelectionChunkResult;
}

export async function runGuardedSelectionChunk(
  input: RunTier1SelectionChunkInput,
): Promise<GuardedSelectionChunkOutput> {
  const { month, track, periodKey, client } = input;
  const { data: runId, error: lockErr } = await client.rpc(
    "acquire_selection_worker_lock",
    { p_period_key: periodKey, p_track: track, p_month: month },
  );
  if (lockErr) {
    throw new Error(`acquire_lock_failed:${lockErr.code ?? "unknown"}`);
  }
  if (!runId) {
    // acquire null = 이미 finalize된 period(acquire의 finalized_at null-guard) OR 다른
    // non-stale worker 보유 중. period-scoped due-gate의 일일 재시도가 lock 경합처럼 보이지
    // 않도록 finalized_at으로 구분 보고. 조회 실패는 보수적으로 already_running(기존 의미).
    const { data: runRow, error: runRowErr } = await client
      .from("tier1_selection_run")
      .select("finalized_at")
      .eq("period_key", periodKey)
      .maybeSingle();
    if (runRowErr || !runRow) {
      return { skipped: "already_running" };
    }
    return {
      skipped: runRow.finalized_at ? "already_finalized" : "already_running",
    };
  }
  let chunkSucceeded = false;
  try {
    // runId 주입 — finalize의 mark_selection_finalized run_id fencing.
    const result = await runTier1SelectionChunk({ ...input, runId: runId as string });
    await releaseSelectionLock(client, periodKey, runId as string, "succeeded");
    chunkSucceeded = true;
    return { result };
  } catch (err) {
    if (!chunkSucceeded) {
      // run_id fencing: stale reclaim 후 늦게 깨어난 old worker는 p_run_id 불일치로 no-op.
      try {
        await releaseSelectionLock(client, periodKey, runId as string, "failed");
      } catch (releaseErr) {
        console.error(
          JSON.stringify({
            event: "selection_worker_lock_release_failed",
            month,
            periodKey,
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
