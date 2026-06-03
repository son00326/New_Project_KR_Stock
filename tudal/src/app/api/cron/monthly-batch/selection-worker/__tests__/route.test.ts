// Tier1 selection-worker route — auth + flag gate + run-mutex skip + self-continue (OPS-3).
// PR5 report-worker/__tests__/route.test.ts 패턴 복제.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const guardedMock = vi.fn();

// next/server `after()`는 request scope를 요구 → vitest node env에서 throw.
// NextResponse/NextRequest는 real 유지하고 after만 no-op stub (self-continue 게이트 결정만 검증).
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: () => {} };
});

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({ rpc: vi.fn() }),
}));
vi.mock("@/lib/screening/tier1-selection-batch-worker", () => ({
  runGuardedSelectionChunk: (...a: unknown[]) => guardedMock(...a),
}));
// route가 DI 배선용으로 import하는 실 모듈들 — 호출 안 되므로 light stub.
vi.mock("@/lib/data/admin-tier0-candidates", () => ({
  getTier0Candidates: vi.fn(),
}));
vi.mock("@/lib/screening/persona-panel-adapter", () => ({
  makeCallPersonaPanel: vi.fn(() => vi.fn()),
}));
vi.mock("@/lib/ai/prompts/personas", () => ({ CORE_11_PERSONAS: [] }));
vi.mock("@/lib/ai/anthropic-client", () => ({ callPersona: vi.fn() }));
vi.mock("@/lib/data/dart-financials", () => ({
  fetchFinancialsSummary: vi.fn(),
}));
vi.mock("@/lib/cost/cost-logger", () => ({
  preflightHardcap: vi.fn(),
  getMonthlyTotal: vi.fn(),
}));
vi.mock("@/lib/data/admin-shortlist-persist", () => ({
  upsertShortList30: vi.fn(),
}));
vi.mock("@/lib/screening/persona-eval", () => ({ runTier1Screening: vi.fn() }));
vi.mock("@/lib/data/admin-pipeline-health-insert", () => ({
  insertPipelineHealth: vi.fn(),
}));
vi.mock("@/lib/data/admin-alerts-insert", () => ({ insertAlertEvents: vi.fn() }));
vi.mock("@/lib/data/admin-cost-alerts", () => ({ emitCostAlert: vi.fn() }));

import { GET } from "@/app/api/cron/monthly-batch/selection-worker/route";

const URL = "http://localhost/api/cron/monthly-batch/selection-worker";
const ORIG_ENV = { ...process.env };

function req(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(URL, { headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "secret-x";
  process.env.SELECTION_CRON_AUTO_ENABLED = "true";
  delete process.env.SELECTION_CRON_SELF_CONTINUE;
  delete process.env.VERCEL_ENV;
  delete process.env.NEXT_PUBLIC_APP_ENV;
  guardedMock.mockResolvedValue({
    result: {
      month: "2026-06",
      claimed: 3,
      done: 3,
      skipped: 0,
      failed: 0,
      deferred: 0,
      remaining: 0,
      finalized: false,
      aborted: null,
    },
  });
});

afterEach(() => {
  process.env = { ...ORIG_ENV };
});

describe("selection-worker auth", () => {
  it("Authorization 부재 → 401", async () => {
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(guardedMock).not.toHaveBeenCalled();
  });

  it("잘못된 Bearer → 401", async () => {
    const res = await GET(req({ authorization: "Bearer wrong" }));
    expect(res.status).toBe(401);
  });

  it("production-like + CRON_SECRET 미설정 → 401 (fail-closed)", async () => {
    delete process.env.CRON_SECRET;
    process.env.VERCEL_ENV = "production";
    const res = await GET(req());
    expect(res.status).toBe(401);
  });
});

describe("selection-worker flag gate", () => {
  it("SELECTION_CRON_AUTO_ENABLED 미설정 → 200 skipped, guarded 미호출 (spend 0)", async () => {
    delete process.env.SELECTION_CRON_AUTO_ENABLED;
    const res = await GET(req({ authorization: "Bearer secret-x" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skipped).toBe(true);
    expect(body.reason).toBe("selection_cron_auto_disabled");
    expect(guardedMock).not.toHaveBeenCalled();
  });
});

describe("selection-worker run-mutex + result", () => {
  it("run-mutex 미획득(already_running) → 200 skipped", async () => {
    guardedMock.mockResolvedValue({ skipped: "already_running" });
    const res = await GET(req({ authorization: "Bearer secret-x" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skipped).toBe(true);
    expect(body.reason).toBe("already_running");
  });

  it("성공 → 200 ok + result", async () => {
    const res = await GET(req({ authorization: "Bearer secret-x" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.result.done).toBe(3);
  });

  it("worker throw → 502", async () => {
    guardedMock.mockRejectedValue(new Error("cost_logging_disabled"));
    const res = await GET(req({ authorization: "Bearer secret-x" }));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe("cost_logging_disabled");
  });
});

describe("selection-worker self-continue forward-progress gate (OPS-3)", () => {
  it("claimed>0 + remaining>0 + SELF_CONTINUE → 202 continued", async () => {
    process.env.SELECTION_CRON_SELF_CONTINUE = "true";
    guardedMock.mockResolvedValue({
      result: {
        month: "2026-06",
        claimed: 3,
        done: 3,
        skipped: 0,
        failed: 0,
        deferred: 0,
        remaining: 27,
        finalized: false,
        aborted: null,
      },
    });
    const res = await GET(req({ authorization: "Bearer secret-x" }));
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.continued).toBe(true);
  });

  it("claimed=0 + remaining>0 + SELF_CONTINUE → 200 (no zero-progress self-loop)", async () => {
    process.env.SELECTION_CRON_SELF_CONTINUE = "true";
    guardedMock.mockResolvedValue({
      result: {
        month: "2026-06",
        claimed: 0,
        done: 0,
        skipped: 0,
        failed: 0,
        deferred: 0,
        remaining: 5,
        finalized: false,
        aborted: null,
      },
    });
    const res = await GET(req({ authorization: "Bearer secret-x" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.continued).toBeUndefined();
    expect(body.ok).toBe(true);
  });

  it("finalize 발생(finalized:true, remaining:0) → 200 + result, self-continue 안 함", async () => {
    process.env.SELECTION_CRON_SELF_CONTINUE = "true";
    guardedMock.mockResolvedValue({
      result: {
        month: "2026-06",
        claimed: 1,
        done: 1,
        skipped: 0,
        failed: 0,
        deferred: 0,
        remaining: 0,
        finalized: true,
        aborted: null,
      },
    });
    const res = await GET(req({ authorization: "Bearer secret-x" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.continued).toBeUndefined();
    expect(body.result.finalized).toBe(true);
  });
});
