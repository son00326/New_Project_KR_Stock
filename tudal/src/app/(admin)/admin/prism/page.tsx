import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getLatestPrismSnapshot,
  getPrismHistorySeries,
  getPrismStaleStatus,
} from "@/lib/data/admin-prism";

import {
  EmptyState,
  formatNumber,
  formatPercent,
  MetricCard,
  PrismPageHeader,
  resolveMarket,
  SectionFallback,
  StaleNotice,
} from "./_components/prism-ui";
import { nameOf, readNumber, tickerOf } from "./_lib/section-values";
import { ComparisonChart } from "./compare/comparison-chart";

export const dynamic = "force-dynamic";

interface PrismDashboardPageProps {
  readonly searchParams: Promise<{ readonly market?: string | string[] }>;
}

export default async function PrismDashboardPage({ searchParams }: PrismDashboardPageProps) {
  const market = resolveMarket((await searchParams).market);
  const [snapshot, history] = await Promise.all([
    getLatestPrismSnapshot(market),
    getPrismHistorySeries(market),
  ]);

  if (snapshot === null) {
    return (
      <div className="space-y-6">
        <PrismPageHeader
          description="외부 PRISM 엔진이 박제한 최신 상태와 precomputed 성과를 읽기 전용으로 확인합니다."
          market={market}
          pathname="/admin/prism"
          title="프리즘 대시보드"
        />
        <EmptyState
          description="사이드카의 첫 스냅샷이 수집되면 성과와 보유 현황이 여기에 표시됩니다."
          title="아직 수집된 스냅샷이 없어요"
        />
      </div>
    );
  }

  const stale = getPrismStaleStatus(snapshot);
  const summary = snapshot.payload.summary;
  const holdings = snapshot.payload.holdings;
  const cumulativeReturn = summary === null
    ? null
    : readNumber(summary, ["cumulative_return", "total_return", "prism_simulator_return"]);
  const winRate = summary === null ? null : readNumber(summary, ["win_rate", "winning_rate"]);
  const profitFactor = summary === null ? null : readNumber(summary, ["profit_factor", "pf"]);
  const averageProfit = summary === null
    ? null
    : readNumber(summary, ["average_profit", "avg_profit", "average_win"]);
  const averageLoss = summary === null
    ? null
    : readNumber(summary, ["average_loss", "avg_loss"]);
  const averageHoldingDays = summary === null
    ? null
    : readNumber(summary, ["average_holding_days", "avg_holding_days", "holding_days"]);
  const benchmarkReturn = summary === null
    ? null
    : readNumber(summary, ["benchmark_return", "market_return", "index_return"]);
  const historyPoints = history.flatMap((point) => point.terminalPerformance === null ? [] : [{
    date: point.marketSessionDate,
    prism: point.terminalPerformance.prismSimulatorReturn,
    slot: point.snapshotSlot,
  }]);

  return (
    <div className="space-y-7">
      <PrismPageHeader
        description="외부 PRISM 엔진이 박제한 최신 상태와 precomputed 성과를 읽기 전용으로 확인합니다."
        market={market}
        pathname="/admin/prism"
        title="프리즘 대시보드"
        trailing={
          <Badge variant="outline">
            {snapshot.snapshotSlot.toUpperCase()} · {snapshot.marketSessionDate}
          </Badge>
        }
      />

      <StaleNotice
        description={`다음 예정 슬롯 이후 12시간의 유예가 지났습니다. 마지막 생성: ${new Date(snapshot.generatedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}`}
        label={stale.isStale ? "업데이트 지연" : "최신 슬롯 반영"}
        stale={stale.isStale}
      />

      {summary === null ? (
        <SectionFallback title="성과 요약" />
      ) : (
        <section aria-labelledby="summary-heading" className="space-y-3">
          <h2 id="summary-heading" className="text-base font-semibold">성과 요약</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              label="누적수익률"
              tone={cumulativeReturn === null ? "neutral" : cumulativeReturn >= 0 ? "up" : "down"}
              value={formatPercent(cumulativeReturn)}
            />
            <MetricCard label="승률" value={formatPercent(winRate)} />
            <MetricCard label="Profit Factor" value={formatNumber(profitFactor)} />
            <MetricCard label="평균 수익" value={formatPercent(averageProfit)} />
            <MetricCard label="평균 손실" value={formatPercent(averageLoss)} />
            <MetricCard label="평균 보유일" value={averageHoldingDays === null ? "—" : `${formatNumber(averageHoldingDays, 1)}일`} />
          </div>
        </section>
      )}

      <section aria-labelledby="benchmark-heading" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="benchmark-heading" className="text-base font-semibold">벤치마크 대비 Forward 추이</h2>
            <p className="mt-1 text-xs text-muted-foreground">아카이브 terminal_performance만 사용 · 시장 기준수익률은 최신 summary 산출물</p>
          </div>
          <Badge variant="outline">시장 기준수익률 {formatPercent(benchmarkReturn)}</Badge>
        </div>
        <Card>
          <CardContent className="pt-1">
            {historyPoints.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">아직 forward 성과 관측치가 없습니다.</p>
            ) : (
              <ComparisonChart
                benchmark={benchmarkReturn}
                data={historyPoints}
                showJoopick={false}
              />
            )}
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="holdings-heading" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="holdings-heading" className="text-base font-semibold">현재 보유 종목</h2>
          {holdings === null ? null : (
            <Badge variant="secondary">{holdings.length}개</Badge>
          )}
        </div>
        {holdings === null ? (
          <SectionFallback title="보유 현황" />
        ) : holdings.length === 0 ? (
          <EmptyState
            description="시뮬레이터가 실제 진입한 종목이 생기면 여기에 표시됩니다."
            title="현재 보유 종목이 없어요"
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>시뮬레이터 포지션</CardTitle>
              <CardDescription>최신 스냅샷의 holdings 원본 섹션</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-160 text-left text-sm">
                <thead className="border-b text-xs text-muted-foreground">
                  <tr>
                    <th className="pb-3 font-medium">종목</th>
                    <th className="pb-3 text-right font-medium">진입가</th>
                    <th className="pb-3 text-right font-medium">현재가</th>
                    <th className="pb-3 text-right font-medium">수익률</th>
                    <th className="pb-3 text-right font-medium">보유일</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {holdings.map((holding, index) => {
                    const returnPct = readNumber(holding, ["return_pct", "profit_rate", "return"]);
                    return (
                      <tr key={`${tickerOf(holding) ?? "holding"}-${index}`}>
                        <td className="py-4">
                          <p className="font-semibold">{nameOf(holding)}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{tickerOf(holding) ?? "코드 없음"}</p>
                        </td>
                        <td className="py-4 text-right tabular-nums">{formatNumber(readNumber(holding, ["entry_price", "buy_price"]))}</td>
                        <td className="py-4 text-right tabular-nums">{formatNumber(readNumber(holding, ["current_price", "price"]))}</td>
                        <td className={returnPct !== null && returnPct < 0 ? "py-4 text-right tabular-nums text-market-down" : "py-4 text-right tabular-nums text-market-up"}>{formatPercent(returnPct)}</td>
                        <td className="py-4 text-right tabular-nums">{formatNumber(readNumber(holding, ["holding_days", "days_held"]), 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
