// monthly-batch.test.ts — M10 배치 재시도·실패 처리 단위 테스트 (S5a T5a.1)
import { describe, it, expect } from "vitest";
import {
  buildSchedulerFailAlert,
  runMonthlyBatch,
  runStepWithRetries,
  toPipelineHealthRecord,
  type BatchStep,
} from "../monthly-batch";

function successStep(name: string): BatchStep {
  return {
    name,
    pipeline: "dart",
    run: async () => ({ success: true }),
  };
}

function failingStep(
  name: string,
  failTimes: number,
  ok: boolean = false,
): BatchStep {
  let calls = 0;
  return {
    name,
    pipeline: "ai",
    run: async () => {
      calls += 1;
      if (calls <= failTimes) return { success: false, error: `fail-${calls}` };
      return ok ? { success: true } : { success: false, error: `fail-${calls}` };
    },
  };
}

const noSleep = () => Promise.resolve();

describe("runStepWithRetries", () => {
  it("첫 시도 성공 → attempts=1", async () => {
    const out = await runStepWithRetries(successStep("a"), { sleep: noSleep });
    expect(out.success).toBe(true);
    expect(out.attempts).toBe(1);
  });

  it("2회 실패 후 3회차 성공 → attempts=3 · success", async () => {
    const out = await runStepWithRetries(failingStep("b", 2, true), {
      sleep: noSleep,
      maxAttempts: 3,
    });
    expect(out.success).toBe(true);
    expect(out.attempts).toBe(3);
  });

  it("3회 모두 실패 → success=false · attempts=3 · error 보존", async () => {
    const out = await runStepWithRetries(failingStep("c", 5, false), {
      sleep: noSleep,
      maxAttempts: 3,
    });
    expect(out.success).toBe(false);
    expect(out.attempts).toBe(3);
    expect(out.error).toMatch(/fail-3/);
  });

  it("throw 예외도 재시도 · 마지막 message 보존", async () => {
    let calls = 0;
    const step: BatchStep = {
      name: "throws",
      pipeline: "alert",
      run: async () => {
        calls += 1;
        throw new Error(`boom-${calls}`);
      },
    };
    const out = await runStepWithRetries(step, {
      sleep: noSleep,
      maxAttempts: 3,
    });
    expect(out.success).toBe(false);
    expect(out.attempts).toBe(3);
    expect(out.error).toBe("boom-3");
  });
});

describe("runMonthlyBatch", () => {
  it("모든 스텝 성공 → overallSuccess=true · 모든 스텝 실행", async () => {
    const result = await runMonthlyBatch(
      [successStep("a"), successStep("b"), successStep("c")],
      { sleep: noSleep },
    );
    expect(result.overallSuccess).toBe(true);
    expect(result.steps).toHaveLength(3);
    expect(result.steps.every((s) => s.success)).toBe(true);
  });

  it("중간 스텝 실패 시 후속 스텝 중단(기본)", async () => {
    const result = await runMonthlyBatch(
      [
        successStep("a"),
        failingStep("b", 5, false), // 3회 모두 실패
        successStep("c"), // 실행되면 안 됨
      ],
      { sleep: noSleep, maxAttempts: 3 },
    );
    expect(result.overallSuccess).toBe(false);
    expect(result.steps).toHaveLength(2); // a, b만 기록됨
    expect(result.steps[1].name).toBe("b");
  });

  it("continueOnFailure=true 시 후속 스텝도 실행", async () => {
    const result = await runMonthlyBatch(
      [
        successStep("a"),
        failingStep("b", 5, false),
        successStep("c"),
      ],
      { sleep: noSleep, maxAttempts: 2, continueOnFailure: true },
    );
    expect(result.overallSuccess).toBe(false);
    expect(result.steps).toHaveLength(3);
    expect(result.steps[2].name).toBe("c");
    expect(result.steps[2].success).toBe(true);
  });
});

describe("buildSchedulerFailAlert", () => {
  it("실패한 스텝 정보를 triggerReason에 포함", async () => {
    const run = await runMonthlyBatch(
      [successStep("a"), failingStep("flaky-step", 5, false)],
      { sleep: noSleep, maxAttempts: 3 },
    );
    const alert = buildSchedulerFailAlert(run);
    expect(alert.alertType).toBe("scheduler_fail");
    expect(alert.severity).toBe("critical");
    expect(alert.triggerReason).toMatch(/flaky-step/);
    expect(alert.triggerReason).toMatch(/3회 재시도/);
  });
});

describe("toPipelineHealthRecord", () => {
  it("StepOutcome → pipeline_health 페이로드 변환", async () => {
    const out = await runStepWithRetries(successStep("x"), { sleep: noSleep });
    const record = toPipelineHealthRecord("run-1", out);
    expect(record.pipeline).toBe("dart");
    expect(record.status).toBe("success");
    expect(record.runId).toBe("run-1");
    expect(record.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
