// PR4 Task 3 Step 3.2 — TrackRecordTabs (Group A + F 해소: 누적 vs 월별 아카이브 탭 분리).
// SoT plan: docs/superpowers/plans/2026-05-25-pr4-ui-caller-wire.md §Step 3.2 (lines 1067-1094).
//
// 'use client' client island (Server Component page.tsx에서 props 주입).
// shadcn Tabs (base-ui) 사용. defaultValue='cumulative'.

'use client';

import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type {
  TrackRecordCumulative,
  TrackRecordArchiveEntry,
} from './actions';

interface TrackRecordTabsProps {
  cumulative: TrackRecordCumulative;
  archives: TrackRecordArchiveEntry[];
}

// ─── 포맷 헬퍼 (page.tsx와 동일 시그니처 — 코드 정합 보존) ───────────────────
function fmtPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${(n * 100).toFixed(1)}%`;
}

function fmtNum(n: number): string {
  return n.toFixed(2);
}

const BUCKET_LABEL: Record<'short' | 'mid' | 'long', string> = {
  short: '단기 (Short)',
  mid: '중기 (Mid)',
  long: '장기 (Long)',
};

function colorClass(n: number): string {
  return n >= 0
    ? 'text-[color:var(--color-market-up)]'
    : 'text-[color:var(--color-market-down)]';
}

function formatMonthLabel(month: string): string {
  // 'YYYY-MM-01' → 'YYYY년 M월'
  const [y, m] = month.split('-');
  return `${y}년 ${Number(m)}월`;
}

export function TrackRecordTabs({ cumulative, archives }: TrackRecordTabsProps) {
  return (
    <Tabs defaultValue="cumulative">
      <TabsList aria-label="Track Record 탭">
        <TabsTrigger value="cumulative">누적 성과</TabsTrigger>
        <TabsTrigger value="archive">월별 아카이브</TabsTrigger>
      </TabsList>

      {/* ── 누적 성과 탭 ─────────────────────────────────────────────────── */}
      <TabsContent value="cumulative" className="space-y-8 pt-4">
        <CumulativeContent data={cumulative} />
      </TabsContent>

      {/* ── 월별 아카이브 탭 ─────────────────────────────────────────────── */}
      <TabsContent value="archive" className="space-y-6 pt-4">
        <ArchiveContent entries={archives} />
      </TabsContent>
    </Tabs>
  );
}

// ─── Cumulative content ─────────────────────────────────────────────────────
function CumulativeContent({ data }: { data: TrackRecordCumulative }) {
  const { summary, monthly, buckets, counterfactual, capMonths } = data;
  const isEmpty =
    summary === null && monthly.length === 0 && buckets.length === 0;

  if (isEmpty) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 px-6 py-10 text-center">
        <p className="text-sm font-medium">운용 데이터 누적 후 산출</p>
        <p className="mt-2 text-sm text-muted-foreground">
          가상 포트 스냅샷이 적재되면 누적 성과 · 월별 · 버킷별 분해가 표시됩니다.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* R3.11-1: 5 Summary Cards */}
      {summary && (
        <section aria-label="누적 성과 요약">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">누적 수익률</p>
              <p className={`mt-1 text-xl font-semibold tabular-nums ${colorClass(summary.cumulativeReturn)}`}>
                {fmtPct(summary.cumulativeReturn)}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">KOSPI 동기간</p>
              <p className={`mt-1 text-xl font-semibold tabular-nums ${colorClass(summary.cumulativeKospi)}`}>
                {fmtPct(summary.cumulativeKospi)}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">Alpha</p>
              <p className={`mt-1 text-xl font-semibold tabular-nums ${colorClass(summary.cumulativeAlpha)}`}>
                {fmtPct(summary.cumulativeAlpha)}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">Sharpe</p>
              <p className={`mt-1 text-xl font-semibold tabular-nums ${colorClass(summary.cumulativeSharpe - 0.5)}`}>
                {fmtNum(summary.cumulativeSharpe)}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">MDD</p>
              <p className={`mt-1 text-xl font-semibold tabular-nums ${colorClass(summary.cumulativeMdd)}`}>
                {fmtPct(summary.cumulativeMdd)}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* R3.11-4: CAP Months 참조 카드 */}
      <section aria-label="NSM CAP Months">
        <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-4">
          <div>
            <p className="text-xs text-muted-foreground">NSM · CAP Months</p>
            <p className="mt-1 text-lg font-semibold">{capMonths}/12개월 진행 중</p>
          </div>
          <Link href="/admin/decision-tree" className="text-sm font-medium text-primary underline">
            Decision Tree에서 상세 보기 →
          </Link>
        </div>
      </section>

      {/* R3.11-2: 월별 성과 테이블 */}
      {monthly.length > 0 && (
        <section aria-labelledby="cumulative-monthly-heading">
          <h2 id="cumulative-monthly-heading" className="mb-3 text-lg font-semibold">
            월별 성과
          </h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr className="text-xs text-muted-foreground">
                  <th className="py-2 pl-4 text-left">월</th>
                  <th className="py-2 pr-3 text-right">포트</th>
                  <th className="py-2 pr-3 text-right">KOSPI</th>
                  <th className="py-2 pr-3 text-right">Alpha</th>
                  <th className="py-2 pr-3 text-right">Sharpe</th>
                  <th className="py-2 pr-4 text-right">CAP 연속</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {monthly.map((row) => (
                  <tr key={row.month} className="hover:bg-muted/20">
                    <td className="py-2.5 pl-4 font-mono">{row.month}</td>
                    <td className={`py-2.5 pr-3 text-right tabular-nums ${colorClass(row.portfolioReturn)}`}>
                      {fmtPct(row.portfolioReturn)}
                    </td>
                    <td className={`py-2.5 pr-3 text-right tabular-nums ${colorClass(row.kospiReturn)}`}>
                      {fmtPct(row.kospiReturn)}
                    </td>
                    <td className={`py-2.5 pr-3 text-right tabular-nums ${colorClass(row.alpha)}`}>
                      {fmtPct(row.alpha)}
                    </td>
                    <td className={`py-2.5 pr-3 text-right tabular-nums ${colorClass(row.sharpe - 0.5)}`}>
                      {fmtNum(row.sharpe)}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-muted-foreground">
                      {row.capStreak}개월
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* R3.11-2: 버킷별 집계 */}
      {buckets.length > 0 && (
        <section aria-labelledby="cumulative-bucket-heading">
          <h2 id="cumulative-bucket-heading" className="mb-3 text-lg font-semibold">
            버킷별 집계
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {buckets.map((b) => (
              <div key={b.bucket} className="rounded-lg border bg-card p-4 space-y-2">
                <p className="text-sm font-semibold">{BUCKET_LABEL[b.bucket]}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>누적 수익률</span>
                  <span className={`font-mono font-semibold ${colorClass(b.cumulativeReturn)}`}>
                    {fmtPct(b.cumulativeReturn)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Sharpe</span>
                  <span className={`font-mono font-semibold ${colorClass(b.sharpe - 0.5)}`}>
                    {fmtNum(b.sharpe)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>편입 종목</span>
                  <span className="font-mono font-semibold">{b.tickerCount}종</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* R3.11-3: Counterfactual */}
      <section aria-labelledby="cumulative-counterfactual-heading">
        <h2 id="cumulative-counterfactual-heading" className="mb-3 text-lg font-semibold">
          Counterfactual
        </h2>
        {counterfactual === null ? (
          <div className="rounded-lg border border-dashed bg-muted/20 px-6 py-6 text-center">
            <p className="text-sm font-medium">운용 데이터 누적 후 산출</p>
            <p className="mt-2 text-sm text-muted-foreground">
              AI 비중 시계열 저장 정책은 D11/S9 이후 결정됩니다.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <p className="text-sm">
              AI 비중 그대로 따랐으면 수익률:{' '}
              <strong className={colorClass(counterfactual.aiOnlyReturn)}>
                {fmtPct(counterfactual.aiOnlyReturn)}
              </strong>
            </p>
            <p className="text-sm">
              실제(어드민 오버라이드 반영):{' '}
              <strong className={colorClass(counterfactual.actualReturn)}>
                {fmtPct(counterfactual.actualReturn)}
              </strong>
            </p>
            <p className="text-sm">
              차이:{' '}
              <strong className={colorClass(-counterfactual.deltaPct)}>
                {fmtPct(counterfactual.deltaPct)}
              </strong>{' '}
              {counterfactual.deltaPct > 0
                ? '(오버라이드가 수익 감소)'
                : '(오버라이드가 수익 증대)'}
            </p>
            <p className="text-xs text-muted-foreground">{counterfactual.note}</p>
          </div>
        )}
      </section>
    </>
  );
}

// ─── Archive content ────────────────────────────────────────────────────────
function ArchiveContent({ entries }: { entries: TrackRecordArchiveEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 px-6 py-10 text-center">
        <p className="text-sm font-medium">월별 아카이브 없음</p>
        <p className="mt-2 text-sm text-muted-foreground">
          풀 리포트가 생성된 월부터 여기에 누적됩니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {entries.map((entry) => (
        <section
          key={entry.month}
          aria-labelledby={`archive-month-${entry.month}`}
          className="rounded-lg border bg-card p-4 space-y-3"
        >
          <header className="flex items-center justify-between">
            <h3 id={`archive-month-${entry.month}`} className="text-base font-semibold">
              {formatMonthLabel(entry.month)}
            </h3>
            <ApprovalBadge approval={entry.approval} />
          </header>

          <p className="text-xs text-muted-foreground">{entry.reports.length}종목 풀 리포트</p>

          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 md:grid-cols-3">
            {entry.reports.map((r) => (
              <li key={`${entry.month}-${r.ticker}`}>
                <Link
                  href={`/admin/report/${r.ticker}`}
                  className="flex items-center justify-between rounded border px-2 py-1.5 text-sm hover:bg-muted/30"
                >
                  <span className="font-mono">{r.ticker}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {r.name ?? '-'}{r.sector ? ` · ${r.sector}` : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ApprovalBadge({ approval }: { approval: TrackRecordArchiveEntry['approval'] }) {
  if (approval === null) {
    return (
      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        미승인
      </span>
    );
  }
  if (approval.approvalType === 'accept') {
    return (
      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
        {approval.isFinal ? '승인 확정' : '승인 (미확정)'}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
      반려{approval.isFinal ? ' 확정' : ''}
    </span>
  );
}
