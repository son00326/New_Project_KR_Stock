// G1 funnel reflection 입력 로더 — 순수부(period 매핑/수익 창/exposure 기저/수익률) +
//   loadFunnelReflectionInput 조립(typed Supabase chain mock, fail-soft 계약).
import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mapPriorPeriodKeyToMonth,
  resolveMonthReturnWindow,
  buildFunnelCandidates,
  computeRealizedReturns,
  loadFunnelReflectionInput,
  type FunnelCandidateDbRow,
} from "@/lib/reflection/funnel-reflection-source";
import { FUNNEL_CHAMPION_CONFIG } from "@/lib/reflection/funnel-champion-config";

// ── typed Supabase chain mocks (any 금지) ──────────────────────────────────
interface QueryError {
  code?: string;
}
interface QueryResult {
  data: Array<Record<string, unknown>> | null;
  error: QueryError | null;
}
interface MaybeSingleResult {
  data: Record<string, unknown> | null;
  error: QueryError | null;
}

/** tier1_selection_run(getPriorFinalizedCycle) chain: select→eq→not→lt→order→limit→maybeSingle. */
interface PriorRunChain {
  select: (cols: string) => PriorRunChain;
  eq: (col: string, v: unknown) => PriorRunChain;
  not: (col: string, op: string, v: unknown) => PriorRunChain;
  lt: (col: string, v: unknown) => PriorRunChain;
  order: (col: string, opts: { ascending: boolean }) => PriorRunChain;
  limit: (n: number) => PriorRunChain;
  maybeSingle: () => Promise<MaybeSingleResult>;
}

function priorRunChain(result: MaybeSingleResult): PriorRunChain {
  const chain: PriorRunChain = {
    select: () => chain,
    eq: () => chain,
    not: () => chain,
    lt: () => chain,
    order: () => chain,
    limit: () => chain,
    maybeSingle: () => Promise.resolve(result),
  };
  return chain;
}

/** tier0_candidates_150 chain: select→eq → thenable(QueryResult). select cols per-call 기록. */
interface CandidatesChain extends PromiseLike<QueryResult> {
  select: (cols: string) => CandidatesChain;
  eq: (col: string, v: unknown) => CandidatesChain;
}

function candidatesChain(
  resultBySelect: (cols: string) => QueryResult,
  selectCalls: string[],
): CandidatesChain {
  let currentCols = "";
  const chain: CandidatesChain = {
    select: (cols: string) => {
      currentCols = cols;
      selectCalls.push(cols);
      return chain;
    },
    eq: () => chain,
    then: (onFulfilled) =>
      Promise.resolve(resultBySelect(currentCols)).then(onFulfilled),
  };
  return chain;
}

function mockClient(opts: {
  prior: MaybeSingleResult;
  candidates: (cols: string) => QueryResult;
  selectCalls?: string[];
}): SupabaseClient {
  const selectCalls = opts.selectCalls ?? [];
  const from = vi.fn((table: string) => {
    if (table === "tier1_selection_run") return priorRunChain(opts.prior);
    if (table === "tier0_candidates_150") {
      return candidatesChain(opts.candidates, selectCalls);
    }
    throw new Error(`unexpected table: ${table}`);
  });
  return { from } as unknown as SupabaseClient;
}

const PRIOR_M_2026_06: MaybeSingleResult = {
  data: {
    period_key: "m:2026-06",
    track: "midlong",
    month: "2026-06",
    finalized_at: "2026-06-05T02:00:00Z",
  },
  error: null,
};

function bizDays(dates: string[]): Array<{ date: string; isBusinessDay: boolean }> {
  return dates.map((date) => ({ date, isBusinessDay: true }));
}

// ── 순수부 ─────────────────────────────────────────────────────────────────
describe("mapPriorPeriodKeyToMonth", () => {
  it("m:YYYY-MM → YYYY-MM (0047 CHECK 포맷)", () => {
    expect(mapPriorPeriodKeyToMonth("m:2026-06")).toBe("2026-06");
  });
  it("short 트랙 키(s:YYYY-MM-DD)·비정상 월 → null(fail-soft)", () => {
    expect(mapPriorPeriodKeyToMonth("s:2026-06-22")).toBeNull();
    expect(mapPriorPeriodKeyToMonth("m:2026-13")).toBeNull();
    expect(mapPriorPeriodKeyToMonth("2026-06")).toBeNull();
    expect(mapPriorPeriodKeyToMonth("")).toBeNull();
  });
});

