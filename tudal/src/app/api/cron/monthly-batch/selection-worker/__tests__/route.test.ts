// Tier1 selection-worker route — auth + flag gate + run-mutex skip + self-continue (OPS-3)
//   + B-SEL-CRON: period-scoped due-gate(트랙별 현재 period는 window 내내 due) + per-track 실패격리
//   + now seam + SELF_CONTINUE opt-out 기본 ON + stall alert + 고아 period sweep.
// PR5 report-worker/__tests__/route.test.ts 패턴 복제.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import type { Tier1SelectionChunkResult } from "@/lib/screening/tier1-selection-batch-worker";

const guardedMock = vi.fn();
const afterCallbacks = vi.hoisted(() => [] as Array<() => void | Promise<void>>);
// 고아 period sweep — service-role client.from('tier1_selection_run') SELECT 결과 주입 seam.
const orphanQueryState = vi.hoisted(() => ({
  rows: [] as Array<{ period_key: string; track: string; created_at: string }>,
  error: null as { code?: string } | null,
}));

// next/server `after()`는 request scope를 요구 → vitest node env에서 throw.
// NextResponse/NextRequest는 real 유지하고 after callback만 캡처해 self-continue URL까지 검증.
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: (callback: () => void | Promise<void>) => {
      afterCallbacks.push(callback);
    },
  };
});

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({
    rpc: vi.fn(),
    // 고아 period sweep: .from('tier1_selection_run').select(..).is('finalized_at', null).gt('created_at', iso)
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        is: vi.fn(() => ({
          gt: vi.fn(async () => ({
            data: orphanQueryState.rows,
            error: orphanQueryState.error,
          })),
        })),
      })),
    })),
  }),
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
vi.mock("@/lib/ai/judge-client", () => ({
  callJudge: vi.fn(),
  callDualJudge: vi.fn(),
}));
vi.mock("@/lib/ai/prompts/debate-round-template", () => ({
  renderPeerArguments: vi.fn(() => ""),
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

// `?now=<ISO>` seam (테스트 결정성). period-scoped due-gate: 날짜는 period key 계산에만 쓰이고
//   어느 날이든 두 트랙 모두 현재 period로 진행한다 (B-SEL-CRON).
//   2026-06-08T01:00:00Z = KST 2026-06-08 10:00 월요일 → s:2026-06-08 / m:2026-06.
//   2026-06-01T01:00:00Z = KST 2026-06-01 10:00 월요일+1일 → s:2026-06-01 / m:2026-06.
//   2026-06-04T01:00:00Z = KST 2026-06-04 10:00 목요일 → s:2026-06-01(그 주 월요일) / m:2026-06.
const MON_NOT_FIRST = "2026-06-08T01:00:00Z";
const MON_AND_FIRST = "2026-06-01T01:00:00Z";
const MIDWEEK = "2026-06-04T01:00:00Z";
function reqAt(now: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`${URL}?now=${encodeURIComponent(now)}`, { headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  afterCallbacks.length = 0;
  orphanQueryState.rows = [];
  orphanQueryState.error = null;
  process.env.CRON_SECRET = "secret-x";
  process.env.SELECTION_CRON_AUTO_ENABLED = "true";
  delete process.env.SELECTION_CRON_SELF_CONTINUE;
  delete process.env.VERCEL_ENV;
  delete process.env.NEXT_PUBLIC_APP_ENV;
  guardedMock.mockResolvedValue({ result: chunkResult() });
});

afterEach(() => {
  vi.unstubAllGlobals();
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

describe("selection-worker period-scoped due-gate (B-SEL-CRON)", () => {
  it("월요일 → 두 트랙 모두 현재 period로 호출 (s:해당 월요일 / m:해당 월)", async () => {
    const res = await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    expect(res.status).toBe(200);
    expect(guardedMock).toHaveBeenCalledTimes(2);
    const shortCall = guardedMock.mock.calls.find((c) => c[0].track === "short");
    const midlongCall = guardedMock.mock.calls.find(
      (c) => c[0].track === "midlong",
    );
    expect(shortCall![0]).toMatchObject({
      periodKey: "s:2026-06-08",
      month: "2026-06",
    });
    expect(midlongCall![0]).toMatchObject({
      periodKey: "m:2026-06",
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

  it("주중(목요일) → no-op 아님: 그 주 월요일 period를 이어서 진행 (미finalize 고아화 차단)", async () => {
    const res = await GET(reqAt(MIDWEEK, { authorization: "Bearer secret-x" }));
    expect(res.status).toBe(200);
    expect(guardedMock).toHaveBeenCalledTimes(2);
    const shortCall = guardedMock.mock.calls.find((c) => c[0].track === "short");
    expect(shortCall![0].periodKey).toBe("s:2026-06-01"); // 그 주 월요일로 수렴
    const midlongCall = guardedMock.mock.calls.find(
      (c) => c[0].track === "midlong",
    );
    expect(midlongCall![0].periodKey).toBe("m:2026-06");
  });

  it("finalize된 period의 일일 재시도 → already_finalized skip 보고 (cheap no-op)", async () => {
    guardedMock.mockResolvedValue({ skipped: "already_finalized" });
    const res = await GET(reqAt(MIDWEEK, { authorization: "Bearer secret-x" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    for (const t of body.tracks) {
      expect(t.skipped).toBe("already_finalized");
    }
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

  it("W1b — judgeEnqueued>0 + remaining>0 → self-continue 202 (forward-progress)", async () => {
    process.env.SELECTION_CRON_SELF_CONTINUE = "true";
    guardedMock.mockResolvedValue({
      result: chunkResult({ claimed: 0, judgeEnqueued: 100, remaining: 100 }),
    });
    const res = await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    expect(res.status).toBe(202);
  });

  it("W1b — guarded 인자에 callJudgePanel/callDualJudge DI 배선", async () => {
    await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    const args = guardedMock.mock.calls[0][0] as {
      callJudgePanel?: (input: {
        ticker: string;
        month: string;
        track: "short" | "midlong";
        finalPanel: unknown[];
        reflectionContext?: string;
      }) => Promise<unknown>;
      callDualJudge?: (input: {
        ticker: string;
        month: string;
        track: "short" | "midlong";
        finalPanel: unknown[];
        reflectionContext?: string;
      }) => Promise<unknown>;
    };
    expect(typeof args.callJudgePanel).toBe("function");
    expect(typeof args.callDualJudge).toBe("function");
    await args.callJudgePanel!({
      ticker: "005930",
      month: "2026-06",
      track: "short",
      finalPanel: [],
      reflectionContext: "[재점검] ctx",
    });
    await args.callDualJudge!({
      ticker: "000660",
      month: "2026-06",
      track: "midlong",
      finalPanel: [],
    });
    const { callJudge, callDualJudge } = await import("@/lib/ai/judge-client");
    expect(callJudge).toHaveBeenCalledWith(
      expect.objectContaining({
        ticker: "005930",
        month: "2026-06",
        track: "short",
        reflectionContext: "[재점검] ctx",
      }),
    );
    expect(callDualJudge).toHaveBeenCalledWith(
      expect.objectContaining({
        ticker: "000660",
        month: "2026-06",
        track: "midlong",
      }),
    );
  });

  it("W2b — guarded 호출 인자에 incumbentsSource/buildIncumbentContexts DI 배선", async () => {
    await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    expect(guardedMock).toHaveBeenCalledTimes(2);
    const args = guardedMock.mock.calls[0][0] as {
      incumbentsSource?: unknown;
      buildIncumbentContexts?: unknown;
    };
    expect(typeof args.incumbentsSource).toBe("function");
    expect(typeof args.buildIncumbentContexts).toBe("function");
  });

  it("두 트랙 모두 throw → 부분실패라도 502 단일화 금지 (트랙별 보고)", async () => {
    guardedMock.mockRejectedValue(new Error("cost_logging_disabled"));
    const res = await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.tracks).toHaveLength(2);
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

  it("SELF_CONTINUE fetch는 now query를 보존한다", async () => {
    process.env.SELECTION_CRON_SELF_CONTINUE = "true";
    guardedMock.mockResolvedValue({
      result: chunkResult({ remaining: 27 }),
    });
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    expect(res.status).toBe(202);
    expect(afterCallbacks).toHaveLength(1);
    await afterCallbacks[0]();
    expect(fetchMock).toHaveBeenCalledWith(
      `${URL}?now=${encodeURIComponent(MON_NOT_FIRST)}`,
      expect.objectContaining({
        headers: { authorization: "Bearer secret-x" },
      }),
    );
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

// B-SEL-CRON — SELF_CONTINUE는 opt-out 기본 ON (daily cron 단독 3 jobs/day로는 period당
//   ~130 jobs를 window 내 완주 불가 → 운영 viability상 load-bearing accelerator).
describe("selection-worker SELF_CONTINUE 기본값 (opt-out, B-SEL-CRON)", () => {
  it("env 미설정 + forward-progress + remaining>0 → 기본 ON으로 202 continued", async () => {
    // beforeEach가 SELECTION_CRON_SELF_CONTINUE를 delete — 미설정 상태 그대로.
    guardedMock.mockResolvedValue({
      result: chunkResult({ remaining: 27 }),
    });
    const res = await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.continued).toBe(true);
  });

  it('명시 "false" → self-continue 안 함 (opt-out 동작)', async () => {
    process.env.SELECTION_CRON_SELF_CONTINUE = "false";
    guardedMock.mockResolvedValue({
      result: chunkResult({ remaining: 27 }),
    });
    const res = await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.continued).toBeUndefined();
    expect(afterCallbacks).toHaveLength(0);
  });
});

describe("selection-worker stall alert (SELF_CONTINUE 명시 off + 미완 period)", () => {
  it('명시 "false" + remaining>0 → scheduler_fail warning alert (stall 가시화)', async () => {
    process.env.SELECTION_CRON_SELF_CONTINUE = "false";
    guardedMock.mockResolvedValue({
      result: chunkResult({ remaining: 27 }),
    });
    const res = await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    expect(res.status).toBe(200);
    const { insertAlertEvents } = await import("@/lib/data/admin-alerts-insert");
    const calls = (insertAlertEvents as ReturnType<typeof vi.fn>).mock.calls;
    const stallCall = calls.find((c) =>
      (c[0] as Array<{ triggerReason: string }>).some((e) =>
        e.triggerReason.includes("self_continue_disabled_stall"),
      ),
    );
    expect(stallCall).toBeDefined();
    const event = (stallCall![0] as Array<Record<string, unknown>>)[0];
    expect(event.alertType).toBe("scheduler_fail");
    expect(event.severity).toBe("warning");
  });

  it('명시 "false" + remaining=0 → stall alert 없음', async () => {
    process.env.SELECTION_CRON_SELF_CONTINUE = "false";
    guardedMock.mockResolvedValue({
      result: chunkResult({ remaining: 0 }),
    });
    await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    const { insertAlertEvents } = await import("@/lib/data/admin-alerts-insert");
    expect(insertAlertEvents).not.toHaveBeenCalled();
  });

  it("기본 ON(미설정) + remaining>0 → stall alert 없음 (self-continue가 진행 담당)", async () => {
    guardedMock.mockResolvedValue({
      result: chunkResult({ remaining: 27 }),
    });
    await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    const { insertAlertEvents } = await import("@/lib/data/admin-alerts-insert");
    expect(insertAlertEvents).not.toHaveBeenCalled();
  });

  it("alert insert 실패해도 응답은 200 유지 (best-effort)", async () => {
    process.env.SELECTION_CRON_SELF_CONTINUE = "false";
    guardedMock.mockResolvedValue({
      result: chunkResult({ remaining: 27 }),
    });
    const { insertAlertEvents } = await import("@/lib/data/admin-alerts-insert");
    (insertAlertEvents as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("insert_failed"),
    );
    const res = await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    expect(res.status).toBe(200);
  });
});

describe("selection-worker 고아 period sweep (B-SEL-CRON silent-spend 가시화)", () => {
  it("미finalize + 현재 period 아님 → scheduler_fail warning alert (period_key 명시)", async () => {
    // now = 2026-06-08(월) → 현재 period = s:2026-06-08 / m:2026-06. 직전 주 미완 = 고아.
    orphanQueryState.rows = [
      { period_key: "s:2026-06-01", track: "short", created_at: "2026-06-01T02:00:00Z" },
    ];
    const res = await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    expect(res.status).toBe(200);
    const { insertAlertEvents } = await import("@/lib/data/admin-alerts-insert");
    const calls = (insertAlertEvents as ReturnType<typeof vi.fn>).mock.calls;
    const orphanCall = calls.find((c) =>
      (c[0] as Array<{ triggerReason: string }>).some((e) =>
        e.triggerReason.includes("s:2026-06-01"),
      ),
    );
    expect(orphanCall).toBeDefined();
    const event = (orphanCall![0] as Array<Record<string, unknown>>)[0];
    expect(event.alertType).toBe("scheduler_fail");
    expect(event.severity).toBe("warning");
  });

  it("현재 period의 미finalize run row → 고아 아님 (alert 없음)", async () => {
    orphanQueryState.rows = [
      { period_key: "s:2026-06-08", track: "short", created_at: "2026-06-08T02:00:00Z" },
      { period_key: "m:2026-06", track: "midlong", created_at: "2026-06-01T02:00:00Z" },
    ];
    await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    const { insertAlertEvents } = await import("@/lib/data/admin-alerts-insert");
    expect(insertAlertEvents).not.toHaveBeenCalled();
  });

  it("sweep 쿼리 실패해도 응답 200 유지 (best-effort)", async () => {
    orphanQueryState.error = { code: "XX000" };
    const res = await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
