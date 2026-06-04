// PR5 worker — pure-ish 로직 단위 테스트 (deps mocked + fake supabase client).
// plan §6 T1/T3/T9/T-v1. DB-level claim/mutex/versioning(SQL)은 omxy SQL 리뷰 + 수동 QA (repo 컨벤션).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── module mocks ──
const orchestrateMock = vi.fn();
const getActiveShortListMock = vi.fn();
const reportExistsMock = vi.fn();
const preflightMock = vi.fn();
const getMonthlyTotalMock = vi.fn();
const insertPipelineHealthMock = vi.fn();
const emitCostAlertMock = vi.fn();
const insertAlertEventsMock = vi.fn();
const enrichMock = vi.fn();

vi.mock("@/lib/report/report-input-enricher", () => ({
  enrichReportInput: (...a: unknown[]) => enrichMock(...a),
}));
vi.mock("@/lib/report/full-report-orchestrator", () => ({
  orchestrateFullReport: (...a: unknown[]) => orchestrateMock(...a),
}));
vi.mock("@/lib/data/admin-shortlist", () => ({
  getActiveShortList: (...a: unknown[]) => getActiveShortListMock(...a),
}));
vi.mock("@/lib/data/admin-reports", () => ({
  reportExistsAndCompleteForMonth: (...a: unknown[]) => reportExistsMock(...a),
}));
vi.mock("@/lib/cost/cost-logger", () => ({
  preflightHardcap: (...a: unknown[]) => preflightMock(...a),
  getMonthlyTotal: (...a: unknown[]) => getMonthlyTotalMock(...a),
}));
vi.mock("@/lib/data/admin-pipeline-health-insert", () => ({
  insertPipelineHealth: (...a: unknown[]) => insertPipelineHealthMock(...a),
}));
vi.mock("@/lib/data/admin-cost-alerts", () => ({
  emitCostAlert: (...a: unknown[]) => emitCostAlertMock(...a),
}));
vi.mock("@/lib/data/admin-alerts-insert", () => ({
  insertAlertEvents: (...a: unknown[]) => insertAlertEventsMock(...a),
}));

import {
  runGuardedReportChunk,
  runReportBatchChunk,
} from "@/lib/report/full-report-batch-worker";

type WorkerClient = Parameters<typeof runReportBatchChunk>[0]["client"];
function workerClient(client: unknown): WorkerClient {
  return client as WorkerClient;
}

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

interface RpcCall {
  name: string;
  args: Record<string, unknown>;
}

// fake supabase client (worker가 사용하는 표면만)
function makeFakeClient(opts: {
  claimedJobs: Array<{ id: string; ticker: string }>;
  userExists?: boolean;
  remainingCount?: number;
  acquireRunId?: string | null;
  acquireError?: { code?: string } | null;
  releaseErrors?: Array<{ code?: string }>;
}) {
  const rpcCalls: RpcCall[] = [];
  const updatePayloads: unknown[] = [];
  const releaseErrors = [...(opts.releaseErrors ?? [])];
  const makeWriteChain = () => {
    const chain: Record<string, unknown> = {};
    const done = async () => ({ error: null });
    chain.eq = vi.fn(() => chain);
    chain.in = vi.fn(done);
    chain.then = (resolve: (value: { error: null }) => unknown) =>
      resolve({ error: null });
    return chain;
  };
  const client = {
    auth: {
      admin: {
        getUserById: vi.fn(async () =>
          opts.userExists === false
            ? { data: { user: null }, error: null }
            : { data: { user: { id: VALID_UUID } }, error: null },
        ),
      },
    },
    from: vi.fn(() => {
      const chain: Record<string, unknown> = {};
      chain.upsert = vi.fn(async () => ({ error: null }));
      chain.update = vi.fn((payload: unknown) => {
        updatePayloads.push(payload);
        return makeWriteChain();
      });
      chain.select = vi.fn(() => ({
        eq: vi.fn(() => ({
          in: vi.fn(async () => ({
            count: opts.remainingCount ?? 0,
            error: null,
          })),
        })),
      }));
      return chain;
    }),
    rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      if (name === "acquire_report_worker_lock") {
        return {
          data: opts.acquireRunId ?? null,
          error: opts.acquireError ?? null,
        };
      }
      if (name === "release_report_worker_lock") {
        return {
          data: null,
          error: releaseErrors.shift() ?? null,
        };
      }
      if (name === "claim_next_report_jobs") {
        return { data: opts.claimedJobs, error: null };
      }
      return { data: null, error: null };
    }),
  };
  return { client, rpcCalls, updatePayloads };
}

