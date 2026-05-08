import { createClient } from "@/lib/supabase/server";
import type { PortfolioSnapshot } from "@/types/admin";

// ---------------------------------------------------------------------------
// portfolio_snapshot (E5) — Supabase 실 I/O (T7e.4).
// Accept 확정 시 Day 0 가상 포트 스냅샷을 INSERT한다.
// ---------------------------------------------------------------------------

export interface PortfolioSnapshotDbRow {
  id: string;
  date: string;
  month: string;
  ticker: string | null;
  entry_price: string | number | null;
  current_price: string | number | null;
  weight: string | number | null;
  is_cash: boolean;
  daily_return: string | number | null;
  total_return: string | number | null;
  kospi_return: string | number | null;
  alpha: string | number | null;
  sharpe: string | number | null;
}

export type NewPortfolioSnapshot = Omit<PortfolioSnapshot, "id">;

function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

export function transformPortfolioSnapshotRow(
  row: PortfolioSnapshotDbRow,
): PortfolioSnapshot {
  return {
    id: row.id,
    date: row.date,
    month: row.month,
    ticker: row.ticker,
    entryPrice: num(row.entry_price),
    currentPrice: num(row.current_price),
    weight: num(row.weight),
    isCash: row.is_cash,
    dailyReturn: num(row.daily_return),
    totalReturn: num(row.total_return),
    kospiReturn: num(row.kospi_return),
    alpha: num(row.alpha),
    sharpe: num(row.sharpe),
  };
}

function toInsertPayload(row: NewPortfolioSnapshot) {
  return {
    date: row.date,
    month: row.month,
    ticker: row.ticker,
    entry_price: row.entryPrice,
    current_price: row.currentPrice,
    weight: row.weight,
    is_cash: row.isCash,
    daily_return: row.dailyReturn,
    total_return: row.totalReturn,
    kospi_return: row.kospiReturn,
    alpha: row.alpha,
    sharpe: row.sharpe,
  };
}

export async function insertPortfolioSnapshots(
  snapshots: NewPortfolioSnapshot[],
): Promise<void> {
  if (snapshots.length === 0) return;

  const client = await createClient();
  const { error } = await client
    .from("portfolio_snapshot")
    .insert(snapshots.map(toInsertPayload));

  if (error) throw error;
}
