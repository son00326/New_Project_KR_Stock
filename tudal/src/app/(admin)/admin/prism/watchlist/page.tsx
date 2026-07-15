import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLatestPrismSnapshot } from "@/lib/data/admin-prism";

import {
  EmptyState,
  formatNumber,
  PrismPageHeader,
  resolveMarket,
  resolvePage,
  SectionFallback,
} from "../_components/prism-ui";
import {
  dateOf,
  nameOf,
  readNumber,
  readString,
  tickerOf,
  type PrismRecord,
} from "../_lib/section-values";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

interface WatchlistPageProps {
  readonly searchParams: Promise<{
    readonly market?: string | string[];
    readonly page?: string | string[];
  }>;
}

export default async function WatchlistPage({ searchParams }: WatchlistPageProps) {
  const params = await searchParams;
  const market = resolveMarket(params.market);
  const page = resolvePage(params.page);
  const snapshot = await getLatestPrismSnapshot(market);
  const watchlist = snapshot?.payload.watchlist ?? null;
  const pageCount = watchlist === null ? 0 : Math.max(1, Math.ceil(watchlist.length / PAGE_SIZE));
  const currentPage = pageCount === 0 ? 1 : Math.min(page, pageCount);
  const visible = watchlist?.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE) ?? [];
  const groups = groupByDate(visible);
  const remainingCount = watchlist === null ? 0 : watchlist.length - visible.length;

  return (
    <div className="space-y-7">
      <PrismPageHeader
        description="외부 엔진이 관찰 중인 후보를 날짜별로 봅니다. 후보 점수와 진입 보류 사유는 엔진 산출물을 그대로 표시합니다."
        market={market}
        pathname="/admin/prism/watchlist"
        title="관심 종목"
      />

      {snapshot === null ? (
        <EmptyState description="첫 스냅샷 수집 후 관심 종목이 표시됩니다." title="아직 수집된 스냅샷이 없어요" />
      ) : watchlist === null ? (
        <SectionFallback title="관심 종목" />
      ) : watchlist.length === 0 ? (
        <EmptyState description="새 후보가 탐지되면 점수와 진입 보류 사유를 함께 표시합니다." title="관찰 중인 후보가 없어요" />
      ) : (
        <div className="space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              총 {watchlist.length.toLocaleString("ko-KR")}건 · 현재 {visible.length}건 표시 · 나머지 {remainingCount.toLocaleString("ko-KR")}건
            </p>
            <Badge variant="outline">{currentPage} / {pageCount} 페이지</Badge>
          </div>
          {groups.map((group) => (
            <section key={group.date} aria-labelledby={`watchlist-${group.date}`} className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 id={`watchlist-${group.date}`} className="text-base font-semibold">{group.date}</h2>
                <Badge variant="secondary">{group.items.length}개</Badge>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {group.items.map((candidate, index) => {
                  const skipReason = readString(candidate, ["skip_reason", "skipReason", "reason"]);
                  return (
                    <Card key={`${tickerOf(candidate) ?? "candidate"}-${index}`}>
                      <CardHeader className="grid grid-cols-[1fr_auto] gap-3">
                        <div>
                          <CardTitle>{nameOf(candidate)}</CardTitle>
                          <p className="mt-1 text-xs text-muted-foreground">{tickerOf(candidate) ?? "코드 없음"}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">후보 점수</p>
                          <p className="mt-1 text-xl font-bold tabular-nums">{formatNumber(readNumber(candidate, ["score", "total_score", "confidence"]), 1)}</p>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="rounded-xl bg-muted/60 p-4">
                          <p className="text-xs font-medium text-muted-foreground">Skip 사유</p>
                          <p className="mt-2 text-sm leading-6">{skipReason ?? "진입 보류 사유가 기록되지 않았습니다."}</p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
          <nav aria-label="관심 종목 페이지" className="flex justify-end gap-2">
            {currentPage > 1 ? <PageLink direction="previous" market={market} page={currentPage - 1} /> : null}
            {currentPage < pageCount ? <PageLink direction="next" market={market} page={currentPage + 1} /> : null}
          </nav>
        </div>
      )}
    </div>
  );
}

function groupByDate(records: readonly PrismRecord[]): readonly {
  readonly date: string;
  readonly items: readonly PrismRecord[];
}[] {
  const dates = [...new Set(records.map(dateOf))].sort((left, right) => right.localeCompare(left));
  return dates.map((date) => ({ date, items: records.filter((record) => dateOf(record) === date) }));
}

function PageLink({
  direction,
  market,
  page,
}: {
  readonly direction: "previous" | "next";
  readonly market: "kr" | "us";
  readonly page: number;
}) {
  return (
    <Link className="inline-flex items-center gap-1 rounded-xl border bg-card px-3 py-2 text-sm font-semibold shadow-toss-sm hover:bg-muted" href={`/admin/prism/watchlist?market=${market}&page=${page}`}>
      {direction === "previous" ? <ChevronLeft aria-hidden="true" className="size-4" /> : null}
      {direction === "previous" ? "이전" : "다음"}
      {direction === "next" ? <ChevronRight aria-hidden="true" className="size-4" /> : null}
    </Link>
  );
}
