import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLatestPrismSnapshot } from "@/lib/data/admin-prism";

import {
  EmptyState,
  formatNumber,
  formatPercent,
  MetricCard,
  PrismPageHeader,
  resolveMarket,
  resolvePage,
  SectionFallback,
} from "../_components/prism-ui";
import { dateOf, nameOf, readNumber, readString, tickerOf } from "../_lib/section-values";

const PAGE_SIZE = 20;

export const dynamic = "force-dynamic";

interface TradesPageProps {
  readonly searchParams: Promise<{
    readonly market?: string | string[];
    readonly page?: string | string[];
  }>;
}

export default async function TradesPage({ searchParams }: TradesPageProps) {
  const params = await searchParams;
  const market = resolveMarket(params.market);
  const page = resolvePage(params.page);
  const snapshot = await getLatestPrismSnapshot(market);
  const trades = snapshot?.payload.tradingHistory ?? null;
  const summary = snapshot?.payload.summary ?? null;
  const pageCount = trades === null
    ? 0
    : Math.max(1, Math.ceil(trades.length / PAGE_SIZE));
  const currentPage = pageCount === 0 ? 1 : Math.min(page, pageCount);
  const visibleTrades = trades?.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE) ?? [];

  return (
    <div className="space-y-7">
      <PrismPageHeader
        description="완료된 시뮬레이터 거래와 외부 엔진이 함께 저장한 precomputed 통계를 확인합니다."
        market={market}
        pathname="/admin/prism/trades"
        title="거래 내역"
      />

      {snapshot === null ? (
        <EmptyState description="첫 스냅샷 수집 후 거래 내역이 표시됩니다." title="아직 수집된 스냅샷이 없어요" />
      ) : (
        <>
          {summary === null ? (
            <SectionFallback title="거래 통계" />
          ) : (
            <section aria-label="거래 통계" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="승률" value={formatPercent(readNumber(summary, ["win_rate", "winning_rate"]))} />
              <MetricCard label="Profit Factor" value={formatNumber(readNumber(summary, ["profit_factor", "pf"]))} />
              <MetricCard label="평균 수익" value={formatPercent(readNumber(summary, ["average_profit", "avg_profit", "average_win"]))} />
              <MetricCard label="평균 손실" value={formatPercent(readNumber(summary, ["average_loss", "avg_loss"]))} />
            </section>
          )}

          {trades === null ? (
            <SectionFallback title="거래 내역" />
          ) : trades.length === 0 ? (
            <EmptyState description="시뮬레이터가 거래를 완료하면 건별 기록과 AI 근거가 표시됩니다." title="완료된 거래가 없어요" />
          ) : (
            <section aria-label="거래 목록" className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">총 {trades.length.toLocaleString("ko-KR")}건</p>
                <Badge variant="outline">{currentPage} / {pageCount} 페이지</Badge>
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                {visibleTrades.map((trade, index) => {
                  const returnPct = readNumber(trade, ["return_pct", "profit_rate", "realized_return"]);
                  return (
                    <Card key={`${tickerOf(trade) ?? "trade"}-${dateOf(trade)}-${index}`}>
                      <CardHeader className="grid grid-cols-[1fr_auto] gap-3">
                        <div>
                          <CardTitle>{nameOf(trade)}</CardTitle>
                          <p className="mt-1 text-xs text-muted-foreground">{dateOf(trade)} · {tickerOf(trade) ?? "코드 없음"}</p>
                        </div>
                        <Badge className={returnPct !== null && returnPct < 0 ? "bg-market-down/10 text-market-down" : "bg-market-up/10 text-market-up"}>{formatPercent(returnPct)}</Badge>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <dl className="grid grid-cols-3 gap-3 rounded-xl bg-muted/60 p-4 text-sm">
                          <div><dt className="text-xs text-muted-foreground">진입가</dt><dd className="mt-1 font-semibold tabular-nums">{formatNumber(readNumber(trade, ["entry_price", "buy_price"]))}</dd></div>
                          <div><dt className="text-xs text-muted-foreground">청산가</dt><dd className="mt-1 font-semibold tabular-nums">{formatNumber(readNumber(trade, ["exit_price", "sell_price"]))}</dd></div>
                          <div><dt className="text-xs text-muted-foreground">보유일</dt><dd className="mt-1 font-semibold tabular-nums">{formatNumber(readNumber(trade, ["holding_days", "days_held"]), 0)}일</dd></div>
                        </dl>
                        <details className="group rounded-xl border border-border/60 px-4 py-3">
                          <summary className="cursor-pointer list-none text-sm font-semibold">AI 근거 펼쳐보기</summary>
                          <p className="mt-3 border-t pt-3 text-sm leading-6 text-muted-foreground">{readString(trade, ["ai_reason", "reason", "rationale", "analysis"]) ?? "저장된 AI 근거가 없습니다."}</p>
                        </details>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              <nav aria-label="거래 내역 페이지" className="flex justify-end gap-2">
                {currentPage > 1 ? <PageLink direction="previous" market={market} page={currentPage - 1} /> : null}
                {currentPage < pageCount ? <PageLink direction="next" market={market} page={currentPage + 1} /> : null}
              </nav>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function PageLink({ direction, market, page }: { readonly direction: "previous" | "next"; readonly market: "kr" | "us"; readonly page: number }) {
  return (
    <Link className="inline-flex items-center gap-1 rounded-xl border bg-card px-3 py-2 text-sm font-semibold shadow-toss-sm hover:bg-muted" href={`/admin/prism/trades?market=${market}&page=${page}`}>
      {direction === "previous" ? <ChevronLeft aria-hidden="true" className="size-4" /> : null}
      {direction === "previous" ? "이전" : "다음"}
      {direction === "next" ? <ChevronRight aria-hidden="true" className="size-4" /> : null}
    </Link>
  );
}
