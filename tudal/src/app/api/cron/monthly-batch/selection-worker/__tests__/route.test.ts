// Tier1 selection-worker route — auth + flag gate + run-mutex skip + self-continue (OPS-3)
//   + W2a Task 9: KST due-gate(월=short / 1일=midlong) + per-track 실패격리 + now seam.
// PR5 report-worker/__tests__/route.test.ts 패턴 복제.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import type { Tier1SelectionChunkResult } from "@/lib/screening/tier1-selection-batch-worker";

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
  makeCallDebatePanel: vi.fn(() => vi.fn()), // W1a
}));
vi.mock("@/lib/ai/model-registry", () => ({
  resolveTier1PanelSlot: vi.fn(), // W1a — server-only 모듈 stub
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
  upsertShortListTrack: vi.fn(),
}));
vi.mock("@/lib/screening/persona-eval", () => ({ runTier1Screening: vi.fn() }));
vi.mock("@/lib/data/admin-pipeline-health-insert", () => ({
  insertPipelineHealth: vi.fn(),
}));
vi.mock("@/lib/data/admin-alerts-insert", () => ({ insertAlertEvents: vi.fn() }));
vi.mock("@/lib/data/admin-cost-alerts", () => ({ emitCostAlert: vi.fn() }));
// W2b (D27 Q5) — incumbent DI 배선용 실 모듈 stub.
vi.mock("@/lib/data/admin-shortlist-incumbents", () => ({
  getIncumbents: vi.fn(),
  buildIncumbentThesisContexts: vi.fn(),
}));

import { GET } from "@/app/api/cron/monthly-batch/selection-worker/route";

const URL = "http://localhost/api/cron/monthly-batch/selection-worker";
const ORIG_ENV = { ...process.env };

function chunkResult(
  over: Partial<Tier1SelectionChunkResult> = {},
): Tier1SelectionChunkResult {
  return {
    month: "2026-06",
    claimed: 3,
    done: 3,
    skipped: 0,
    failed: 0,
    deferred: 0,
    r2Enqueued: 0,
    judgeEnqueued: 0,
    remaining: 0,
    finalized: false,
    aborted: null,
    ...over,
  };
}

// KST due-gate seam은 `?now=<ISO>` 쿼리로 주입 (테스트 결정성).
//   2026-06-08T01:00:00Z = KST 2026-06-08 10:00 월요일 (short due, midlong not due).
//   2026-06-01T01:00:00Z = KST 2026-06-01 10:00 월요일 = 1일 (short + midlong 둘 다 due).
//   2026-06-04T01:00:00Z = KST 2026-06-04 10:00 목요일 (둘 다 not due).
const MON_NOT_FIRST = "2026-06-08T01:00:00Z"; // 월요일, 1일 아님 → short only
const MON_AND_FIRST = "2026-06-01T01:00:00Z"; // 월요일 + 1일 → short + midlong
const NEITHER = "2026-06-04T01:00:00Z"; // 목요일, 1일 아님 → no-op
function reqAt(now: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`${URL}?now=${encodeURIComponent(now)}`, { headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "secret-x";
  process.env.SELECTION_CRON_AUTO_ENABLED = "true";
  delete process.env.SELECTION_CRON_SELF_CONTINUE;
  delete process.env.VERCEL_ENV;
  delete process.env.NEXT_PUBLIC_APP_ENV;
  guardedMock.mockResolvedValue({ result: chunkResult() });
});

afterEach(() => {
  process.env = { ...ORIG_ENV };
});

describe("selection-worker auth", () => {
  it("Authorization 부재 → 401", async () => {
    const res = await GET(reqAt(MON_NOT_FIRST));
    expect(res.status).toBe(401);
    expect(guardedMock).not.toHaveBeenCalled();
  });

  it("잘못된 Bearer → 401", async () => {
    const res = await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer wrong" }));
    expect(res.status).toBe(401);
  });

  it("production-like + CRON_SECRET 미설정 → 401 (fail-closed)", async () => {
    delete process.env.CRON_SECRET;
    process.env.VERCEL_ENV = "production";
    const res = await GET(reqAt(MON_NOT_FIRST));
    expect(res.status).toBe(401);
  });
});

describe("selection-worker flag gate", () => {
  it("SELECTION_CRON_AUTO_ENABLED 미설정 → 200 skipped, guarded 미호출 (spend 0)", async () => {
    delete process.env.SELECTION_CRON_AUTO_ENABLED;
    const res = await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skipped).toBe(true);
    expect(body.reason).toBe("selection_cron_auto_disabled");
    expect(guardedMock).not.toHaveBeenCalled();
  });
});

