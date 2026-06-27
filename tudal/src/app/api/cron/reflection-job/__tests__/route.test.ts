// PR-K Reflection cron route — auth + REFLECTION_ENABLED gate(200 skip) + per-track 회고 job dispatch
//   + per-track 실패격리. shadow-first: flag off → service-role client 미생성·runReflectionJob 0콜.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const { runReflectionJobMock } = vi.hoisted(() => ({ runReflectionJobMock: vi.fn() }));
const serviceRoleState = vi.hoisted(() => ({
  created: 0,
  getUserByIdResult: { data: { user: { id: "u" } }, error: null } as {
    data: { user: { id: string } | null } | null;
    error: unknown;
  },
}));

vi.mock("@/lib/reflection/orchestrator", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/reflection/orchestrator")>();
  return { ...actual, runReflectionJob: runReflectionJobMock };
});

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => {
    serviceRoleState.created += 1;
    return {
      from: vi.fn(),
      auth: {
        admin: {
          getUserById: vi.fn(async () => serviceRoleState.getUserByIdResult),
        },
      },
    };
  },
}));

import { GET } from "@/app/api/cron/reflection-job/route";

function req(opts: { secret?: string } = {}): NextRequest {
  const headers = new Headers();
  if (opts.secret) headers.set("authorization", `Bearer ${opts.secret}`);
  return new NextRequest("https://x/api/cron/reflection-job", { headers });
}

