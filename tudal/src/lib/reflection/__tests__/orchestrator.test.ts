import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runReflectionJob } from "@/lib/reflection/orchestrator";
import type { ReflectionJobDeps } from "@/lib/reflection/orchestrator";
import type { CycleSelection, ReflectionLogRow } from "@/lib/reflection/types";
import type { PersonaScore } from "@/lib/screening/tier1-schema";

function score(personaId: string, conviction: number): PersonaScore {
  return {
    persona_id: personaId,
    scores: { short: 50, mid: 50, long: 50 },
    winning_timeframe: "short",
    rationale_kr: "",
    conviction,
  };
}

const CYCLE = {
  month: "2026-06-01",
  periodKey: "s:2026-06-22",
  finalizedAt: "2026-06-26T01:00:00Z",
};

const SELECTIONS: CycleSelection[] = [
  { ticker: "000001", panel: [score("p1", 80)] },
  { ticker: "000002", panel: [score("p1", 80)] },
];

function baseDeps(over: Partial<ReflectionJobDeps> = {}): ReflectionJobDeps {
  return {
    track: "short",
    personaRoster: ["p1"],
    getPriorFinalizedCycle: async () => CYCLE,
    getCyclePanels: async () => SELECTIONS,
    resolvePrices: async () => ({
      entryPrices: new Map([
        ["000001", 100],
        ["000002", 100],
      ]),
      currentPrices: new Map([
        ["000001", 110],
        ["000002", 90],
      ]),
      entryDate: "20260626",
      currentDate: "20260627",
    }),
    insertReflectionLog: async () => {},
    ...over,
  };
}

