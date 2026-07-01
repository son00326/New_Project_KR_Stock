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
import {
  chartColor,
  CHART_GRID,
  CHART_AXIS,
  CHART_LABEL,
} from "@/lib/chart-colors";

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
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
        <XAxis dataKey="month" stroke={CHART_AXIS} tick={{ fill: CHART_AXIS, fontSize: 12 }} />
        <YAxis stroke={CHART_AXIS} tick={{ fill: CHART_AXIS, fontSize: 12 }} />
        <Tooltip
          formatter={(v: unknown) => (typeof v === "number" ? v.toFixed(3) : String(v))}
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            color: CHART_LABEL,
            fontSize: 12,
          }}
          labelStyle={{ color: CHART_LABEL }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line
          type="monotone"
          dataKey="alpha"
          stroke={chartColor(0)}
          strokeWidth={2}
          name="초과수익"
        />
        <Line
          type="monotone"
          dataKey="sharpe"
          stroke={chartColor(1)}
          strokeWidth={2}
          name="위험 대비 수익"
        />
        <Line
          type="monotone"
          dataKey="mdd"
          stroke={chartColor(2)}
          strokeWidth={2}
          name="최대 낙폭"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
