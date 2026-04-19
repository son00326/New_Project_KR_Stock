"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

export interface TrendPoint {
  month: string;
  alpha: number;
  sharpe: number;
  mdd: number;
}

export function DecisionTreeTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip formatter={(v: unknown) => (typeof v === "number" ? v.toFixed(3) : String(v))} />
        <Legend />
        <Line
          type="monotone"
          dataKey="alpha"
          stroke="var(--chart-1)"
          strokeWidth={2}
          name="Alpha"
        />
        <Line
          type="monotone"
          dataKey="sharpe"
          stroke="var(--chart-2)"
          strokeWidth={2}
          name="Sharpe"
        />
        <Line
          type="monotone"
          dataKey="mdd"
          stroke="var(--chart-3)"
          strokeWidth={2}
          name="MDD"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
