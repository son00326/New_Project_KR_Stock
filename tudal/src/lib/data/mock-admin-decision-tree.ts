import type { DecisionVerdict } from "@/lib/performance/judge";

export interface MonthlyDecisionRow {
  month: string; // '2026-02'
  alpha: number;  // decimal (e.g., 0.022 = +2.2%)
  sharpe: number;
  mdd: number;    // negative decimal (e.g., -0.05)
  verdict: DecisionVerdict;
}

export interface DecisionTreeSnapshot {
  cumulativeAlpha: number;
  cumulativeSharpe: number;
  cumulativeMdd: number;      // negative
  monthlyHistory: MonthlyDecisionRow[]; // chronological
  monthlyVerdicts: Array<'○' | '△' | '✕'>; // for computeCapMonths (chronological, trailing ○s = streak)
}

export const MOCK_DECISION_TREE_SNAPSHOT: DecisionTreeSnapshot = {
  cumulativeAlpha: 0.042,
  cumulativeSharpe: 0.82,
  cumulativeMdd: -0.08,
  monthlyHistory: [
    { month: '2026-02', alpha: 0.018, sharpe: 0.6,  mdd: -0.05, verdict: '○' },
    { month: '2026-03', alpha: 0.012, sharpe: 0.55, mdd: -0.07, verdict: '○' },
    { month: '2026-04', alpha: 0.012, sharpe: 0.7,  mdd: -0.08, verdict: '○' },
  ],
  monthlyVerdicts: ['○', '○', '○'],
};
