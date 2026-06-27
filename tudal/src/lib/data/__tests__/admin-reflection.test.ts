// PR-K Reflection 데이터 레이어 유닛테스트.
// mock chain 타이핑: feedback_test_mock_typing (any 금지, admin-shortlist-incumbents.test.ts 패턴).
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  insertReflectionLog,
  getLatestReflectionLog,
  getPriorFinalizedCycle,
  getCyclePanels,
  reflectionExists,
} from "@/lib/data/admin-reflection";
import type { ReflectionLogRow } from "@/lib/reflection/types";

function validRow(over: Partial<ReflectionLogRow> = {}): ReflectionLogRow {
  return {
    month: "2026-06-01",
    track: "short",
    periodKey: "s:2026-06-22",
    finalizedAt: "2026-06-26T01:00:00Z",
    reflectionKind: "retrospective",
    selectedCount: 10,
    pricedCount: 8,
    overallHitRate: 0.5,
    overallAvgRealizedReturn: 0.03,
    perPersonaMetrics: [
      { personaId: "p1", sampleSize: 8, hitRate: 0.75, convictionWeightedReturn: 0.06, avgConviction: 72 },
    ],
    injectedContextSnapshot: "ctx",
    priceSource: "KRX_EOD",
    priceBasisEntryDate: "20260626",
    priceBasisCurrentDate: "20260627",
    ...over,
  };
}

// ── insertReflectionLog: from → upsert ──
function upsertClient(result: { error: { code?: string } | null }) {
  const upsert = vi.fn().mockResolvedValue(result);
  const from = vi.fn().mockReturnValue({ upsert });
  return { client: { from } as unknown as SupabaseClient, spies: { from, upsert } };
}

describe("insertReflectionLog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("upsert onConflict month,track,period_key (idempotent) + 컬럼 매핑", async () => {
    const { client, spies } = upsertClient({ error: null });
    await insertReflectionLog(validRow(), { client });
    expect(spies.from).toHaveBeenCalledWith("reflection_log");
    const [payload, opts] = spies.upsert.mock.calls[0];
    expect(opts).toEqual({ onConflict: "month,track,period_key" });
    expect(payload).toMatchObject({
      month: "2026-06-01",
      track: "short",
      period_key: "s:2026-06-22",
      reflection_kind: "retrospective",
      selected_count: 10,
      priced_count: 8,
      overall_hit_rate: 0.5,
      overall_avg_realized_return: 0.03,
      injected_context_snapshot: "ctx",
      price_source: "KRX_EOD",
      price_basis_entry_date: "20260626",
      price_basis_current_date: "20260627",
    });
    expect(payload.per_persona_metrics).toEqual(validRow().perPersonaMetrics);
  });

  it("invalid month → throw (DB 전 가드, 쿼리 0회)", async () => {
    const { client, spies } = upsertClient({ error: null });
    await expect(insertReflectionLog(validRow({ month: "2026-06" }), { client })).rejects.toThrow(
      /reflection_log_invalid_month/,
    );
    expect(spies.from).not.toHaveBeenCalled();
  });

  it("invalid track → throw", async () => {
    const { client } = upsertClient({ error: null });
    await expect(
      insertReflectionLog(validRow({ track: "weekly" as never }), { client }),
    ).rejects.toThrow(/reflection_log_invalid_track/);
  });

  it("DB error → throw with code", async () => {
    const { client } = upsertClient({ error: { code: "23514" } });
    await expect(insertReflectionLog(validRow(), { client })).rejects.toThrow(/23514/);
  });
});

// ── getLatestReflectionLog: from → select → eq → order → limit → maybeSingle ──
function latestClient(result: { data: { injected_context_snapshot: string | null } | null; error: { code?: string } | null }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const limit = vi.fn().mockReturnValue({ maybeSingle });
  const order = vi.fn().mockReturnValue({ limit });
  const eq = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { client: { from } as unknown as SupabaseClient, spies: { from, select, eq, order, limit, maybeSingle } };
}

