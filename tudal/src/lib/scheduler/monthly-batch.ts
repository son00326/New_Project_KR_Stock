import type { AlertEvent, PipelineHealth, PipelineKind } from "@/types/admin";

// ---------------------------------------------------------------------------
// M10 월간 배치 파이프라인 (S5a T5a.1)
// ref: ServicePlan-Admin §3.10 R3.10-1~5
//
// 플로우: 스크리닝 → Short List → 리포트 → 알림 전송
// 실패 시 스텝당 3회 재시도 → 실패 확정 시 scheduler_fail AlertEvent + 전월 유지.
// pipeline_health 레코드는 각 스텝마다 1건씩 생성 (dart·ai·alert 등 태그).
//
// 본 모듈은 순수 로직 — 실 I/O(pykrx·GPT·Telegram)는 주입받은 step.run() 함수가 담당.
// 실데이터 전환 시점(S5 실 API 키 세팅)에 각 step.run을 실 구현체로 교체.
// ---------------------------------------------------------------------------

export const DEFAULT_MAX_ATTEMPTS = 3;

export interface BatchStep {
  name: string;
  pipeline: PipelineKind;
  run: () => Promise<BatchStepResult>;
  maxAttempts?: number;
}

export interface BatchStepResult {
  success: boolean;
  error?: string;
  meta?: Record<string, unknown>;
}

export interface StepOutcome {
  name: string;
  pipeline: PipelineKind;
  attempts: number;
  success: boolean;
  error: string | null;
  latencyMs: number;
  startedAt: string;
  finishedAt: string;
}

export interface BatchRunOutcome {
  runId: string;
  startedAt: string;
  finishedAt: string;
  totalLatencyMs: number;
  overallSuccess: boolean;
  steps: StepOutcome[];
}

interface ClockLike {
  now: () => number;
}

const SYSTEM_CLOCK: ClockLike = { now: () => Date.now() };

// 지수 백오프 대기 (mock-mode에서는 sleepMs=0으로 주입해 즉시 완료)
export interface RetryOptions {
  maxAttempts?: number;
  sleep?: (ms: number) => Promise<void>;
  backoffMs?: (attempt: number) => number;
}

export async function runStepWithRetries(
  step: BatchStep,
  opts: RetryOptions = {},
  clock: ClockLike = SYSTEM_CLOCK,
): Promise<StepOutcome> {
  const max = step.maxAttempts ?? opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const backoff = opts.backoffMs ?? ((attempt) => Math.min(1000 * 2 ** attempt, 10_000));

  const startedAtMs = clock.now();
  const startedAt = new Date(startedAtMs).toISOString();
  let attempts = 0;
  let lastError: string | null = null;

  while (attempts < max) {
    attempts += 1;
    try {
      const result = await step.run();
      if (result.success) {
        const finishedAtMs = clock.now();
        return {
          name: step.name,
          pipeline: step.pipeline,
          attempts,
          success: true,
          error: null,
          latencyMs: finishedAtMs - startedAtMs,
          startedAt,
          finishedAt: new Date(finishedAtMs).toISOString(),
        };
      }
      lastError = result.error ?? "unknown failure";
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    if (attempts < max) {
      await sleep(backoff(attempts));
    }
  }

  const finishedAtMs = clock.now();
  return {
    name: step.name,
    pipeline: step.pipeline,
    attempts,
    success: false,
    error: lastError,
    latencyMs: finishedAtMs - startedAtMs,
    startedAt,
    finishedAt: new Date(finishedAtMs).toISOString(),
  };
}

// 월간 배치 실행 — steps 배열을 순차 실행. 중간 스텝 실패 시 후속 스텝 실행은
// 호출자가 결정 (기본: 스텝 실패 시 즉시 중단하고 scheduler_fail 알림 방출).
export async function runMonthlyBatch(
  steps: BatchStep[],
  opts: RetryOptions & { continueOnFailure?: boolean } = {},
  clock: ClockLike = SYSTEM_CLOCK,
): Promise<BatchRunOutcome> {
  const runId = `run-${clock.now().toString(36)}`;
  const startedAtMs = clock.now();
  const outcomes: StepOutcome[] = [];
  let overallSuccess = true;

  for (const step of steps) {
    const outcome = await runStepWithRetries(step, opts, clock);
    outcomes.push(outcome);
    if (!outcome.success) {
      overallSuccess = false;
      if (!opts.continueOnFailure) break;
    }
  }

  const finishedAtMs = clock.now();
  return {
    runId,
    startedAt: new Date(startedAtMs).toISOString(),
    finishedAt: new Date(finishedAtMs).toISOString(),
    totalLatencyMs: finishedAtMs - startedAtMs,
    overallSuccess,
    steps: outcomes,
  };
}

// StepOutcome → pipeline_health INSERT payload 변환
export function toPipelineHealthRecord(
  runId: string,
  outcome: StepOutcome,
): Omit<PipelineHealth, "id"> {
  return {
    runId,
    pipeline: outcome.pipeline,
    status: outcome.success ? "success" : "failed",
    startedAt: outcome.startedAt,
    finishedAt: outcome.finishedAt,
    latencyMs: outcome.latencyMs,
    error: outcome.error,
  };
}

// 배치 실패 시 방출할 scheduler_fail AlertEvent 페이로드 생성
export function buildSchedulerFailAlert(
  run: BatchRunOutcome,
): Omit<AlertEvent, "id" | "isRead"> {
  const failed = run.steps.find((s) => !s.success);
  const reason = failed
    ? `월간 배치 실패: ${failed.name} (${failed.pipeline}) — ${failed.attempts}회 재시도. 전월 유지. 오류: ${failed.error ?? "unknown"}`
    : "월간 배치 실패 (상세 불명)";
  return {
    alertType: "scheduler_fail",
    ticker: null,
    severity: "critical",
    triggerReason: reason,
    signalSentAt: run.finishedAt,
    outcomeAt: null,
    t7PriceChange: null,
    decisionRecorded: null,
    decisionMemo: null,
  };
}
