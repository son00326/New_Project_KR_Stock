// Tier1 selection-worker route — auth + flag gate + run-mutex skip + self-continue (OPS-3)
//   + B-SEL-CRON: period-scoped due-gate(트랙별 현재 period는 window 내내 due) + per-track 실패격리
//   + now seam + SELF_CONTINUE opt-out 기본 ON + stall alert + 고아 period sweep.
// PR5 report-worker/__tests__/route.test.ts 패턴 복제.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import type { Tier1SelectionChunkResult } from "@/lib/screening/tier1-selection-batch-worker";
import {
  currentShortPeriodKey,
  currentMidlongPeriodKey,
} from "@/lib/screening/selection-period";

const guardedMock = vi.fn();
const afterCallbacks = vi.hoisted(() => [] as Array<() => void | Promise<void>>);
const serviceRoleState = vi.hoisted(() => ({
  throwOnCreate: null as Error | null,
}));
const macroMock = vi.hoisted(() => ({
  getMacroContextString: vi.fn(async () => ""),
}));
// PR-K Reflection (D32) — getLatestReflectionLog mock: 회고 스냅샷을 track별로 반환(live 배선 회귀 박제).
const reflectionMock = vi.hoisted(() => ({
  getLatestReflectionLog: vi.fn(async (opts: { track: string }) => ({
    injectedContextSnapshot: `refl-${opts.track}`,
  })),
}));
// 고아 period sweep — service-role client.from('tier1_selection_run') SELECT 결과 + filter 인자 캡처 seam.
const orphanQueryState = vi.hoisted(() => ({
  rows: [] as Array<{ period_key: string; track: string; created_at: string }>,
  error: null as { code?: string } | null,
  // finding 22a — sweep 쿼리가 정확히 .is('finalized_at', null).gt('created_at', sinceIso)인지 검증용.
  isArgs: null as [string, unknown] | null,
  gtArgs: null as [string, unknown] | null,
  selectCount: 0,
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
  createServiceRoleClient: () => {
    if (serviceRoleState.throwOnCreate) {
      throw serviceRoleState.throwOnCreate;
    }
    return {
      rpc: vi.fn(),
      // 고아 period sweep: .from('tier1_selection_run').select(..).is('finalized_at', null).gt('created_at', iso)
      //   finding 22a — is/gt 인자를 캡처해 컬럼·연산자 회귀를 잡는다.
      from: vi.fn(() => ({
        select: vi.fn(() => {
          orphanQueryState.selectCount += 1;
          return {
            is: vi.fn((col: string, val: unknown) => {
              orphanQueryState.isArgs = [col, val];
              return {
                gt: vi.fn(async (col2: string, val2: unknown) => {
                  orphanQueryState.gtArgs = [col2, val2];
                  return {
                    data: orphanQueryState.rows,
                    error: orphanQueryState.error,
                  };
                }),
              };
            }),
          };
        }),
      })),
    };
  },
}));
vi.mock("@/lib/screening/tier1-selection-batch-worker", () => ({
  runGuardedSelectionChunk: (...a: unknown[]) => guardedMock(...a),
}));
vi.mock("@/lib/macro/source", () => ({
  getMacroContextString: macroMock.getMacroContextString,
}));
vi.mock("@/lib/data/admin-reflection", () => ({
  getLatestReflectionLog: reflectionMock.getLatestReflectionLog,
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
// B-SEL-CRON — self-continue hop 모의(&selfcontinue=1): route-level alert(sweep/track-throw/stall) skip 검증.
function hopReqAt(now: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(
    `${URL}?now=${encodeURIComponent(now)}&selfcontinue=1`,
    { headers },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  afterCallbacks.length = 0;
  orphanQueryState.rows = [];
  orphanQueryState.error = null;
  orphanQueryState.isArgs = null;
  orphanQueryState.gtArgs = null;
  orphanQueryState.selectCount = 0;
  process.env.CRON_SECRET = "secret-x";
  process.env.SELECTION_CRON_AUTO_ENABLED = "true";
  delete process.env.SELECTION_CRON_SELF_CONTINUE;
  delete process.env.VERCEL_ENV;
  delete process.env.NEXT_PUBLIC_APP_ENV;
  serviceRoleState.throwOnCreate = null;
  macroMock.getMacroContextString.mockReset();
  macroMock.getMacroContextString.mockResolvedValue("");
  delete process.env.REFLECTION_ENABLED;
  reflectionMock.getLatestReflectionLog.mockReset();
  reflectionMock.getLatestReflectionLog.mockImplementation(async (opts: { track: string }) => ({
    injectedContextSnapshot: `refl-${opts.track}`,
  }));
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
    expect(macroMock.getMacroContextString).not.toHaveBeenCalled();
  });

  it("flag off + service-role client 생성 실패 → 200 skipped 유지 (dormant merge-safe)", async () => {
    delete process.env.SELECTION_CRON_AUTO_ENABLED;
    serviceRoleState.throwOnCreate = new Error("service_role_missing");
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skipped).toBe(true);
    expect(body.reason).toBe("selection_cron_auto_disabled");
    expect(guardedMock).not.toHaveBeenCalled();
    expect(orphanQueryState.selectCount).toBe(0);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("selection_orphan_sweep_failed"),
    );
    consoleSpy.mockRestore();
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

  it("finding 14 — track throw 시 cron-entry에서 best-effort scheduler_fail alert 발화", async () => {
    guardedMock.mockImplementation((input: { track: string }) => {
      if (input.track === "short") {
        return Promise.reject(new Error("shortlist_track_cross_bucket_overlap"));
      }
      return Promise.resolve({ result: chunkResult() });
    });
    const res = await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    expect(res.status).toBe(200);
    const { insertAlertEvents } = await import("@/lib/data/admin-alerts-insert");
    const calls = (insertAlertEvents as ReturnType<typeof vi.fn>).mock.calls;
    const failCall = calls.find((c) =>
      (c[0] as Array<{ triggerReason: string }>).some((e) =>
        e.triggerReason.includes("shortlist_track_cross_bucket_overlap"),
      ),
    );
    expect(failCall).toBeDefined();
    const event = (failCall![0] as Array<Record<string, unknown>>)[0];
    expect(event.alertType).toBe("scheduler_fail");
  });

  it("finding 14 — hop(&selfcontinue=1)에서는 track throw alert skip (중복 차단)", async () => {
    guardedMock.mockRejectedValue(new Error("shortlist_track_cross_bucket_overlap"));
    await GET(hopReqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    const { insertAlertEvents } = await import("@/lib/data/admin-alerts-insert");
    expect(insertAlertEvents).not.toHaveBeenCalled();
  });

  it("track throw + best-effort alert 실패해도 응답 200 (트랙별 보고 유지)", async () => {
    guardedMock.mockRejectedValue(new Error("finalize_boom"));
    const { insertAlertEvents } = await import("@/lib/data/admin-alerts-insert");
    (insertAlertEvents as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("alert_insert_failed"),
    );
    const res = await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false);
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

  it("cluster D — 패널 factory에 costLogMonth=t.month 배선 (preflight month == insert month)", async () => {
    await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    const { makeCallPersonaPanel, makeCallDebatePanel } = await import(
      "@/lib/screening/persona-panel-adapter"
    );
    // short 트랙 호출 = 첫 호출 (period s:2026-06-08 → month 2026-06).
    const panelDeps = (makeCallPersonaPanel as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as { costLogMonth?: string };
    const debateDeps = (makeCallDebatePanel as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as { costLogMonth?: string };
    expect(panelDeps.costLogMonth).toBe("2026-06");
    expect(debateDeps.costLogMonth).toBe("2026-06");
  });

  it("G4 — live selection route가 macroContextString을 1회 계산해 R1/R2 패널에 동일 주입", async () => {
    const macroContextString = "[거시 컨텍스트] 강세(예측 아님)";
    macroMock.getMacroContextString.mockResolvedValue(macroContextString);
    await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    const { makeCallPersonaPanel, makeCallDebatePanel } = await import(
      "@/lib/screening/persona-panel-adapter"
    );
    expect(macroMock.getMacroContextString).toHaveBeenCalledTimes(1);
    const panelCalls = (makeCallPersonaPanel as ReturnType<typeof vi.fn>).mock.calls as Array<
      [{ macroContextString?: string }]
    >;
    const debateCalls = (makeCallDebatePanel as ReturnType<typeof vi.fn>).mock.calls as Array<
      [{ macroContextString?: string }]
    >;
    expect(panelCalls).toHaveLength(2);
    expect(debateCalls).toHaveLength(2);
    for (const [deps] of panelCalls) {
      expect(deps.macroContextString).toBe(macroContextString);
    }
    for (const [deps] of debateCalls) {
      expect(deps.macroContextString).toBe(macroContextString);
    }
  });

  it("PR-K — REFLECTION_ENABLED on → 직전 회고 스냅샷을 track별로 R1/R2 패널에 주입 (live 배선 회귀 박제·track-scoping)", async () => {
    process.env.REFLECTION_ENABLED = "true";
    await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    const { makeCallPersonaPanel, makeCallDebatePanel } = await import(
      "@/lib/screening/persona-panel-adapter"
    );
    // 두 트랙 모두 직전 회고를 조회(per-track fetch).
    expect(reflectionMock.getLatestReflectionLog).toHaveBeenCalled();
    const panelCalls = (makeCallPersonaPanel as ReturnType<typeof vi.fn>).mock.calls as Array<
      [{ reflectionLearningContext?: string }]
    >;
    const debateCalls = (makeCallDebatePanel as ReturnType<typeof vi.fn>).mock.calls as Array<
      [{ reflectionLearningContext?: string }]
    >;
    expect(panelCalls).toHaveLength(2);
    expect(debateCalls).toHaveLength(2);
    // dueTracks 순서 = [short, midlong]. track-scoping: short는 short 회고, midlong은 midlong 회고.
    //   route가 track을 하드코딩하면(예 항상 short) 둘 다 refl-short → 이 단언이 실패(회귀 박제).
    expect(panelCalls[0][0].reflectionLearningContext).toBe("refl-short");
    expect(panelCalls[1][0].reflectionLearningContext).toBe("refl-midlong");
    expect(debateCalls[0][0].reflectionLearningContext).toBe("refl-short");
    expect(debateCalls[1][0].reflectionLearningContext).toBe("refl-midlong");
  });

  it("PR-K — REFLECTION_ENABLED off → getLatestReflectionLog 미호출(DB read 0) + reflectionLearningContext '' (byte-identical)", async () => {
    // REFLECTION_ENABLED 미설정(default off)
    await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    expect(reflectionMock.getLatestReflectionLog).not.toHaveBeenCalled();
    const { makeCallPersonaPanel, makeCallDebatePanel } = await import(
      "@/lib/screening/persona-panel-adapter"
    );
    const panelCalls = (makeCallPersonaPanel as ReturnType<typeof vi.fn>).mock.calls as Array<
      [{ reflectionLearningContext?: string }]
    >;
    const debateCalls = (makeCallDebatePanel as ReturnType<typeof vi.fn>).mock.calls as Array<
      [{ reflectionLearningContext?: string }]
    >;
    for (const [deps] of panelCalls) expect(deps.reflectionLearningContext).toBe("");
    for (const [deps] of debateCalls) expect(deps.reflectionLearningContext).toBe("");
  });

  it("PR-K — 회고 조회 throw → fail-soft '' (회고는 supplementary, 선정 무중단)", async () => {
    process.env.REFLECTION_ENABLED = "true";
    reflectionMock.getLatestReflectionLog.mockRejectedValue(new Error("reflection_log_latest_failed:42P01"));
    const res = await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    // 선정은 정상 완료(회고 read 실패가 트랙을 막지 않음).
    expect([200, 202]).toContain(res.status);
    const { makeCallPersonaPanel } = await import("@/lib/screening/persona-panel-adapter");
    const panelCalls = (makeCallPersonaPanel as ReturnType<typeof vi.fn>).mock.calls as Array<
      [{ reflectionLearningContext?: string }]
    >;
    expect(panelCalls.length).toBeGreaterThan(0);
    for (const [deps] of panelCalls) expect(deps.reflectionLearningContext).toBe("");
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

  it("finding 21 — 한 트랙 throw + 다른 트랙 forward-progress → 202 + ok:false (실패 마스킹 방지)", async () => {
    process.env.SELECTION_CRON_SELF_CONTINUE = "true";
    guardedMock.mockImplementation((input: { track: string }) => {
      if (input.track === "short") {
        return Promise.reject(new Error("finalize_boom"));
      }
      return Promise.resolve({ result: chunkResult({ remaining: 27 }) });
    });
    const res = await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.continued).toBe(true);
    expect(body.ok).toBe(false); // 하드코딩 true 아님 — short throw 반영
  });

  it("cost_hardcap abort + 다른 트랙 forward-progress → 202 + ok:false (abort 마스킹 방지)", async () => {
    process.env.SELECTION_CRON_SELF_CONTINUE = "true";
    guardedMock.mockImplementation((input: { track: string }) => {
      if (input.track === "short") {
        return Promise.resolve({
          result: chunkResult({
            claimed: 0,
            done: 0,
            deferred: 12,
            remaining: 0,
            aborted: "cost_hardcap",
          }),
        });
      }
      return Promise.resolve({ result: chunkResult({ remaining: 27 }) });
    });
    const res = await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.continued).toBe(true);
    expect(body.ok).toBe(false);
    const short = body.tracks.find((t: { track: string }) => t.track === "short");
    expect(short.ok).toBe(false);
    expect(short.result.aborted).toBe("cost_hardcap");
  });

  it("SELF_CONTINUE fetch는 now query 보존 + &selfcontinue=1 마커 부여", async () => {
    process.env.SELECTION_CRON_SELF_CONTINUE = "true";
    guardedMock.mockResolvedValue({
      result: chunkResult({ remaining: 27 }),
    });
    const fetchMock = vi.fn<(input: unknown, init?: unknown) => Promise<Response>>(
      async () => new Response(null, { status: 204 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const res = await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    expect(res.status).toBe(202);
    expect(afterCallbacks).toHaveLength(1);
    await afterCallbacks[0]();
    // now 보존 + selfcontinue=1 마커 (hop이 sweep/stall/track-throw alert skip하도록).
    const fetchedUrl = fetchMock.mock.calls[0][0] as string;
    expect(fetchedUrl).toContain(`now=${encodeURIComponent(MON_NOT_FIRST)}`);
    expect(fetchedUrl).toContain("selfcontinue=1");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
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
  it("env 미설정 + forward-progress + remaining>0 → 기본 ON으로 202 continued + after() 등록", async () => {
    // beforeEach가 SELECTION_CRON_SELF_CONTINUE를 delete — 미설정 상태 그대로.
    guardedMock.mockResolvedValue({
      result: chunkResult({ remaining: 27 }),
    });
    const res = await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.continued).toBe(true);
    // finding 22c — 기본 ON 경로에서도 after() 등록 회귀 방어 (명시 true 테스트가 대신 못 잡음).
    expect(afterCallbacks).toHaveLength(1);
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

describe("selection-worker stall alert 일반화 (finding 15)", () => {
  it('명시 "false" + remaining>0 → scheduler_fail warning (self_continue=false 사유)', async () => {
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
        e.triggerReason.includes("self_continue=false"),
      ),
    );
    expect(stallCall).toBeDefined();
    const event = (stallCall![0] as Array<Record<string, unknown>>)[0];
    expect(event.alertType).toBe("scheduler_fail");
    expect(event.severity).toBe("warning");
  });

  it("기본 ON livelock(claimed=0 + remaining>0 + enqueue 0) → stall warning (no_forward_progress 사유)", async () => {
    // beforeEach가 SELF_CONTINUE delete → 기본 ON. forward-progress 0이면 self-continue 안 돌아 stall.
    guardedMock.mockResolvedValue({
      result: chunkResult({ claimed: 0, done: 0, remaining: 5 }),
    });
    const res = await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    expect(res.status).toBe(200);
    const { insertAlertEvents } = await import("@/lib/data/admin-alerts-insert");
    const calls = (insertAlertEvents as ReturnType<typeof vi.fn>).mock.calls;
    const stallCall = calls.find((c) =>
      (c[0] as Array<{ triggerReason: string }>).some((e) =>
        e.triggerReason.includes("no_forward_progress"),
      ),
    );
    expect(stallCall).toBeDefined();
  });

  it("기본 ON + forward-progress 있음(claimed>0, remaining>0) → stall 없음 (self-continue가 진행)", async () => {
    guardedMock.mockResolvedValue({
      result: chunkResult({ remaining: 27 }),
    });
    await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    const { insertAlertEvents } = await import("@/lib/data/admin-alerts-insert");
    expect(insertAlertEvents).not.toHaveBeenCalled();
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

  it("hop(&selfcontinue=1)에서는 stall alert skip (중복 차단)", async () => {
    process.env.SELECTION_CRON_SELF_CONTINUE = "false";
    guardedMock.mockResolvedValue({
      result: chunkResult({ remaining: 27 }),
    });
    await GET(hopReqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
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
  // 고아 픽스처 시간-앵커 규칙: created_at 은 REAL wall-clock 기준(라우트 sweep window = new Date()-60d,
  //   `?now=` seam 아님 — finding 3/7/11/18/24)이라 항상 now-31d(60d window 내)로 둔다. 그러나 period_key 는
  //   반드시 **seam(MON_NOT_FIRST)** 기준 이전 period 로 잡는다 — wall-clock 로 잡으면 실시간이 흐르며
  //   now-31d 가 고정 seam period(예: m:2026-06)로 표류해 현재 period union 과 충돌, 고아가 오분류된다
  //   (테스트 전용 시간-앵커 버그; production 은 seam 이 없어 무영향).
  const SEAM = new Date(MON_NOT_FIRST);
  function pastShortOrphan() {
    return {
      period_key: currentShortPeriodKey(new Date(SEAM.getTime() - 21 * 86400000)), // seam-3주 → 이전 주, union 불충돌
      track: "short",
      created_at: new Date(Date.now() - 31 * 86400000).toISOString(), // REAL 60d window 내
    };
  }

  function staleJanuaryOrphan() {
    return {
      period_key: "s:2026-01-05",
      track: "short",
      created_at: "2026-01-05T02:00:00Z",
    };
  }

  function recentMidlongOrphan() {
    return {
      period_key: currentMidlongPeriodKey(new Date(SEAM.getTime() - 35 * 86400000)), // seam-35d → 이전 달, union 불충돌
      track: "midlong",
      created_at: new Date(Date.now() - 31 * 86400000).toISOString(), // REAL 60d window 내
    };
  }

  it("미finalize + 비현재 period → scheduler_fail warning (period_key 명시, spend 단정 안 함)", async () => {
    const orphan = pastShortOrphan();
    orphanQueryState.rows = [orphan];
    const res = await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    expect(res.status).toBe(200);
    const { insertAlertEvents } = await import("@/lib/data/admin-alerts-insert");
    const calls = (insertAlertEvents as ReturnType<typeof vi.fn>).mock.calls;
    const orphanCall = calls.find((c) =>
      (c[0] as Array<{ triggerReason: string }>).some((e) =>
        e.triggerReason.includes(orphan.period_key),
      ),
    );
    expect(orphanCall).toBeDefined();
    const event = (orphanCall![0] as Array<Record<string, unknown>>)[0];
    expect(event.alertType).toBe("scheduler_fail");
    expect(event.severity).toBe("warning");
    // finding 20/26 — spend 발생을 단정하지 않는다.
    expect(event.triggerReason as string).not.toContain("spend가 발생");
  });

  it("finding 22a — sweep 쿼리는 .is('finalized_at', null).gt('created_at', 60일전)", async () => {
    orphanQueryState.rows = [];
    await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    expect(orphanQueryState.isArgs).toEqual(["finalized_at", null]);
    expect(orphanQueryState.gtArgs?.[0]).toBe("created_at");
    // sinceIso = 실 wall-clock - 60일 (seam ?now=가 아님 — finding 3/7/11/18/24).
    const sinceMs = Date.parse(orphanQueryState.gtArgs?.[1] as string);
    const ageDays = (Date.now() - sinceMs) / 86400000;
    expect(ageDays).toBeGreaterThan(58);
    expect(ageDays).toBeLessThan(62);
  });

  it("finding 1/8/10 — midlong 고아(전분기 created)도 60일 window 내면 탐지", async () => {
    const orphan = recentMidlongOrphan();
    orphanQueryState.rows = [orphan];
    await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    const { insertAlertEvents } = await import("@/lib/data/admin-alerts-insert");
    const calls = (insertAlertEvents as ReturnType<typeof vi.fn>).mock.calls;
    expect(
      calls.some((c) =>
        (c[0] as Array<{ triggerReason: string }>).some((e) =>
          e.triggerReason.includes(orphan.period_key),
        ),
      ),
    ).toBe(true);
  });

  it("현재 period(seam)의 미finalize run row → 고아 아님 (alert 없음)", async () => {
    // ?now=2026-06-08 seam → currentPeriodKeys에 s:2026-06-08·m:2026-06 포함(seam ∪ real).
    orphanQueryState.rows = [
      { period_key: "s:2026-06-08", track: "short", created_at: "2026-06-08T02:00:00Z" },
      { period_key: "m:2026-06", track: "midlong", created_at: "2026-06-01T02:00:00Z" },
    ];
    await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    const { insertAlertEvents } = await import("@/lib/data/admin-alerts-insert");
    expect(insertAlertEvents).not.toHaveBeenCalled();
  });

  it("finding 3/7/11/18/24 — 수동 ?now=<과거> 재개 시 실 현재 live period는 고아 오탐 안 함", async () => {
    // 수동 재개: ?now=과거. 그러나 sweep anchor는 실 wall-clock → 진짜 현재 진행 period는 union(real)에 포함.
    const liveShortKey = currentShortPeriodKey(new Date());
    const liveMidlongKey = currentMidlongPeriodKey(new Date());
    orphanQueryState.rows = [
      { period_key: liveShortKey, track: "short", created_at: new Date().toISOString() },
      { period_key: liveMidlongKey, track: "midlong", created_at: new Date().toISOString() },
    ];
    await GET(reqAt("2026-01-12T01:00:00Z", { authorization: "Bearer secret-x" }));
    const { insertAlertEvents } = await import("@/lib/data/admin-alerts-insert");
    expect(insertAlertEvents).not.toHaveBeenCalled();
  });

  it("finding 2/5/12/17/23 — hop(&selfcontinue=1)에서는 sweep skip (alert 폭주 차단)", async () => {
    orphanQueryState.rows = [staleJanuaryOrphan()];
    await GET(hopReqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    expect(orphanQueryState.selectCount).toBe(0); // sweep 쿼리 자체가 안 돔
    const { insertAlertEvents } = await import("@/lib/data/admin-alerts-insert");
    expect(insertAlertEvents).not.toHaveBeenCalled();
  });

  it("finding 9 — flag off여도 sweep은 돈다 (flag gate 앞)", async () => {
    delete process.env.SELECTION_CRON_AUTO_ENABLED;
    orphanQueryState.rows = [pastShortOrphan()];
    const res = await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reason).toBe("selection_cron_auto_disabled"); // flag gate는 여전히 작동
    expect(orphanQueryState.selectCount).toBe(1); // 그래도 sweep은 실행됨
    const { insertAlertEvents } = await import("@/lib/data/admin-alerts-insert");
    expect(insertAlertEvents).toHaveBeenCalled(); // 고아 alert 발화
  });

  it("sweep 쿼리 실패해도 응답 200 유지 (best-effort)", async () => {
    orphanQueryState.error = { code: "XX000" };
    const res = await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("시간-앵커 회귀 가드 — wall-clock 이 seam period 로 흘러도 두 고아 탐지 유지 (fake timer)", async () => {
    // period_key 를 wall-clock 으로 잡던 옛 버그 재현 방지. 2026-07-12 = now-31d(2026-06-11)의
    //   midlong(m:2026-06)·short 주(s:2026-06-08)가 고정 seam(MON_NOT_FIRST)과 충돌하던 날.
    //   seam-상대 픽스처는 이 날에도 현재 union 과 불충돌·정상 탐지돼야 한다(옛 wall-clock 픽스처면 실패).
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-07-12T00:00:00Z"));
      const short = pastShortOrphan();
      const mid = recentMidlongOrphan();
      orphanQueryState.rows = [short, mid];
      await GET(reqAt(MON_NOT_FIRST, { authorization: "Bearer secret-x" }));
      const { insertAlertEvents } = await import("@/lib/data/admin-alerts-insert");
      const calls = (insertAlertEvents as ReturnType<typeof vi.fn>).mock.calls;
      const flagged = (pk: string) =>
        calls.some((c) =>
          (c[0] as Array<{ triggerReason: string }>).some((e) =>
            e.triggerReason.includes(pk),
          ),
        );
      expect(flagged(short.period_key)).toBe(true);
      expect(flagged(mid.period_key)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
