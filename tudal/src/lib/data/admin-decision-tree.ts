// ---------------------------------------------------------------------------
// admin-decision-tree.ts — T7e.6 Decision Tree snapshot via Supabase.
// portfolio_snapshot의 ticker IS NULL (포트 전체) 행 시계열 → groupByMonth →
// computeSharpeRatio / computeMaxDrawdown → judgeDecisionTree → MonthlyDecisionRow[].
// 시드 부재 = null (UI는 게이지 0%/빈 상태로 일관 동작).
// currentCapMonths는 페이지에서 computeCapMonths(monthlyVerdicts) 호출.
//
// NOTE: groupByMonth / computeCumulativeValues 는 admin-performance.ts와 로직이
// 유사하지만 의도적으로 별도 구현. 두 모듈을 독립으로 유지(공유 helper로 옮길지는
// T7e.6 외부의 후속 리팩터로 판단).
// ---------------------------------------------------------------------------

import { createClient } from "@/lib/supabase/server";
import {
  COLUMNS,
  transformSnapshotRow,
  type PortfolioSnapshotRow,
} from "@/lib/data/admin-performance";
import { computeMaxDrawdown } from "@/lib/performance/mdd";
import { computeSharpeRatio } from "@/lib/performance/sharpe";
import {
  judgeDecisionTree,
  type DecisionVerdict,
} from "@/lib/performance/judge";
import type { PortfolioSnapshot } from "@/types/admin";

export interface MonthlyDecisionRow {
  month: string;
  alpha: number;
  sharpe: number;
  mdd: number;
  verdict: DecisionVerdict;
}

export interface DecisionTreeSnapshot {
  cumulativeAlpha: number;
  cumulativeSharpe: number;
  cumulativeMdd: number;
  monthlyHistory: MonthlyDecisionRow[];
  monthlyVerdicts: DecisionVerdict[];
}

export async function getDecisionTreeSnapshot(): Promise<DecisionTreeSnapshot | null> {
  const client = await createClient();
  const { data, error } = await client
    .from("portfolio_snapshot")
    .select(COLUMNS)
    .is("ticker", null)
    .eq("is_cash", false)
    .order("date", { ascending: true });

  if (error) {
    throw new Error(
      `decision_tree query failed: ${error.message ?? "unknown"}`,
    );
  }
  if (!data || (Array.isArray(data) && data.length === 0)) return null;

  const rows = (data as PortfolioSnapshotRow[]).map(transformSnapshotRow);
  if (rows.length === 0) return null;

  const monthly = groupByMonth(rows);
  let prevTotalReturn = 0;
  let prevKospiReturn = 0;
  const monthlyHistory: MonthlyDecisionRow[] = monthly.map((g) => {
    const dailyReturns = g.rows.map((r) => r.dailyReturn);
    const cumulativeValues = computeCumulativeValues(g.rows);
    const last = g.rows[g.rows.length - 1];
    const portfolioReturn = last.totalReturn - prevTotalReturn;
    const kospiReturn = last.kospiReturn - prevKospiReturn;
    const alpha = portfolioReturn - kospiReturn;
    const sharpe = computeSharpeRatio(dailyReturns);
    const mdd = computeMaxDrawdown(cumulativeValues);
    const verdict = judgeDecisionTree({
      alpha,
      sharpe,
      mdd,
    }).overall;
    prevTotalReturn = last.totalReturn;
    prevKospiReturn = last.kospiReturn;
    return { month: g.month, alpha, sharpe, mdd, verdict };
  });

  const last = rows[rows.length - 1];
  const dailyReturns = rows.map((r) => r.dailyReturn);
  const cumulativeValues = computeCumulativeValues(rows);

  return {
    cumulativeAlpha: last.alpha,
    cumulativeSharpe: computeSharpeRatio(dailyReturns),
    cumulativeMdd: computeMaxDrawdown(cumulativeValues),
    monthlyHistory,
    monthlyVerdicts: monthlyHistory.map((m) => m.verdict),
  };
}

// ---------------------------------------------------------------------------
// 내부 helpers
// ---------------------------------------------------------------------------

function groupByMonth(
  rows: PortfolioSnapshot[],
): { month: string; rows: PortfolioSnapshot[] }[] {
  const map = new Map<string, PortfolioSnapshot[]>();
  for (const r of rows) {
    const list = map.get(r.month);
    if (list) list.push(r);
    else map.set(r.month, [r]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([month, monthRows]) => ({ month, rows: monthRows }));
}

function computeCumulativeValues(rows: PortfolioSnapshot[]): number[] {
  const out: number[] = [];
  let cur = 1;
  for (const r of rows) {
    cur = cur * (1 + r.dailyReturn);
    out.push(cur);
  }
  return out;
}