describe("resolveMonthReturnWindow (D-4)", () => {
  // now = 2026-07-10 12:00 KST (03:00 UTC) — 6월은 완료된 과거 월.
  const NOW = new Date("2026-07-10T03:00:00Z");
  const JUNE_DAYS = bizDays(["2026-06-02", "2026-06-03", "2026-06-15", "2026-06-30"]);
  const JULY_DAYS = bizDays(["2026-07-01", "2026-07-08", "2026-07-09", "2026-07-10"]);

  it("완료 월: entry=월 첫 거래일, exit=월 말 거래일", () => {
    expect(
      resolveMonthReturnWindow("2026-06", NOW, [...JUNE_DAYS, ...JULY_DAYS]),
    ).toEqual({ entryBasDd: "20260602", exitBasDd: "20260630" });
  });

  it("진행 중 월: exit=최신 완료 거래일(월말 아님)", () => {
    // now 2026-07-10 12:00 KST(장마감 cutoff 18시 전) → 최신 완료 거래일 = 07-09.
    expect(resolveMonthReturnWindow("2026-07", NOW, JULY_DAYS)).toEqual({
      entryBasDd: "20260701",
      exitBasDd: "20260709",
    });
  });

  it("월 거래일 0개 → null", () => {
    expect(resolveMonthReturnWindow("2026-05", NOW, JULY_DAYS)).toBeNull();
  });

  it("창 미형성(entry==exit 단일 거래일) → null (무의미 0% 제안의 period UNIQUE 선점 방지)", () => {
    const now = new Date("2026-07-01T10:00:00Z"); // 07-01 19시 KST — 당일 종가 확정
    expect(
      resolveMonthReturnWindow("2026-07", now, bizDays(["2026-07-01"])),
    ).toBeNull();
  });

  it("calendar stale(최신 완료 거래일 해소 불가) → null(fail-closed)", () => {
    // businessDays가 now보다 14일 이상 과거에서 끊김 → resolveLatestCompletedTradingDay null.
    const staleNow = new Date("2026-08-30T03:00:00Z");
    expect(resolveMonthReturnWindow("2026-06", staleNow, JUNE_DAYS)).toBeNull();
  });
});

describe("buildFunnelCandidates (D-1 exposure 기저)", () => {
  const RANKED_ROWS: FunnelCandidateDbRow[] = [
    {
      ticker: "005930",
      tier0_score: 88.5,
      factor_ranks: { trend: 91.2, size: 72.4, foreign: 50, earnings: 50, quality: 50 },
    },
    {
      ticker: "000660",
      tier0_score: "87.0",
      factor_ranks: { trend: 80.1, size: 95.0, foreign: 50, earnings: 50, quality: 50 },
    },
  ];

  it("전 행 factor_ranks 유효 → per-factor exposure (champion factor 포함)", () => {
    const { candidates, exposureSource } = buildFunnelCandidates(RANKED_ROWS);
    expect(exposureSource).toBe("factor_ranks");
    expect(candidates).toHaveLength(2);
    expect(candidates[0].factorExposures.trend).toBe(91.2);
    expect(candidates[0].factorExposures.size).toBe(72.4);
  });

  it("한 행이라도 factor_ranks 결손 → 월 전체 tier0_score pseudo-factor fallback(혼합 기저 금지)", () => {
    const rows: FunnelCandidateDbRow[] = [
      RANKED_ROWS[0],
      { ticker: "035420", tier0_score: 70.5, factor_ranks: null },
    ];
    const { candidates, exposureSource } = buildFunnelCandidates(rows);
    expect(exposureSource).toBe("tier0_score_fallback");
    expect(candidates).toHaveLength(2);
    expect(candidates[0].factorExposures).toEqual({ tier0_score: 88.5 });
    expect(candidates[1].factorExposures).toEqual({ tier0_score: 70.5 });
  });

  it("champion factor(size) 누락된 factor_ranks는 무효 → fallback", () => {
    const rows: FunnelCandidateDbRow[] = [
      { ticker: "005930", tier0_score: 88.5, factor_ranks: { trend: 91.2 } },
    ];
    expect(buildFunnelCandidates(rows).exposureSource).toBe("tier0_score_fallback");
  });

  it("비-object/배열 factor_ranks는 무효 → fallback", () => {
    const rows: FunnelCandidateDbRow[] = [
      { ticker: "005930", tier0_score: 88.5, factor_ranks: [1, 2] },
    ];
    expect(buildFunnelCandidates(rows).exposureSource).toBe("tier0_score_fallback");
  });

  it("ticker dedupe(첫 행 유지) + string tier0_score 파싱 + 비수치 score 행 제외", () => {
    const rows: FunnelCandidateDbRow[] = [
      { ticker: "005930", tier0_score: 88.5 },
      { ticker: "005930", tier0_score: 1.0 },
      { ticker: "000660", tier0_score: "87.0" },
      { ticker: "035420", tier0_score: null },
    ];
    const { candidates } = buildFunnelCandidates(rows);
    expect(candidates.map((c) => c.ticker)).toEqual(["005930", "000660"]);
    expect(candidates[0].factorExposures.tier0_score).toBe(88.5);
    expect(candidates[1].factorExposures.tier0_score).toBe(87.0);
  });

  it("빈 rows → 빈 candidates(fallback)", () => {
    const { candidates, exposureSource } = buildFunnelCandidates([]);
    expect(candidates).toHaveLength(0);
    expect(exposureSource).toBe("tier0_score_fallback");
  });
});

