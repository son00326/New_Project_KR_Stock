// Tier1 selection chunk worker — pure-ish 로직 단위 테스트 (deps mocked + fake supabase client).
// PR5 full-report-batch-worker.test.ts 패턴 복제 + finalize(replay) 신규 케이스.
// DB-level claim/mutex/SKIP LOCKED/run_id fencing/done-guard(SQL)은 omxy SQL 리뷰 + 수동 QA (repo 컨벤션).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  runGuardedSelectionChunk,
  runTier1SelectionChunk,
  type RunTier1SelectionChunkInput,
} from "@/lib/screening/tier1-selection-batch-worker";
import type {
  PersonaScore,
  TickerAggregate,
  Tier1ScreeningResult,
} from "@/lib/screening/tier1-schema";

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

// ── DI mocks (deps injected — no module mock needed) ──
function makePanelResult(personaId: string): PersonaScore {
  return {
    persona_id: personaId,
    scores: { short: 50, mid: 50, long: 50 },
    winning_timeframe: "short",
    rationale_kr: "",
    conviction: 50,
  };
}
const CORE_11_IDS = Array.from({ length: 11 }, (_, i) => `persona-${i}`);
function makePanel(): PersonaScore[] {
  return CORE_11_IDS.map(makePanelResult);
}

function makeTickerAggregate(ticker: string, tf: "short" | "mid" | "long"): TickerAggregate {
  return {
    ticker,
    sector: null,
    weighted_scores: { short: 50, mid: 50, long: 50 },
    primary_timeframe: tf,
    consensus_badges_by_timeframe: { short: "🟢", mid: "🟢", long: "🟢" },
    assigned_by: "primary",
    assigned_timeframe: tf,
    prompt_version_id: "p@v1",
    personas_version_id: "core11@v3.1",
  };
}

// 150 후보 (50 short + 50 mid + 50 long) — getTier0Candidates 반환 형태(Tier1Candidate).
function make150Candidates() {
  const buckets: Array<"short" | "mid" | "long"> = ["short", "mid", "long"];
  const out = [];
  for (let b = 0; b < 3; b++) {
    const bucket = buckets[b];
    for (let i = 0; i < 50; i++) {
      const ticker = `${b}${String(i).padStart(5, "0")}`;
      out.push({
        ticker,
        sector: null,
        tier0_buckets: {
          short: bucket === "short",
          mid: bucket === "mid",
          long: bucket === "long",
        },
        tier0_scores: {
          short: bucket === "short" ? 50 - i : null,
          mid: bucket === "mid" ? 50 - i : null,
          long: bucket === "long" ? 50 - i : null,
        },
      });
    }
  }
  return out;
}

interface RpcCall {
  name: string;
  args: Record<string, unknown>;
}

// fake supabase client (worker가 사용하는 표면만)
function makeFakeClient(opts: {
  claimedJobs: Array<{ id: string; ticker: string; bucket?: string }>;
  userExists?: boolean;
  remainingCount?: number; // pending+running count (preflight + forward-progress)
  // finalize 시 (remaining==0) worker가 1회 SELECT하는 전체 terminal rows.
  // 각 row = {ticker, status, panel_result}. doneCount/terminalCount는 여기서 파생.
  allRows?: Array<{
    ticker: string;
    status: string;
    panel_result: PersonaScore[] | null;
  }>;
  acquireRunId?: string | null;
  acquireError?: { code?: string } | null;
  releaseErrors?: Array<{ code?: string }>;
}) {
  const rpcCalls: RpcCall[] = [];
  const updatePayloads: unknown[] = [];
  const releaseErrors = [...(opts.releaseErrors ?? [])];
  const makeWriteChain = () => {
    const chain: Record<string, unknown> = {};
    chain.eq = vi.fn(() => chain);
    chain.is = vi.fn(async () => ({ error: null }));
    chain.in = vi.fn(async () => ({ error: null }));
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
    from: vi.fn((table: string) => {
      void table;
      const chain: Record<string, unknown> = {};
      chain.upsert = vi.fn(async () => ({ error: null }));
      chain.update = vi.fn((payload: unknown) => {
        updatePayloads.push(payload);
        return makeWriteChain();
      });
      // 두 SELECT 형태:
      //   (a) remaining count: .select('id', {count:'exact', head:true}).eq('month',..).in('status', [..]) → {count}
      //   (b) finalize 전체 rows: .select('ticker, status, panel_result').eq('month',..) → {data}
      chain.select = vi.fn(
        (_cols: string, selOpts?: { count?: string; head?: boolean }) => {
          const isCount = selOpts?.head === true;
          if (isCount) {
            return {
              eq: vi.fn(() => ({
                in: vi.fn(async () => ({
                  count: opts.remainingCount ?? 0,
                  error: null,
                })),
              })),
            };
          }
          // finalize 전체 rows SELECT (no head) → .eq('month',..) returns {data}
          return {
            eq: vi.fn(async () => ({
              data: opts.allRows ?? [],
              error: null,
            })),
          };
        },
      );
      return chain;
    }),
    rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      if (name === "acquire_selection_worker_lock") {
        return {
          data: opts.acquireRunId ?? null,
          error: opts.acquireError ?? null,
        };
      }
      if (name === "release_selection_worker_lock") {
        return {
          data: null,
          error: releaseErrors.shift() ?? null,
        };
      }
      if (name === "claim_next_selection_jobs") {
        return { data: opts.claimedJobs, error: null };
      }
      return { data: null, error: null };
    }),
  };
  return { client, rpcCalls, updatePayloads };
}

