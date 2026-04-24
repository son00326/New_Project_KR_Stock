import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const failedOutcome = {
  overallSuccess: false,
  runId: "run-failed",
  steps: [
    {
      name: "screening",
      pipeline: "dart",
      success: false,
      attempts: 3,
      latencyMs: 12,
      error: "source unavailable",
      startedAt: "2026-04-24T00:00:00.000Z",
      finishedAt: "2026-04-24T00:00:01.000Z",
    },
  ],
};

vi.mock("@/lib/scheduler/monthly-batch", () => ({
  runMonthlyBatch: vi.fn(async () => failedOutcome),
  buildSchedulerFailAlert: vi.fn(() => ({
    triggerReason: "월간 배치 실패: screening",
  })),
}));

describe("GET /api/cron/monthly-batch", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-secret";
  });

  it("returns non-2xx status when the monthly batch fails", async () => {
    const { GET } = await import("../route");

    const res = await GET(
      new NextRequest("http://localhost/api/cron/monthly-batch", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.ok).toBe(false);
    expect(body.alertEmitted).toMatch(/월간 배치 실패/);
  });
});
