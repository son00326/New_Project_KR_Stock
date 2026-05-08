import { describe, expect, it } from "vitest";
import {
  transformSnapshotRow,
  type PortfolioSnapshotRow,
} from "@/lib/data/admin-performance";

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
