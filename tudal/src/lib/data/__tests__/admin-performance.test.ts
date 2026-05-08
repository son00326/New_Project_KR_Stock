import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getBucketPerformance,
  getCounterfactual,
  getMonthlyPerformance,
  getPerformanceSummary,
  transformSnapshotRow,
  type PortfolioSnapshotRow,
} from "@/lib/data/admin-performance";
import { computeMaxDrawdown } from "@/lib/performance/mdd";
import { computeSharpeRatio } from "@/lib/performance/sharpe";

// ---------------------------------------------------------------------------
// Supabase chain mock — feedback_test_mock_typing.md 패턴 준수.
// any/eslint-disable 금지 → 명시적 SelectChain/QueryResult 인터페이스 정의.
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: mocks.from,
  })),
}));

vi.mock("@/lib/data/admin-shortlist", () => ({
  getActiveShortList: vi.fn(),
}));

import { getActiveShortList } from "@/lib/data/admin-shortlist";
import type { ShortListItem } from "@/types/admin";

interface QueryResult {
  data: unknown;
  error: unknown;
}

// SELECT chain with a thenable terminal: select().eq().order().order() → await → QueryResult
// Supabase의 PostgrestFilterBuilder는 thenable이라 await만으로 종결 가능.
interface SelectChain extends PromiseLike<QueryResult> {
  select: (columns: string) => SelectChain;
  eq: (column: string, value: string | number | boolean) => SelectChain;
  is: (column: string, value: null | boolean) => SelectChain;
  not: (column: string, op: string, value: null | boolean) => SelectChain;
  order: (
    column: string,
    options?: { ascending: boolean },
  ) => SelectChain;
}

