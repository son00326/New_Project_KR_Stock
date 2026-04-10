"use client";

import { TrendingUp, TrendingDown, DollarSign, Users, Factory, Globe } from "lucide-react";
import { formatKRW } from "@/lib/constants";

interface KeyMetric {
  label: string;
  value: string;
  subtext?: string;
  trend?: "up" | "down" | "neutral";
  icon: React.ReactNode;
}

interface KeyMetricsCardsProps {
  metrics: KeyMetric[];
}

export function KeyMetricsCards({ metrics }: KeyMetricsCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="rounded-lg border bg-gradient-to-br from-background to-muted/20 p-4 space-y-2"
        >
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
              {metric.icon}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{metric.label}</p>
            <p className="text-lg font-bold mt-0.5">{metric.value}</p>
            {metric.subtext && (
              <p
                className={`text-xs mt-0.5 font-medium ${
                  metric.trend === "up"
                    ? "text-red-600"
                    : metric.trend === "down"
                    ? "text-blue-600"
                    : "text-muted-foreground"
                }`}
              >
                {metric.subtext}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// 삼성전자 핵심 지표 프리셋
export function getSamsungKeyMetrics(): KeyMetric[] {
  return [
    {
      label: "시가총액",
      value: "358조",
      subtext: "코스피 1위",
      icon: <DollarSign className="h-4 w-4 text-primary" />,
    },
    {
      label: "매출액 (2024)",
      value: "301조",
      subtext: "+16.2% YoY",
      trend: "up",
      icon: <TrendingUp className="h-4 w-4 text-primary" />,
    },
    {
      label: "영업이익 (2024)",
      value: "32.7조",
      subtext: "+398% YoY",
      trend: "up",
      icon: <TrendingUp className="h-4 w-4 text-primary" />,
    },
    {
      label: "직원 수",
      value: "약 26.7만명",
      subtext: "글로벌",
      icon: <Users className="h-4 w-4 text-primary" />,
    },
    {
      label: "R&D 투자",
      value: "약 25조",
      subtext: "매출의 8%",
      icon: <Factory className="h-4 w-4 text-primary" />,
    },
    {
      label: "글로벌 거점",
      value: "74개국",
      subtext: "생산/판매법인",
      icon: <Globe className="h-4 w-4 text-primary" />,
    },
  ];
}
