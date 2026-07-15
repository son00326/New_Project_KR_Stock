import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLatestPrismSnapshot } from "@/lib/data/admin-prism";

import {
  EmptyState,
  formatNumber,
  PrismPageHeader,
  resolveMarket,
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

interface WatchlistPageProps {
  readonly searchParams: Promise<{ readonly market?: string | string[] }>;
}

export default async function WatchlistPage({ searchParams }: WatchlistPageProps) {
  const market = resolveMarket((await searchParams).market);
  const snapshot = await getLatestPrismSnapshot(market);
  const watchlist = snapshot?.payload.watchlist ?? null;
  const groups = watchlist === null ? [] : groupByDate(watchlist);

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
