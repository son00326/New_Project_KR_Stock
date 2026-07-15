import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLatestPrismSnapshot } from "@/lib/data/admin-prism";

import {
  EmptyState,
  formatNumber,
  formatPercent,
  PrismPageHeader,
  resolveMarket,
  SectionFallback,
} from "../_components/prism-ui";
import { nameOf, readString, readNumber, tickerOf } from "../_lib/section-values";

export const dynamic = "force-dynamic";

interface HoldingsPageProps {
  readonly searchParams: Promise<{ readonly market?: string | string[] }>;
}

export default async function HoldingsPage({ searchParams }: HoldingsPageProps) {
  const market = resolveMarket((await searchParams).market);
  const snapshot = await getLatestPrismSnapshot(market);
  const decisions = snapshot?.payload.holdingDecisions ?? null;

  return (
    <div className="space-y-7">
      <PrismPageHeader
        description="보유 포지션에 대한 외부 엔진의 판단을 원문 데이터 기준으로 확인합니다. 이 화면에서는 수정하거나 주문할 수 없습니다."
        market={market}
        pathname="/admin/prism/holdings"
        title="AI 보유 분석"
      />

      {snapshot === null ? (
        <EmptyState
          description="사이드카 스냅샷이 수집된 뒤 보유 판단을 확인할 수 있습니다."
          title="아직 수집된 스냅샷이 없어요"
        />
      ) : decisions === null ? (
        <SectionFallback
          description="holding_decisions 섹션이 없거나 현재 계약과 맞지 않습니다. 다른 프리즘 섹션은 계속 이용할 수 있습니다."
          title="AI 보유 판단"
        />
      ) : decisions.length === 0 ? (
        <EmptyState
          description="현재 상류 엔진은 holding_decisions를 생성하지 않습니다. 섹션이 추가되면 별도 변경 없이 안전하게 표시됩니다."
          title="생성된 보유 판단이 없어요"
        />
      ) : (
        <section aria-label="AI 보유 판단 목록" className="grid gap-4 lg:grid-cols-2">
          {decisions.map((decision, index) => {
            const action = readString(decision, ["decision", "action", "recommendation"]) ?? "관찰";
            return (
              <Card key={`${tickerOf(decision) ?? "decision"}-${index}`}>
                <CardHeader className="grid grid-cols-[1fr_auto] gap-3">
                  <div>
                    <CardTitle>{nameOf(decision)}</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">{tickerOf(decision) ?? "종목 코드 없음"}</p>
                  </div>
                  <Badge variant="secondary">{action}</Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted/60 p-4 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">신뢰도</p>
                      <p className="mt-1 font-semibold tabular-nums">{formatPercent(readNumber(decision, ["confidence", "confidence_score"]))}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">보유일</p>
                      <p className="mt-1 font-semibold tabular-nums">{formatNumber(readNumber(decision, ["holding_days", "days_held"]), 0)}일</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">판단 근거</p>
                    <p className="mt-2 text-sm leading-6">{readString(decision, ["reason", "rationale", "analysis"]) ?? "근거가 제공되지 않았습니다."}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>
      )}
    </div>
  );
}
