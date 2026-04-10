"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { ShareholderInfo } from "@/types/corporate";

interface ShareholderChartProps {
  shareholders: ShareholderInfo[];
}

const COLORS: Record<string, string> = {
  "최대주주": "#2563eb",
  "특수관계인": "#3b82f6",
  "국민연금": "#16a34a",
  "외국인": "#ea580c",
  "자사주": "#9333ea",
  "기타": "#94a3b8",
};

export function ShareholderChart({ shareholders }: ShareholderChartProps) {
  const data = shareholders.map((s) => ({
    name: `${s.name} (${s.category})`,
    value: s.ownership,
    category: s.category,
  }));

  return (
    <div className="flex flex-col md:flex-row items-center gap-8">
      {/* 도넛 차트 */}
      <div className="w-full md:w-1/2 h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={105}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={COLORS[entry.category] || "#94a3b8"}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => `${Number(value).toFixed(2)}%`}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* 상세 표 */}
      <div className="w-full md:w-1/2">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 font-medium text-muted-foreground">주주</th>
              <th className="text-right py-2 font-medium text-muted-foreground">지분율</th>
              <th className="text-right py-2 font-medium text-muted-foreground">주식 수</th>
            </tr>
          </thead>
          <tbody>
            {shareholders.map((s) => (
              <tr key={s.name} className="border-b last:border-0">
                <td className="py-2.5">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: COLORS[s.category] || "#94a3b8" }}
                    />
                    <div>
                      <span className="text-sm font-medium">{s.name}</span>
                      <span className="text-xs text-muted-foreground ml-1.5">
                        {s.category}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="text-right py-2.5 font-semibold">
                  {s.ownership.toFixed(2)}%
                </td>
                <td className="text-right py-2.5 text-muted-foreground text-xs">
                  {s.shares.toLocaleString("ko-KR")}주
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 핵심 포인트 */}
        <div className="mt-4 rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong>외국인 지분율 51.84%</strong> — 외국인 투자자가 과반 이상을 보유하고 있어 글로벌 자금 흐름에 영향을 크게 받습니다. 환율, 글로벌 금리 변화가 외국인 매매에 직접적으로 영향을 줍니다.
          </p>
        </div>
      </div>
    </div>
  );
}
