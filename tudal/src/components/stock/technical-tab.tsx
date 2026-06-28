"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getStockByTicker,
  MOCK_FINANCIALS,
  MOCK_REVENUE_SEGMENTS,
  MOCK_MULTIPLES,
  MOCK_STOCKS,
} from "@/lib/data/mock-stocks";
import { RevenueChart } from "@/components/stock/charts/revenue-chart";
import { RevenueTrendChart } from "@/components/stock/charts/revenue-trend-chart";
import { QuarterlyFinancials } from "@/components/stock/charts/quarterly-financials";
import { FinancialTable } from "@/components/stock/charts/financial-table";
import { MultiplesHistory } from "@/components/stock/charts/multiples-history";
import { AnalystConsensus } from "@/components/stock/charts/analyst-consensus";
import { MultiplesComparison } from "@/components/stock/charts/multiples-comparison";
import { PeerGroupTable } from "@/components/stock/charts/peer-group-table";

interface TechnicalTabProps {
  ticker: string;
}

export function TechnicalTab({ ticker }: TechnicalTabProps) {
  const stock = getStockByTicker(ticker);
  const financials = MOCK_FINANCIALS[ticker];
  const segments = MOCK_REVENUE_SEGMENTS[ticker];
  const multiples = MOCK_MULTIPLES[ticker];

  if (!stock) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        해당 종목의 분석 데이터를 찾을 수 없습니다.
      </div>
    );
  }

  // Peer Group 구성 (같은 industry의 종목들)
  const peers = MOCK_STOCKS.filter(
    (s) => s.industry === stock.industry && s.ticker !== ticker
  );

  return (
    <div className="space-y-8">
      {/* 1. 매출 구성 */}
      {segments && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-1">매출 구성 (사업부문별)</h3>
            <p className="text-sm text-muted-foreground mb-6">
              {stock.name}의 사업 부문별 매출 비중 (2024년 기준)
            </p>
            <RevenueChart segments={segments} />
          </CardContent>
        </Card>
      )}

      {/* 2. 분기별 실적 */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-1">분기별 실적 추이</h3>
          <p className="text-sm text-muted-foreground mb-6">
            분기별 매출/영업이익/순이익 + YoY 성장률
          </p>
          <QuarterlyFinancials ticker={ticker} />
        </CardContent>
      </Card>

      {/* 3. 연간 실적 추이 */}
      {financials && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-1">연간 실적 추이</h3>
            <p className="text-sm text-muted-foreground mb-6">
              매출/영업이익/순이익 추이 및 수익성 변화
            </p>
            <RevenueTrendChart financials={financials} />
          </CardContent>
        </Card>
      )}

      {/* 4. 재무제표 상세 테이블 */}
      {financials && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-1">재무제표 상세</h3>
            <p className="text-sm text-muted-foreground mb-6">
              최근 4개년 핵심 재무 지표 (YoY 변동 포함)
            </p>
            <FinancialTable financials={financials} />
          </CardContent>
        </Card>
      )}

      {/* 5. 투자 지표 — Trailing / Forward + 5개년 추이 + 해외 Peer */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-1">투자 지표 (Valuation)</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Trailing / Forward 멀티플 비교, 5개년 추이, 글로벌 Peer 벤치마크
          </p>
          <MultiplesHistory ticker={ticker} currentPrice={stock.currentPrice} />
        </CardContent>
      </Card>

      {/* 6. 애널리스트 TP 컨센서스 */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-1">애널리스트 목표주가 (TP) 컨센서스</h3>
          <p className="text-sm text-muted-foreground mb-6">
            국내/해외 주요 증권사 애널리스트들의 최신 목표주가
          </p>
          <AnalystConsensus ticker={ticker} currentPrice={stock.currentPrice} />
        </CardContent>
      </Card>

      {/* 7. 국내 Peer Group 비교 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-semibold">국내 Peer Group 비교</h3>
            <Badge variant="secondary">국내</Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            동일 업종 내 경쟁사와의 멀티플 비교
          </p>

          {peers.length > 0 ? (
            <>
              <PeerGroupTable
                targetTicker={ticker}
                targetStock={stock}
                peers={peers}
              />
              <MultiplesComparison
                targetTicker={ticker}
                targetStock={stock}
                peers={peers}
              />
            </>
          ) : (
            <div className="text-center py-8 text-sm text-muted-foreground">
              현재 비교 가능한 국내 Peer 데이터가 없습니다. 추후 업데이트됩니다.
            </div>
          )}
        </CardContent>
      </Card>

      {/* 8. 밸류에이션 판단 */}
      {multiples && peers.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-1">밸류에이션 진단</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Peer 대비 {stock.name}의 밸류에이션 수준
            </p>
            <ValuationVerdict
              stock={stock}
              multiples={multiples}
              peers={peers}
            />
          </CardContent>
        </Card>
      )}

      {/* AI 생성 안내 */}
      <div className="text-xs text-muted-foreground text-center py-4 border-t">
        재무 데이터는 DART 전자공시 및 KRX 데이터를 기반으로 합니다.
        투자 판단의 최종 책임은 이용자 본인에게 있습니다.
      </div>
    </div>
  );
}