function makeSelectChain(terminal: QueryResult): SelectChain {
  const builder = {} as SelectChain;
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.is = vi.fn(() => builder);
  builder.not = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.then = ((onFulfilled, onRejected) =>
    Promise.resolve(terminal).then(
      onFulfilled,
      onRejected,
    )) as PromiseLike<QueryResult>["then"];
  return builder;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// transformSnapshotRow (Task 2 — 회귀 보존)
// ---------------------------------------------------------------------------

describe("transformSnapshotRow", () => {
  it("maps numeric strings to numbers", () => {
    const row: PortfolioSnapshotRow = {
      id: "snap-1",
      date: "2026-04-15",
      month: "2026-04-01",
      ticker: "005930",
      entry_price: "70000",
      current_price: "71500",
      weight: "0.05",
      is_cash: false,
      daily_return: "0.003",
      total_return: "0.021",
      kospi_return: "0.012",
      alpha: "0.009",
      sharpe: "0.65",
    };
    const out = transformSnapshotRow(row);
    expect(out.entryPrice).toBe(70000);
    expect(out.currentPrice).toBe(71500);
    expect(out.weight).toBeCloseTo(0.05);
    expect(out.totalReturn).toBeCloseTo(0.021);
  });

  it("treats nulls as 0", () => {
    const row: PortfolioSnapshotRow = {
      id: "snap-cash",
      date: "2026-04-15",
      month: "2026-04-01",
      ticker: null,
      entry_price: null,
      current_price: null,
      weight: "1.0",
      is_cash: true,
      daily_return: null,
      total_return: null,
      kospi_return: null,
      alpha: null,
      sharpe: null,
    };
    const out = transformSnapshotRow(row);
    expect(out.entryPrice).toBe(0);
    expect(out.alpha).toBe(0);
    expect(out.isCash).toBe(true);
  });

  it("returns 0 for NaN/invalid numeric strings", () => {
    const row: PortfolioSnapshotRow = {
      id: "snap-2",
      date: "2026-04-15",
      month: "2026-04-01",
      ticker: "005930",
      entry_price: "abc",
      current_price: "NaN",
      weight: "0.05",
      is_cash: false,
      daily_return: 0,
      total_return: 0,
      kospi_return: 0,
      alpha: "abc",
      sharpe: "NaN",
    };
    const out = transformSnapshotRow(row);
    expect(out.entryPrice).toBe(0);
    expect(out.currentPrice).toBe(0);
    expect(out.alpha).toBe(0);
    expect(out.sharpe).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getPerformanceSummary
// ---------------------------------------------------------------------------

describe("getPerformanceSummary", () => {
  it("returns null when DB has no portfolio rows", async () => {
    const chain = makeSelectChain({ data: [], error: null });
    mocks.from.mockReturnValue({ select: chain.select });

    const result = await getPerformanceSummary();

    expect(mocks.from).toHaveBeenCalledWith("portfolio_snapshot");
    expect(result).toBeNull();
  });

  it("computes cumulativeReturn/sharpe/mdd from chronological rows", async () => {
    const rows: PortfolioSnapshotRow[] = [
      {
        id: "p-1",
        date: "2026-04-01",
        month: "2026-04-01",
        ticker: null,
        entry_price: null,
        current_price: null,
        weight: "1.0",
        is_cash: false,
        daily_return: 0.01,
        total_return: 0.01,
        kospi_return: 0.005,
        alpha: 0.005,
        sharpe: 0.5,
      },
      {
        id: "p-2",
        date: "2026-04-02",
        month: "2026-04-01",
        ticker: null,
        entry_price: null,
        current_price: null,
        weight: "1.0",
        is_cash: false,
        daily_return: -0.005,
        total_return: 0.005,
        kospi_return: 0.002,
        alpha: 0.003,
        sharpe: 0.4,
      },
      {
        id: "p-3",
        date: "2026-04-03",
        month: "2026-04-01",
        ticker: null,
        entry_price: null,
        current_price: null,
        weight: "1.0",
        is_cash: false,
        daily_return: 0.008,
        total_return: 0.013,
        kospi_return: 0.007,
        alpha: 0.006,
        sharpe: 0.6,
      },
    ];
    const chain = makeSelectChain({ data: rows, error: null });
    mocks.from.mockReturnValue({ select: chain.select });

    const result = await getPerformanceSummary();

    expect(result).not.toBeNull();
    if (!result) return; // 타입 가드
    expect(result.cumulativeReturn).toBeCloseTo(0.013);
    expect(result.cumulativeKospi).toBeCloseTo(0.007);
    expect(result.cumulativeAlpha).toBeCloseTo(0.006);

    const expectedDailyReturns = [0.01, -0.005, 0.008];
    expect(result.dailyReturns).toEqual(expectedDailyReturns);

    const expectedCumValues = [1.0 * 1.01, 1.01 * 0.995, 1.01 * 0.995 * 1.008];
    expect(result.cumulativeValues[0]).toBeCloseTo(expectedCumValues[0]);
    expect(result.cumulativeValues[2]).toBeCloseTo(expectedCumValues[2]);
    expect(result.cumulativeSharpe).toBeCloseTo(
      computeSharpeRatio(expectedDailyReturns),
    );
    expect(result.cumulativeMdd).toBeCloseTo(
      computeMaxDrawdown(expectedCumValues),
    );
    // currentCapMonths는 Task 4에서 wired; 현재는 0.
    expect(result.currentCapMonths).toBe(0);
  });

  it("throws when supabase returns an error", async () => {
    const chain = makeSelectChain({
      data: null,
      error: { message: "rls denied" },
    });
    mocks.from.mockReturnValue({ select: chain.select });

    await expect(getPerformanceSummary()).rejects.toThrow(/portfolio_snapshot/);
  });
});

// ---------------------------------------------------------------------------
// getMonthlyPerformance
// ---------------------------------------------------------------------------

describe("getMonthlyPerformance", () => {
  it("returns empty array when DB has no portfolio rows", async () => {
    const chain = makeSelectChain({ data: [], error: null });
    mocks.from.mockReturnValue({ select: chain.select });

    const result = await getMonthlyPerformance();
    expect(result).toEqual([]);
  });

  it("chains monthly returns and tracks capStreak across pass→fail", async () => {
    // 월 1 (2026-03): alpha 양수, sharpe 충분, mdd 작음 → ○
    // 월 2 (2026-04): alpha 음수 → ✕ (capStreak reset to 0)
    const rows: PortfolioSnapshotRow[] = [
      // 월 1 — daily returns로 sharpe ≈ 충분히 양수
      {
        id: "m1-1",
        date: "2026-03-01",
        month: "2026-03-01",
        ticker: null,
        entry_price: null,
        current_price: null,
        weight: "1.0",
        is_cash: false,
        daily_return: 0.02,
        total_return: 0.02,
        kospi_return: 0.005,
        alpha: 0.015,
        sharpe: 1.5,
      },
      {
        id: "m1-2",
        date: "2026-03-15",
        month: "2026-03-01",
        ticker: null,
        entry_price: null,
        current_price: null,
        weight: "1.0",
        is_cash: false,
        daily_return: 0.025,
        total_return: 0.045,
        kospi_return: 0.01,
        alpha: 0.035,
        sharpe: 1.8,
      },
      // 월 2 — total_return 후퇴 → portfolioReturn 음수 → alpha 음수 → ✕
      {
        id: "m2-1",
        date: "2026-04-01",
        month: "2026-04-01",
        ticker: null,
        entry_price: null,
        current_price: null,
        weight: "1.0",
        is_cash: false,
        daily_return: -0.01,
        total_return: 0.035,
        kospi_return: 0.02,
        alpha: 0.015,
        sharpe: 1.0,
      },
      {
        id: "m2-2",
        date: "2026-04-15",
        month: "2026-04-01",
        ticker: null,
        entry_price: null,
        current_price: null,
        weight: "1.0",
        is_cash: false,
        daily_return: -0.005,
        total_return: 0.030,
        kospi_return: 0.04,
        alpha: -0.01,
        sharpe: 0.8,
      },
    ];
    const chain = makeSelectChain({ data: rows, error: null });
    mocks.from.mockReturnValue({ select: chain.select });

    const result = await getMonthlyPerformance();

    expect(result).toHaveLength(2);
    expect(result[0].month).toBe("2026-03-01");
    expect(result[0].portfolioReturn).toBeCloseTo(0.045);
    expect(result[0].kospiReturn).toBeCloseTo(0.01);
    expect(result[0].alpha).toBeCloseTo(0.035);
    expect(result[0].capStreak).toBe(1);

    expect(result[1].month).toBe("2026-04-01");
    expect(result[1].portfolioReturn).toBeCloseTo(0.030 - 0.045);
    expect(result[1].kospiReturn).toBeCloseTo(0.04 - 0.01);
    // alpha = portfolioReturn - kospiReturn = -0.015 - 0.030 = -0.045 → ✕
    expect(result[1].alpha).toBeCloseTo(-0.045);
    expect(result[1].capStreak).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getBucketPerformance
// ---------------------------------------------------------------------------

describe("getBucketPerformance", () => {
  it("returns empty array when no per-ticker rows exist", async () => {
    const chain = makeSelectChain({ data: [], error: null });
    mocks.from.mockReturnValue({ select: chain.select });

    const result = await getBucketPerformance();
    expect(result).toEqual([]);
  });

  it("aggregates ticker rows into bucket rows with correct tickerCount", async () => {
    const tickerRows: PortfolioSnapshotRow[] = [
      // short bucket — A
      {
        id: "t-a-1",
        date: "2026-04-01",
        month: "2026-04-01",
        ticker: "AAA",
        entry_price: "100",
        current_price: "102",
        weight: "0.05",
        is_cash: false,
        daily_return: 0.01,
        total_return: 0.05,
        kospi_return: 0.01,
        alpha: 0.04,
        sharpe: 0.7,
      },
      // mid bucket — B
      {
        id: "t-b-1",
        date: "2026-04-01",
        month: "2026-04-01",
        ticker: "BBB",
        entry_price: "200",
        current_price: "210",
        weight: "0.10",
        is_cash: false,
        daily_return: 0.005,
        total_return: 0.08,
        kospi_return: 0.01,
        alpha: 0.07,
        sharpe: 0.9,
      },
    ];

    const shortlist: ShortListItem[] = [
      {
        id: "sl-aaa",
        month: "2026-04-01",
        ticker: "AAA",
        name: "AAA",
        sector: "미분류",
        bucket: "short",
        rank: 1,
        compositeScore: 80,
        trendScore: 70,
        momentumScore: 75,
        volatilityScore: 65,
        divergencePct: 0,
        sparkline7d: [],
        signalLabel: "",
        deltaStatus: "hold",
        deltaReason: "",
        summary3Line: "",
        suggestedWeight: 0.05,
        createdAt: "2026-04-01T00:00:00Z",
      },
      {
        id: "sl-bbb",
        month: "2026-04-01",
        ticker: "BBB",
        name: "BBB",
        sector: "미분류",
        bucket: "mid",
        rank: 1,
        compositeScore: 85,
        trendScore: 80,
        momentumScore: 80,
        volatilityScore: 70,
        divergencePct: 0,
        sparkline7d: [],
        signalLabel: "",
        deltaStatus: "hold",
        deltaReason: "",
        summary3Line: "",
        suggestedWeight: 0.10,
        createdAt: "2026-04-01T00:00:00Z",
      },
    ];

    const chain = makeSelectChain({ data: tickerRows, error: null });
    mocks.from.mockReturnValue({ select: chain.select });
    vi.mocked(getActiveShortList).mockResolvedValue(shortlist);

    const result = await getBucketPerformance();

    const short = result.find((r) => r.bucket === "short");
    const mid = result.find((r) => r.bucket === "mid");
    const long = result.find((r) => r.bucket === "long");

    expect(short?.tickerCount).toBe(1);
    expect(mid?.tickerCount).toBe(1);
    expect(long?.tickerCount).toBe(0);
    expect(short?.cumulativeReturn).toBeCloseTo(0.05);
    expect(mid?.cumulativeReturn).toBeCloseTo(0.08);
    expect(short?.sharpe).toBeCloseTo(0.7);
    expect(mid?.sharpe).toBeCloseTo(0.9);
  });
});

// ---------------------------------------------------------------------------
// getCounterfactual
// ---------------------------------------------------------------------------

describe("getCounterfactual", () => {
  it("returns null until D11/S9 captures AI-weight time series", async () => {
    const result = await getCounterfactual();
    expect(result).toBeNull();
  });
});