describe("selection-worker KST due-gate (W2a Task 9)", () => {
  it("월요일(1일 아님) → short 트랙만 1회 호출 (period_key s:)", async () => {
    const res = await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    expect(res.status).toBe(200);
    expect(guardedMock).toHaveBeenCalledTimes(1);
    expect(guardedMock.mock.calls[0][0]).toMatchObject({
      track: "short",
      periodKey: "s:2026-06-08",
      month: "2026-06",
    });
  });

  it("1일이면서 월요일 → short + midlong 둘 다 순차 호출 (독립 period_key)", async () => {
    const res = await GET(reqAt(MON_AND_FIRST, { authorization: "Bearer secret-x" }));
    expect(res.status).toBe(200);
    expect(guardedMock).toHaveBeenCalledTimes(2);
    const tracks = guardedMock.mock.calls.map((c) => c[0].track);
    expect(tracks).toContain("short");
    expect(tracks).toContain("midlong");
    const shortCall = guardedMock.mock.calls.find((c) => c[0].track === "short");
    const midlongCall = guardedMock.mock.calls.find(
      (c) => c[0].track === "midlong",
    );
    expect(shortCall![0].periodKey).toBe("s:2026-06-01");
    expect(midlongCall![0].periodKey).toBe("m:2026-06");
  });

  it("둘 다 not due → 200 no-op, guarded 미호출", async () => {
    const res = await GET(reqAt(NEITHER, { authorization: "Bearer secret-x" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(guardedMock).not.toHaveBeenCalled();
  });
});

describe("selection-worker per-track 실패격리 (R3 MED-5)", () => {
  it("short throw → midlong은 그래도 실행 + 부분실패 보고(502 단일화 금지)", async () => {
    guardedMock.mockImplementation((input: { track: string }) => {
      if (input.track === "short") {
        return Promise.reject(new Error("cost_logging_disabled"));
      }
      return Promise.resolve({ result: chunkResult({ month: "2026-06" }) });
    });
    const res = await GET(reqAt(MON_AND_FIRST, { authorization: "Bearer secret-x" }));
    // 한 트랙 실패해도 전체 502 단일화 안 함.
    expect(res.status).toBe(200);
    expect(guardedMock).toHaveBeenCalledTimes(2);
    const body = await res.json();
    // 트랙별 status 보고.
    const short = body.tracks.find((t: { track: string }) => t.track === "short");
    const midlong = body.tracks.find(
      (t: { track: string }) => t.track === "midlong",
    );
    expect(short.ok).toBe(false);
    expect(short.error).toContain("cost_logging_disabled");
    expect(midlong.ok).toBe(true);
  });
});

describe("selection-worker run-mutex + result", () => {
  it("run-mutex 미획득(already_running) → 200 skipped (트랙별 보고)", async () => {
    guardedMock.mockResolvedValue({ skipped: "already_running" });
    const res = await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    const short = body.tracks.find((t: { track: string }) => t.track === "short");
    expect(short.ok).toBe(true);
    expect(short.skipped).toBe("already_running");
  });

  it("성공 → 200 ok + 트랙별 result", async () => {
    const res = await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    const short = body.tracks.find((t: { track: string }) => t.track === "short");
    expect(short.ok).toBe(true);
    expect(short.result.done).toBe(3);
  });

  it("W1a — guarded 인자에 callDebatePanel 배선 + 패널 deps에 slotResolver 주입", async () => {
    await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    const args = guardedMock.mock.calls[0][0] as { callDebatePanel?: unknown };
    expect(typeof args.callDebatePanel).toBe("function");
    const { makeCallPersonaPanel } = await import("@/lib/screening/persona-panel-adapter");
    const { makeCallDebatePanel } = await import("@/lib/screening/persona-panel-adapter");
    const panelDeps = (makeCallPersonaPanel as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as { slotResolver?: unknown };
    const debateDeps = (makeCallDebatePanel as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as { slotResolver?: unknown };
    expect(typeof panelDeps.slotResolver).toBe("function");
    expect(typeof debateDeps.slotResolver).toBe("function");
  });

  it("W2b — guarded 호출 인자에 incumbentsSource/buildIncumbentContexts DI 배선", async () => {
    await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    expect(guardedMock).toHaveBeenCalledTimes(1);
    const args = guardedMock.mock.calls[0][0] as {
      incumbentsSource?: unknown;
      buildIncumbentContexts?: unknown;
    };
    expect(typeof args.incumbentsSource).toBe("function");
    expect(typeof args.buildIncumbentContexts).toBe("function");
  });

  it("단일 트랙 throw + 다른 트랙 없음(short만 due) → 부분실패라도 502 단일화 금지", async () => {
    guardedMock.mockRejectedValue(new Error("cost_logging_disabled"));
    const res = await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false);
    const short = body.tracks.find((t: { track: string }) => t.track === "short");
    expect(short.ok).toBe(false);
    expect(short.error).toContain("cost_logging_disabled");
  });
});

describe("selection-worker self-continue forward-progress gate (OPS-3)", () => {
  it("claimed>0 + remaining>0 + SELF_CONTINUE → 202 continued", async () => {
    process.env.SELECTION_CRON_SELF_CONTINUE = "true";
    guardedMock.mockResolvedValue({
      result: chunkResult({ remaining: 27 }),
    });
    const res = await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.continued).toBe(true);
  });

  it("claimed=0 + remaining>0 + SELF_CONTINUE → 200 (no zero-progress self-loop)", async () => {
    process.env.SELECTION_CRON_SELF_CONTINUE = "true";
    guardedMock.mockResolvedValue({
      result: chunkResult({ claimed: 0, done: 0, remaining: 5 }),
    });
    const res = await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.continued).toBeUndefined();
    expect(body.ok).toBe(true);
  });

  it("claimed=0 + r2Enqueued>0 + remaining>0 + SELF_CONTINUE → 202 continued", async () => {
    process.env.SELECTION_CRON_SELF_CONTINUE = "true";
    guardedMock.mockResolvedValue({
      result: chunkResult({ claimed: 0, done: 0, r2Enqueued: 7, remaining: 7 }),
    });
    const res = await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.continued).toBe(true);
  });

  it("finalize 발생(finalized:true, remaining:0) → 200, self-continue 안 함", async () => {
    process.env.SELECTION_CRON_SELF_CONTINUE = "true";
    guardedMock.mockResolvedValue({
      result: chunkResult({ claimed: 1, done: 1, finalized: true }),
    });
    const res = await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.continued).toBeUndefined();
    const short = body.tracks.find((t: { track: string }) => t.track === "short");
    expect(short.result.finalized).toBe(true);
  });
});