const ORIG_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.AI_COST_LOG_REAL_INSERT_ENABLED = "true";
  process.env.PR5_CRON_AUTO_ENABLED = "true";
  process.env.CRON_SYSTEM_USER_ID = VALID_UUID;
  getActiveShortListMock.mockResolvedValue([
    { ticker: "005930", name: "삼성전자", sector: "반도체" },
    { ticker: "000660", name: "SK하이닉스", sector: "반도체" },
    ...Array.from({ length: 28 }, (_, i) => ({
      ticker: `9${String(i).padStart(5, "0")}`,
      name: `테스트${i}`,
      sector: "테스트",
    })),
  ]);
  // PR-H scope 2 — chunk enrich default (cost 0, financials DB-read 격리). macro는 항상 근거 부족.
  enrichMock.mockResolvedValue({
    tier1Verdict: "BUY",
    consensusBadge: "🟢",
    financialsSummary: "[티커 2024 연간] 매출 100억",
    technicalsSummary: "종합 80 · 추세 75 · 모멘텀 70 · 변동성 30 · breakout",
    macroSummary: "근거 부족",
    sectorReference: "반도체 섹터 Level A 레퍼런스 적용",
  });
  preflightMock.mockResolvedValue({
    currentTotal: 0,
    reservation: 0,
    remaining: 500000,
  });
  getMonthlyTotalMock.mockResolvedValue(0);
  reportExistsMock.mockResolvedValue({ exists: false, complete: false });
  orchestrateMock.mockResolvedValue({
    reportId: "r1",
    costKrw: 535,
    revised: false,
    criticVerdict: {},
    criticRunId: "c1",
  });
  insertPipelineHealthMock.mockResolvedValue(undefined);
  insertAlertEventsMock.mockResolvedValue(undefined);
  emitCostAlertMock.mockResolvedValue(undefined);
});

afterEach(() => {
  process.env = { ...ORIG_ENV };
});

