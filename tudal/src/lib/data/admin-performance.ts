// ---------------------------------------------------------------------------
// admin-performance.ts — portfolio_snapshot 읽기 + 성능 집계 (T7e.6).
// Task 2: DB row 타입 + transformer + COLUMNS.
// Task 3에서 getPerformanceSummary / monthly / bucket / counterfactual 추가.
// ---------------------------------------------------------------------------

import type { PortfolioSnapshot } from "@/types/admin";

export interface PortfolioSnapshotRow {
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

// 주의: 이 문자열은 PortfolioSnapshotRow 인터페이스와 1:1 동기 — 둘 중 하나가 바뀌면 다른 하나도 갱신.
export const COLUMNS =
  "id, date, month, ticker, entry_price, current_price, weight, is_cash, daily_return, total_return, kospi_return, alpha, sharpe";

function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

export function transformSnapshotRow(row: PortfolioSnapshotRow): PortfolioSnapshot {
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