describe("reflection-job cron route", () => {
  const saved = {
    enabled: process.env.REFLECTION_ENABLED,
    llm: process.env.REFLECTION_LLM_SUMMARY_ENABLED,
    cost: process.env.AI_COST_LOG_REAL_INSERT_ENABLED,
    cronUser: process.env.CRON_SYSTEM_USER_ID,
    krx: process.env.KRX_OPENAPI_KEY,
    secret: process.env.CRON_SECRET,
    nodeEnv: process.env.NODE_ENV,
  };
  beforeEach(() => {
    vi.clearAllMocks();
    serviceRoleState.created = 0;
    serviceRoleState.getUserByIdResult = { data: { user: { id: "u" } }, error: null };
    delete process.env.REFLECTION_ENABLED;
    delete process.env.REFLECTION_LLM_SUMMARY_ENABLED;
    delete process.env.AI_COST_LOG_REAL_INSERT_ENABLED;
    delete process.env.CRON_SYSTEM_USER_ID;
    delete process.env.KRX_OPENAPI_KEY;
    process.env.CRON_SECRET = "s3cr3t";
    runReflectionJobMock.mockResolvedValue({
      skipped: false,
      track: "short",
      periodKey: "s:2026-06-22",
      selectedCount: 10,
      pricedCount: 8,
      overallHitRate: 0.5,
      overallAvgRealizedReturn: 0.03,
    });
  });
  afterEach(() => {
    const restore = (k: string, v: string | undefined) => {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    };
    restore("REFLECTION_ENABLED", saved.enabled);
    restore("REFLECTION_LLM_SUMMARY_ENABLED", saved.llm);
    restore("AI_COST_LOG_REAL_INSERT_ENABLED", saved.cost);
    restore("CRON_SYSTEM_USER_ID", saved.cronUser);
    restore("KRX_OPENAPI_KEY", saved.krx);
    restore("CRON_SECRET", saved.secret);
  });

  it("unauthorized(잘못된 secret) → 401", async () => {
    const res = await GET(req({ secret: "wrong" }));
    expect(res.status).toBe(401);
    expect(runReflectionJobMock).not.toHaveBeenCalled();
  });

  it("dormancy: REFLECTION_ENABLED off → 200 skip + service-role 미생성 + runReflectionJob 0콜", async () => {
    const res = await GET(req({ secret: "s3cr3t" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skipped).toBe(true);
    expect(serviceRoleState.created).toBe(0);
    expect(runReflectionJobMock).not.toHaveBeenCalled();
  });

  it("flag on → 두 트랙(short+midlong) runReflectionJob 호출 + 200", async () => {
    process.env.REFLECTION_ENABLED = "true";
    const res = await GET(req({ secret: "s3cr3t" }));
    expect(res.status).toBe(200);
    expect(runReflectionJobMock).toHaveBeenCalledTimes(2);
    const tracks = runReflectionJobMock.mock.calls.map((c) => c[0].track).sort();
    expect(tracks).toEqual(["midlong", "short"]);
    const body = await res.json();
    expect(body.tracks).toHaveLength(2);
  });

  it("per-track 실패격리: 한 트랙 throw → 다른 트랙 진행 + 200(ok=false 보고)", async () => {
    process.env.REFLECTION_ENABLED = "true";
    runReflectionJobMock.mockImplementation(async ({ track }: { track: string }) => {
      if (track === "short") throw new Error("boom");
      return {
        skipped: false,
        track: "midlong",
        periodKey: "m:2026-06",
        selectedCount: 20,
        pricedCount: 15,
        overallHitRate: 0.6,
        overallAvgRealizedReturn: 0.02,
      };
    });
    const res = await GET(req({ secret: "s3cr3t" }));
    expect(res.status).toBe(200);
    expect(runReflectionJobMock).toHaveBeenCalledTimes(2);
    const body = await res.json();
    expect(body.ok).toBe(false);
    const shortOutcome = body.tracks.find((t: { track: string }) => t.track === "short");
    expect(shortOutcome.ok).toBe(false);
  });

  // ── H2/H3/M4/L5: LLM 요약 fail-closed 게이트 + DI 구성 ──
  const VALID_UUID = "11111111-2222-3333-4444-555555555555";

  it("LLM flag off → deps.preflight/summarize/claimReflectionLog 미주입(무비용 base만)", async () => {
    process.env.REFLECTION_ENABLED = "true";
    await GET(req({ secret: "s3cr3t" }));
    const deps = runReflectionJobMock.mock.calls[0][0];
    expect(deps.preflight).toBeUndefined();
    expect(deps.summarize).toBeUndefined();
    expect(deps.claimReflectionLog).toBeUndefined();
  });

  it("H2: LLM on + AI_COST_LOG_REAL_INSERT_ENABLED off → LLM 요약 비활성(hardcap fail-open 차단)", async () => {
    process.env.REFLECTION_ENABLED = "true";
    process.env.REFLECTION_LLM_SUMMARY_ENABLED = "true";
    process.env.CRON_SYSTEM_USER_ID = VALID_UUID;
    // AI_COST_LOG_REAL_INSERT_ENABLED 미설정
    await GET(req({ secret: "s3cr3t" }));
    const deps = runReflectionJobMock.mock.calls[0][0];
    expect(deps.summarize).toBeUndefined();
    expect(deps.preflight).toBeUndefined();
  });

  it("H3: LLM on + cost-logging on + CRON_SYSTEM_USER_ID invalid → LLM 요약 비활성(FK burn 차단)", async () => {
    process.env.REFLECTION_ENABLED = "true";
    process.env.REFLECTION_LLM_SUMMARY_ENABLED = "true";
    process.env.AI_COST_LOG_REAL_INSERT_ENABLED = "true";
    process.env.CRON_SYSTEM_USER_ID = "not-a-uuid";
    await GET(req({ secret: "s3cr3t" }));
    const deps = runReflectionJobMock.mock.calls[0][0];
    expect(deps.summarize).toBeUndefined();
  });

  it("H3: LLM on + cost-logging on + valid UUID but getUserById not found → 비활성", async () => {
    process.env.REFLECTION_ENABLED = "true";
    process.env.REFLECTION_LLM_SUMMARY_ENABLED = "true";
    process.env.AI_COST_LOG_REAL_INSERT_ENABLED = "true";
    process.env.CRON_SYSTEM_USER_ID = VALID_UUID;
    serviceRoleState.getUserByIdResult = { data: { user: null }, error: null };
    await GET(req({ secret: "s3cr3t" }));
    const deps = runReflectionJobMock.mock.calls[0][0];
    expect(deps.summarize).toBeUndefined();
  });

  it("LLM on + 3중 게이트 충족 → deps.preflight/summarize/claimReflectionLog 주입", async () => {
    process.env.REFLECTION_ENABLED = "true";
    process.env.REFLECTION_LLM_SUMMARY_ENABLED = "true";
    process.env.AI_COST_LOG_REAL_INSERT_ENABLED = "true";
    process.env.CRON_SYSTEM_USER_ID = VALID_UUID;
    await GET(req({ secret: "s3cr3t" }));
    const deps = runReflectionJobMock.mock.calls[0][0];
    expect(deps.preflight).toBeTypeOf("function");
    expect(deps.summarize).toBeTypeOf("function");
    expect(deps.claimReflectionLog).toBeTypeOf("function");
  });

  it("L5: KRX_OPENAPI_KEY 부재 → resolvePrices가 EMPTY(빈 Map·null dates) 반환", async () => {
    process.env.REFLECTION_ENABLED = "true";
    await GET(req({ secret: "s3cr3t" }));
    const deps = runReflectionJobMock.mock.calls[0][0];
    const prices = await deps.resolvePrices({ tickers: ["000001"], finalizedAt: "2026-06-26T01:00:00Z" });
    expect(prices.entryPrices.size).toBe(0);
    expect(prices.currentPrices.size).toBe(0);
    expect(prices.entryDate).toBeNull();
    expect(prices.currentDate).toBeNull();
  });

  it("L5: personaRoster = CORE_11 ids(11) 주입", async () => {
    process.env.REFLECTION_ENABLED = "true";
    await GET(req({ secret: "s3cr3t" }));
    const deps = runReflectionJobMock.mock.calls[0][0];
    expect(deps.personaRoster).toHaveLength(11);
  });
});
