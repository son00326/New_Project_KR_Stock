"use client";

import { Activity, AlertTriangle, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { MOCK_INDICATORS, MOCK_EVENTS, MOCK_VERDICT } from "@/lib/data/mock-macro";
import { VerdictPanel } from "@/components/macro/verdict-panel";
import { IndicatorCard } from "@/components/macro/indicator-card";
import { EventCalendar } from "@/components/macro/event-calendar";
import { FearGreedGauge } from "@/components/macro/fear-greed-gauge";

export function MacroDashboard() {
  const sentimentIndicators = MOCK_INDICATORS.filter((i) => i.category === "sentiment");
  const economicIndicators = MOCK_INDICATORS.filter((i) => i.category === "economic");
  const ratesIndicators = MOCK_INDICATORS.filter((i) => i.category === "rates");
  const commoditiesIndicators = MOCK_INDICATORS.filter((i) => i.category === "commodities");
  const fxIndicators = MOCK_INDICATORS.filter((i) => i.category === "fx");

  const fearGreed = MOCK_INDICATORS.find((i) => i.id === "fear-greed");

  return (
    <div className="space-y-8">
      {/* 헤더 */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold md:text-3xl">매크로 현황판</h1>
            <p className="text-sm text-muted-foreground">
              JARVIS - 글로벌 매크로 지표 실시간 모니터링
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-muted-foreground">
            마지막 업데이트: 2026년 4월 11일 10:00 KST
          </span>
        </div>
      </div>

      {/* 종합 투자 판단 */}
      <VerdictPanel verdict={MOCK_VERDICT} />

      {/* 공포·탐욕 지수 + 핵심 지표 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 공포·탐욕 게이지 */}
        <Card className="lg:col-span-1">
          <CardContent className="pt-6">
            <h3 className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              시장 심리
            </h3>
            {fearGreed && <FearGreedGauge value={fearGreed.value} />}
          </CardContent>
        </Card>

        {/* 심리 지표 카드들 */}
        <Card className="lg:col-span-2">
          <CardContent className="pt-6">
            <h3 className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2">
              <Zap className="h-4 w-4" />
              심리 지표
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {sentimentIndicators.map((indicator) => (
                <IndicatorCard key={indicator.id} indicator={indicator} compact />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 경제 지표 */}
      <div>
        <SectionHeader title="경제 지표" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {economicIndicators.map((indicator) => (
            <IndicatorCard key={indicator.id} indicator={indicator} />
          ))}
        </div>
      </div>

      {/* 금리 */}
      <div>
        <SectionHeader title="금리" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {ratesIndicators.map((indicator) => (
            <IndicatorCard key={indicator.id} indicator={indicator} />
          ))}
        </div>
      </div>

      {/* 원자재 + 환율 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <SectionHeader title="원자재" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {commoditiesIndicators.map((indicator) => (
              <IndicatorCard key={indicator.id} indicator={indicator} />
            ))}
          </div>
        </div>
        <div>
          <SectionHeader title="환율" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fxIndicators.map((indicator) => (
              <IndicatorCard key={indicator.id} indicator={indicator} />
            ))}
          </div>
        </div>
      </div>

      {/* 경제 캘린더 */}
      <div>
        <SectionHeader title="경제 이벤트 캘린더" />
        <EventCalendar events={MOCK_EVENTS} />
      </div>

      {/* 면책 */}
      <div className="text-xs text-muted-foreground text-center py-4 border-t">
        매크로 데이터는 각국 통계청, 중앙은행, 거래소 데이터를 기반으로 합니다.
        투자 판단의 최종 책임은 이용자 본인에게 있습니다.
      </div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
      {title}
    </h3>
  );
}
