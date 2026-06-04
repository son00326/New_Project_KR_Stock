// Tier1 selection chunk worker — pure-ish 로직 단위 테스트 (deps mocked + fake supabase client).
// PR5 full-report-batch-worker.test.ts 패턴 복제 + finalize(replay) 신규 케이스.
// W2a Task 8 — period_key/track 재구성: preflight-first(claim/reset 前) + deferred→pending reset(preflight pass)
//   + finalize 게이트(nonTerminal===0 && terminal>0) + upsertShortListTrack finalize.
// DB-level claim/mutex/SKIP LOCKED/run_id fencing/done-guard(SQL)은 omxy SQL 리뷰 + 수동 QA (repo 컨벤션).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  runGuardedSelectionChunk,
  runTier1SelectionChunk,
  type RunTier1SelectionChunkInput,
} from "@/lib/screening/tier1-selection-batch-worker";
import type {
  PersonaScore,
  SelectionTrack,
  TickerAggregate,
  Tier1ScreeningResult,
} from "@/lib/screening/tier1-schema";
import { TRACK_FRESH_POOL, TRACK_SELECT_COUNT } from "@/lib/screening/tier1-schema";
import { getTier1PanelWorstSlotCostKrw } from "@/lib/ai/model-registry";

const VALID_UUID = "11111111-1111-4111-8111-111111111111";
const MIDLONG_PERIOD_KEY = "m:2026-06";
const SHORT_PERIOD_KEY = "s:2026-06-01";

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

