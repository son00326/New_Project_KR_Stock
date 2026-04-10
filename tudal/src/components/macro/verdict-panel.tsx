"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { MarketVerdict } from "@/types/macro";

interface VerdictPanelProps {
  verdict: MarketVerdict;
}

const SIGNAL_CONFIG = {
  strong_bullish: {
    label: "매우 긍정",
    color: "text-red-600",
    bg: "bg-red-50 border-red-200",
    icon: TrendingUp,
  },
  bullish: {
    label: "긍정",
    color: "text-red-600",
    bg: "bg-red-50 border-red-200",
    icon: TrendingUp,
  },
  neutral: {
    label: "중립",
    color: "text-yellow-600",
    bg: "bg-yellow-50 border-yellow-200",
    icon: Minus,
  },
  bearish: {
    label: "부정",
    color: "text-blue-600",
    bg: "bg-blue-50 border-blue-200",
    icon: TrendingDown,
  },
  strong_bearish: {
    label: "매우 부정",
    color: "text-blue-600",
    bg: "bg-blue-50 border-blue-200",
    icon: TrendingDown,
  },
};

const DETAIL_SIGNAL = {
  bullish: { label: "긍정", color: "bg-red-100 text-red-700" },
  bearish: { label: "부정", color: "bg-blue-100 text-blue-700" },
  neutral: { label: "중립", color: "bg-yellow-100 text-yellow-700" },
};

export function VerdictPanel({ verdict }: VerdictPanelProps) {
  const config = SIGNAL_CONFIG[verdict.overallSignal];
  const Icon = config.icon;

  return (
    <Card className={`border-2 ${config.bg}`}>
      <CardContent className="pt-6">
        {/* 상단: 종합 판단 */}
        <div className="flex flex-col md:flex-row md:items-center gap-6 mb-6">
          {/* 스코어 */}
          <div className="flex items-center gap-4">
            <div className="relative h-20 w-20">
              <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
                <circle
                  cx="40"
                  cy="40"
                  r="35"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="6"
                  className="text-muted/20"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="35"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="6"
                  strokeDasharray={`${(verdict.score / 100) * 220} 220`}
                  strokeLinecap="round"
                  className={config.color}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-xl font-bold ${config.color}`}>
                  {verdict.score}
                </span>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <Icon className={`h-5 w-5 ${config.color}`} />
                <span className={`text-xl font-bold ${config.color}`}>
                  {config.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                종합 투자 환경 점수 (0~100)
              </p>
            </div>
          </div>

          {/* 요약 */}
          <div className="flex-1">
            <p className="text-sm leading-relaxed">{verdict.summary}</p>
          </div>
        </div>

        {/* 하단: 카테고리별 상세 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {verdict.details.map((detail) => {
            const detailConfig = DETAIL_SIGNAL[detail.signal];
            return (
              <div
                key={detail.category}
                className="rounded-lg border bg-background/80 p-3"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium">{detail.category}</span>
                  <Badge className={`text-xs ${detailConfig.color} border-0`}>
                    {detailConfig.label}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {detail.reason}
                </p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
