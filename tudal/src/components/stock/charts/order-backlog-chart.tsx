"use client";

import {
  BarChart,
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
import { Badge } from "@/components/ui/badge";
import type { OrderBacklog } from "@/types/corporate";

interface OrderBacklogChartProps {
  orders: OrderBacklog[];
  companyName: string;
}

export function OrderBacklogChart({ orders, companyName }: OrderBacklogChartProps) {
  const sorted = [...orders].sort((a, b) => a.year - b.year);

  const data = sorted.map((o) => ({
    year: `${o.year}`,
    수주액: Math.round(o.orderReceived / 1_0000_0000_0000),
    매출액: Math.round(o.revenue / 1_0000_0000_0000),
    수주잔고: Math.round(o.orderBacklog / 1_0000_0000_0000),
    "B/B Ratio": o.bookToBill,
  }));

  const latestBB = sorted[sorted.length - 1]?.bookToBill ?? 0;
  const prevBB = sorted.length >= 2 ? sorted[sorted.length - 2]?.bookToBill ?? 0 : 0;

  return (
    <div className="space-y-6">
      {/* 수주 vs 매출 비교 */}
      <div>
        <h4 className="text-sm font-medium mb-3">수주액 vs 매출액 추이 (단위: 조원)</h4>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => [`${Number(value)}조원`]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="수주액" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={28} />
              <Bar dataKey="매출액" fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 수주잔고 + B/B Ratio */}
      <div>
        <h4 className="text-sm font-medium mb-3">수주잔고 및 Book-to-Bill Ratio</h4>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} domain={[0.5, 1.5]} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="left" dataKey="수주잔고" fill="#16a34a" radius={[4, 4, 0, 0]} barSize={32} name="수주잔고 (조원)" />
              <Line yAxisId="right" type="monotone" dataKey="B/B Ratio" stroke="#ea580c" strokeWidth={2} dot={{ r: 4 }} name="B/B Ratio" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 핵심 인사이트 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">최신 B/B Ratio</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-2xl font-bold ${latestBB >= 1.0 ? "text-green-700" : "text-red-700"}`}>
              {latestBB.toFixed(2)}
            </span>
            <Badge className={`text-xs border-0 ${latestBB >= 1.0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
              {latestBB >= 1.0 ? "양호" : "주의"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            1.0 이상 = 수주 &gt; 매출 (성장)
          </p>
        </div>

        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">수주잔고 (2024)</p>
          <p className="text-2xl font-bold mt-1">
            {Math.round(sorted[sorted.length - 1]?.orderBacklog / 1_0000_0000_0000)}조원
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            향후 매출로 인식될 금액
          </p>
        </div>

        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">수주 추세</p>
          <p className={`text-2xl font-bold mt-1 ${latestBB > prevBB ? "text-green-700" : "text-red-700"}`}>
            {latestBB > prevBB ? "개선" : "둔화"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            B/B {prevBB.toFixed(2)} → {latestBB.toFixed(2)}
          </p>
        </div>
      </div>

      {/* 해석 */}
      <div className="rounded-lg bg-muted/50 p-4">
        <p className="text-sm font-medium mb-2">수주 추이 해석</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          <strong>Book-to-Bill(B/B) Ratio</strong>는 수주액을 매출액으로 나눈 값입니다.
          <strong> 1.0 이상</strong>이면 새로운 주문이 매출보다 많다는 뜻으로, 향후 매출 성장이 기대됩니다.
          {companyName}의 2024년 B/B Ratio는 {latestBB.toFixed(2)}로,
          {latestBB >= 1.0
            ? " 수주가 매출을 초과하여 긍정적인 성장 신호를 보여주고 있습니다."
            : " 수주가 매출에 미치지 못해 향후 매출 둔화 가능성에 유의할 필요가 있습니다."}
          수주잔고는 {Math.round(sorted[sorted.length - 1]?.orderBacklog / 1_0000_0000_0000)}조원으로, 이는 향후 매출로 전환될 예정인 확보된 물량입니다.
        </p>
      </div>
    </div>
  );
}