// W1b — judge 라운드(round=3) fullset 헬퍼: finalize 도달 테스트는 최종 panel 보유 ticker 전부에
//   round=3 done JudgeVerdict가 있어야 judge enqueue 게이트를 통과한다.
function makeJudgeVerdict(score = 50) {
  return {
    scores: { short: score, mid: score, long: score },
    winning_timeframe: "short" as const,
    rationale_kr: "판정",
    conviction: 60,
  };
}
function judgeRowsFor(
  rows: Array<{ ticker: string; status: string }>,
  score = 50,
) {
  return rows
    .filter((r) => r.status === "done")
    .map((r) => ({
      ticker: r.ticker,
      status: "done",
      panel_result: makeJudgeVerdict(score),
      round: 3 as const,
    }));
}
function makeHighVariancePanel(): PersonaScore[] {
  return CORE_11_IDS.map((personaId, i) => ({
    ...makePanelResult(personaId),
    scores: {
      short: i % 2 === 0 ? 90 : 10,
      mid: i % 2 === 0 ? 90 : 10,
      long: i % 2 === 0 ? 90 : 10,
    },
  }));
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

// 트랙별 fresh 후보 풀 — getTier0Candidates 반환 형태(Tier1Candidate).
//   short = 50 (bucket short) / midlong = 100 (mid 50 + long 50).
function makeTrackCandidates(track: SelectionTrack) {
  const buckets: Array<"short" | "mid" | "long"> =
    track === "short" ? ["short"] : ["mid", "long"];
  const out = [];
  for (let b = 0; b < buckets.length; b++) {
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
  openCount?: number; // pending+running count (preflight reservation + forward-progress)
  deferredCount?: number; // deferred count (reservation + finalize 차단)
  judgeOpenCount?: number; // W1b — round=3 pending+running (judge reservation line)
  judgeDeferredCount?: number; // W1b — round=3 deferred
  nonTerminalCount?: number; // pending+running+deferred (finalize 게이트)
  terminalCount?: number; // done+failed (finalize 게이트)
  // finalize 시 worker가 1회 SELECT하는 전체 rows.
  allRows?: Array<{
    ticker: string;
    status: string;
    // W1b — round 3은 JudgeVerdict 이형 (worker가 round별 type guard로 해석).
    panel_result: PersonaScore[] | ReturnType<typeof makeJudgeVerdict> | null;
    round?: 1 | 2 | 3; // 미지정 시 worker가 1로 간주 (DB default 동형)
  }>;
  acquireRunId?: string | null;
  acquireError?: { code?: string } | null;
  releaseErrors?: Array<{ code?: string }>;
  roundCountSchemaMissing?: boolean;
}) {
  const rpcCalls: RpcCall[] = [];
  const updatePayloads: unknown[] = [];
  const releaseErrors = [...(opts.releaseErrors ?? [])];
  // count SELECT는 status 집합으로 어떤 count 헬퍼인지 식별.
  const countFor = (statuses: string[], rounds?: number[]): number => {
    const set = new Set(statuses);
    const isOpen = set.has("pending") && set.has("running") && set.size === 2;
    const isDeferred = set.has("deferred") && set.size === 1;
    const isNonTerminal =
      set.has("pending") && set.has("running") && set.has("deferred") && set.size === 3;
    const isTerminal = set.has("done") && set.has("failed") && set.size === 2;
    // W1b — round=[3] 필터는 judge 전용 카운트 (기본 0 = 기존 테스트 무회귀).
    if (rounds && rounds.length === 1 && rounds[0] === 3) {
      if (isOpen) return opts.judgeOpenCount ?? 0;
      if (isDeferred) return opts.judgeDeferredCount ?? 0;
      return 0;
    }
    if (isOpen) return opts.openCount ?? 0;
    if (isDeferred) return opts.deferredCount ?? 0;
    if (isNonTerminal) return opts.nonTerminalCount ?? 0;
    if (isTerminal) return opts.terminalCount ?? 0;
    return 0;
  };
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
      //   (a) count: .select('id', {count:'exact', head:true}).eq('period_key',..).in('status', [..]) → {count}
      //   (b) finalize 전체 rows: .select('ticker, status, panel_result').eq('period_key',..) → {data}
      chain.select = vi.fn(
        (_cols: string, selOpts?: { count?: string; head?: boolean }) => {
          const isCount = selOpts?.head === true;
          if (isCount) {
            return {
              eq: vi.fn(() => ({
                // W1b — hybrid: await 직접(라운드 무관) + .in('round', rounds) 체이닝 양쪽 지원.
                in: vi.fn((_col: string, statuses: string[]) => ({
                  in: vi.fn(async (_col2: string, rounds: number[]) => ({
                    count: countFor(statuses, rounds),
                    error: opts.roundCountSchemaMissing
                      ? {
                          code: "PGRST204",
                          message: "Could not find the 'round' column",
                        }
                      : null,
                  })),
                  then: (
                    resolve: (v: { count: number; error: null }) => unknown,
                  ) => resolve({ count: countFor(statuses), error: null }),
                })),
              })),
            };
          }
          // finalize 전체 rows SELECT (no head) → .eq('period_key',..) returns {data}
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

// selected stub (트랙별 selectCount; refine 통과용은 worker가 검증 안 함 — persist/runScreening은 mock).
function stubSelected(track: SelectionTrack): TickerAggregate[] {
  if (track === "short") {
    return Array.from({ length: 10 }, (_, i) =>
      makeTickerAggregate(`0${String(i).padStart(5, "0")}`, "short"),
    );
  }
  const tfs: Array<"mid" | "long"> = ["mid", "long"];
  return Array.from({ length: 20 }, (_, i) =>
    makeTickerAggregate(
      `${Math.floor(i / 10)}${String(i).padStart(5, "0")}`,
      tfs[Math.floor(i / 10)],
    ),
  );
}

// runScreening mock 반환 (Tier1ScreeningResult로 캐스팅 — worker는 selected/commentsByTicker만 사용).
function stubScreeningResult(track: SelectionTrack): Tier1ScreeningResult {
  const selectCount = TRACK_SELECT_COUNT[track];
  return {
    selected: stubSelected(track),
    notSelected: [],
    selectionMeta: {
      shortCount: track === "short" ? selectCount : 0,
      midCount: track === "midlong" ? 10 : 0,
      longCount: track === "midlong" ? 10 : 0,
      backfillCounts: { short: 0, mid: 0, long: 0 },
      promptVersionId: "p@v1",
      personasVersionId: "core11@v3.1",
      generatedAt: new Date().toISOString(),
    },
    commentsByTicker: {},
  };
}

// W2b (D27 Q5) — incumbent fixture (IncumbentInfo shape).
function makeIncumbentInfo(ticker: string, bucket: "short" | "mid" | "long") {
  return {
    ticker,
    bucket,
    rank: 1,
    month: "2026-05-01",
    sector: null,
    name: `종목${ticker}`,
    aiCommentKr: "직전 논거",
    consensusBadge: "🟢",
    aiScore: 78.2,
    conviction: 71,
    deltaStatus: "new",
    compositeScore: 72.5,
    signalLabel: "기존 신호",
  };
}

// DI 기본 세팅. over는 loosely typed로 받아 mock 타입(.mock 접근) 보존.
function makeDeps(track: SelectionTrack = "midlong", over: Record<string, unknown> = {}) {
  const callPersonaPanel = vi.fn(async () => makePanel());
  const fetchFinancials = vi.fn(async () => "fin");
  const tier0Source = vi.fn(async () => makeTrackCandidates(track));
  const preflightHardcap = vi.fn(async () => {});
  const persist = vi.fn(async () => {});
  const runScreening = vi.fn(async () => stubScreeningResult(track));
  const getMonthlyTotal = vi.fn(async () => 0);
  const insertPipelineHealth = vi.fn(async () => {});
  const insertAlertEvents = vi.fn(async () => {});
  const emitCostAlert = vi.fn(async () => {});
  // W2b — incumbent DI 기본값: cold start([]) = W2a fresh-only 무회귀.
  const incumbentsSource = vi.fn(async () => [] as ReturnType<typeof makeIncumbentInfo>[]);
  const buildIncumbentContexts = vi.fn(async () => ({}) as Record<string, string>);
  // W1a — R2 반박 패널 기본 mock.
  const callDebatePanel = vi.fn(async () => makePanel());
  // W1b — judge/dual-judge 기본 mock.
  const callJudgePanel = vi.fn(async () => makeJudgeVerdict());
  const callDualJudge = vi.fn(async () => makeJudgeVerdict());
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
    incumbentsSource,
    buildIncumbentContexts,
    callDebatePanel,
    callJudgePanel,
    callDualJudge,
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
  opts: { track?: SelectionTrack; periodKey?: string; month?: string } = {},
) {
  const track = opts.track ?? "midlong";
  const periodKey =
    opts.periodKey ?? (track === "short" ? SHORT_PERIOD_KEY : MIDLONG_PERIOD_KEY);
  return runTier1SelectionChunk({
    month: opts.month ?? "2026-06",
    track,
    periodKey,
    client: client as unknown as RunTier1SelectionChunkInput["client"],
    ...deps,
  } as unknown as RunTier1SelectionChunkInput);
}

function runGuarded(client: unknown, deps: ReturnType<typeof makeDeps>) {
  return runGuardedSelectionChunk({
    month: "2026-06",
    track: "midlong",
    periodKey: MIDLONG_PERIOD_KEY,
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

  it("tier0 후보 0개면 quiet skip + alert 0 + panel 0 + claim 미호출", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      const { client, rpcCalls } = makeFakeClient({ claimedJobs: [] });
      const deps = makeDeps("midlong", { tier0Source: vi.fn(async () => []) });
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

  it("tier0 후보 수가 트랙 fresh pool과 다르면 fail-closed + alert, panel 0", async () => {
    const { client } = makeFakeClient({ claimedJobs: [] });
    const deps = makeDeps("midlong", {
      tier0Source: vi.fn(async () => makeTrackCandidates("midlong").slice(0, 5)),
    });
    await expect(runChunk(client, deps)).rejects.toThrow(
      "tier0_candidates_invalid_count:5",
    );
    expect(deps.callPersonaPanel).not.toHaveBeenCalled();
    expect(deps.insertAlertEvents).toHaveBeenCalled();
  });

  it("short 트랙: 후보 50개면 정상 진행 (fresh pool=50)", async () => {
    const { client } = makeFakeClient({
      claimedJobs: [{ id: "j1", ticker: "000000" }],
      openCount: 5,
      nonTerminalCount: 5,
      terminalCount: 1,
    });
    const deps = makeDeps("short");
    const res = await runChunk(client, deps, {
      track: "short",
      periodKey: SHORT_PERIOD_KEY,
    });
    expect(res.done).toBe(1);
    expect(deps.callPersonaPanel).toHaveBeenCalledTimes(1);
  });
});

describe("runTier1SelectionChunk enqueue period_key/track", () => {
  it("enqueue rows에 period_key/track 기록 + onConflict period_key,ticker,round (W1a)", async () => {
    const { client } = makeFakeClient({
      claimedJobs: [{ id: "j1", ticker: "000000" }],
      openCount: 5,
      nonTerminalCount: 5,
      terminalCount: 1,
    });
    const deps = makeDeps("midlong");
    // upsert 페이로드 캡쳐
    let upsertRows: Array<Record<string, unknown>> = [];
    let upsertOpts: Record<string, unknown> = {};
    const origFrom = client.from;
    client.from = vi.fn((table: string) => {
      const chain = origFrom(table) as Record<string, unknown>;
      chain.upsert = vi.fn(
        async (rows: Array<Record<string, unknown>>, o: Record<string, unknown>) => {
          if (table === "tier1_selection_job") {
            upsertRows = rows;
            upsertOpts = o;
          }
          return { error: null };
        },
      );
      return chain;
    }) as typeof client.from;
    await runChunk(client, deps);
    expect(upsertRows.length).toBe(TRACK_FRESH_POOL.midlong);
    expect(upsertRows[0]).toMatchObject({
      period_key: MIDLONG_PERIOD_KEY,
      track: "midlong",
    });
    expect(upsertOpts).toMatchObject({ onConflict: "period_key,ticker,round" });
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
        openCount: 5,
        nonTerminalCount: 5, // not finalize yet
        terminalCount: 2,
      });
      const deps = makeDeps("midlong", { callPersonaPanel });
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
      openCount: 5,
    });
    const deps = makeDeps("midlong", { callPersonaPanel });
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
      openCount: 5,
      nonTerminalCount: 5, // 아직 미완성 → finalize 안 함
      terminalCount: 2,
    });
    const deps = makeDeps("midlong");
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
        openCount: 5,
        nonTerminalCount: 5,
        terminalCount: 2,
      });
      const deps = makeDeps("midlong", { callPersonaPanel });
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

describe("runTier1SelectionChunk preflight-first + deferred reset (R4 HIGH-2 / R3 HIGH-1)", () => {
  it("preflight cost_hardcap_exceeded → claim/reset 미실행(attempts 미소진) + STOP, aborted='cost_hardcap'", async () => {
    const preflightHardcap = vi
      .fn()
      .mockRejectedValue(new Error("cost_hardcap_exceeded"));
    const { client, rpcCalls, updatePayloads } = makeFakeClient({
      claimedJobs: [],
      openCount: 5,
      deferredCount: 0,
    });
    const deps = makeDeps("midlong", { preflightHardcap });
    const res = await runChunk(client, deps);
    expect(res.aborted).toBe("cost_hardcap");
    expect(deps.emitCostAlert).toHaveBeenCalled();
    expect(deps.callPersonaPanel).not.toHaveBeenCalled();
    // preflight 먼저 → fail 시 claim 미호출 (attempts 미소진)
    expect(
      rpcCalls.find((c) => c.name === "claim_next_selection_jobs"),
    ).toBeUndefined();
    // deferred→pending reset도 미실행 (preflight pass 시에만)
    expect(updatePayloads).not.toContainEqual(
      expect.objectContaining({ status: "pending" }),
    );
    // pipeline_health failed 보고
    expect(deps.insertPipelineHealth).toHaveBeenCalledWith(
      expect.objectContaining({ pipeline: "ai", status: "failed" }),
      expect.anything(),
    );
  });

  it("preflight reservation callCount = (openJobs + deferredJobs) × 11 (W0 D28 ③ model-aware)", async () => {
    const preflightHardcap = vi.fn(async () => {});
    const { client } = makeFakeClient({
      claimedJobs: [{ id: "j1", ticker: "000000" }],
      openCount: 5, // 5 open
      deferredCount: 2, // 2 deferred → (5+2)×11 = 77
      nonTerminalCount: 5,
      terminalCount: 1,
    });
    const deps = makeDeps("midlong", { preflightHardcap });
    await runChunk(client, deps);
    expect(preflightHardcap).toHaveBeenCalledWith(
      expect.objectContaining({
        month: "2026-06",
        lines: [
          expect.objectContaining({
            callCount: 77,
            maxCostPerCallKrw: expect.any(Number),
          }),
        ],
      }),
      expect.objectContaining({ callerKind: "service-role" }),
    );
    const firstCallArgs = preflightHardcap.mock.calls[0] as unknown as unknown[];
    const callArgs = firstCallArgs[0] as {
      lines: Array<{ maxCostPerCallKrw: number }>;
    };
    expect(callArgs.lines[0].maxCostPerCallKrw).toBeGreaterThan(0);
  });

  it("preflight pass 시 deferred→pending reset 후 claim 진행 (deadlock 해소)", async () => {
    const { client, rpcCalls, updatePayloads } = makeFakeClient({
      claimedJobs: [{ id: "j1", ticker: "000000" }],
      openCount: 0,
      deferredCount: 3, // open 0 + deferred 3 → preflight reservation 33
      nonTerminalCount: 3,
      terminalCount: 1,
    });
    const deps = makeDeps("midlong");
    await runChunk(client, deps);
    // deferred→pending 리셋 (attempts 보존 = attempts 키 없음)
    const resetPayload = updatePayloads.find(
      (p) =>
        (p as Record<string, unknown>).status === "pending" &&
        !("attempts" in (p as Record<string, unknown>)),
    );
    expect(resetPayload).toBeDefined();
    // reset 후 claim 진행
    expect(
      rpcCalls.find((c) => c.name === "claim_next_selection_jobs"),
    ).toBeDefined();
  });

  it("open+deferred 0개면 preflight 미호출하고 finalize 경로로 진행한다", async () => {
    const preflightHardcap = vi.fn(async () => {
      throw new Error("should_not_call_preflight");
    });
    // W1a — R2 게이트 하에서 finalize 도달: targets ⊆ round2 done 보장 위해 R1+R2 풀세트 제공.
    const r1RowsFull = makeTrackCandidates("midlong").map((c) => ({
      ticker: c.ticker,
      status: "done",
      panel_result: makePanel(),
      round: 1 as const,
    }));
    const allRows = [
      ...r1RowsFull,
      ...r1RowsFull.map((r) => ({ ...r, round: 2 as const })),
      ...judgeRowsFor(r1RowsFull), // W1b — judge fullset
    ];
    const { client } = makeFakeClient({
      claimedJobs: [],
      openCount: 0,
      deferredCount: 0,
      nonTerminalCount: 0,
      terminalCount: 100,
      allRows,
    });
    const deps = makeDeps("midlong", { preflightHardcap });
    const res = await runChunk(client, deps);

    // W1b — main reservation preflight(tier1/judge 라인)는 jobs 0이라 미호출.
    //   dual-judge 전용 preflight(경계 ≤8, 단일 라인) 1회만 허용 (D3 — finalize 내 관측층).
    expect(preflightHardcap).toHaveBeenCalledTimes(1);
    const dualLines = (
      preflightHardcap.mock.calls[0] as unknown[]
    )[0] as { lines: Array<{ callCount: number }> };
    expect(dualLines.lines).toHaveLength(1);
    expect(dualLines.lines[0].callCount).toBeLessThanOrEqual(8);
    expect(deps.callPersonaPanel).not.toHaveBeenCalled();
    expect(deps.runScreening).toHaveBeenCalled();
    expect(deps.persist).toHaveBeenCalled();
    expect(res.finalized).toBe(true);
  });

  it("preflight 통과 후 cost warning emitter를 best-effort 호출한다", async () => {
    const { client } = makeFakeClient({
      claimedJobs: [{ id: "j1", ticker: "000000" }],
      openCount: 7,
      nonTerminalCount: 7,
      terminalCount: 1,
    });
    const deps = makeDeps("midlong");
    await runChunk(client, deps);
    expect(deps.emitCostAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        month: "2026-06",
        projectedKrw: expect.any(Number),
      }),
      expect.anything(),
    );
  });

  it("CRF-1 preflight hardcap alert insert 실패 best-effort → defer 먼저 then aborted return", async () => {
    const preflightHardcap = vi
      .fn()
      .mockRejectedValue(new Error("cost_hardcap_exceeded"));
    const emitCostAlert = vi
      .fn()
      .mockRejectedValue(new Error("alert_event_insert_failed"));
    const { client, updatePayloads } = makeFakeClient({
      claimedJobs: [],
      openCount: 5,
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const deps = makeDeps("midlong", { preflightHardcap, emitCostAlert });
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

describe("runTier1SelectionChunk finalize (nonTerminal===0 && terminal>0 → 30선정 + persist)", () => {
  it("미완성(nonTerminal>0) → finalized:false, runScreening 미호출, persist 0", async () => {
    const { client } = makeFakeClient({
      claimedJobs: [{ id: "j1", ticker: "000000" }],
      openCount: 0,
      deferredCount: 0,
      nonTerminalCount: 10, // nonTerminal>0 → finalize 안 함
      terminalCount: 90,
    });
    const deps = makeDeps("midlong");
    const res = await runChunk(client, deps);
    expect(res.finalized).toBe(false);
    expect(deps.runScreening).not.toHaveBeenCalled();
    expect(deps.persist).not.toHaveBeenCalled();
  });

  it("deferred 잔존(nonTerminal>0) → finalize 미발동 (deferred는 finalize 차단, R2 MED-6)", async () => {
    const { client } = makeFakeClient({
      claimedJobs: [],
      openCount: 0,
      deferredCount: 5, // deferred만 잔존 → nonTerminal=5
      nonTerminalCount: 5,
      terminalCount: 95,
    });
    const deps = makeDeps("midlong");
    const res = await runChunk(client, deps);
    expect(res.finalized).toBe(false);
    expect(deps.runScreening).not.toHaveBeenCalled();
    expect(deps.persist).not.toHaveBeenCalled();
  });

  it("빈 풀(terminal 0) finalize 미발동", async () => {
    const { client } = makeFakeClient({
      claimedJobs: [],
      openCount: 0,
      deferredCount: 0,
      nonTerminalCount: 0,
      terminalCount: 0, // terminal 0 → finalize 게이트 차단
    });
    const deps = makeDeps("midlong");
    const res = await runChunk(client, deps);
    expect(res.finalized).toBe(false);
    expect(deps.runScreening).not.toHaveBeenCalled();
    expect(deps.persist).not.toHaveBeenCalled();
  });

  it("nonTerminal=0 & terminal>0 → finalized:true, runScreening 1회(replay), persist(month,track,30 rows)", async () => {
    // W1a — R2 게이트 하에서 finalize 도달: targets ⊆ round2 done 보장 위해 R1+R2 풀세트 제공.
    const r1RowsFull = makeTrackCandidates("midlong").map((c) => ({
      ticker: c.ticker,
      status: "done",
      panel_result: makePanel(),
      round: 1 as const,
    }));
    const allRows = [
      ...r1RowsFull,
      ...r1RowsFull.map((r) => ({ ...r, round: 2 as const })),
      ...judgeRowsFor(r1RowsFull), // W1b — judge fullset
    ];
    const { client } = makeFakeClient({
      claimedJobs: [{ id: "j1", ticker: "000000" }],
      openCount: 0,
      deferredCount: 0,
      nonTerminalCount: 0,
      terminalCount: 100,
      allRows,
    });
    const deps = makeDeps("midlong");
    const res = await runChunk(client, deps);
    expect(res.finalized).toBe(true);
    expect(deps.runScreening).toHaveBeenCalledTimes(1);
    // runScreening은 track 전파
    const screenArgs = deps.runScreening.mock.calls[0] as unknown[];
    expect((screenArgs[0] as { track: SelectionTrack }).track).toBe("midlong");
    expect(deps.persist).toHaveBeenCalledTimes(1);
    // persist는 upsertShortListTrack 시그니처: (monthYM, track, selected, options)
    const persistArgs = deps.persist.mock.calls[0] as unknown[];
    expect(persistArgs[0]).toBe("2026-06");
    expect(persistArgs[1]).toBe("midlong");
    expect(persistArgs[2]).toHaveLength(TRACK_SELECT_COUNT.midlong);
  });

  it("finalize는 mark_selection_finalized(periodKey, runId) RPC 호출", async () => {
    // W1a — R2 게이트 하에서 finalize 도달: targets ⊆ round2 done 보장 위해 R1+R2 풀세트 제공.
    const r1RowsFull = makeTrackCandidates("midlong").map((c) => ({
      ticker: c.ticker,
      status: "done",
      panel_result: makePanel(),
      round: 1 as const,
    }));
    const allRows = [
      ...r1RowsFull,
      ...r1RowsFull.map((r) => ({ ...r, round: 2 as const })),
      ...judgeRowsFor(r1RowsFull), // W1b — judge fullset
    ];
    const { client, rpcCalls } = makeFakeClient({
      acquireRunId: "run-9",
      claimedJobs: [{ id: "j1", ticker: "000000" }],
      openCount: 0,
      deferredCount: 0,
      nonTerminalCount: 0,
      terminalCount: 100,
      allRows,
    });
    const deps = makeDeps("midlong");
    const res = await runGuardedSelectionChunk({
      month: "2026-06",
      track: "midlong",
      periodKey: MIDLONG_PERIOD_KEY,
      client: client as unknown as RunTier1SelectionChunkInput["client"],
      ...deps,
    } as unknown as RunTier1SelectionChunkInput);
    expect(res.result?.finalized).toBe(true);
    const finalizeCall = rpcCalls.find(
      (c) => c.name === "mark_selection_finalized",
    );
    expect(finalizeCall?.args).toMatchObject({
      p_period_key: MIDLONG_PERIOD_KEY,
      p_run_id: "run-9",
    });
  });

  it("finalize replay 콜백이 stored panel_result 반환 → callPersonaPanel(실 LLM) 추가 0콜 (cost 0)", async () => {
    // W1a — R2 게이트 하에서 finalize 도달: targets ⊆ round2 done 보장 위해 R1+R2 풀세트 제공.
    const r1RowsFull = makeTrackCandidates("midlong").map((c) => ({
      ticker: c.ticker,
      status: "done",
      panel_result: makePanel(),
      round: 1 as const,
    }));
    const allRows = [
      ...r1RowsFull,
      ...r1RowsFull.map((r) => ({ ...r, round: 2 as const })),
      ...judgeRowsFor(r1RowsFull), // W1b — judge fullset
    ];
    const { client } = makeFakeClient({
      claimedJobs: [],
      openCount: 0,
      deferredCount: 0,
      nonTerminalCount: 0,
      terminalCount: 100,
      allRows,
    });
    const runScreening = vi.fn(async (input: RunTier1ScreeningLike) => {
      const replayed = await input.callPersonaPanel({
        ticker: "000000",
        financials: "",
      });
      expect(replayed).toHaveLength(11);
      return stubScreeningResult("midlong");
    });
    const deps = makeDeps("midlong", { runScreening });
    await runChunk(client, deps);
    expect(deps.callPersonaPanel).not.toHaveBeenCalled();
    expect(runScreening).toHaveBeenCalledTimes(1);
  });

  it("degraded(failed) 포함 terminal>0 nonTerminal=0 → finalize 실행", async () => {
    const all = makeTrackCandidates("midlong");
    const r1Rows = all.map((c, i) => ({
      ticker: c.ticker,
      status: i < 90 ? "done" : "failed",
      panel_result: i < 90 ? makePanel() : null,
      round: 1 as const,
    }));
    // W1a — R2 게이트 통과용: done ticker 전체를 round2 done으로 제공 (targets ⊆ round2).
    const allRows = [
      ...r1Rows,
      ...r1Rows.filter((r) => r.status === "done").map((r) => ({ ...r, round: 2 as const })),
      ...judgeRowsFor(r1Rows), // W1b — done 90에 judge fullset
    ];
    const { client } = makeFakeClient({
      claimedJobs: [],
      openCount: 0,
      deferredCount: 0,
      nonTerminalCount: 0,
      terminalCount: 100,
      allRows,
    });
    const deps = makeDeps("midlong");
    const res = await runChunk(client, deps);
    expect(res.finalized).toBe(true);
    expect(deps.runScreening).toHaveBeenCalledTimes(1);
    expect(deps.persist).toHaveBeenCalledTimes(1);
  });
});

describe("runGuardedSelectionChunk lock mutex (OPS-2)", () => {
  it("acquire(periodKey,track,month)→run_id → chunk runs → release same run_id succeeded", async () => {
    const { client, rpcCalls } = makeFakeClient({
      acquireRunId: "run-1",
      claimedJobs: [{ id: "j1", ticker: "000000" }],
      openCount: 5,
      nonTerminalCount: 5,
      terminalCount: 1,
    });
    const deps = makeDeps("midlong");
    const res = await runGuarded(client, deps);
    expect(res.result?.done).toBe(1);
    expect(deps.callPersonaPanel).toHaveBeenCalledTimes(1);
    const acquire = rpcCalls.find(
      (c) => c.name === "acquire_selection_worker_lock",
    );
    expect(acquire?.args).toMatchObject({
      p_period_key: MIDLONG_PERIOD_KEY,
      p_track: "midlong",
      p_month: "2026-06",
    });
    expect(
      rpcCalls.find((c) => c.name === "release_selection_worker_lock")?.args,
    ).toMatchObject({
      p_period_key: MIDLONG_PERIOD_KEY,
      p_run_id: "run-1",
      p_status: "succeeded",
    });
  });

  it("acquire→null → already_running skip, panel 0", async () => {
    const { client } = makeFakeClient({
      acquireRunId: null,
      claimedJobs: [{ id: "j1", ticker: "000000" }],
    });
    const deps = makeDeps("midlong");
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
    const deps = makeDeps("midlong");
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
    const deps = makeDeps("midlong");
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
    const deps = makeDeps("midlong");
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
  track: SelectionTrack;
  callPersonaPanel: (input: {
    ticker: string;
    financials: string;
  }) => Promise<PersonaScore[]>;
  fetchFinancials: (ticker: string) => Promise<string>;
  candidates: unknown[];
}

// ---------------------------------------------------------------------------
// W2b (D27 Q5) — incumbent union + per-call thesis context + delta/removed
// ---------------------------------------------------------------------------
describe("W2b incumbent union + thesis context", () => {
  it("union enqueue: incumbent source 10 중 fresh와 5개 중첩 → fresh 50 + incumbent-only 5 = 55 jobs (무심사 탈락 금지)", async () => {
    const fresh = makeTrackCandidates("short"); // tickers 000000..000049
    const incumbents = [
      // 5 overlap with fresh
      ...fresh.slice(0, 5).map((c) => makeIncumbentInfo(c.ticker, "short")),
      // 5 incumbent-only
      ...Array.from({ length: 5 }, (_, i) => makeIncumbentInfo(`90000${i}`, "short")),
    ];
    const { client } = makeFakeClient({
      claimedJobs: [],
      openCount: 55,
      nonTerminalCount: 55,
      terminalCount: 0,
    });
    let upsertRows: Array<Record<string, unknown>> = [];
    const origFrom = client.from;
    client.from = vi.fn((table: string) => {
      const chain = origFrom(table) as Record<string, unknown>;
      chain.upsert = vi.fn(async (rows: Array<Record<string, unknown>>) => {
        if (table === "tier1_selection_job") upsertRows = rows;
        return { error: null };
      });
      return chain;
    }) as typeof client.from;
    const deps = makeDeps("short", {
      incumbentsSource: vi.fn(async () => incumbents),
    });
    await runChunk(client, deps, { track: "short" });
    expect(upsertRows).toHaveLength(55);
    const tickers = new Set(upsertRows.map((r) => r.ticker));
    expect(tickers.has("900000")).toBe(true);
    expect(tickers.has("900004")).toBe(true);
  });

  it("incumbent ticker chunk 처리 시 callPersonaPanel에 reflectionContext 전달, 비-incumbent는 undefined", async () => {
    const incumbents = [makeIncumbentInfo("900000", "mid")];
    const { client } = makeFakeClient({
      claimedJobs: [
        { id: "j1", ticker: "900000" },
        { id: "j2", ticker: "000000" },
      ],
      openCount: 0,
      nonTerminalCount: 1,
      terminalCount: 100,
    });
    const deps = makeDeps("midlong", {
      incumbentsSource: vi.fn(async () => incumbents),
      buildIncumbentContexts: vi.fn(async () => ({
        "900000": "[재점검] 직전 논거 컨텍스트",
      })),
    });
    await runChunk(client, deps);
    expect(deps.buildIncumbentContexts).toHaveBeenCalledTimes(1);
    const calls = (deps.callPersonaPanel as ReturnType<typeof vi.fn>).mock
      .calls as Array<[{ ticker: string; reflectionContext?: string }]>;
    const incCall = calls.find(([a]) => a.ticker === "900000")!;
    const freshCall = calls.find(([a]) => a.ticker === "000000")!;
    expect(incCall[0].reflectionContext).toBe("[재점검] 직전 논거 컨텍스트");
    expect(freshCall[0].reflectionContext).toBeUndefined();
  });

  it("claimed에 incumbent 없으면 buildIncumbentContexts 미호출 (조회 절약 + cold start 무회귀)", async () => {
    const { client } = makeFakeClient({
      claimedJobs: [{ id: "j2", ticker: "000000" }],
      openCount: 0,
      nonTerminalCount: 1,
      terminalCount: 100,
    });
    const deps = makeDeps("midlong", {
      incumbentsSource: vi.fn(async () => [makeIncumbentInfo("900000", "mid")]),
    });
    await runChunk(client, deps);
    expect(deps.buildIncumbentContexts).not.toHaveBeenCalled();
  });

  it("finalize: persist options.incumbentTickers + incumbentMetadataByTicker + removed 구조화 로그", async () => {
    // W1a — R2 게이트 하에서 finalize 도달: targets ⊆ round2 done 보장 위해 R1+R2 풀세트 제공.
    const r1RowsFull = makeTrackCandidates("midlong").map((c) => ({
      ticker: c.ticker,
      status: "done",
      panel_result: makePanel(),
      round: 1 as const,
    }));
    const allRows = [
      ...r1RowsFull,
      ...r1RowsFull.map((r) => ({ ...r, round: 2 as const })),
      ...judgeRowsFor(r1RowsFull), // W1b — judge fullset
    ];
    // stubSelected(midlong) tickers: 0000xx/1000xx 형태 — incumbent 1개는 selected에 없음 → removed.
    const incumbents = [
      makeIncumbentInfo("900000", "mid"), // removed 예상
    ];
    const { client } = makeFakeClient({
      claimedJobs: [{ id: "j1", ticker: "000000" }],
      openCount: 0,
      deferredCount: 0,
      nonTerminalCount: 0,
      terminalCount: 101,
      allRows,
    });
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      const deps = makeDeps("midlong", {
        incumbentsSource: vi.fn(async () => incumbents),
      });
      const res = await runChunk(client, deps);
      expect(res.finalized).toBe(true);
      const persistArgs = deps.persist.mock.calls[0] as unknown[];
      const options = persistArgs[3] as {
        incumbentTickers: ReadonlySet<string>;
        incumbentMetadataByTicker: Record<string, { name: string | null }>;
      };
      expect(options.incumbentTickers.has("900000")).toBe(true);
      expect(options.incumbentMetadataByTicker["900000"]).toMatchObject({
        name: "종목900000",
        compositeScore: 72.5,
        signalLabel: "기존 신호",
      });
      const removedLog = infoSpy.mock.calls
        .map((c) => String(c[0]))
        .find((s) => s.includes("incumbent_removed"));
      expect(removedLog).toBeDefined();
      expect(removedLog).toContain("900000");
    } finally {
      infoSpy.mockRestore();
    }
  });

  it("incumbents가 TRACK_SELECT_COUNT를 초과하면(11) → abortBeforeSpend(incumbents_count_exceeded) (fail-closed, spend 0)", async () => {
    const { client } = makeFakeClient({
      claimedJobs: [],
      openCount: 0,
      nonTerminalCount: 0,
      terminalCount: 0,
    });
    const deps = makeDeps("short", {
      incumbentsSource: vi.fn(async () =>
        Array.from({ length: 11 }, (_, i) => makeIncumbentInfo(`9000${String(i).padStart(2, "0")}`, "short")),
      ),
    });
    await expect(runChunk(client, deps, { track: "short" })).rejects.toThrow(
      "incumbents_count_exceeded:11>10",
    );
    expect(deps.callPersonaPanel).not.toHaveBeenCalled();
  });

  it("carry 졸업 제외로 incumbent 9행이어도 abort 없이 union enqueue (partial 정당)", async () => {
    const { client } = makeFakeClient({
      claimedJobs: [],
      openCount: 0,
      nonTerminalCount: 0,
      terminalCount: 0,
    });
    const deps = makeDeps("short", {
      incumbentsSource: vi.fn(async () =>
        Array.from({ length: 9 }, (_, i) => makeIncumbentInfo(`90000${i}`, "short")),
      ),
    });
    const res = await runChunk(client, deps, { track: "short" });
    expect(res.aborted).toBeNull();
  });

  it("incumbentsSource 실패 → throw 전파 (silent drop 금지 — D27 무심사 탈락 금지)", async () => {
    const { client } = makeFakeClient({
      claimedJobs: [],
      openCount: 0,
      nonTerminalCount: 0,
      terminalCount: 0,
    });
    const deps = makeDeps("short", {
      incumbentsSource: vi.fn(async () => {
        throw new Error("incumbents_query_failed:PGRST000");
      }),
    });
    await expect(runChunk(client, deps, { track: "short" })).rejects.toThrow(
      "incumbents_query_failed",
    );
    expect(deps.preflightHardcap).not.toHaveBeenCalled();
    expect(deps.insertPipelineHealth).toHaveBeenCalledTimes(1);
    expect(deps.insertPipelineHealth).toHaveBeenCalledWith(
      expect.objectContaining({
        pipeline: "ai",
        status: "failed",
        error: expect.stringContaining(
          "preflight_abort:incumbents_query_failed:PGRST000",
        ),
      }),
      expect.anything(),
    );
    expect(deps.insertAlertEvents).toHaveBeenCalledTimes(1);
    expect(deps.callPersonaPanel).not.toHaveBeenCalled();
  });

  it("reservation: open 55 + deferred 5 = 60 jobs × 11 = 660 callCount preflight (incumbent job 자동 포함)", async () => {
    const { client } = makeFakeClient({
      claimedJobs: [],
      openCount: 55,
      deferredCount: 5,
      nonTerminalCount: 60,
      terminalCount: 0,
    });
    const deps = makeDeps("short", {
      incumbentsSource: vi.fn(async () =>
        Array.from({ length: 10 }, (_, i) => makeIncumbentInfo(`90000${i}`, "short")),
      ),
    });
    await runChunk(client, deps, { track: "short" });
    const preflightArgs = deps.preflightHardcap.mock.calls[0] as unknown[];
    const lines = (preflightArgs[0] as { lines: Array<{ callCount: number }> }).lines;
    expect(lines[0].callCount).toBe(660);
  });
});

// ---------------------------------------------------------------------------
// W1a (D4/D6/D8) — 멀티라운드: R2 enqueue 게이트 + debate chunk + finalize R2-우선
// ---------------------------------------------------------------------------
describe("W1a 멀티라운드 R2 반박", () => {
  it("R1 enqueue rows에 round:1 명시 + onConflict period_key,ticker,round", async () => {
    const { client } = makeFakeClient({
      claimedJobs: [],
      openCount: 100,
      nonTerminalCount: 100,
      terminalCount: 0,
    });
    let upsertRows: Array<Record<string, unknown>> = [];
    let upsertOpts: Record<string, unknown> = {};
    const origFrom = client.from;
    client.from = vi.fn((table: string) => {
      const chain = origFrom(table) as Record<string, unknown>;
      chain.upsert = vi.fn(
        async (rows: Array<Record<string, unknown>>, o: Record<string, unknown>) => {
          if (table === "tier1_selection_job" && upsertRows.length === 0) {
            upsertRows = rows;
            upsertOpts = o;
          }
          return { error: null };
        },
      );
      return chain;
    }) as typeof client.from;
    await runChunk(client, makeDeps("midlong"));
    expect(upsertRows[0]).toMatchObject({ round: 1 });
    expect(upsertOpts).toMatchObject({ onConflict: "period_key,ticker,round" });
  });

  it("0032 round schema 미적용 DB는 selection_round_schema_missing으로 fail-closed", async () => {
    const { client } = makeFakeClient({
      claimedJobs: [],
      openCount: 100,
      nonTerminalCount: 100,
      terminalCount: 0,
    });
    const origFrom = client.from;
    client.from = vi.fn((table: string) => {
      const chain = origFrom(table) as Record<string, unknown>;
      chain.upsert = vi.fn(async () => ({
        error:
          table === "tier1_selection_job"
            ? { code: "PGRST204", message: "Could not find the 'round' column" }
            : null,
      }));
      return chain;
    }) as typeof client.from;
    const deps = makeDeps("midlong");
    await expect(runChunk(client, deps)).rejects.toThrow(
      "selection_round_schema_missing",
    );
    expect(deps.preflightHardcap).not.toHaveBeenCalled();
    expect(deps.callPersonaPanel).not.toHaveBeenCalled();
  });

  it("round-aware preflight count에서 0032 schema가 없으면 selection_round_schema_missing으로 fail-closed", async () => {
    const { client } = makeFakeClient({
      claimedJobs: [],
      openCount: 100,
      nonTerminalCount: 100,
      terminalCount: 0,
      roundCountSchemaMissing: true,
    });
    const deps = makeDeps("midlong");
    await expect(runChunk(client, deps)).rejects.toThrow(
      "selection_round_schema_missing",
    );
    expect(deps.preflightHardcap).not.toHaveBeenCalled();
    expect(deps.callPersonaPanel).not.toHaveBeenCalled();
  });

  it("round-aware SELECT에서 0032 schema가 없으면 selection_round_schema_missing으로 fail-closed", async () => {
    const { client } = makeFakeClient({
      claimedJobs: [],
      openCount: 0,
      deferredCount: 0,
      nonTerminalCount: 0,
      terminalCount: 1,
    });
    const origFrom = client.from;
    client.from = vi.fn((table: string) => {
      const chain = origFrom(table) as Record<string, unknown>;
      if (table === "tier1_selection_job") {
        const origSelect = chain.select as (
          cols: string,
          opts?: { count?: string; head?: boolean },
        ) => unknown;
        chain.select = vi.fn((cols: string, opts?: { count?: string; head?: boolean }) => {
          if (opts?.head) return origSelect(cols, opts);
          return {
            eq: vi.fn(async () => ({
              data: null,
              error: { code: "PGRST204", message: "Could not find the 'round' column" },
            })),
          };
        });
      }
      return chain;
    }) as typeof client.from;
    const deps = makeDeps("midlong");
    await expect(runChunk(client, deps)).rejects.toThrow(
      "selection_round_schema_missing",
    );
    expect(deps.persist).not.toHaveBeenCalled();
  });

  it("R1 전부 terminal + targets>0 + round2 미존재 → round2 enqueue(대상만, round:2) + finalize 안 함", async () => {
    // 균일 panel(분산 0) → targets = 경계 rank 6..15 (각 tf) — round2 부재라 enqueue 발생.
    const r1Rows = makeTrackCandidates("midlong").map((c) => ({
      ticker: c.ticker,
      status: "done",
      panel_result: makePanel(),
      round: 1 as const,
    }));
    const { client } = makeFakeClient({
      claimedJobs: [],
      openCount: 0,
      deferredCount: 0,
      nonTerminalCount: 0,
      terminalCount: 100,
      allRows: r1Rows,
    });
    const upserts: Array<Array<Record<string, unknown>>> = [];
    const origFrom = client.from;
    client.from = vi.fn((table: string) => {
      const chain = origFrom(table) as Record<string, unknown>;
      chain.upsert = vi.fn(async (rows: Array<Record<string, unknown>>) => {
        if (table === "tier1_selection_job") upserts.push(rows);
        return { error: null };
      });
      return chain;
    }) as typeof client.from;
    const deps = makeDeps("midlong");
    const res = await runChunk(client, deps);
    expect(res.finalized).toBe(false);
    expect(deps.persist).not.toHaveBeenCalled();
    // 마지막 upsert = round2 enqueue (첫 upsert는 R1 idempotent enqueue)
    const r2Rows = upserts[upserts.length - 1];
    expect(r2Rows.length).toBeGreaterThan(0);
    expect(r2Rows.every((r) => r.round === 2)).toBe(true);
    expect(res.r2Enqueued).toBe(r2Rows.length);
    expect(r2Rows.length).toBeLessThan(100); // 대상만 (전체 아님)
  });

  it("R2 target이 현재 후보 밖이면 silently stuck 대신 r2_enqueue_failed로 fail-closed", async () => {
    const allRows = [
      {
        ticker: "999999",
        status: "done",
        panel_result: makeHighVariancePanel(),
        round: 1 as const,
      },
    ];
    const { client } = makeFakeClient({
      claimedJobs: [],
      openCount: 0,
      deferredCount: 0,
      nonTerminalCount: 0,
      terminalCount: 1,
      allRows,
    });
    const deps = makeDeps("midlong");
    await expect(runChunk(client, deps)).rejects.toThrow(
      "r2_enqueue_failed:target_not_in_candidates:999999",
    );
    expect(deps.persist).not.toHaveBeenCalled();
  });

  it("R1 전부 terminal + targets=0(전부 degraded) → 즉시 finalize (무회귀)", async () => {
    const r1Rows = makeTrackCandidates("midlong").map((c) => ({
      ticker: c.ticker,
      status: "failed",
      panel_result: null,
      round: 1 as const,
    }));
    const { client } = makeFakeClient({
      claimedJobs: [],
      openCount: 0,
      deferredCount: 0,
      nonTerminalCount: 0,
      terminalCount: 100,
      allRows: r1Rows,
    });
    const deps = makeDeps("midlong");
    const res = await runChunk(client, deps);
    expect(res.finalized).toBe(true);
    expect(deps.runScreening).toHaveBeenCalledTimes(1);
  });

  it("round2 전부 terminal → finalize: storedPanels가 R2 done 우선/R1 fallback (R2 failed는 R1 유지)", async () => {
    const candidates = makeTrackCandidates("midlong");
    const r1Panel = makePanel(); // scores 50
    const r2Panel = makePanel().map((p) => ({
      ...p,
      scores: { short: 80, mid: 80, long: 80 },
    }));
    const r1Rows = candidates.map((c) => ({
      ticker: c.ticker,
      status: "done",
      panel_result: r1Panel,
      round: 1 as const,
    }));
    // 전 ticker round2 존재: 첫 ticker만 failed(panel null) → R1 fallback, 나머지 done(R2 우선)
    const r2Rows = candidates.map((c, i) => ({
      ticker: c.ticker,
      status: i === 0 ? "failed" : "done",
      panel_result: i === 0 ? null : r2Panel,
      round: 2 as const,
    }));
    const { client } = makeFakeClient({
      claimedJobs: [],
      openCount: 0,
      deferredCount: 0,
      nonTerminalCount: 0,
      terminalCount: 200,
      allRows: [...r1Rows, ...r2Rows, ...judgeRowsFor(r1Rows)], // W1b — judge fullset
    });
    const deps = makeDeps("midlong");
    const res = await runChunk(client, deps);
    expect(res.finalized).toBe(true);
    const screenInput = (deps.runScreening as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as unknown as {
      callPersonaPanel: (i: { ticker: string; financials: string }) => Promise<PersonaScore[]>;
    };
    const failedTickerPanel = await screenInput.callPersonaPanel({
      ticker: candidates[0].ticker,
      financials: "",
    });
    expect(failedTickerPanel[0].scores.short).toBe(50); // R1 fallback
    const okPanel = await screenInput.callPersonaPanel({
      ticker: candidates[1].ticker,
      financials: "",
    });
    expect(okPanel[0].scores.short).toBe(80); // R2 우선
  });

  it("R2 chunk: claimed round=2 job은 callDebatePanel 경유(r1Panel 주입) + incumbent ctx 동반, round=1은 callPersonaPanel", async () => {
    const candidates = makeTrackCandidates("midlong");
    const r1Rows = candidates.map((c) => ({
      ticker: c.ticker,
      status: "done",
      panel_result: makePanel(),
      round: 1 as const,
    }));
    const { client } = makeFakeClient({
      claimedJobs: [
        { id: "j1", ticker: candidates[0].ticker, round: 2 },
        { id: "j2", ticker: candidates[1].ticker, round: 1 },
      ] as Array<{ id: string; ticker: string; round?: number }>,
      openCount: 5,
      nonTerminalCount: 5,
      terminalCount: 100,
      allRows: r1Rows,
    });
    const incumbents = [makeIncumbentInfo(candidates[0].ticker, "mid")];
    const deps = makeDeps("midlong", {
      incumbentsSource: vi.fn(async () => incumbents),
      buildIncumbentContexts: vi.fn(async () => ({
        [candidates[0].ticker]: "[재점검] ctx",
      })),
    });
    await runChunk(client, deps);
    expect(deps.callDebatePanel).toHaveBeenCalledTimes(1);
    const debateArg = (deps.callDebatePanel as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as { ticker: string; r1Panel: PersonaScore[]; reflectionContext?: string };
    expect(debateArg.ticker).toBe(candidates[0].ticker);
    expect(debateArg.r1Panel).toHaveLength(11);
    expect(debateArg.reflectionContext).toBe("[재점검] ctx");
    expect(deps.callPersonaPanel).toHaveBeenCalledTimes(1); // round=1 job만
  });

  it("R2 chunk: round=2인데 R1 done panel 부재 → debate_r1_panel_missing failed 처리 (spend 0)", async () => {
    const { client, rpcCalls } = makeFakeClient({
      claimedJobs: [{ id: "j1", ticker: "099999", round: 2 }] as Array<{
        id: string;
        ticker: string;
        round?: number;
      }>,
      openCount: 0,
      nonTerminalCount: 1,
      terminalCount: 100,
      allRows: [],
    });
    const deps = makeDeps("midlong");
    const res = await runChunk(client, deps);
    expect(res.failed).toBe(1);
    expect(deps.callDebatePanel).not.toHaveBeenCalled();
    const mark = rpcCalls.find((c) => c.name === "mark_selection_job");
    expect(mark?.args).toMatchObject({ p_status: "failed" });
    expect(String(mark?.args.p_error)).toContain("debate_r1_panel_missing");
  });

  it("reservation: (open+deferred) × 11 × worst-slot 단가 (mix, R2 jobs 자동 포함)", async () => {
    const { client } = makeFakeClient({
      claimedJobs: [],
      openCount: 55,
      deferredCount: 5,
      nonTerminalCount: 60,
      terminalCount: 0,
    });
    const deps = makeDeps("midlong");
    await runChunk(client, deps);
    const preflightArgs = deps.preflightHardcap.mock.calls[0] as unknown[];
    const lines = (
      preflightArgs[0] as { lines: Array<{ callCount: number; maxCostPerCallKrw: number }> }
    ).lines;
    expect(lines[0].callCount).toBe(660);
    expect(lines[0].maxCostPerCallKrw).toBe(getTier1PanelWorstSlotCostKrw());
  });
});

// ---------------------------------------------------------------------------
// W1b (D1/D3/D4/D6) — judge 라운드 + dual-judge + judgeScores 주입
// ---------------------------------------------------------------------------
describe("W1b judge 라운드 + dual-judge", () => {
  function r1r2FullSet() {
    const r1 = makeTrackCandidates("midlong").map((c) => ({
      ticker: c.ticker,
      status: "done",
      panel_result: makePanel(),
      round: 1 as const,
    }));
    return [...r1, ...r1.map((r) => ({ ...r, round: 2 as const }))];
  }

  it("R2 단계 충족 + round3 미존재 → judge enqueue(round:3, 최종 panel 보유분) + finalize 안 함 + judgeEnqueued 반환", async () => {
    const { client } = makeFakeClient({
      claimedJobs: [],
      openCount: 0,
      deferredCount: 0,
      nonTerminalCount: 0,
      terminalCount: 200,
      allRows: r1r2FullSet(), // judge rows 없음
    });
    const upserts: Array<Array<Record<string, unknown>>> = [];
    const origFrom = client.from;
    client.from = vi.fn((table: string) => {
      const chain = origFrom(table) as Record<string, unknown>;
      chain.upsert = vi.fn(async (rows: Array<Record<string, unknown>>) => {
        if (table === "tier1_selection_job") upserts.push(rows);
        return { error: null };
      });
      return chain;
    }) as typeof client.from;
    const deps = makeDeps("midlong");
    const res = await runChunk(client, deps);
    expect(res.finalized).toBe(false);
    expect(res.judgeEnqueued).toBe(100); // 최종 panel 100 전부
    const judgeRows = upserts[upserts.length - 1];
    expect(judgeRows.every((r) => r.round === 3)).toBe(true);
    expect(deps.persist).not.toHaveBeenCalled();
  });

  it("judge chunk: claimed round=3 → callJudgePanel(최종 panel R2-우선 + incumbent ctx) / 최종 panel 부재 → judge_panel_missing failed", async () => {
    const candidates = makeTrackCandidates("midlong");
    const rows = r1r2FullSet();
    const { client, rpcCalls } = makeFakeClient({
      claimedJobs: [
        { id: "j1", ticker: candidates[0].ticker, round: 3 },
        { id: "j2", ticker: "099999", round: 3 }, // 최종 panel 없음
      ] as Array<{ id: string; ticker: string; round?: number }>,
      openCount: 0,
      nonTerminalCount: 1,
      terminalCount: 200,
      allRows: rows,
    });
    const incumbents = [makeIncumbentInfo(candidates[0].ticker, "mid")];
    const deps = makeDeps("midlong", {
      incumbentsSource: vi.fn(async () => incumbents),
      buildIncumbentContexts: vi.fn(async () => ({
        [candidates[0].ticker]: "[재점검] judge ctx",
      })),
    });
    const res = await runChunk(client, deps);
    expect(deps.callJudgePanel).toHaveBeenCalledTimes(1);
    const arg = (deps.callJudgePanel as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as {
      ticker: string;
      month: string;
      finalPanel: PersonaScore[];
      track: SelectionTrack;
      reflectionContext?: string;
    };
    expect(arg.ticker).toBe(candidates[0].ticker);
    expect(arg.month).toBe("2026-06");
    expect(arg.track).toBe("midlong");
    expect(arg.finalPanel).toHaveLength(11);
    expect(arg.reflectionContext).toBe("[재점검] judge ctx");
    expect(res.failed).toBe(1); // 099999
    const mark = rpcCalls.find(
      (c) => c.name === "mark_selection_job" && String(c.args.p_error ?? "").includes("judge_panel_missing"),
    );
    expect(mark).toBeDefined();
  });

  it("judge 전부 terminal → finalize: judgeScoresByTicker 주입(runScreening) + dual-judge 경계만 콜 + 불일치 로그 + 최종=Opus", async () => {
    const candidates = makeTrackCandidates("midlong");
    const rows = r1r2FullSet();
    // judge verdict: ticker별 차등 점수 (rank 형성) — 0번째가 최고.
    const judgeRows = candidates.map((c, i) => ({
      ticker: c.ticker,
      status: "done",
      panel_result: makeJudgeVerdict(100 - i),
      round: 3 as const,
    }));
    const { client } = makeFakeClient({
      claimedJobs: [],
      openCount: 0,
      deferredCount: 0,
      nonTerminalCount: 0,
      terminalCount: 300,
      allRows: [...rows, ...judgeRows],
    });
    // GPT verdict: 항상 winning_timeframe 'long' → opus('short')와 불일치
    const incumbentTicker = candidates[8].ticker;
    const deps = makeDeps("midlong", {
      incumbentsSource: vi.fn(async () => [makeIncumbentInfo(incumbentTicker, "mid")]),
      buildIncumbentContexts: vi.fn(async () => ({
        [incumbentTicker]: "[재점검] dual ctx",
      })),
      callDualJudge: vi.fn(async () => ({
        scores: { short: 1, mid: 1, long: 99 },
        winning_timeframe: "long" as const,
        rationale_kr: "",
        conviction: 50,
      })),
    });
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      const res = await runChunk(client, deps);
      expect(res.finalized).toBe(true);
      // runScreening에 judgeScores 주입
      const screenInput = (deps.runScreening as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as unknown as {
        judgeScoresByTicker?: Record<string, { short: number }>;
      };
      expect(Object.keys(screenInput.judgeScoresByTicker ?? {})).toHaveLength(100);
      // dual-judge: midlong 활성 tf 2개 × rank 9..12 ≤ 8 콜
      const dualCalls = (deps.callDualJudge as ReturnType<typeof vi.fn>).mock.calls.length;
      expect(dualCalls).toBeGreaterThan(0);
      expect(dualCalls).toBeLessThanOrEqual(8);
      const dualArgs = (deps.callDualJudge as ReturnType<typeof vi.fn>).mock.calls.map(
        (c) =>
          c[0] as {
            ticker: string;
            month?: string;
            track?: SelectionTrack;
            reflectionContext?: string;
          },
      );
      expect(dualArgs.every((a) => a.track === "midlong")).toBe(true);
      expect(dualArgs.every((a) => a.month === "2026-06")).toBe(true);
      expect(dualArgs.find((a) => a.ticker === incumbentTicker)?.reflectionContext).toBe(
        "[재점검] dual ctx",
      );
      // 불일치 로그
      const disagreeLog = infoSpy.mock.calls
        .map((c) => String(c[0]))
        .find((s) => s.includes("dual_judge_disagreement"));
      expect(disagreeLog).toBeDefined();
    } finally {
      infoSpy.mockRestore();
    }
  });

  it("judge 전부 failed → judgeScores empty + consensus fallback finalize (graceful)", async () => {
    const candidates = makeTrackCandidates("midlong");
    const rows = r1r2FullSet();
    const judgeRows = candidates.map((c) => ({
      ticker: c.ticker,
      status: "failed",
      panel_result: null,
      round: 3 as const,
    }));
    const { client } = makeFakeClient({
      claimedJobs: [],
      openCount: 0,
      deferredCount: 0,
      nonTerminalCount: 0,
      terminalCount: 300,
      allRows: [...rows, ...judgeRows],
    });
    const deps = makeDeps("midlong");
    const res = await runChunk(client, deps);
    expect(res.finalized).toBe(true);
    const screenInput = (deps.runScreening as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as unknown as { judgeScoresByTicker?: Record<string, unknown> };
    expect(Object.keys(screenInput.judgeScoresByTicker ?? {})).toHaveLength(0);
    expect(deps.callDualJudge).not.toHaveBeenCalled(); // judge 점수 0 → dual 대상 0
  });

  it("dual-judge 전용 preflight fail(hardcap) → dual 전체 skip + dual_judge_skipped_hardcap 로그, 선정은 진행", async () => {
    const candidates = makeTrackCandidates("midlong");
    const rows = r1r2FullSet();
    const judgeRows = candidates.map((c, i) => ({
      ticker: c.ticker,
      status: "done",
      panel_result: makeJudgeVerdict(100 - i),
      round: 3 as const,
    }));
    const { client } = makeFakeClient({
      claimedJobs: [],
      openCount: 0,
      deferredCount: 0,
      nonTerminalCount: 0,
      terminalCount: 300,
      allRows: [...rows, ...judgeRows],
    });
    const preflightHardcap = vi.fn(async (args: { lines?: unknown[] }) => {
      if (args.lines && (args.lines as Array<{ callCount: number }>)[0].callCount <= 8) {
        throw new Error("cost_hardcap_exceeded:dual");
      }
    });
    const deps = makeDeps("midlong", { preflightHardcap });
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      const res = await runChunk(client, deps);
      expect(res.finalized).toBe(true); // 선정 차단 안 함
      expect(deps.callDualJudge).not.toHaveBeenCalled();
      const skipLog = infoSpy.mock.calls
        .map((c) => String(c[0]))
        .find((s) => s.includes("dual_judge_skipped_hardcap"));
      expect(skipLog).toBeDefined();
    } finally {
      infoSpy.mockRestore();
    }
  });

  it("preflight lines: tier1 + judge 라인 분리 (judge open jobs는 1콜 단가)", async () => {
    const { client } = makeFakeClient({
      claimedJobs: [],
      openCount: 55,
      deferredCount: 5,
      judgeOpenCount: 90,
      nonTerminalCount: 150,
      terminalCount: 0,
    });
    const deps = makeDeps("midlong");
    await runChunk(client, deps);
    const lines = (
      (deps.preflightHardcap as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
        lines: Array<{ callCount: number; maxCostPerCallKrw: number }>;
      }
    ).lines;
    expect(lines).toHaveLength(2);
    expect(lines[0].callCount).toBe(660); // (55+5)×11
    expect(lines[1].callCount).toBe(90); // judge 1콜/ticker
    expect(lines[1].maxCostPerCallKrw).not.toBe(lines[0].maxCostPerCallKrw);
  });
});