describe("runReflectionJob", () => {
  const saved = {
    enabled: process.env.REFLECTION_ENABLED,
    llm: process.env.REFLECTION_LLM_SUMMARY_ENABLED,
  };
  beforeEach(() => {
    delete process.env.REFLECTION_ENABLED;
    delete process.env.REFLECTION_LLM_SUMMARY_ENABLED;
  });
  afterEach(() => {
    if (saved.enabled === undefined) delete process.env.REFLECTION_ENABLED;
    else process.env.REFLECTION_ENABLED = saved.enabled;
    if (saved.llm === undefined) delete process.env.REFLECTION_LLM_SUMMARY_ENABLED;
    else process.env.REFLECTION_LLM_SUMMARY_ENABLED = saved.llm;
  });

  it("dormancy pin: flag off → skipped(flag_off) + 모든 IO DI 0콜", async () => {
    const getPriorFinalizedCycle = vi.fn();
    const getCyclePanels = vi.fn();
    const resolvePrices = vi.fn();
    const insertReflectionLog = vi.fn();
    const res = await runReflectionJob(
      baseDeps({ getPriorFinalizedCycle, getCyclePanels, resolvePrices, insertReflectionLog }),
    );
    expect(res.skipped).toBe(true);
    expect(res.reason).toBe("flag_off");
    expect(getPriorFinalizedCycle).not.toHaveBeenCalled();
    expect(getCyclePanels).not.toHaveBeenCalled();
    expect(resolvePrices).not.toHaveBeenCalled();
    expect(insertReflectionLog).not.toHaveBeenCalled();
  });

  it("prior cycle 부재 → skipped(no_finalized_cycle), insert 0콜(fail-soft)", async () => {
    process.env.REFLECTION_ENABLED = "true";
    const insertReflectionLog = vi.fn();
    const res = await runReflectionJob(
      baseDeps({ getPriorFinalizedCycle: async () => null, insertReflectionLog }),
    );
    expect(res.skipped).toBe(true);
    expect(res.reason).toBe("no_finalized_cycle");
    expect(insertReflectionLog).not.toHaveBeenCalled();
  });

  it("panels 부재 → skipped(no_panels)", async () => {
    process.env.REFLECTION_ENABLED = "true";
    const res = await runReflectionJob(baseDeps({ getCyclePanels: async () => [] }));
    expect(res.skipped).toBe(true);
    expect(res.reason).toBe("no_panels");
  });

  it("happy path: metrics 산출 + reflection_log upsert 1회 + summary 반환", async () => {
    process.env.REFLECTION_ENABLED = "true";
    let saved: ReflectionLogRow | null = null;
    const insertReflectionLog = vi.fn(async (row: ReflectionLogRow) => {
      saved = row;
    });
    const res = await runReflectionJob(baseDeps({ insertReflectionLog }));
    expect(res.skipped).toBe(false);
    expect(res.track).toBe("short");
    expect(res.periodKey).toBe("s:2026-06-22");
    expect(res.selectedCount).toBe(2);
    expect(res.pricedCount).toBe(2);
    expect(res.overallHitRate).toBeCloseTo(0.5, 6); // 1 up, 1 down
    expect(insertReflectionLog).toHaveBeenCalledTimes(1);
    expect(saved!.reflectionKind).toBe("retrospective");
    expect(saved!.priceSource).toBe("KRX_EOD");
    expect(saved!.priceBasisEntryDate).toBe("20260626");
    expect(saved!.injectedContextSnapshot).toContain("회고");
  });

  it("기본 경로(LLM summary off): preflight·summarize 미호출(무비용)", async () => {
    process.env.REFLECTION_ENABLED = "true";
    const preflight = vi.fn();
    const summarize = vi.fn();
    await runReflectionJob(baseDeps({ preflight, summarize }));
    expect(preflight).not.toHaveBeenCalled();
    expect(summarize).not.toHaveBeenCalled();
  });

  it("LLM summary on + DI → preflight→summarize 호출 + snapshot에 요약 부가", async () => {
    process.env.REFLECTION_ENABLED = "true";
    process.env.REFLECTION_LLM_SUMMARY_ENABLED = "true";
    const order: string[] = [];
    const preflight = vi.fn(async () => {
      order.push("preflight");
    });
    const summarize = vi.fn(async () => {
      order.push("summarize");
      return "AI 요약: p1 강점";
    });
    let saved: ReflectionLogRow | null = null;
    const res = await runReflectionJob(
      baseDeps({
        preflight,
        summarize,
        insertReflectionLog: async (row) => {
          saved = row;
        },
      }),
    );
    expect(res.skipped).toBe(false);
    expect(order).toEqual(["preflight", "summarize"]); // 비용 게이트 먼저
    expect(saved!.injectedContextSnapshot).toContain("AI 요약: p1 강점");
  });

  it("LLM summary on + preflight throw(hardcap) → degrade: summarize 미호출(burn 0) + 무비용 base 회고 영속(throw 안 함)", async () => {
    process.env.REFLECTION_ENABLED = "true";
    process.env.REFLECTION_LLM_SUMMARY_ENABLED = "true";
    const summarize = vi.fn();
    let saved: ReflectionLogRow | null = null;
    const res = await runReflectionJob(
      baseDeps({
        preflight: async () => {
          throw new Error("cost_hardcap_exceeded");
        },
        summarize,
        insertReflectionLog: async (row) => {
          saved = row;
        },
      }),
    );
    expect(res.skipped).toBe(false); // job은 성공(throw 안 함)
    expect(summarize).not.toHaveBeenCalled(); // preflight throw → 요약 skip(burn 0)
    expect(saved).not.toBeNull(); // 무비용 base 회고는 영속(degrade)
    expect(saved!.injectedContextSnapshot).toContain("회고"); // base snapshot 유지(요약 부가 안 됨)
  });

  it("LLM summary on + summarize transient throw → degrade: base 회고 영속(throw 안 함)", async () => {
    process.env.REFLECTION_ENABLED = "true";
    process.env.REFLECTION_LLM_SUMMARY_ENABLED = "true";
    let saved: ReflectionLogRow | null = null;
    const res = await runReflectionJob(
      baseDeps({
        preflight: async () => {},
        summarize: async () => {
          throw new Error("ai_call_failed:transient:429");
        },
        insertReflectionLog: async (row) => {
          saved = row;
        },
      }),
    );
    expect(res.skipped).toBe(false);
    expect(saved).not.toBeNull();
    expect(saved!.injectedContextSnapshot).toContain("회고");
  });

  it("M4 cost-idempotency: alreadyReflected true → preflight/summarize 미호출(re-burn 방지) + base upsert는 진행", async () => {
    process.env.REFLECTION_ENABLED = "true";
    process.env.REFLECTION_LLM_SUMMARY_ENABLED = "true";
    const preflight = vi.fn(async () => {});
    const summarize = vi.fn(async () => "요약");
    const insertReflectionLog = vi.fn(async () => {});
    await runReflectionJob(
      baseDeps({
        alreadyReflected: async () => true,
        preflight,
        summarize,
        insertReflectionLog,
      }),
    );
    expect(preflight).not.toHaveBeenCalled();
    expect(summarize).not.toHaveBeenCalled();
    expect(insertReflectionLog).toHaveBeenCalledTimes(1); // base는 idempotent upsert
  });

  it("가격 전부 부재(resolvePrices 빈 Map) → metrics null이어도 영속(fail-soft)", async () => {
    process.env.REFLECTION_ENABLED = "true";
    let saved: ReflectionLogRow | null = null;
    const res = await runReflectionJob(
      baseDeps({
        resolvePrices: async () => ({
          entryPrices: new Map(),
          currentPrices: new Map(),
          entryDate: null,
          currentDate: null,
        }),
        insertReflectionLog: async (row) => {
          saved = row;
        },
      }),
    );
    expect(res.skipped).toBe(false);
    expect(res.pricedCount).toBe(0);
    expect(res.overallHitRate).toBeNull();
    expect(saved!.priceSource).toBeNull();
    expect(saved!.injectedContextSnapshot).toBe(""); // pricedCount 0 → 빈 컨텍스트
  });

  it("resolvePrices throw → fail-soft(빈 가격으로 진행, throw 전파 안 함)", async () => {
    process.env.REFLECTION_ENABLED = "true";
    const res = await runReflectionJob(
      baseDeps({
        resolvePrices: async () => {
          throw new Error("krx_eod_fetch_failed:503");
        },
      }),
    );
    expect(res.skipped).toBe(false);
    expect(res.pricedCount).toBe(0);
  });
});