describe("runReportBatchChunk step-0 fail-closed (T9 — R2 HIGH-2 + R3 HIGH-1)", () => {
  it("PR5_CRON_AUTO_ENABLED!==true → pr5_cron_auto_disabled, LLM 0", async () => {
    process.env.PR5_CRON_AUTO_ENABLED = "false";
    const { client } = makeFakeClient({ claimedJobs: [] });
    await expect(
      runReportBatchChunk({ month: "2026-06", client: workerClient(client) }),
    ).rejects.toThrow("pr5_cron_auto_disabled");
    expect(orchestrateMock).not.toHaveBeenCalled();
    expect(insertAlertEventsMock).toHaveBeenCalled();
  });

  it("AI_COST_LOG_REAL_INSERT_ENABLED!==true → cost_logging_disabled, LLM 0", async () => {
    process.env.AI_COST_LOG_REAL_INSERT_ENABLED = "false";
    const { client } = makeFakeClient({ claimedJobs: [] });
    await expect(
      runReportBatchChunk({ month: "2026-06", client: workerClient(client) }),
    ).rejects.toThrow("cost_logging_disabled");
    expect(orchestrateMock).not.toHaveBeenCalled();
    expect(insertAlertEventsMock).toHaveBeenCalled();
  });

  it("CRON_SYSTEM_USER_ID 미설정/형식 위반 → cron_system_user_id_invalid, LLM 0", async () => {
    process.env.CRON_SYSTEM_USER_ID = "cron-system"; // not a UUID
    const { client } = makeFakeClient({ claimedJobs: [] });
    await expect(
      runReportBatchChunk({ month: "2026-06", client: workerClient(client) }),
    ).rejects.toThrow("cron_system_user_id_invalid");
    expect(orchestrateMock).not.toHaveBeenCalled();
    expect(insertAlertEventsMock).toHaveBeenCalled();
  });

  it("auth.users 부재 → cron_system_user_not_found, LLM 0", async () => {
    const { client } = makeFakeClient({ claimedJobs: [], userExists: false });
    await expect(
      runReportBatchChunk({ month: "2026-06", client: workerClient(client) }),
    ).rejects.toThrow("cron_system_user_not_found");
    expect(orchestrateMock).not.toHaveBeenCalled();
    expect(insertAlertEventsMock).toHaveBeenCalled();
  });

  it("short_list_30이 아직 seed되지 않은 0개 상태면 quiet skip + alert 0 + LLM 0", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      getActiveShortListMock.mockResolvedValue([]);
      const { client, rpcCalls } = makeFakeClient({ claimedJobs: [] });
      const res = await runReportBatchChunk({
        month: "2026-06",
        client: workerClient(client),
      });
      expect(res).toEqual({
        month: "2026-06",
        claimed: 0,
        done: 0,
        skipped: 0,
        failed: 0,
        deferred: 0,
        remaining: 0,
        aborted: null,
      });
      expect(orchestrateMock).not.toHaveBeenCalled();
      expect(insertAlertEventsMock).not.toHaveBeenCalled();
      expect(insertPipelineHealthMock).not.toHaveBeenCalled();
      expect(preflightMock).not.toHaveBeenCalled();
      expect(
        rpcCalls.find((c) => c.name === "claim_next_report_jobs"),
      ).toBeUndefined();
      expect(infoSpy).toHaveBeenCalledWith(
        expect.stringContaining("short_list_not_seeded"),
      );
    } finally {
      infoSpy.mockRestore();
    }
  });

  // W2a Task 9.5 (R3 HIGH-2 + R4 MED-5): 트랙 split로 일시 <30 가능 → fail-closed(502 + critical
  //   alert/pipeline-health 'failed') 대신 not-ready clean skip. 텔레메트리 발행 前 early-return.
  it("short_list_30이 1~29개면 not-ready clean skip (텔레메트리 前) — alert/pipeline-health 0, LLM 0", async () => {
    getActiveShortListMock.mockResolvedValue(
      Array.from({ length: 20 }, (_, i) => ({
        ticker: `9${String(i).padStart(5, "0")}`,
        name: `테스트${i}`,
        sector: "테스트",
      })),
    );
    const { client, rpcCalls } = makeFakeClient({ claimedJobs: [] });
    const res = await runReportBatchChunk({
      month: "2026-06",
      client: workerClient(client),
    });
    expect(res).toEqual({
      month: "2026-06",
      claimed: 0,
      done: 0,
      skipped: 0,
      failed: 0,
      deferred: 0,
      remaining: 0,
      aborted: null,
      notReady: { reason: "shortlist_not_ready" },
    });
    expect(orchestrateMock).not.toHaveBeenCalled();
    // 텔레메트리 미발행 (R4 MED-5: critical alert/pipeline-health 'failed' false-alarm 차단), spend 0.
    expect(insertAlertEventsMock).not.toHaveBeenCalled();
    expect(insertPipelineHealthMock).not.toHaveBeenCalled();
    expect(preflightMock).not.toHaveBeenCalled();
    expect(
      rpcCalls.find((c) => c.name === "claim_next_report_jobs"),
    ).toBeUndefined();
  });
});

