"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown } from "lucide-react";
import { SAMSUNG_ANALYST_TPS } from "@/lib/data/mock-quarterly";

interface AnalystConsensusProps {
  ticker: string;
  currentPrice: number;
}

export function AnalystConsensus({ ticker, currentPrice }: AnalystConsensusProps) {
  const [regionFilter, setRegionFilter] = useState<"all" | "domestic" | "overseas">("all");

  if (ticker !== "005930") {
    return <div className="text-center py-6 text-sm text-muted-foreground">TP 컨센서스 데이터는 연동 후 제공됩니다.</div>;
  }

  const filtered = regionFilter === "all"
    ? SAMSUNG_ANALYST_TPS
    : SAMSUNG_ANALYST_TPS.filter((a) => a.region === regionFilter);

  const allTPs = SAMSUNG_ANALYST_TPS.map((a) => a.targetPrice);
  const avgTP = Math.round(allTPs.reduce((a, b) => a + b, 0) / allTPs.length);
  const maxTP = Math.max(...allTPs);
  const minTP = Math.min(...allTPs);
  const upside = ((avgTP - currentPrice) / currentPrice * 100).toFixed(1);

  const domesticTPs = SAMSUNG_ANALYST_TPS.filter((a) => a.region === "domestic").map((a) => a.targetPrice);
  const overseasTPs = SAMSUNG_ANALYST_TPS.filter((a) => a.region === "overseas").map((a) => a.targetPrice);
  const domesticAvg = Math.round(domesticTPs.reduce((a, b) => a + b, 0) / domesticTPs.length);
  const overseasAvg = Math.round(overseasTPs.reduce((a, b) => a + b, 0) / overseasTPs.length);

  return (
    <div className="space-y-6">
      {/* 컨센서스 요약 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border p-3 bg-primary/5 border-primary/20">
          <p className="text-xs text-muted-foreground">컨센서스 평균 TP</p>
          <p className="text-xl font-bold text-primary">{avgTP.toLocaleString()}원</p>
          <p className={`text-xs font-semibold mt-0.5 ${Number(upside) > 0 ? "text-red-600" : "text-blue-600"}`}>
            현재가 대비 {Number(upside) > 0 ? "+" : ""}{upside}%
          </p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">국내 평균</p>
          <p className="text-xl font-bold">{domesticAvg.toLocaleString()}원</p>
          <p className="text-xs text-muted-foreground">{domesticTPs.length}개 기관</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">해외 평균</p>
          <p className="text-xl font-bold">{overseasAvg.toLocaleString()}원</p>
          <p className="text-xs text-muted-foreground">{overseasTPs.length}개 기관</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">TP 범위</p>
          <p className="text-xl font-bold">{minTP.toLocaleString()}~{(maxTP / 10000).toFixed(1)}만</p>
          <p className="text-xs text-muted-foreground">최저~최고</p>
        </div>
      </div>

      {/* TP 분포 바 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>최저 {minTP.toLocaleString()}원</span>
          <span>최고 {maxTP.toLocaleString()}원</span>
        </div>
        <div className="relative h-8 bg-muted rounded-full overflow-hidden">
          {/* 현재가 마커 */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-foreground z-10"
            style={{ left: `${((currentPrice - minTP) / (maxTP - minTP)) * 100}%` }}
          />
          <div
            className="absolute -top-5 text-[10px] font-medium"
            style={{ left: `${((currentPrice - minTP) / (maxTP - minTP)) * 100}%`, transform: "translateX(-50%)" }}
          >
            현재가
          </div>
          {/* 평균 TP 마커 */}
          <div
            className="absolute top-0 bottom-0 w-1 bg-primary z-10 rounded-full"
            style={{ left: `${((avgTP - minTP) / (maxTP - minTP)) * 100}%` }}
          />
          {/* 그라디언트 */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-200 via-green-200 to-red-200 opacity-50" />
        </div>
      </div>

      {/* 필터 */}
      <div className="flex items-center gap-2">
        {(["all", "domestic", "overseas"] as const).map((r) => {
          const labels = { all: "전체", domestic: "국내", overseas: "해외" };
          return (
            <button
              key={r}
              onClick={() => setRegionFilter(r)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                regionFilter === r ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {labels[r]}
            </button>
          );
        })}
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left py-2 px-2 font-semibold text-muted-foreground">날짜</th>
              <th className="text-left py-2 px-2 font-semibold text-muted-foreground">기관</th>
              <th className="text-left py-2 px-2 font-semibold text-muted-foreground">애널리스트</th>
              <th className="text-right py-2 px-2 font-semibold text-muted-foreground">목표가</th>
              <th className="text-right py-2 px-2 font-semibold text-muted-foreground">변동</th>
              <th className="text-center py-2 px-2 font-semibold text-muted-foreground">의견</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => {
              const change = a.previousTP ? a.targetPrice - a.previousTP : 0;
              return (
                <tr key={`${a.institution}-${a.date}`} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="py-2 px-2 text-muted-foreground">{a.date}</td>
                  <td className="py-2 px-2 font-medium">
                    {a.institution}
                    {a.region === "overseas" && <Badge variant="outline" className="ml-1 text-[9px] px-1">해외</Badge>}
                  </td>
                  <td className="py-2 px-2 text-muted-foreground">{a.analyst}</td>
                  <td className="py-2 px-2 text-right font-semibold">{a.targetPrice.toLocaleString()}원</td>
                  <td className="py-2 px-2 text-right">
                    {change !== 0 && (
                      <span className={`inline-flex items-center gap-0.5 ${change > 0 ? "text-red-600" : "text-blue-600"}`}>
                        {change > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {change > 0 ? "+" : ""}{change.toLocaleString()}
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-2 text-center">
                    <Badge variant="secondary" className="text-[10px]">{a.rating}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