// 30 selected stub (timeframe별 10 = short/mid/long, refine 통과용은 worker가 검증 안 함 — persist/runScreening은 mock).
function stubSelected(): TickerAggregate[] {
  const tfs: Array<"short" | "mid" | "long"> = ["short", "mid", "long"];
  return Array.from({ length: 30 }, (_, i) =>
    makeTickerAggregate(
      `${Math.floor(i / 10)}${String(i).padStart(5, "0")}`,
      tfs[Math.floor(i / 10)],
    ),
  );
}

// runScreening mock 반환 (Tier1ScreeningResult로 캐스팅 — worker는 selected/commentsByTicker만 사용).
function stubScreeningResult(): Tier1ScreeningResult {
  return {
    selected: stubSelected(),
    notSelected: [],
    selectionMeta: {
      shortCount: 10,
      midCount: 10,
      longCount: 10,
      backfillCounts: { short: 0, mid: 0, long: 0 },
      promptVersionId: "p@v1",
      personasVersionId: "core11@v3.1",
      generatedAt: new Date().toISOString(),
    },
    commentsByTicker: {},
  };
}

// DI 기본 세팅. over는 loosely typed로 받아 mock 타입(.mock 접근) 보존.
function makeDeps(over: Record<string, unknown> = {}) {
  const callPersonaPanel = vi.fn(async () => makePanel());
  const fetchFinancials = vi.fn(async () => "fin");
  const tier0Source = vi.fn(async () => make150Candidates());
  const preflightHardcap = vi.fn(async () => {});
  const persist = vi.fn(async () => {});
  const runScreening = vi.fn(async () => stubScreeningResult());
  const getMonthlyTotal = vi.fn(async () => 0);
  const insertPipelineHealth = vi.fn(async () => {});
  const insertAlertEvents = vi.fn(async () => {});
  const emitCostAlert = vi.fn(async () => {});
  const deps = {
    tier0Source,
    callPersonaPanel,
    fetchFinancials,
    preflightHardcap,
    getMonthlyTotal,
    persist,
    runScreening,
    insertPipelineHealth,
    insertAlertEvents,
    emitCostAlert,
    promptVersionId: "p@v1",
    personasVersionId: "core11@v3.1",
    ...over,
  };
  return deps;
}

const ORIG_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.AI_COST_LOG_REAL_INSERT_ENABLED = "true";
  process.env.SELECTION_CRON_AUTO_ENABLED = "true";
  process.env.CRON_SYSTEM_USER_ID = VALID_UUID;
});

afterEach(() => {
  process.env = { ...ORIG_ENV };
});

function runChunk(
  client: unknown,
  deps: ReturnType<typeof makeDeps>,
  month = "2026-06",
) {
  return runTier1SelectionChunk({
    month,
    client: client as unknown as RunTier1SelectionChunkInput["client"],
    ...deps,
  } as unknown as RunTier1SelectionChunkInput);
}

function runGuarded(client: unknown, deps: ReturnType<typeof makeDeps>) {
  return runGuardedSelectionChunk({
    month: "2026-06",
    client: client as unknown as RunTier1SelectionChunkInput["client"],
    ...deps,
  } as unknown as RunTier1SelectionChunkInput);
}

