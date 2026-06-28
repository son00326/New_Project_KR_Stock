"use client";

import { formatKRW } from "@/lib/constants";
import type { FinancialData } from "@/types/stock";

interface FinancialTableProps {
  financials: FinancialData[];
}

export function FinancialTable({ financials }: FinancialTableProps) {
  const sorted = [...financials].sort((a, b) => a.year - b.year);

  const rows = [
    { label: "매출액", key: "revenue" as const },
    { label: "영업이익", key: "operatingIncome" as const },
    { label: "순이익", key: "netIncome" as const },
    { label: "총자산", key: "totalAssets" as const },
    { label: "자본총계", key: "totalEquity" as const },
    { label: "EPS", key: "eps" as const, unit: "원" },
    { label: "BPS", key: "bps" as const, unit: "원" },
    { label: "DPS", key: "dps" as const, unit: "원" },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-3 pr-4 font-medium text-muted-foreground">
              항목
            </th>
            {sorted.map((f) => (
              <th
                key={f.year}
                className="text-right py-3 px-3 font-semibold min-w-[100px] tabular-nums"
              >
                {f.year}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b last:border-0 transition-colors hover:bg-muted/30">
              <td className="py-3 pr-4 text-muted-foreground">{row.label}</td>
              {sorted.map((f) => {
                const value = f[row.key];
                const prevYear = sorted.find((s) => s.year === f.year - 1);
                const prevValue = prevYear ? prevYear[row.key] : null;
                const yoyChange =
                  prevValue && prevValue !== 0
                    ? ((value - prevValue) / Math.abs(prevValue)) * 100
                    : null;

                return (
                  <td key={f.year} className="text-right py-3 px-3">
                    <div className="font-medium tabular-nums">
                      {row.unit
                        ? `${value.toLocaleString("ko-KR")}${row.unit}`
                        : formatKRW(value)}
                    </div>
                    {yoyChange !== null && (
                      <div
                        className={`text-xs mt-0.5 tabular-nums ${
                          yoyChange > 0
                            ? "text-market-up"
                            : yoyChange < 0
                            ? "text-market-down"
                            : "text-muted-foreground"
                        }`}
                      >
                        {yoyChange > 0 ? "+" : ""}
                        {yoyChange.toFixed(1)}%
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
