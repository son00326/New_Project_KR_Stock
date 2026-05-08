import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  insertPortfolioSnapshots,
  transformPortfolioSnapshotRow,
  type NewPortfolioSnapshot,
  type PortfolioSnapshotDbRow,
} from "@/lib/data/admin-snapshots";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: mocks.from,
  })),
}));

const baseRow: PortfolioSnapshotDbRow = {
  id: "33333333-3333-3333-3333-333333333333",
  date: "2026-04-03",
  month: "2026-04-01",
  ticker: "005930",
  entry_price: "75000.0000",
  current_price: "76000.0000",
  weight: "0.0500",
  is_cash: false,
  daily_return: "0.013333",
  total_return: "0.013333",
  kospi_return: "0.001000",
  alpha: "0.012333",
  sharpe: "0.500000",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.from.mockReturnValue({ insert: mocks.insert });
  mocks.insert.mockResolvedValue({ error: null });
});

describe("transformPortfolioSnapshotRow", () => {
  it("maps numeric DB strings to PortfolioSnapshot numbers", () => {
    const snapshot = transformPortfolioSnapshotRow(baseRow);

    expect(snapshot.id).toBe(baseRow.id);
    expect(snapshot.ticker).toBe("005930");
    expect(snapshot.entryPrice).toBe(75000);
    expect(snapshot.currentPrice).toBe(76000);
    expect(snapshot.weight).toBe(0.05);
    expect(snapshot.alpha).toBe(0.012333);
  });
});

describe("insertPortfolioSnapshots", () => {
  it("inserts snapshot rows with snake_case columns and DB-generated ids", async () => {
    const rows: NewPortfolioSnapshot[] = [
      {
        date: "2026-04-03",
        month: "2026-04-01",
        ticker: "005930",
        entryPrice: 75000,
        currentPrice: 75000,
        weight: 0.05,
        isCash: false,
        dailyReturn: 0,
        totalReturn: 0,
        kospiReturn: 0,
        alpha: 0,
        sharpe: 0,
      },
    ];

    await insertPortfolioSnapshots(rows);

    expect(mocks.from).toHaveBeenCalledWith("portfolio_snapshot");
    expect(mocks.insert).toHaveBeenCalledWith([
      {
        date: "2026-04-03",
        month: "2026-04-01",
        ticker: "005930",
        entry_price: 75000,
        current_price: 75000,
        weight: 0.05,
        is_cash: false,
        daily_return: 0,
        total_return: 0,
        kospi_return: 0,
        alpha: 0,
        sharpe: 0,
      },
    ]);
  });
});