describe("runTier1SelectionChunk step-0 fail-closed", () => {
  it("SELECTION_CRON_AUTO_ENABLED!==true → selection_cron_auto_disabled, panel 0 (spend 0)", async () => {
    process.env.SELECTION_CRON_AUTO_ENABLED = "false";
    const { client } = makeFakeClient({ claimedJobs: [] });
    const deps = makeDeps();
    await expect(runChunk(client, deps)).rejects.toThrow(
      "selection_cron_auto_disabled",
    );
    expect(deps.callPersonaPanel).not.toHaveBeenCalled();
    expect(deps.insertAlertEvents).toHaveBeenCalled();
  });

  it("AI_COST_LOG_REAL_INSERT_ENABLED!==true → cost_logging_disabled, panel 0", async () => {
    process.env.AI_COST_LOG_REAL_INSERT_ENABLED = "false";
    const { client } = makeFakeClient({ claimedJobs: [] });
    const deps = makeDeps();
    await expect(runChunk(client, deps)).rejects.toThrow("cost_logging_disabled");
    expect(deps.callPersonaPanel).not.toHaveBeenCalled();
  });

  it("CRON_SYSTEM_USER_ID 비-UUID → cron_system_user_id_invalid, panel 0", async () => {
    process.env.CRON_SYSTEM_USER_ID = "cron-system";
    const { client } = makeFakeClient({ claimedJobs: [] });
    const deps = makeDeps();
    await expect(runChunk(client, deps)).rejects.toThrow(
      "cron_system_user_id_invalid",
    );
    expect(deps.callPersonaPanel).not.toHaveBeenCalled();
  });

  it("auth.users 부재 → cron_system_user_not_found, panel 0", async () => {
    const { client } = makeFakeClient({ claimedJobs: [], userExists: false });
    const deps = makeDeps();
    await expect(runChunk(client, deps)).rejects.toThrow(
      "cron_system_user_not_found",
    );
    expect(deps.callPersonaPanel).not.toHaveBeenCalled();
  });

  it("tier0_candidates_150이 0개면 quiet skip + alert 0 + panel 0 + claim 미호출", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      const { client, rpcCalls } = makeFakeClient({ claimedJobs: [] });
      const deps = makeDeps({ tier0Source: vi.fn(async () => []) });
      const res = await runChunk(client, deps);
      expect(res.aborted).toBeNull();
      expect(res.claimed).toBe(0);
      expect(res.finalized).toBe(false);
      expect(deps.callPersonaPanel).not.toHaveBeenCalled();
      expect(deps.insertAlertEvents).not.toHaveBeenCalled();
      expect(deps.insertPipelineHealth).not.toHaveBeenCalled();
      expect(
        rpcCalls.find((c) => c.name === "claim_next_selection_jobs"),
      ).toBeUndefined();
      expect(infoSpy).toHaveBeenCalledWith(
        expect.stringContaining("tier0_candidates_not_seeded"),
      );
    } finally {
      infoSpy.mockRestore();
    }
  });

  it("tier0_candidates가 1~149개면 fail-closed + alert, panel 0", async () => {
    const { client } = makeFakeClient({ claimedJobs: [] });
    const deps = makeDeps({
      tier0Source: vi.fn(async () => make150Candidates().slice(0, 5)),
    });
    await expect(runChunk(client, deps)).rejects.toThrow(
      "tier0_candidates_invalid_count:5",
    );
    expect(deps.callPersonaPanel).not.toHaveBeenCalled();
    expect(deps.insertAlertEvents).toHaveBeenCalled();
  });
});

