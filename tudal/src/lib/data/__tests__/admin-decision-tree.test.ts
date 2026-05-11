import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getDecisionTreeSnapshot,
} from "@/lib/data/admin-decision-tree";
import type { PortfolioSnapshotRow } from "@/lib/data/admin-performance";

// ---------------------------------------------------------------------------
// Supabase chain mock — feedback_test_mock_typing.md 패턴 준수.
// any/eslint-disable 금지 → 명시적 SelectChain/QueryResult 인터페이스 정의.
// admin-performance.test.ts와 동일 패턴(thenable PromiseLike).
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: mocks.from,
  })),
}));

interface QueryResult {
  data: unknown;
  error: unknown;
}

// SELECT chain with thenable terminal: select().is().order() → await → QueryResult
interface SelectChain extends PromiseLike<QueryResult> {
  select: (columns: string) => SelectChain;
  is: (column: string, value: null | boolean) => SelectChain;
  eq: (column: string, value: string | number | boolean) => SelectChain;
  order: (
    column: string,
    options?: { ascending: boolean },
  ) => SelectChain;
}

function makeSelectChain(terminal: QueryResult): SelectChain {
  const builder = {} as SelectChain;
  builder.select = vi.fn(() => builder);
  builder.is = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
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
// fixtures
// ---------------------------------------------------------------------------

// 단일 월 — 모든 게이트 통과(○)를 만들기 위한 행 묶음.
// alpha = 0.02 (>=0 통과), sharpe ≈ 충분히 큼, mdd = 0 (drawdown 없음).
function rowsSingleMonthAllPass(): PortfolioSnapshotRow[] {
  return [
    {
      id: "p-1",
      date: "2026-04-01",
      month: "2026-04-01",
      ticker: null,
      entry_price: null,
      current_price: null,
      weight: "1.0",
      is_cash: false,
      daily_return: 0.005,
      total_return: 0.005,
      kospi_return: 0.001,
      alpha: 0.02,
      sharpe: 0,
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
      daily_return: 0.006,
      total_return: 0.011,
      kospi_return: 0.003,
      alpha: 0.02,
      sharpe: 0,
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
      daily_return: 0.007,
      total_return: 0.018,
      kospi_return: 0.005,
      alpha: 0.02,
      sharpe: 0,
    },
  ];
}

// 두 번째 월 — MDD가 -0.20으로 임계값(-0.15)을 깬다 → ✕.
// 1.0 → 1.10 (+10%) → 0.88 (1.10 * 0.80, -20% drawdown) 으로 setup.
function rowsTwoMonthsSecondFailsMdd(): PortfolioSnapshotRow[] {
  return [
    // ── 월 1 (2026-03): ○ — alpha=0.02, drawdown 없음
    {
      id: "m1-1",
      date: "2026-03-01",
      month: "2026-03-01",
      ticker: null,
      entry_price: null,
      current_price: null,
      weight: "1.0",
      is_cash: false,
      daily_return: 0.005,
      total_return: 0.005,
      kospi_return: 0.001,
      alpha: 0.02,
      sharpe: 0,
    },
    {
      id: "m1-2",
      date: "2026-03-02",
      month: "2026-03-01",
      ticker: null,
      entry_price: null,
      current_price: null,
      weight: "1.0",
      is_cash: false,
      daily_return: 0.006,
      total_return: 0.011,
      kospi_return: 0.003,
      alpha: 0.02,
      sharpe: 0,
    },
    {
      id: "m1-3",
      date: "2026-03-03",
      month: "2026-03-01",
      ticker: null,
      entry_price: null,
      current_price: null,
      weight: "1.0",
      is_cash: false,
      daily_return: 0.007,
      total_return: 0.018,
      kospi_return: 0.005,
      alpha: 0.02,
      sharpe: 0,
    },
    // ── 월 2 (2026-04): ✕ — drawdown -20% (1.0 → 1.10 → 0.88)
    {
      id: "m2-1",
      date: "2026-04-01",
      month: "2026-04-01",
      ticker: null,
      entry_price: null,
      current_price: null,
      weight: "1.0",
      is_cash: false,
      daily_return: 0.10, // 1.0 → 1.10 (peak)
      total_return: 0.119,
      kospi_return: 0.005,
      alpha: 0.02,
      sharpe: 0,
    },
    {
      id: "m2-2",
      date: "2026-04-02",
      month: "2026-04-01",
      ticker: null,
      entry_price: null,
      current_price: null,
      weight: "1.0",
      is_cash: false,
      daily_return: -0.20, // 1.10 → 0.88, drawdown = (0.88-1.10)/1.10 = -0.20 → fail
      total_return: -0.105,
      kospi_return: 0.005,
      alpha: 0.02,
      sharpe: 0,
    },
  ];
}

// ---------------------------------------------------------------------------
// getDecisionTreeSnapshot
// ---------------------------------------------------------------------------

describe("getDecisionTreeSnapshot", () => {
  it("returns null when DB has no portfolio rows (empty array)", async () => {
    const chain = makeSelectChain({ data: [], error: null });
    mocks.from.mockReturnValue({ select: chain.select });

    const result = await getDecisionTreeSnapshot();

    expect(mocks.from).toHaveBeenCalledWith("portfolio_snapshot");
    expect(chain.is).toHaveBeenCalledWith("ticker", null);
    expect(chain.eq).toHaveBeenCalledWith("is_cash", false);
    expect(result).toBeNull();
  });

  it("returns null when DB returns null data", async () => {
    const chain = makeSelectChain({ data: null, error: null });
    mocks.from.mockReturnValue({ select: chain.select });

    const result = await getDecisionTreeSnapshot();
    expect(result).toBeNull();
  });

  it("throws when supabase returns an error", async () => {
    const chain = makeSelectChain({
      data: null,
      error: { message: "rls denied" },
    });
    mocks.from.mockReturnValue({ select: chain.select });

    await expect(getDecisionTreeSnapshot()).rejects.toThrow(/decision_tree/);
  });

  it("returns ○ verdict for a single month where all gates pass", async () => {
    const rows = rowsSingleMonthAllPass();
    const chain = makeSelectChain({ data: rows, error: null });
    mocks.from.mockReturnValue({ select: chain.select });

    const result = await getDecisionTreeSnapshot();

    expect(result).not.toBeNull();
    if (!result) return; // type guard
    expect(result.monthlyHistory).toHaveLength(1);
    expect(result.monthlyHistory[0].month).toBe("2026-04-01");
    expect(result.monthlyHistory[0].alpha).toBeCloseTo(0.013);
    // mdd = 0 (drawdown 없음, 우상향만) → 통과; sharpe도 양수의 일관 수익률로 통과
    expect(result.monthlyHistory[0].mdd).toBe(0);
    expect(result.monthlyHistory[0].verdict).toBe("○");
    expect(result.monthlyVerdicts).toEqual(["○"]);
  });

  it("chains verdicts ○ → ✕ when second month's MDD breaks the gate", async () => {
    const rows = rowsTwoMonthsSecondFailsMdd();
    const chain = makeSelectChain({ data: rows, error: null });
    mocks.from.mockReturnValue({ select: chain.select });

    const result = await getDecisionTreeSnapshot();

    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.monthlyHistory).toHaveLength(2);
    expect(result.monthlyHistory[0].month).toBe("2026-03-01");
    expect(result.monthlyHistory[0].verdict).toBe("○");
    expect(result.monthlyHistory[1].month).toBe("2026-04-01");
    // MDD ≈ -0.20 < -0.15 → fail; 가벼운 sharpe 추가 fail 가능 → ✕
    expect(result.monthlyHistory[1].mdd).toBeLessThan(-0.15);
    expect(result.monthlyHistory[1].verdict).toBe("✕");
    expect(result.monthlyVerdicts).toEqual(["○", "✕"]);
  });

  it("uses month-over-month alpha for monthly verdicts instead of cumulative alpha", async () => {
    const rows: PortfolioSnapshotRow[] = [
      {
        id: "a-1",
        date: "2026-03-01",
        month: "2026-03-01",
        ticker: null,
        entry_price: null,
        current_price: null,
        weight: "1.0",
        is_cash: false,
        daily_return: 0.005,
        total_return: 0.05,
        kospi_return: 0.01,
        alpha: 0.10,
        sharpe: 0,
      },
      {
        id: "a-2",
        date: "2026-03-02",
        month: "2026-03-01",
        ticker: null,
        entry_price: null,
        current_price: null,
        weight: "1.0",
        is_cash: false,
        daily_return: 0.006,
        total_return: 0.10,
        kospi_return: 0.02,
        alpha: 0.10,
        sharpe: 0,
      },
      {
        id: "a-3",
        date: "2026-04-01",
        month: "2026-04-01",
        ticker: null,
        entry_price: null,
        current_price: null,
        weight: "1.0",
        is_cash: false,
        daily_return: 0.005,
        total_return: 0.11,
        kospi_return: 0.08,
        alpha: 0.02,
        sharpe: 0,
      },
      {
        id: "a-4",
        date: "2026-04-02",
        month: "2026-04-01",
        ticker: null,
        entry_price: null,
        current_price: null,
        weight: "1.0",
        is_cash: false,
        daily_return: 0.006,
        total_return: 0.12,
        kospi_return: 0.12,
        alpha: 0.02,
        sharpe: 0,
      },
    ];
    const chain = makeSelectChain({ data: rows, error: null });
    mocks.from.mockReturnValue({ select: chain.select });

    const result = await getDecisionTreeSnapshot();

    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.monthlyHistory[1].alpha).toBeCloseTo(-0.08);
    expect(result.monthlyHistory[1].verdict).toBe("△");
    expect(result.monthlyVerdicts).toEqual(["○", "△"]);
  });

  it("cumulativeAlpha matches the alpha of the last row", async () => {
    const rows: PortfolioSnapshotRow[] = [
      {
        id: "c-1",
        date: "2026-03-01",
        month: "2026-03-01",
        ticker: null,
        entry_price: null,
        current_price: null,
        weight: "1.0",
        is_cash: false,
        daily_return: 0.005,
        total_return: 0.005,
        kospi_return: 0.001,
        alpha: 0.01,
        sharpe: 0,
      },
      {
        id: "c-2",
        date: "2026-04-15",
        month: "2026-04-01",
        ticker: null,
        entry_price: null,
        current_price: null,
        weight: "1.0",
        is_cash: false,
        daily_return: 0.006,
        total_return: 0.011,
        kospi_return: 0.003,
        alpha: 0.042, // last row → cumulativeAlpha
        sharpe: 0,
      },
    ];
    const chain = makeSelectChain({ data: rows, error: null });
    mocks.from.mockReturnValue({ select: chain.select });

    const result = await getDecisionTreeSnapshot();

    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.cumulativeAlpha).toBeCloseTo(0.042);
  });
});
