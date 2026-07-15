import { Info } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getLatestPrismSnapshot,
  getPrismBenchmarkMeta,
  getPrismHistorySeries,
  joopickFractionToPrismPercent,
  type PrismHistoryPoint,
  type PrismMarket,
  type PrismSnapshot,
} from "@/lib/data/admin-prism";
import { getActiveShortList } from "@/lib/data/admin-shortlist";

import { EmptyState, PrismPageHeader, resolveMarket } from "../_components/prism-ui";
import { getJoopickPerformanceSeries, type JoopickPerformancePoint } from "../_lib/joopick-series";
import { tickerOf } from "../_lib/section-values";
import { ComparisonChart, type PrismComparisonPoint } from "./comparison-chart";

export const dynamic = "force-dynamic";

interface ComparePageProps {
  readonly searchParams: Promise<{ readonly market?: string | string[] }>;
}

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const market = resolveMarket((await searchParams).market);
  const [snapshot, history, meta] = await Promise.all([
    getLatestPrismSnapshot(market),
    getPrismHistorySeries(market),
    getPrismBenchmarkMeta(),
  ]);
  const marketMeta = meta.find((item) => item.market === market) ?? null;

  if (snapshot === null || marketMeta === null) {
    return (
      <div className="space-y-7">
        <PrismPageHeader description="동일한 forward 기간에 박제된 관측치만 병렬로 확인합니다." market={market} pathname="/admin/prism/compare" title="주픽 vs 프리즘" />
        <EmptyState description="최초 스냅샷과 불변 벤치마크 기준일이 모두 준비되면 비교를 시작합니다." title="비교 기준 데이터가 부족해요" />
      </div>
    );
  }

  const joopick = market === "kr" ? await getJoopickPerformanceSeries() : [];
  const shortlist = market === "kr" ? await getActiveShortList() : [];
  const firstJoopickDate = joopick[0]?.date;
  const benchmarkStartDate = market === "kr" && firstJoopickDate !== undefined
    ? maxDate(marketMeta.benchmarkSessionDate, firstJoopickDate)
    : marketMeta.benchmarkSessionDate;
  const chartData = buildComparisonSeries(history, joopick, market, benchmarkStartDate);
  const prismTickers = actualEntryTickers(snapshot);
  const shortlistByTicker = new Map(shortlist.map((item) => [item.ticker, item.name]));
  const overlap = [...prismTickers]
    .filter((ticker) => shortlistByTicker.has(ticker))
    .map((ticker) => ({ ticker, name: shortlistByTicker.get(ticker) ?? ticker }))
    .sort((left, right) => left.ticker.localeCompare(right.ticker));

  return (
    <div className="space-y-7">
      <PrismPageHeader
        description="각 아카이브 스냅샷의 terminal_performance 한 점만 사용해 forward 관측을 병렬로 봅니다."
        market={market}
        pathname="/admin/prism/compare"
        title="주픽 vs 프리즘"
        trailing={<Badge variant="outline">기준일 {benchmarkStartDate}</Badge>}
      />

      {market === "us" ? (
        <div className="rounded-2xl border border-info/30 bg-info/10 p-4 text-sm">
          <div className="flex gap-3"><Info aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-info" /><div><p className="font-semibold text-info">미국 시장은 프리즘 단독 표시</p><p className="mt-1 text-muted-foreground">주픽 US 포트폴리오 트랙이 없어 비교 대상이 없습니다.</p></div></div>
        </div>
      ) : null}
      {market === "kr" && joopick.length === 0 ? (
        <div className="rounded-2xl border border-info/30 bg-info/10 p-4 text-sm">
          <div className="flex gap-3"><Info aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-info" /><div><p className="font-semibold text-info">주픽 유효 스냅샷 대기</p><p className="mt-1 text-muted-foreground">첫 portfolio_snapshot 집계 행이 생길 때까지 프리즘 forward 관측만 표시합니다.</p></div></div>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Forward 누적수익률</CardTitle>
          <CardDescription>기간 정렬용 변환, 원본 재계산 아님 · 스냅샷당 1 관측치</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <EmptyState description="기준일 이후 terminal_performance가 쌓이면 차트를 표시합니다." title="비교할 forward 관측치가 없어요" />
          ) : (
            <ComparisonChart data={chartData} showJoopick={market === "kr"} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="grid grid-cols-[1fr_auto] gap-3">
          <div><CardTitle>픽 오버랩</CardTitle><CardDescription>프리즘 실제 진입 종목과 주픽 shortlist 교집합</CardDescription></div>
          <Badge variant="secondary">현재 활성 30 기준</Badge>
        </CardHeader>
        <CardContent>
          {market === "us" ? (
            <p className="text-sm text-muted-foreground">주픽 US 트랙 부재로 픽 오버랩을 계산하지 않습니다.</p>
          ) : overlap.length === 0 ? (
            <p className="text-sm text-muted-foreground">현재 활성 30과 겹치는 실제 진입 종목이 없습니다.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {overlap.map((item) => <Badge key={item.ticker} variant="outline">{item.name} · {item.ticker}</Badge>)}
            </div>
          )}
        </CardContent>
      </Card>

      <ComparisonDisclaimers />
    </div>
  );
}

function buildComparisonSeries(
  history: readonly PrismHistoryPoint[],
  joopick: readonly JoopickPerformancePoint[],
  market: PrismMarket,
  startDate: string,
): readonly PrismComparisonPoint[] {
  const prism = history.filter((point) => point.marketSessionDate >= startDate && point.terminalPerformance !== null);
  const prismBaseline = prism[0]?.terminalPerformance?.prismSimulatorReturn ?? 0;
  const joopickAligned = market === "kr" ? joopick.filter((point) => point.date >= startDate) : [];
  const joopickBaseline = joopickAligned[0] === undefined
    ? 0
    : joopickFractionToPrismPercent(joopickAligned[0].totalReturn);
  return prism.flatMap((point) => {
    if (point.terminalPerformance === null) return [];
    const alignedJoopick = joopickAligned
      .filter((candidate) => candidate.date <= point.marketSessionDate)
      .at(-1);
    const base = {
      date: point.marketSessionDate,
      prism: point.terminalPerformance.prismSimulatorReturn - prismBaseline,
      slot: point.snapshotSlot,
    };
    return alignedJoopick === undefined ? [base] : [{
      ...base,
      joopick: joopickFractionToPrismPercent(alignedJoopick.totalReturn) - joopickBaseline,
    }];
  });
}

function actualEntryTickers(snapshot: PrismSnapshot): ReadonlySet<string> {
  const entries = [...(snapshot.payload.tradingHistory ?? []), ...(snapshot.payload.holdings ?? [])];
  return new Set(entries.map(tickerOf).filter((ticker): ticker is string => ticker !== null));
}

function maxDate(left: string, right: string): string {
  return left >= right ? left : right;
}

function ComparisonDisclaimers() {
  return (
    <section aria-labelledby="comparison-notice-heading" className="rounded-2xl border border-border/60 bg-muted/40 p-5">
      <h2 id="comparison-notice-heading" className="font-semibold">비교 해석 시 유의사항</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
        <li>프리즘은 약 5일 스윙·장중, 주픽은 주간·월간으로 호라이즌이 달라 상이한 방법론의 참고 병렬 비교입니다. 우열을 단정하지 않습니다.</li>
        <li>프리즘 수치는 외부 엔진 산출물을 그대로 사용하며, 표시한 baseline subtraction은 기간 정렬용 변환이고 원본 재계산이 아닙니다.</li>
        <li>이 서비스는 정보를 제공하며 투자 자문이 아닙니다.</li>
        <li>충분한 forward 표본이 축적되기 전에는 통계적 우열을 주장하지 않습니다.</li>
      </ul>
    </section>
  );
}