describe("runTier1SelectionChunk sequential + isolation", () => {
  it("1 종목 panel 실패 → 나머지 처리 계속, mark failed/done 분리", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const callPersonaPanel = vi
        .fn()
        .mockRejectedValueOnce(new Error("persona_score_validation_failed:scores"))
        .mockResolvedValue(makePanel());
      const { client, rpcCalls } = makeFakeClient({
        claimedJobs: [
          { id: "j1", ticker: "000000" },
          { id: "j2", ticker: "000001" },
        ],
        remainingCount: 5, // not finalize yet
      });
      const deps = makeDeps({ callPersonaPanel });
      const res = await runChunk(client, deps);
      expect(res.failed).toBe(1);
      expect(res.done).toBe(1);
      const marks = rpcCalls.filter((c) => c.name === "mark_selection_job");
      expect(marks.find((m) => m.args.p_id === "j1")?.args.p_status).toBe(
        "failed",
      );
      expect(marks.find((m) => m.args.p_id === "j2")?.args.p_status).toBe("done");
      expect(deps.insertAlertEvents).toHaveBeenCalled(); // failed summary
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("ai_key_unavailable → batch throw, panel 1회만, reset {status:'pending',attempts:0}", async () => {
    const callPersonaPanel = vi
      .fn()
      .mockRejectedValue(new Error("ai_key_unavailable"));
    const { client, updatePayloads } = makeFakeClient({
      claimedJobs: [
        { id: "j1", ticker: "000000" },
        { id: "j2", ticker: "000001" },
      ],
    });
    const deps = makeDeps({ callPersonaPanel });
    await expect(runChunk(client, deps)).rejects.toThrow("ai_key_unavailable");
    expect(callPersonaPanel).toHaveBeenCalledTimes(1);
    expect(updatePayloads).toContainEqual(
      expect.objectContaining({
        status: "pending",
        attempts: 0,
        last_error: "ai_key_unavailable",
      }),
    );
  });

  it("all-green chunk(미완성) → alert 0, pipeline_health success, finalized false", async () => {
    const { client } = makeFakeClient({
      claimedJobs: [
        { id: "j1", ticker: "000000" },
        { id: "j2", ticker: "000001" },
      ],
      remainingCount: 5, // 아직 미완성 → finalize 안 함
    });
    const deps = makeDeps();
    const res = await runChunk(client, deps);
    expect(deps.tier0Source).toHaveBeenCalledWith(
      expect.objectContaining({ month: "2026-06" }),
    );
    expect(res.done).toBe(2);
    expect(res.failed).toBe(0);
    expect(res.finalized).toBe(false);
    expect(deps.insertAlertEvents).not.toHaveBeenCalled();
    expect(deps.insertPipelineHealth).toHaveBeenCalledWith(
      expect.objectContaining({ pipeline: "ai", status: "success" }),
      expect.anything(),
    );
  });

  it("transient retry: 첫 ticker N회 실패 후 failed, 다음 ticker 계속", async () => {
    vi.useFakeTimers();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const callPersonaPanel = vi
        .fn()
        .mockRejectedValueOnce(new Error("429 rate_limit"))
        .mockRejectedValueOnce(new Error("429 rate_limit"))
        .mockRejectedValueOnce(new Error("429 rate_limit"))
        .mockResolvedValue(makePanel());
      const { client, rpcCalls } = makeFakeClient({
        claimedJobs: [
          { id: "j1", ticker: "000000" },
          { id: "j2", ticker: "000001" },
        ],
        remainingCount: 5,
      });
      const deps = makeDeps({ callPersonaPanel });
      const pending = runChunk(client, deps);
      await vi.runAllTimersAsync();
      const res = await pending;
      expect(callPersonaPanel).toHaveBeenCalledTimes(4);
      expect(res.failed).toBe(1);
      expect(res.done).toBe(1);
      const marks = rpcCalls.filter((c) => c.name === "mark_selection_job");
      expect(marks.find((m) => m.args.p_id === "j1")?.args.p_status).toBe(
        "failed",
      );
      expect(marks.find((m) => m.args.p_id === "j2")?.args.p_status).toBe("done");
    } finally {
      errorSpy.mockRestore();
      vi.useRealTimers();
    }
  });
});

