"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { MacroIndicator } from "@/types/macro";

interface IndicatorCardProps {
  indicator: MacroIndicator;
  compact?: boolean;
}

const SIGNAL_BADGE = {
  bullish: { label: "호재", className: "bg-red-100 text-red-700 border-0" },
  bearish: { label: "악재", className: "bg-blue-100 text-blue-700 border-0" },
  neutral: { label: "중립", className: "bg-yellow-100 text-yellow-700 border-0" },
};

export function IndicatorCard({ indicator, compact = false }: IndicatorCardProps) {
  const isPositive = indicator.change > 0;
  const isNegative = indicator.change < 0;
  const badgeConfig = SIGNAL_BADGE[indicator.signal];

  return (
    <div className="rounded-lg border p-4 hover:shadow-sm transition-shadow">
      {/* 상단: 이름 + 시그널 */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-xs text-muted-foreground">{indicator.name}</p>
          <p className="text-sm font-medium">{indicator.nameKo}</p>
        </div>
        <Badge className={`text-xs shrink-0 ${badgeConfig.className}`}>
          {badgeConfig.label}
        </Badge>
      </div>

      {/* 중간: 수치 */}
      <div className="flex items-end gap-2 mb-2">
        <span className="text-2xl font-bold">
          {indicator.unit === "%"
            ? `${indicator.value}%`
            : indicator.unit === "$/배럴" || indicator.unit === "$/oz"
            ? `$${indicator.value.toLocaleString()}`
            : indicator.unit === "원"
            ? `${indicator.value.toLocaleString()}원`
            : indicator.value.toLocaleString()}
        </span>
        <div
          className={`flex items-center gap-1 text-sm font-medium mb-0.5 ${
            isPositive
              ? "text-red-600"
              : isNegative
              ? "text-blue-600"
              : "text-muted-foreground"
          }`}
        >
          {isPositive ? (
            <TrendingUp className="h-3.5 w-3.5" />
          ) : isNegative ? (
            <TrendingDown className="h-3.5 w-3.5" />
          ) : (
            <Minus className="h-3.5 w-3.5" />
          )}
          <span>
            {isPositive ? "+" : ""}
            {indicator.changePercent.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* 하단: 설명 */}
      {!compact && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          {indicator.description}
        </p>
      )}
    </div>
  );
}