function ValuationVerdict({
  stock,
  multiples,
  peers,
}: {
  stock: ReturnType<typeof getStockByTicker>;
  multiples: (typeof MOCK_MULTIPLES)[string];
  peers: typeof MOCK_STOCKS;
}) {
  // 간단한 Peer 평균 대비 판단 로직
  const peerMultiples = peers
    .map((p) => MOCK_MULTIPLES[p.ticker])
    .filter(Boolean);

  if (peerMultiples.length === 0) return null;

  const avgPeerPer =
    peerMultiples.reduce((sum, p) => sum + (p.per || 0), 0) /
    peerMultiples.length;

  const targetPer = multiples.per || 0;
  const discount = ((targetPer - avgPeerPer) / avgPeerPer) * 100;

  let verdict: string;
  let verdictColor: string;
  let reason: string;

  if (discount < -20) {
    verdict = "저평가";
    verdictColor = "text-market-down bg-market-down/10 border-market-down/20";
    reason = `${stock!.name}의 PER(${targetPer.toFixed(1)}배)은 Peer 평균(${avgPeerPer.toFixed(1)}배) 대비 ${Math.abs(discount).toFixed(1)}% 할인된 수준입니다. 이는 시장이 ${stock!.name}의 성장성을 보수적으로 평가하고 있거나, 구조적 리스크를 반영하고 있을 가능성이 있습니다.`;
  } else if (discount > 20) {
    verdict = "고평가";
    verdictColor = "text-market-up bg-market-up/10 border-market-up/20";
    reason = `${stock!.name}의 PER(${targetPer.toFixed(1)}배)은 Peer 평균(${avgPeerPer.toFixed(1)}배) 대비 ${discount.toFixed(1)}% 프리미엄이 부여되어 있습니다. 이는 시장이 ${stock!.name}의 성장 잠재력을 높게 평가하고 있음을 의미합니다.`;
  } else {
    verdict = "적정";
    verdictColor = "text-chart-3 bg-chart-3/10 border-chart-3/20";
    reason = `${stock!.name}의 PER(${targetPer.toFixed(1)}배)은 Peer 평균(${avgPeerPer.toFixed(1)}배)과 유사한 수준으로, 시장에서 적정한 밸류에이션을 받고 있는 것으로 판단됩니다.`;
  }

  return (
    <div className={`rounded-xl border p-6 ${verdictColor}`}>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl font-bold tracking-tight">{verdict}</span>
        <Badge variant="outline" className="text-xs">
          Peer 대비 PER 기준
        </Badge>
      </div>
      <p className="text-sm leading-relaxed opacity-90">{reason}</p>
      <p className="text-xs mt-3 opacity-70">
        * 단순 PER 비교 기준이며, PBR/PSR/EV-EBITDA 등 종합적 분석이 필요합니다.
        AI 심층 분석은 추후 업데이트됩니다.
      </p>
    </div>
  );
}