describe("runTier1SelectionChunk cost_hardcap abort", () => {
  it("batch preflight cost_hardcap_40man → deferred + cost alert + STOP (no throw), aborted='cost_hardcap'", async () => {
    const preflightHardcap = vi
      .fn()
      .mockRejectedValue(new Error("cost_hardcap_40man"));
    const { client, rpcCalls } = makeFakeClient({
      claimedJobs: [],
      remainingCount: 5,
    });
    const deps = makeDeps({ preflightHardcap });
    const res = await runChunk(client, deps);
    expect(res.aborted).toBe("cost_hardcap");
    expect(deps.emitCostAlert).toHaveBeenCalled();
    expect(deps.callPersonaPanel).not.toHaveBeenCalled();
    expect(
      rpcCalls.find((c) => c.name === "claim_next_selection_jobs"),
    ).toBeDefined();
    expect(deps.insertPipelineHealth).toHaveBeenCalledWith(
      expect.objectContaining({ pipeline: "ai", status: "failed" }),
      expect.anything(),
    );
  });

  it("preflight callCount = pendingTickerCount × 11 (Core 11)", async () => {
    const preflightHardcap = vi.fn(async () => {});
    const { client } = makeFakeClient({
      claimedJobs: [{ id: "j1", ticker: "000000" }],
      remainingCount: 7, // 7 ticker pending → 77 calls
    });
    const deps = makeDeps({ preflightHardcap });
    await runChunk(client, deps);
    expect(preflightHardcap).toHaveBeenCalledWith(
      expect.objectContaining({ month: "2026-06", callCount: 77 }),
      expect.objectContaining({ callerKind: "service-role" }),
    );
  });

  it("preflight 통과 후 cost warning emitter를 best-effort 호출한다", async () => {
    const { client } = makeFakeClient({
      claimedJobs: [{ id: "j1", ticker: "000000" }],
      remainingCount: 7,
    });
    const deps = makeDeps();
    await runChunk(client, deps);
    expect(deps.emitCostAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        month: "2026-06",
        projectedKrw: expect.any(Number),
      }),
      expect.anything(),
    );
  });

  it("CRF-1 batch hardcap alert insert 실패 best-effort → defer 먼저 then aborted return", async () => {
    const preflightHardcap = vi
      .fn()
      .mockRejectedValue(new Error("cost_hardcap_40man"));
    const emitCostAlert = vi
      .fn()
      .mockRejectedValue(new Error("alert_event_insert_failed"));
    const { client, updatePayloads } = makeFakeClient({
      claimedJobs: [],
      remainingCount: 5,
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const deps = makeDeps({ preflightHardcap, emitCostAlert });
      const res = await runChunk(client, deps);
      expect(res.aborted).toBe("cost_hardcap");
      expect(updatePayloads).toContainEqual(
        expect.objectContaining({ status: "deferred" }),
      );
      expect(emitCostAlert).toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });
});

describe("runTier1SelectionChunk finalize (replay → 30선정 + persist)", () => {
  it("미완성(done<150) → finalized:false, runScreening 미호출, persist 0", async () => {
    const { client } = makeFakeClient({
      claimedJobs: [{ id: "j1", ticker: "000000" }],
      remainingCount: 10, // remaining>0 → finalize 안 함
    });
    const deps = makeDeps();
    const res = await runChunk(client, deps);
    expect(res.finalized).toBe(false);
    expect(deps.runScreening).not.toHaveBeenCalled();
    expect(deps.persist).not.toHaveBeenCalled();
  });

  it("remaining=0 & terminal=150 & done=150 → finalized:true, runScreening 1회(replay), persist 1회(30 rows)", async () => {
    const allRows = make150Candidates().map((c) => ({
      ticker: c.ticker,
      status: "done",
      panel_result: makePanel(),
    }));
    const { client, updatePayloads } = makeFakeClient({
      claimedJobs: [{ id: "j1", ticker: "000000" }],
      remainingCount: 0,
      allRows,
    });
    const deps = makeDeps();
    const res = await runChunk(client, deps);
    expect(res.finalized).toBe(true);
    expect(deps.runScreening).toHaveBeenCalledTimes(1);
    expect(deps.persist).toHaveBeenCalledTimes(1);
    // persist는 30 selected 받음 (persist(month, selected, options))
    const persistArgs = deps.persist.mock.calls[0] as unknown[];
    expect(persistArgs[1]).toHaveLength(30);
    expect(updatePayloads).toContainEqual(
      expect.objectContaining({ finalized_at: expect.any(String) }),
    );
  });

  it("finalize replay 콜백이 stored panel_result 반환 → callPersonaPanel(실 LLM) 추가 0콜 (cost 0)", async () => {
    const allRows = make150Candidates().map((c) => ({
      ticker: c.ticker,
      status: "done",
      panel_result: makePanel(),
    }));
    // claim 0 → loop에서 callPersonaPanel 0. finalize replay는 runScreening 내부 콜백.
    const { client } = makeFakeClient({
      claimedJobs: [],
      remainingCount: 0,
      allRows,
    });
    // runScreening이 replay 콜백을 실제로 호출하는지 검증 (실 runTier1Screening 행동 모사)
    const runScreening = vi.fn(async (input: RunTier1ScreeningLike) => {
      // replay 콜백 호출 → stored 반환, 실 callPersonaPanel(LLM)은 안 거침
      const replayed = await input.callPersonaPanel({
        ticker: "000000",
        financials: "",
      });
      expect(replayed).toHaveLength(11);
      return stubScreeningResult();
    });
    const deps = makeDeps({ runScreening });
    await runChunk(client, deps);
    // 실 LLM panel fan-out은 chunk loop에서만 — claim 0이므로 0콜.
    expect(deps.callPersonaPanel).not.toHaveBeenCalled();
    expect(runScreening).toHaveBeenCalledTimes(1);
  });

  it("degraded(failed/deferred) 포함 terminal=150 → finalize 실행 (done=140 + failed=10)", async () => {
    const all = make150Candidates();
    const allRows = all.map((c, i) => ({
      ticker: c.ticker,
      status: i < 140 ? "done" : "failed",
      panel_result: i < 140 ? makePanel() : null,
    }));
    const { client } = makeFakeClient({
      claimedJobs: [],
      remainingCount: 0,
      allRows,
    });
    const deps = makeDeps();
    const res = await runChunk(client, deps);
    expect(res.finalized).toBe(true);
    expect(deps.runScreening).toHaveBeenCalledTimes(1);
    expect(deps.persist).toHaveBeenCalledTimes(1);
  });
});