describe("computeRealizedReturns", () => {
  it("percentage points 계산 + 결측/entry≤0 제외", () => {
    const entry = new Map([
      ["A", 100],
      ["B", 200],
      ["C", 0],
    ]);
    const exit = new Map([
      ["A", 110],
      ["C", 50],
      ["D", 999],
    ]);
    const out = computeRealizedReturns(["A", "B", "C", "D"], entry, exit);
    expect(out.get("A")).toBe(10);
    expect(out.has("B")).toBe(false); // exit 결측
    expect(out.has("C")).toBe(false); // entry ≤ 0
    expect(out.has("D")).toBe(false); // entry 결측
  });
});

// ── loadFunnelReflectionInput 조립 ─────────────────────────────────────────
describe("loadFunnelReflectionInput", () => {
  const NOW = new Date("2026-07-10T03:00:00Z");
  const CAL = bizDays([
    "2026-06-02",
    "2026-06-15",
    "2026-06-30",
    "2026-07-01",
    "2026-07-09",
    "2026-07-10",
  ]);
  const DB_ROWS: Array<Record<string, unknown>> = [
    {
      ticker: "005930",
      tier0_score: 88.5,
      factor_ranks: { trend: 91.2, size: 72.4 },
    },
    {
      ticker: "000660",
      tier0_score: 87.0,
      factor_ranks: { trend: 40.0, size: 95.0 },
    },
  ];

  it("happy path: 직전 완료 월 + factor_ranks + 실현수익 조립", async () => {
    const selectCalls: string[] = [];
    const client = mockClient({
      prior: PRIOR_M_2026_06,
      candidates: () => ({ data: DB_ROWS, error: null }),
      selectCalls,
    });
    const fetchEodPrices = vi.fn(async (tickers: readonly string[], basDd: string) => {
      const price = basDd === "20260602" ? 100 : 110;
      return new Map(tickers.map((t) => [t, price]));
    });
    const loaded = await loadFunnelReflectionInput({
      client,
      now: NOW,
      loadBusinessDays: async () => CAL,
      fetchEodPrices,
    });
    expect(loaded.input).not.toBeNull();
    expect(loaded.input?.periodKey).toBe("2026-06");
    expect(loaded.input?.championConfig).toEqual({ ...FUNNEL_CHAMPION_CONFIG });
    expect(loaded.input?.candidates).toHaveLength(2);
    expect(loaded.input?.realizedReturns.get("005930")).toBe(10);
    expect(loaded.meta.exposureSource).toBe("factor_ranks");
    expect(loaded.meta.returnWindow).toEqual({
      entryBasDd: "20260602",
      exitBasDd: "20260630",
    });
    // KRX 2 날짜 × 1콜(병합 fetch DI) = 2회.
    expect(fetchEodPrices).toHaveBeenCalledTimes(2);
    expect(selectCalls[0]).toContain("factor_ranks");
  });

  it("0050 미적용(42703) → factor_ranks 없이 재조회 + pseudo-factor fallback", async () => {
    const selectCalls: string[] = [];
    const client = mockClient({
      prior: PRIOR_M_2026_06,
      candidates: (cols) =>
        cols.includes("factor_ranks")
          ? { data: null, error: { code: "42703" } }
          : {
              data: DB_ROWS.map(({ ticker, tier0_score }) => ({ ticker, tier0_score })),
              error: null,
            },
      selectCalls,
    });
    const loaded = await loadFunnelReflectionInput({
      client,
      now: NOW,
      loadBusinessDays: async () => CAL,
      fetchEodPrices: null,
    });
    expect(selectCalls).toHaveLength(2);
    expect(loaded.input?.championConfig).toEqual({ tier0_score: 0.5 });
    expect(loaded.meta.exposureSource).toBe("tier0_score_fallback");
  });

  it("KRX 키 부재(fetchEodPrices null) → 빈 realizedReturns로도 input 조립(fail-soft)", async () => {
    const client = mockClient({
      prior: PRIOR_M_2026_06,
      candidates: () => ({ data: DB_ROWS, error: null }),
    });
    const loaded = await loadFunnelReflectionInput({
      client,
      now: NOW,
      loadBusinessDays: async () => CAL,
      fetchEodPrices: null,
    });
    expect(loaded.input).not.toBeNull();
    expect(loaded.input?.realizedReturns.size).toBe(0);
    expect(loaded.meta.returnWindow).toBeNull();
  });

  it("finalize된 midlong 사이클 없음 → input null + reason", async () => {
    const client = mockClient({
      prior: { data: null, error: null },
      candidates: () => ({ data: [], error: null }),
    });
    const loaded = await loadFunnelReflectionInput({
      client,
      now: NOW,
      loadBusinessDays: async () => CAL,
      fetchEodPrices: null,
    });
    expect(loaded.input).toBeNull();
    expect(loaded.meta.reason).toBe("no_finalized_midlong_cycle");
  });

  it("prior 사이클 period_key 매핑 불가 → input null(fail-soft)", async () => {
    const client = mockClient({
      prior: {
        data: { ...PRIOR_M_2026_06.data, period_key: "s:2026-06-22" },
        error: null,
      },
      candidates: () => ({ data: DB_ROWS, error: null }),
    });
    const loaded = await loadFunnelReflectionInput({
      client,
      now: NOW,
      loadBusinessDays: async () => CAL,
      fetchEodPrices: null,
    });
    expect(loaded.input).toBeNull();
    expect(loaded.meta.reason).toBe("unmapped_period_key:s:2026-06-22");
  });

  it("해당 월 candidates 0행 → input null + reason", async () => {
    const client = mockClient({
      prior: PRIOR_M_2026_06,
      candidates: () => ({ data: [], error: null }),
    });
    const loaded = await loadFunnelReflectionInput({
      client,
      now: NOW,
      loadBusinessDays: async () => CAL,
      fetchEodPrices: null,
    });
    expect(loaded.input).toBeNull();
    expect(loaded.meta.reason).toBe("no_tier0_candidates");
  });

  it("비-42703 query 오류 → throw 대신 input null + loader_failed(fail-soft)", async () => {
    const client = mockClient({
      prior: PRIOR_M_2026_06,
      candidates: () => ({ data: null, error: { code: "42501" } }),
    });
    const loaded = await loadFunnelReflectionInput({
      client,
      now: NOW,
      loadBusinessDays: async () => CAL,
      fetchEodPrices: null,
    });
    expect(loaded.input).toBeNull();
    expect(loaded.meta.reason).toContain("loader_failed:funnel_source_query_failed:42501");
  });

  it("가격 fetch throw → input null + loader_failed(fail-soft, throw 전파 0)", async () => {
    const client = mockClient({
      prior: PRIOR_M_2026_06,
      candidates: () => ({ data: DB_ROWS, error: null }),
    });
    const loaded = await loadFunnelReflectionInput({
      client,
      now: NOW,
      loadBusinessDays: async () => CAL,
      fetchEodPrices: async () => {
        throw new Error("krx_eod_fetch_failed:500");
      },
    });
    expect(loaded.input).toBeNull();
    expect(loaded.meta.reason).toContain("loader_failed:krx_eod_fetch_failed:500");
  });
});
