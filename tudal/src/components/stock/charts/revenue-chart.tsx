"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { formatKRW } from "@/lib/constants";
import type { RevenueSegment } from "@/types/stock";

const COLORS = [
  "#2563eb", // blue-600
  "#16a34a", // green-600
  "#ea580c", // orange-600
  "#9333ea", // purple-600
  "#e11d48", // rose-600
  "#0891b2", // cyan-600
  "#ca8a04", // yellow-600
];

interface RevenueChartProps {
  segments: RevenueSegment[];
}

export function RevenueChart({ segments }: RevenueChartProps) {
  const data = segments.map((s) => ({
    name: s.segmentName,
    value: s.revenue,
    proportion: s.proportion,
  }));

  return (
    <div className="flex flex-col md:flex-row items-center gap-8">
      {/* 파이 차트 */}
      <div className="w-full md:w-1/2 h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={110}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => formatKRW(Number(value))}
              labelFormatter={(label) => String(label)}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* 범례 + 상세 */}
      <div className="w-full md:w-1/2 space-y-3">
        {segments.map((segment, index) => (
          <div
            key={segment.segmentName}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="text-sm">{segment.segmentName}</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">
                {formatKRW(segment.revenue)}
              </span>
              <span className="font-medium w-14 text-right">
                {segment.proportion.toFixed(1)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
