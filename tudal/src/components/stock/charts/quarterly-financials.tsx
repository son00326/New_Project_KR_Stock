"use client";

import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { formatKRW } from "@/lib/constants";
import { SAMSUNG_QUARTERLY } from "@/lib/data/mock-quarterly";

interface QuarterlyFinancialsProps {
  ticker: string;
}

export function QuarterlyFinancials({ ticker }: QuarterlyFinancialsProps) {
  const [metric, setMetric] = useState<"revenue" | "operatingIncome" | "netIncome">("revenue");

  if (ticker !== "005930") {
    return <div className="text-center py-6 text-sm text-muted-foreground">분기별 데이터는 연동 후 제공됩니다.</div>;
  }

  const data = SAMSUNG_QUARTERLY.map((q) => ({
    label: `${q.year} Q${q.quarter}`,
    매출액: Math.round(q.revenue / 1_0000_0000_0000),
    영업이익: Math.round(q.operatingIncome / 1_0000_0000_0000),
    순이익: Math.round(q.netIncome / 1_0000_0000_0000),
    영업이익률: q.operatingMargin,
    revYoY: q.revYoY,
    opIncYoY: q.opIncYoY,
    netIncYoY: q.netIncYoY,
  }));

  const metricKey = { revenue: "매출액", operatingIncome: "영업이익", netIncome: "순이익" }[metric];

  return (
    <div className="space-y-4">
      {/* 지표 선택 */}
      <div className="flex items-center gap-2">
        {(["revenue", "operatingIncome", "netIncome"] as const).map((m) => {
          const labels = { revenue: "매출액", operatingIncome: "영업이익", netIncome: "순이익" };
          return (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                metric === m ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {labels[m]}
            </button>
          );
        })}
      </div>

      {/* 차트 */}
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value) => [`${Number(value)}조원`]} />
            <Bar dataKey={metricKey} fill="#2563eb" radius={[4, 4, 0, 0]} barSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 테이블 with YoY */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left py-2 px-2 font-semibold text-muted-foreground">분기</th>
              <th className="text-right py-2 px-2 font-semibold text-muted-foreground">매출액</th>
              <th className="text-right py-2 px-2 font-semibold text-muted-foreground">YoY</th>
              <th className="text-right py-2 px-2 font-semibold text-muted-foreground">영업이익</th>
              <th className="text-right py-2 px-2 font-semibold text-muted-foreground">YoY</th>
              <th className="text-right py-2 px-2 font-semibold text-muted-foreground">OPM</th>
              <th className="text-right py-2 px-2 font-semibold text-muted-foreground">순이익</th>
              <th className="text-right py-2 px-2 font-semibold text-muted-foreground">YoY</th>
            </tr>
          </thead>
          <tbody>
            {SAMSUNG_QUARTERLY.map((q) => (
              <tr key={`${q.year}Q${q.quarter}`} className="border-b last:border-0">
                <td className="py-2 px-2 font-medium">{q.year} Q{q.quarter}</td>
                <td className="text-right py-2 px-2">{formatKRW(q.revenue)}</td>
                <td className="text-right py-2 px-2">
                  <YoYBadge value={q.revYoY} />
                </td>
                <td className="text-right py-2 px-2">{formatKRW(q.operatingIncome)}</td>
                <td className="text-right py-2 px-2">
                  <YoYBadge value={q.opIncYoY} />
                </td>
                <td className="text-right py-2 px-2 font-medium">{q.operatingMargin}%</td>
                <td className="text-right py-2 px-2">{formatKRW(q.netIncome)}</td>
                <td className="text-right py-2 px-2">
                  <YoYBadge value={q.netIncYoY} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function YoYBadge({ value }: { value?: number }) {
  if (value === undefined) return <span className="text-muted-foreground">-</span>;
  const isPositive = value > 0;
  return (
    <span className={`font-medium ${isPositive ? "text-red-600" : "text-blue-600"}`}>
      {isPositive ? "+" : ""}{value > 999 ? `${Math.round(value)}` : value.toFixed(1)}%
    </span>
  );
}
