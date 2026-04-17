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
        <h4 className="text-sm font-medium mb-3">매출액 / 영업이익 / 순이익 추이 (단위: 조원)</h4>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value) => [`${Number(value)}조원`]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="매출액" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={32} />
              <Bar dataKey="영업이익" fill="#16a34a" radius={[4, 4, 0, 0]} barSize={32} />
              <Bar dataKey="순이익" fill="#9333ea" radius={[4, 4, 0, 0]} barSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 영업이익률 추이 */}
      <div>
        <h4 className="text-sm font-medium mb-3">영업이익률 추이 (%)</h4>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} unit="%" />
              <Tooltip formatter={(value) => [`${Number(value)}%`, "영업이익률"]} />
              <Area
                type="monotone"
                dataKey="영업이익률"
                stroke="#ea580c"
                fill="#ea580c"
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
    <div className={`rounded-lg border p-3 ${positive ? "border-green-200 bg-green-50/50" : "border-red-200 bg-red-50/50"}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold mt-1 ${positive ? "text-green-700" : "text-red-700"}`}>
        {value}
      </p>
    </div>
  );
}
