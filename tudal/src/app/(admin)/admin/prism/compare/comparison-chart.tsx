"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CHART_AXIS, CHART_GRID, CHART_LABEL, chartColor } from "@/lib/chart-colors";
import type { PrismComparisonPoint } from "../_lib/comparison";
import { formatPrismTooltipName } from "../_lib/comparison-tooltip";

interface ComparisonChartProps {
  readonly data: readonly PrismComparisonPoint[];
  readonly showJoopick: boolean;
  readonly benchmark?: number | null;
}

export function ComparisonChart({ data, showJoopick, benchmark }: ComparisonChartProps) {
  return (
    <div
      className="h-80 w-full"
      role="img"
      aria-label={showJoopick ? "주픽과 프리즘 누적수익률 추이 차트" : "프리즘과 시장 기준수익률 추이 차트"}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
          <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            minTickGap={32}
            stroke={CHART_AXIS}
            tick={{ fill: CHART_AXIS, fontSize: 11 }}
          />
          <YAxis
            stroke={CHART_AXIS}
            tick={{ fill: CHART_AXIS, fontSize: 11 }}
            tickFormatter={(value: number) => `${value.toFixed(0)}%`}
          />
          <Tooltip
            formatter={(value: unknown, name: unknown, item: unknown) => [
              typeof value === "number" ? `${value.toFixed(2)}%` : "—",
              formatPrismTooltipName(name, item),
            ]}
            labelFormatter={(label: unknown) => String(label)}
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
          {benchmark === null || benchmark === undefined ? null : (
            <ReferenceLine
              ifOverflow="extendDomain"
              label={{ fill: CHART_LABEL, fontSize: 11, position: "insideTopRight", value: "최신 시장 기준" }}
              stroke={chartColor(2)}
              strokeDasharray="5 5"
              y={benchmark}
            />
          )}
          <Line
            dataKey="prism"
            dot={false}
            name="프리즘"
            stroke={chartColor(0)}
            strokeWidth={2.5}
            type="monotone"
          />
          {showJoopick ? (
            <Line
              connectNulls
              dataKey="joopick"
              dot={false}
              name="주픽"
              stroke={chartColor(1)}
              strokeWidth={2.5}
              type="monotone"
            />
          ) : null}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