describe("getLatestReflectionLog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("track eq + finalized_at desc + limit 1 → snapshot row 반환(recency 정렬·limit 박제)", async () => {
    const { client, spies } = latestClient({ data: { injected_context_snapshot: "ctx-x" }, error: null });
    const row = await getLatestReflectionLog({ track: "midlong", client });
    expect(spies.from).toHaveBeenCalledWith("reflection_log");
    expect(spies.eq).toHaveBeenCalledWith("track", "midlong");
    // load-bearing recency: ascending mutation 또는 limit 제거 시 stale/oldest 반환 → 회귀 박제.
    expect(spies.order).toHaveBeenCalledWith("finalized_at", { ascending: false });
    expect(spies.limit).toHaveBeenCalledWith(1);
    expect(row).toEqual({ injectedContextSnapshot: "ctx-x" });
  });

  it("row 부재 → null", async () => {
    const { client } = latestClient({ data: null, error: null });
    expect(await getLatestReflectionLog({ track: "short", client })).toBeNull();
  });

  it("DB error → throw", async () => {
    const { client } = latestClient({ data: null, error: { code: "42P01" } });
    await expect(getLatestReflectionLog({ track: "short", client })).rejects.toThrow(/42P01/);
  });
});

// ── getPriorFinalizedCycle: from → select → eq(track) → not(finalized_at) → order → limit → maybeSingle ──
function priorClient(result: { data: { period_key: string; track: string; month: string; finalized_at: string } | null; error: { code?: string } | null }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const limit = vi.fn().mockReturnValue({ maybeSingle });
  const order = vi.fn().mockReturnValue({ limit });
  const not = vi.fn().mockReturnValue({ order });
  const eq = vi.fn().mockReturnValue({ not });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { client: { from } as unknown as SupabaseClient, spies: { from, select, eq, not, order, limit, maybeSingle } };
}

describe("getPriorFinalizedCycle", () => {
  beforeEach(() => vi.clearAllMocks());

  it("finalized run → month을 YYYY-MM-01로 변환", async () => {
    const { client, spies } = priorClient({
      data: { period_key: "s:2026-06-22", track: "short", month: "2026-06", finalized_at: "2026-06-26T01:00:00Z" },
      error: null,
    });
    const cycle = await getPriorFinalizedCycle({ track: "short", client });
    expect(spies.eq).toHaveBeenCalledWith("track", "short");
    expect(spies.not).toHaveBeenCalledWith("finalized_at", "is", null);
    // load-bearing recency: '가장 최근 finalize' — ascending mutation 시 oldest 반환 → 회귀 박제.
    expect(spies.order).toHaveBeenCalledWith("finalized_at", { ascending: false });
    expect(spies.limit).toHaveBeenCalledWith(1);
    expect(cycle).toEqual({
      month: "2026-06-01",
      periodKey: "s:2026-06-22",
      finalizedAt: "2026-06-26T01:00:00Z",
    });
  });

  it("finalized run 부재 → null (fail-soft no-op)", async () => {
    const { client } = priorClient({ data: null, error: null });
    expect(await getPriorFinalizedCycle({ track: "short", client })).toBeNull();
  });

  it("DB error → throw", async () => {
    const { client } = priorClient({ data: null, error: { code: "42501" } });
    await expect(getPriorFinalizedCycle({ track: "short", client })).rejects.toThrow(/42501/);
  });
});

// ── getCyclePanels: from → select → eq(period_key) → eq(status) → not(panel_result) ──
interface PanelJobRow {
  ticker: string;
  round?: number;
  panel_result: unknown;
}
function panelsClient(result: { data: PanelJobRow[] | null; error: { code?: string } | null }) {
  const not = vi.fn().mockResolvedValue(result);
  const eq2 = vi.fn().mockReturnValue({ not });
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
  const select = vi.fn().mockReturnValue({ eq: eq1 });
  const from = vi.fn().mockReturnValue({ select });
  return { client: { from } as unknown as SupabaseClient, spies: { from, select, eq1, eq2, not } };
}

function panelJson(personaId: string, conviction: number) {
  return {
    persona_id: personaId,
    scores: { short: 50, mid: 50, long: 50 },
    winning_timeframe: "short",
    rationale_kr: "",
    conviction,
  };
}

