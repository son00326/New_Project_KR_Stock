"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { FinancialData } from "@/types/stock";
import { chartColor, CHART_PRIMARY, CHART_GRID, CHART_AXIS } from "@/lib/chart-colors";

interface RevenueTrendChartProps {
  financials: FinancialData[];
}

export function RevenueTrendChart({ financials }: RevenueTrendChartProps) {
  const sorted = [...financials].sort((a, b) => a.year - b.year);

  const data = sorted.map((f) => ({
    year: `${f.year}`,
    매출액: Math.round(f.revenue / 1_0000_0000_0000),
    영업이익: Math.round(f.operatingIncome / 1_0000_0000_0000),
    순이익: Math.round(f.netIncome / 1_0000_0000_0000),
    영업이익률: Number(((f.operatingIncome / f.revenue) * 100).toFixed(1)),
  }));

  return (
    <div className="space-y-6">
      {/* 매출 + 영업이익 바차트 */}
      <div>
        <h4 className="text-sm font-semibold mb-3">매출액 / 영업이익 / 순이익 추이 (단위: 조원)</h4>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />
              <XAxis dataKey="year" tick={{ fontSize: 12, fill: CHART_AXIS }} />
              <YAxis tick={{ fontSize: 12, fill: CHART_AXIS }} />
              <Tooltip
                formatter={(value) => [`${Number(value)}조원`]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="매출액" fill={CHART_PRIMARY} radius={[4, 4, 0, 0]} barSize={32} />
              <Bar dataKey="영업이익" fill={chartColor(2)} radius={[4, 4, 0, 0]} barSize={32} />
              <Bar dataKey="순이익" fill={chartColor(3)} radius={[4, 4, 0, 0]} barSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 영업이익률 추이 */}
      <div>
        <h4 className="text-sm font-semibold mb-3">영업이익률 추이 (%)</h4>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />
              <XAxis dataKey="year" tick={{ fontSize: 12, fill: CHART_AXIS }} />
              <YAxis tick={{ fontSize: 12, fill: CHART_AXIS }} unit="%" />
              <Tooltip formatter={(value) => [`${Number(value)}%`, "영업이익률"]} />
              <Area
                type="monotone"
                dataKey="영업이익률"
                stroke={chartColor(4)}
                fill={chartColor(4)}
                fillOpacity={0.1}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 핵심 인사이트 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {sorted.length >= 2 && (() => {
          const latest = sorted[sorted.length - 1];
          const prev = sorted[sorted.length - 2];
          const revGrowth = ((latest.revenue - prev.revenue) / prev.revenue * 100).toFixed(1);
          const opMargin = ((latest.operatingIncome / latest.revenue) * 100).toFixed(1);
          const netMargin = ((latest.netIncome / latest.revenue) * 100).toFixed(1);

          return (
            <>
              <InsightCard
                label="매출 성장률 (YoY)"
                value={`${Number(revGrowth) > 0 ? "+" : ""}${revGrowth}%`}
                positive={Number(revGrowth) > 0}
              />
              <InsightCard
                label="영업이익률"
                value={`${opMargin}%`}
                positive={Number(opMargin) > 10}
              />
              <InsightCard
                label="순이익률"
                value={`${netMargin}%`}
                positive={Number(netMargin) > 5}
              />
            </>
          );
        })()}
      </div>
    </div>
  );
}

function InsightCard({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive: boolean;
}) {
  return (
    <div className={`rounded-xl border p-3 shadow-toss-sm ${positive ? "border-market-up/30 bg-market-up/5" : "border-market-down/30 bg-market-down/5"}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold mt-1 tabular-nums ${positive ? "text-market-up" : "text-market-down"}`}>
        {value}
      </p>
    </div>
  );
}