describe("runGuardedSelectionChunk lock mutex (OPS-2)", () => {
  it("acquire→run_id → chunk runs → release same run_id succeeded", async () => {
    const { client, rpcCalls } = makeFakeClient({
      acquireRunId: "run-1",
      claimedJobs: [{ id: "j1", ticker: "000000" }],
      remainingCount: 5,
    });
    const deps = makeDeps();
    const res = await runGuarded(client, deps);
    expect(res.result?.done).toBe(1);
    expect(deps.callPersonaPanel).toHaveBeenCalledTimes(1);
    expect(
      rpcCalls.find((c) => c.name === "release_selection_worker_lock")?.args,
    ).toMatchObject({
      p_month: "2026-06",
      p_run_id: "run-1",
      p_status: "succeeded",
    });
  });

  it("acquire→null → already_running skip, panel 0", async () => {
    const { client } = makeFakeClient({
      acquireRunId: null,
      claimedJobs: [{ id: "j1", ticker: "000000" }],
    });
    const deps = makeDeps();
    const res = await runGuarded(client, deps);
    expect(res).toEqual({ skipped: "already_running" });
    expect(deps.callPersonaPanel).not.toHaveBeenCalled();
  });

  it("chunk throws → release same run_id failed exactly once", async () => {
    process.env.AI_COST_LOG_REAL_INSERT_ENABLED = "false";
    const { client, rpcCalls } = makeFakeClient({
      acquireRunId: "run-2",
      claimedJobs: [],
    });
    const deps = makeDeps();
    await expect(runGuarded(client, deps)).rejects.toThrow(
      "cost_logging_disabled",
    );
    const releases = rpcCalls.filter(
      (c) => c.name === "release_selection_worker_lock",
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
    const deps = makeDeps();
    await expect(runGuarded(client, deps)).rejects.toThrow(
      "acquire_lock_failed:42501",
    );
  });

  it("OPS-2: succeeded release throw → catch retries failed, [succeeded, failed] 순서", async () => {
    const { client, rpcCalls } = makeFakeClient({
      acquireRunId: "run-3",
      claimedJobs: [],
      releaseErrors: [{ code: "XX000" }],
    });
    const deps = makeDeps();
    await expect(runGuarded(client, deps)).rejects.toThrow(
      "release_selection_worker_lock_failed:XX000",
    );
    const releases = rpcCalls.filter(
      (c) => c.name === "release_selection_worker_lock",
    );
    expect(releases.map((c) => c.args.p_status)).toEqual([
      "succeeded",
      "failed",
    ]);
    expect(releases[1].args.p_run_id).toBe("run-3");
  });
});

// runScreening replay 콜백 시그니처 (테스트 로컬 타입)
interface RunTier1ScreeningLike {
  callPersonaPanel: (input: {
    ticker: string;
    financials: string;
  }) => Promise<PersonaScore[]>;
  fetchFinancials: (ticker: string) => Promise<string>;
  candidates: unknown[];
}
