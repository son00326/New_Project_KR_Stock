import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLatestPrismSnapshot } from "@/lib/data/admin-prism";

import {
  EmptyState,
  formatPercent,
  PrismPageHeader,
  resolveMarket,
  resolvePage,
  SectionFallback,
} from "../_components/prism-ui";
import {
  dateOf,
  readExtraArray,
  readExtraRecord,
  readNumber,
  readString,
  type PrismRecord,
} from "../_lib/section-values";

const JOURNAL_VISIBLE_LIMIT = 10;

export const dynamic = "force-dynamic";

interface InsightsPageProps {
  readonly searchParams: Promise<{
    readonly market?: string | string[];
    readonly page?: string | string[];
  }>;
}

export default async function InsightsPage({ searchParams }: InsightsPageProps) {
  const params = await searchParams;
  const market = resolveMarket(params.market);
  const page = resolvePage(params.page);
  const snapshot = await getLatestPrismSnapshot(market);
  const extra = snapshot?.payload.extraSections;
  const triggers = extra === undefined ? null : readExtraArray(extra, ["trigger_confidence", "trigger_confidences", "trigger_stats"]);
  const principles = extra === undefined ? null : readExtraArray(extra, ["principles", "investment_principles", "trading_principles"]);
  const journal = extra === undefined ? null : readExtraArray(extra, ["journal", "journals", "investment_journal", "trading_journal"]);
  const intuition = extra === undefined ? null : readExtraRecord(extra, ["intuition", "market_intuition", "insight"]);

  return (
    <div className="space-y-7">
      <PrismPageHeader
        description="외부 엔진이 기록한 트리거 신뢰도, 운용 원칙과 저널을 섹션별로 격리해 읽습니다."
        market={market}
        pathname="/admin/prism/insights"
        title="인사이트"
      />

      {snapshot === null ? (
        <EmptyState description="첫 스냅샷 수집 후 인사이트 섹션이 표시됩니다." title="아직 수집된 스냅샷이 없어요" />
      ) : (
        <>
          <InsightTriggers records={triggers} />
          <div className="grid gap-6 xl:grid-cols-2">
            <InsightPrinciples records={principles} />
            <InsightIntuition record={intuition} />
          </div>
          <InsightJournal market={market} page={page} records={journal} />
        </>
      )}
    </div>
  );
}