describe("runReportBatchChunk sequential + skip + isolation", () => {
  it("T-v1 SKIP: 이미 완성된 본문은 orchestrate 미호출 + mark done", async () => {
    reportExistsMock.mockResolvedValue({ exists: true, complete: true });
    const { client, rpcCalls } = makeFakeClient({
      claimedJobs: [{ id: "j1", ticker: "005930" }],
    });
    const res = await runReportBatchChunk({
      month: "2026-06",
      client: workerClient(client),
    });
    expect(orchestrateMock).not.toHaveBeenCalled();
    expect(res.skipped).toBe(1);
    expect(res.done).toBe(0);
    const marks = rpcCalls.filter((c) => c.name === "mark_report_job");
    expect(marks[0].args.p_status).toBe("done");
  });

  // PR-H scope 2 — chunk enrich wire: stub("HOLD"/"🟡"/"")  → enrichReportInput(row) 실값.
  it("PR-H enrich: orchestrate receives enriched input (not stub) + enrich called per ticker (cost 0)", async () => {
    const { client } = makeFakeClient({
      claimedJobs: [{ id: "j1", ticker: "005930" }],
    });
    const res = await runReportBatchChunk({
      month: "2026-06",
      client: workerClient(client),
    });
    expect(res.done).toBe(1);
    // enrich는 claimed ticker마다 호출 (row + service-role client 주입).
    expect(enrichMock).toHaveBeenCalledTimes(1);
    const [enrichItemArg, enrichOptArg] = enrichMock.mock.calls[0];
    expect(enrichItemArg).toMatchObject({ ticker: "005930", name: "삼성전자", sector: "반도체" });
    expect(enrichOptArg).toEqual({ client });
    // orchestrate payload = enrich 실값 (stub "HOLD"/"🟡"/"" 역회귀 차단).
    expect(orchestrateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ticker: "005930",
        tier1Verdict: "BUY",
        consensusBadge: "🟢",
        financialsSummary: "[티커 2024 연간] 매출 100억",
        technicalsSummary: "종합 80 · 추세 75 · 모멘텀 70 · 변동성 30 · breakout",
        macroSummary: "근거 부족",
        sectorReference: "반도체 섹터 Level A 레퍼런스 적용",
      }),
      { client, callerKind: "cron" },
    );
  });

  it("PR-H enrich: enrich error (financials SELECT) → per-ticker isolation (mark failed, 다음 ticker 계속)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      enrichMock
        .mockRejectedValueOnce(new Error("financials_corp_lookup_failed:PGRST301"))
        .mockResolvedValue({
          tier1Verdict: "HOLD",
          consensusBadge: "🟡",
          financialsSummary: "fin",
          technicalsSummary: "tech",
          macroSummary: "근거 부족",
          sectorReference: "ref",
        });
      const { client, rpcCalls } = makeFakeClient({
        claimedJobs: [
          { id: "j1", ticker: "005930" },
          { id: "j2", ticker: "000660" },
        ],
      });
      const res = await runReportBatchChunk({
        month: "2026-06",
        client: workerClient(client),
      });
      // enrich 실패 ticker는 failed (orchestrate 미진입), 나머지 계속.
      expect(res.failed).toBe(1);
      expect(res.done).toBe(1);
      expect(orchestrateMock).toHaveBeenCalledTimes(1);
      const marks = rpcCalls.filter((c) => c.name === "mark_report_job");
      expect(marks.find((m) => m.args.p_id === "j1")?.args.p_status).toBe("failed");
      expect(marks.find((m) => m.args.p_id === "j2")?.args.p_status).toBe("done");
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("T1 isolation: 1 종목 실패 → 나머지 처리 계속, 실패 종목 mark failed", async () => {
    orchestrateMock
      // non-transient(retry 0) per-ticker 실패 → 격리 (transient면 retry가 복구하므로 부적합).
      .mockRejectedValueOnce(
        new Error("orchestrate_failed:writer_validation:section_0"),
      ) // 005930
      .mockResolvedValue({
        reportId: "r2",
        costKrw: 535,
        revised: false,
        criticVerdict: {},
        criticRunId: "c2",
      });
    const { client, rpcCalls } = makeFakeClient({
      claimedJobs: [
        { id: "j1", ticker: "005930" },
        { id: "j2", ticker: "000660" },
      ],
    });
    const res = await runReportBatchChunk({
      month: "2026-06",
      client: workerClient(client),
    });
    expect(res.failed).toBe(1);
    expect(res.done).toBe(1);
    const marks = rpcCalls.filter((c) => c.name === "mark_report_job");
    expect(marks.find((m) => m.args.p_id === "j1")?.args.p_status).toBe(
      "failed",
    );
    expect(marks.find((m) => m.args.p_id === "j2")?.args.p_status).toBe("done");
    // 실패 시 summary scheduler_fail alert + pipeline_health failed
    expect(insertAlertEventsMock).toHaveBeenCalled();
  });

  it("T3 systemic abort: ai_key_unavailable → batch throw (나머지 미처리)", async () => {
    orchestrateMock.mockRejectedValue(new Error("ai_key_unavailable"));
    const { client, updatePayloads } = makeFakeClient({
      claimedJobs: [
        { id: "j1", ticker: "005930" },
        { id: "j2", ticker: "000660" },
      ],
    });
    await expect(
      runReportBatchChunk({ month: "2026-06", client: workerClient(client) }),
    ).rejects.toThrow("ai_key_unavailable");
    // 첫 종목에서 abort → 두번째 orchestrate 미호출 (1회만). attempts reset으로 글로벌 설정 오류가 per-ticker cap을 소진하지 않음.
    expect(orchestrateMock).toHaveBeenCalledTimes(1);
    expect(updatePayloads).toContainEqual(
      expect.objectContaining({
        status: "pending",
        attempts: 0,
        last_error: "ai_key_unavailable",
      }),
    );
  });

  it("T-c4 all-green: 전 종목 성공 시 summary alert 0 (pipeline_health success)", async () => {
    const { client } = makeFakeClient({
      claimedJobs: [
        { id: "j1", ticker: "005930" },
        { id: "j2", ticker: "000660" },
      ],
    });
    const res = await runReportBatchChunk({
      month: "2026-06",
      client: workerClient(client),
    });
    expect(getActiveShortListMock).toHaveBeenCalledWith(
      expect.objectContaining({ month: "2026-06-01" }),
    );
    expect(res.done).toBe(2);
    expect(res.failed).toBe(0);
    expect(insertAlertEventsMock).not.toHaveBeenCalled(); // green = alert 0
    expect(insertPipelineHealthMock).toHaveBeenCalledWith(
      expect.objectContaining({ pipeline: "ai", status: "success" }),
      expect.anything(),
    );
  });

  it("TC-6 transient retry: critic_llm_failed 3회 실패 후 해당 job failed, 다음 ticker 계속 처리", async () => {
    vi.useFakeTimers();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      orchestrateMock
        .mockRejectedValueOnce(new Error("critic_llm_failed"))
        .mockRejectedValueOnce(new Error("critic_llm_failed"))
        .mockRejectedValueOnce(new Error("critic_llm_failed"))
        .mockResolvedValueOnce({
          reportId: "r2",
          costKrw: 535,
          revised: false,
          criticVerdict: {},
          criticRunId: "c2",
        });
      const { client, rpcCalls } = makeFakeClient({
        claimedJobs: [
          { id: "j1", ticker: "005930" },
          { id: "j2", ticker: "000660" },
        ],
      });
      const pending = runReportBatchChunk({
        month: "2026-06",
        client: workerClient(client),
      });
      await vi.runAllTimersAsync();
      const res = await pending;

      expect(orchestrateMock).toHaveBeenCalledTimes(4);
      expect(res.failed).toBe(1);
      expect(res.done).toBe(1);
      const marks = rpcCalls.filter((c) => c.name === "mark_report_job");
      expect(marks.find((m) => m.args.p_id === "j1")?.args.p_status).toBe(
        "failed",
      );
      expect(marks.find((m) => m.args.p_id === "j2")?.args.p_status).toBe(
        "done",
      );
    } finally {
      errorSpy.mockRestore();
      vi.useRealTimers();
    }
  });
});