describe("getCyclePanels", () => {
  beforeEach(() => vi.clearAllMocks());

  it("period_key + status done + panel not null → CycleSelection[]", async () => {
    const { client, spies } = panelsClient({
      data: [
        { ticker: "000001", round: 1, panel_result: [panelJson("p1", 80)] },
        { ticker: "000002", round: 1, panel_result: [panelJson("p1", 40)] },
      ],
      error: null,
    });
    const out = await getCyclePanels({ periodKey: "s:2026-06-22", client });
    expect(spies.eq1).toHaveBeenCalledWith("period_key", "s:2026-06-22");
    expect(spies.eq2).toHaveBeenCalledWith("status", "done");
    expect(spies.not).toHaveBeenCalledWith("panel_result", "is", null);
    expect(out).toHaveLength(2);
    expect(out.find((s) => s.ticker === "000001")!.panel[0].persona_id).toBe("p1");
    expect(out.find((s) => s.ticker === "000001")!.panel[0].conviction).toBe(80);
  });

  it("멀티라운드(0032/0033): 같은 ticker의 round 1+2(PersonaScore)+3(JudgeVerdict) → 단 1건, R2 패널 채택(double-count 방지)", async () => {
    const { client } = panelsClient({
      data: [
        { ticker: "000001", round: 1, panel_result: [panelJson("p1", 70)] }, // R1
        { ticker: "000001", round: 2, panel_result: [panelJson("p1", 90)] }, // R2(반박 후 수정) — 채택
        {
          ticker: "000001",
          round: 3,
          panel_result: { scores: { short: 80, mid: 70, long: 60 }, winning_timeframe: "short", rationale_kr: "j", conviction: 75 },
        }, // R3 JudgeVerdict(object) — 제외
        { ticker: "000002", round: 1, panel_result: [panelJson("p1", 50)] }, // R1만(반박 없음)
      ],
      error: null,
    });
    const out = await getCyclePanels({ periodKey: "s:2026-06-22", client });
    expect(out).toHaveLength(2); // ticker별 1건 (000001 double-count 안 됨)
    const t1 = out.find((s) => s.ticker === "000001")!;
    expect(t1.panel).toHaveLength(1);
    expect(t1.panel[0].conviction).toBe(90); // R2 우선(70 아님)
    const t2 = out.find((s) => s.ticker === "000002")!;
    expect(t2.panel[0].conviction).toBe(50); // R1 fallback
  });

  it("round 누락(legacy default 1 간주) → 정상 처리", async () => {
    const { client } = panelsClient({
      data: [{ ticker: "000001", panel_result: [panelJson("p1", 80)] }],
      error: null,
    });
    const out = await getCyclePanels({ periodKey: "s:2026-06-22", client });
    expect(out).toHaveLength(1);
    expect(out[0].panel[0].conviction).toBe(80);
  });

  it("panel_result가 배열 아님/빈배열 → fail-soft 제외(throw 0)", async () => {
    const { client } = panelsClient({
      data: [
        { ticker: "000001", panel_result: "garbage" },
        { ticker: "000002", panel_result: [] },
        { ticker: "000003", panel_result: [panelJson("p1", 80)] },
      ],
      error: null,
    });
    const out = await getCyclePanels({ periodKey: "s:2026-06-22", client });
    expect(out.map((s) => s.ticker)).toEqual(["000003"]);
  });

  it("DB error → throw", async () => {
    const { client } = panelsClient({ data: null, error: { code: "42P01" } });
    await expect(getCyclePanels({ periodKey: "s:2026-06-22", client })).rejects.toThrow(/42P01/);
  });
});

// ── reflectionExists: from → select → eq → eq → eq → limit → maybeSingle ──
function existsClient(result: { data: { id: string } | null; error: { code?: string } | null }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const limit = vi.fn().mockReturnValue({ maybeSingle });
  const eq3 = vi.fn().mockReturnValue({ limit });
  const eq2 = vi.fn().mockReturnValue({ eq: eq3 });
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
  const select = vi.fn().mockReturnValue({ eq: eq1 });
  const from = vi.fn().mockReturnValue({ select });
  return { client: { from } as unknown as SupabaseClient, spies: { from, eq1, eq2, eq3 } };
}

describe("reflectionExists", () => {
  beforeEach(() => vi.clearAllMocks());

  it("row 존재 → true (month/track/period_key 3중 eq)", async () => {
    const { client, spies } = existsClient({ data: { id: "x" }, error: null });
    const out = await reflectionExists({
      month: "2026-06-01",
      track: "short",
      periodKey: "s:2026-06-22",
      client,
    });
    expect(out).toBe(true);
    expect(spies.eq1).toHaveBeenCalledWith("month", "2026-06-01");
    expect(spies.eq2).toHaveBeenCalledWith("track", "short");
    expect(spies.eq3).toHaveBeenCalledWith("period_key", "s:2026-06-22");
  });

  it("row 부재 → false", async () => {
    const { client } = existsClient({ data: null, error: null });
    expect(
      await reflectionExists({ month: "2026-06-01", track: "short", periodKey: "s:2026-06-22", client }),
    ).toBe(false);
  });

  it("DB error → throw", async () => {
    const { client } = existsClient({ data: null, error: { code: "42P01" } });
    await expect(
      reflectionExists({ month: "2026-06-01", track: "short", periodKey: "s:2026-06-22", client }),
    ).rejects.toThrow(/42P01/);
  });
});