function InsightTriggers({ records }: { readonly records: readonly PrismRecord[] | null }) {
  if (records === null) return <SectionFallback title="트리거 신뢰도" />;
  if (records.length === 0) return <EmptyState description="트리거 표본이 쌓이면 신뢰도 표가 표시됩니다." title="트리거 통계가 없어요" />;
  return (
    <Card>
      <CardHeader><CardTitle>트리거 신뢰도</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-140 text-left text-sm">
          <thead className="border-b text-xs text-muted-foreground"><tr><th className="pb-3 font-medium">트리거</th><th className="pb-3 text-right font-medium">신뢰도</th><th className="pb-3 text-right font-medium">표본</th><th className="pb-3 text-right font-medium">상태</th></tr></thead>
          <tbody className="divide-y divide-border/60">
            {records.map((record, index) => <tr key={`${readString(record, ["trigger", "name", "type"]) ?? "trigger"}-${index}`}><td className="py-4 font-semibold">{readString(record, ["trigger", "name", "type"]) ?? "미분류"}</td><td className="py-4 text-right tabular-nums">{formatPercent(readNumber(record, ["confidence", "hit_rate", "accuracy"]))}</td><td className="py-4 text-right tabular-nums">{readNumber(record, ["count", "sample_count", "trades"]) ?? "—"}</td><td className="py-4 text-right"><Badge variant="secondary">{readString(record, ["status", "grade"]) ?? "관찰"}</Badge></td></tr>)}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function InsightPrinciples({ records }: { readonly records: readonly PrismRecord[] | null }) {
  if (records === null) return <SectionFallback title="운용 원칙" />;
  return <Card><CardHeader><CardTitle>운용 원칙</CardTitle></CardHeader><CardContent>{records.length === 0 ? <p className="text-sm text-muted-foreground">기록된 원칙이 없습니다.</p> : <ol className="space-y-3">{records.map((record, index) => <li key={index} className="flex gap-3 text-sm leading-6"><span className="font-semibold text-primary">{index + 1}</span><span>{readString(record, ["principle", "text", "content", "rule"]) ?? "내용 없음"}</span></li>)}</ol>}</CardContent></Card>;
}

function InsightIntuition({ record }: { readonly record: PrismRecord | null }) {
  if (record === null) return <SectionFallback title="시장 직관" />;
  return <Card><CardHeader><CardTitle>시장 직관</CardTitle></CardHeader><CardContent className="space-y-3"><Badge variant="outline">{readString(record, ["regime", "market_state", "status"]) ?? "현재 관찰"}</Badge><p className="text-sm leading-6">{readString(record, ["intuition", "summary", "content", "analysis"]) ?? "기록된 직관 내용이 없습니다."}</p></CardContent></Card>;
}

function InsightJournal({
  market,
  page,
  records,
}: {
  readonly market: "kr" | "us";
  readonly page: number;
  readonly records: readonly PrismRecord[] | null;
}) {
  if (records === null) return <SectionFallback title="저널" />;
  if (records.length === 0) return <EmptyState description="외부 엔진의 판단 기록이 쌓이면 시간순으로 표시됩니다." title="저널 기록이 없어요" />;
  const pageCount = Math.max(1, Math.ceil(records.length / JOURNAL_VISIBLE_LIMIT));
  const currentPage = Math.min(page, pageCount);
  const visible = records.slice(
    (currentPage - 1) * JOURNAL_VISIBLE_LIMIT,
    currentPage * JOURNAL_VISIBLE_LIMIT,
  );
  const remainingCount = records.length - visible.length;
  return (
    <Card>
      <CardHeader className="grid grid-cols-[1fr_auto] gap-3"><CardTitle>저널</CardTitle><Badge variant="secondary">현재 {visible.length}건 · 나머지 {remainingCount}건</Badge></CardHeader>
      <CardContent className="space-y-3">
        {visible.map((record, index) => <JournalEntry key={`${dateOf(record)}-${index}`} record={record} />)}
        <nav aria-label="저널 페이지" className="flex items-center justify-end gap-2 pt-2">
          {currentPage > 1 ? <JournalPageLink direction="previous" market={market} page={currentPage - 1} /> : null}
          {currentPage < pageCount ? <JournalPageLink direction="next" market={market} page={currentPage + 1} /> : null}
        </nav>
      </CardContent>
    </Card>
  );
}

function JournalEntry({ record }: { readonly record: PrismRecord }) {
  return <article className="rounded-xl bg-muted/60 p-4"><p className="text-xs font-medium text-muted-foreground">{dateOf(record)}</p><p className="mt-2 text-sm leading-6">{readString(record, ["content", "note", "reflection", "summary"]) ?? "내용 없음"}</p></article>;
}

function JournalPageLink({
  direction,
  market,
  page,
}: {
  readonly direction: "previous" | "next";
  readonly market: "kr" | "us";
  readonly page: number;
}) {
  return (
    <Link className="inline-flex items-center gap-1 rounded-xl border bg-card px-3 py-2 text-sm font-semibold shadow-toss-sm hover:bg-muted" href={`/admin/prism/insights?market=${market}&page=${page}`}>
      {direction === "previous" ? <ChevronLeft aria-hidden="true" className="size-4" /> : null}
      {direction === "previous" ? "이전" : "다음"}
      {direction === "next" ? <ChevronRight aria-hidden="true" className="size-4" /> : null}
    </Link>
  );
}