describe("runReportBatchChunk cost_hardcap abort (T4)", () => {
  it("batch preflight cost_hardcap_exceeded → deferred + cost alert + STOP (throw 안 함)", async () => {
    preflightMock.mockRejectedValue(new Error("cost_hardcap_exceeded"));
    const { client, rpcCalls } = makeFakeClient({
      claimedJobs: [],
      remainingCount: 5,
    });
    const res = await runReportBatchChunk({
      month: "2026-06",
      client: workerClient(client),
    });
    expect(res.aborted).toBe("cost_hardcap");
    expect(emitCostAlertMock).toHaveBeenCalled();
    expect(orchestrateMock).not.toHaveBeenCalled();
    // claim이 먼저 stale sweep을 수행한 뒤 preflight가 hardcap을 판단한다.
    expect(
      rpcCalls.find((c) => c.name === "claim_next_report_jobs"),
    ).toBeDefined();
    expect(insertPipelineHealthMock).toHaveBeenCalledWith(
      expect.objectContaining({ pipeline: "ai", status: "failed" }),
      expect.anything(),
    );
  });

  it("CRF-1 batch hardcap: alert insert failure is best-effort after deferring open jobs", async () => {
    preflightMock.mockRejectedValue(new Error("cost_hardcap_exceeded"));
    emitCostAlertMock.mockRejectedValue(new Error("alert_event_insert_failed"));
    const { client, updatePayloads } = makeFakeClient({
      claimedJobs: [],
      remainingCount: 5,
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const res = await runReportBatchChunk({
        month: "2026-06",
        client: workerClient(client),
      });
      expect(res.aborted).toBe("cost_hardcap");
      expect(updatePayloads).toContainEqual(
        expect.objectContaining({ status: "deferred" }),
      );
      expect(emitCostAlertMock).toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("CRF-1 mid-loop hardcap: defer open jobs before best-effort alert, then throw original hardcap", async () => {
    orchestrateMock.mockRejectedValue(new Error("cost_hardcap_exceeded"));
    emitCostAlertMock.mockRejectedValue(new Error("alert_event_insert_failed"));
    const { client, updatePayloads } = makeFakeClient({
      claimedJobs: [{ id: "j1", ticker: "005930" }],
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(
        runReportBatchChunk({ month: "2026-06", client: workerClient(client) }),
      ).rejects.toThrow("cost_hardcap_exceeded");
      expect(updatePayloads).toContainEqual(
        expect.objectContaining({ status: "deferred" }),
      );
      expect(emitCostAlertMock).toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });
});

describe("runGuardedReportChunk lock mutex (TC-2 + OPS-2)", () => {
  it("acquire→run_id → chunk runs → release same run_id as succeeded", async () => {
    const { client, rpcCalls } = makeFakeClient({
      acquireRunId: "run-1",
      claimedJobs: [{ id: "j1", ticker: "005930" }],
    });
    const res = await runGuardedReportChunk({
      month: "2026-06",
      client: workerClient(client),
    });
    expect(res.result?.done).toBe(1);
    expect(orchestrateMock).toHaveBeenCalledTimes(1);
    expect(
      rpcCalls.find((c) => c.name === "release_report_worker_lock")?.args,
    ).toMatchObject({
      p_month: "2026-06",
      p_run_id: "run-1",
      p_status: "succeeded",
    });
  });

  it("acquire→null → already_running skip, orchestrate 미호출", async () => {
    const { client } = makeFakeClient({
      acquireRunId: null,
      claimedJobs: [{ id: "j1", ticker: "005930" }],
    });
    const res = await runGuardedReportChunk({
      month: "2026-06",
      client: workerClient(client),
    });
    expect(res).toEqual({ skipped: "already_running" });
    expect(orchestrateMock).not.toHaveBeenCalled();
  });

  it("chunk throws → release same run_id as failed exactly once", async () => {
    process.env.AI_COST_LOG_REAL_INSERT_ENABLED = "false";
    const { client, rpcCalls } = makeFakeClient({
      acquireRunId: "run-2",
      claimedJobs: [],
    });
    await expect(
      runGuardedReportChunk({ month: "2026-06", client: workerClient(client) }),
    ).rejects.toThrow("cost_logging_disabled");
    const releases = rpcCalls.filter(
      (c) => c.name === "release_report_worker_lock",
    );
    expect(releases).toHaveLength(1);
    expect(releases[0].args).toMatchObject({
      p_run_id: "run-2",
      p_status: "failed",
    });
  });

  it("acquire rpc error → throws acquire_lock_failed", async () => {
    const { client } = makeFakeClient({
      acquireRunId: null,
      acquireError: { code: "42501" },
      claimedJobs: [],
    });
    await expect(
      runGuardedReportChunk({ month: "2026-06", client: workerClient(client) }),
    ).rejects.toThrow("acquire_lock_failed:42501");
  });

  it("OPS-2: if release('succeeded') throws, catch attempts release('failed') with same run_id", async () => {
    const { client, rpcCalls } = makeFakeClient({
      acquireRunId: "run-3",
      claimedJobs: [],
      releaseErrors: [{ code: "XX000" }],
    });
    await expect(
      runGuardedReportChunk({ month: "2026-06", client: workerClient(client) }),
    ).rejects.toThrow("release_report_worker_lock_failed:XX000");
    const releases = rpcCalls.filter(
      (c) => c.name === "release_report_worker_lock",
    );
    expect(releases.map((c) => c.args.p_status)).toEqual([
      "succeeded",
      "failed",
    ]);
    expect(releases[1].args.p_run_id).toBe("run-3");
  });
});
