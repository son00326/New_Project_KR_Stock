"use client";

import {
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from "recharts";
import type { DividendHistory } from "@/types/corporate";

interface DividendChartProps {
  dividends: DividendHistory[];
}

export function DividendChart({ dividends }: DividendChartProps) {
  const sorted = [...dividends].sort((a, b) => a.year - b.year);

  const data = sorted.map((d) => ({
    year: `${d.year}`,
    "주당배당금 (원)": d.dps,
    "배당수익률 (%)": d.dividendYield,
    "배당성향 (%)": d.payoutRatio,
  }));

  const latest = sorted[sorted.length - 1];

  return (
    <div className="space-y-6">
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="year" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} unit="%" />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="left" dataKey="주당배당금 (원)" fill="#9333ea" radius={[4, 4, 0, 0]} barSize={32} />
            <Line yAxisId="right" type="monotone" dataKey="배당수익률 (%)" stroke="#ea580c" strokeWidth={2} dot={{ r: 4 }} />
            <Line yAxisId="right" type="monotone" dataKey="배당성향 (%)" stroke="#16a34a" strokeWidth={2} dot={{ r: 4 }} strokeDasharray="5 5" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 배당 요약 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">주당배당금 (DPS)</p>
          <p className="text-xl font-bold mt-1">{latest.dps.toLocaleString()}원</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">배당수익률</p>
          <p className="text-xl font-bold mt-1">{latest.dividendYield}%</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">배당성향</p>
          <p className="text-xl font-bold mt-1">{latest.payoutRatio}%</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">연간 총배당금</p>
          <p className="text-xl font-bold mt-1">{Math.round(latest.totalDividend / 1_0000_0000_0000)}조원</p>
        </div>
      </div>

      <div className="rounded-lg bg-muted/50 p-4">
        <p className="text-sm font-medium mb-2">배당 분석</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          삼성전자는 4년 연속 주당 1,444원의 <strong>안정적인 배당금</strong>을 유지하고 있습니다.
          배당수익률은 주가에 따라 변동되며, 현재 약 {latest.dividendYield}% 수준입니다.
          다만 글로벌 빅테크(Apple 배당수익률 0.5%, TSMC 1.5%) 대비 높은 편이나,
          <strong> 총주주환원율(배당+자사주 매입)은 약 35%로 글로벌 기준에서는 보통 수준</strong>입니다.
          향후 주주환원 정책 강화 여부가 주가 리레이팅의 핵심 변수 중 하나입니다.
        </p>
      </div>
    </div>
  );
}
