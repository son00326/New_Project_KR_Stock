import Link from "next/link";
import {
  MOCK_ADMIN_PERFORMANCE_SUMMARY,
  MOCK_ADMIN_MONTHLY_PERFORMANCE,
  MOCK_ADMIN_BUCKET_PERFORMANCE,
  MOCK_ADMIN_COUNTERFACTUAL,
} from "@/lib/data/mock-admin-performance";

// T4.3 — /admin/track-record
// R3.11-1~4: 5 summary cards · 월별 성과 · 버킷별 집계 · Counterfactual · CAP Months 링크
// Server Component (no "use client")

// ─── 포맷 헬퍼 ───────────────────────────────────────────────────────────────
function fmtPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${(n * 100).toFixed(1)}%`;
}

function fmtNum(n: number): string {
  return n.toFixed(2);
}

const BUCKET_LABEL: Record<"short" | "mid" | "long", string> = {
  short: "단기 (Short)",
  mid: "중기 (Mid)",
  long: "장기 (Long)",
};

// ─── 색상 클래스 헬퍼 ────────────────────────────────────────────────────────
function colorClass(n: number): string {
  return n >= 0
    ? "text-[color:var(--color-market-up)]"
    : "text-[color:var(--color-market-down)]";
}

export default function AdminTrackRecordPage() {
  const summary = MOCK_ADMIN_PERFORMANCE_SUMMARY;
  const monthly = MOCK_ADMIN_MONTHLY_PERFORMANCE;
  const buckets = MOCK_ADMIN_BUCKET_PERFORMANCE;
  const cf = MOCK_ADMIN_COUNTERFACTUAL;

  return (
    <div className="space-y-8">
      {/* ── 헤더 ─────────────────────────────────────────────────────────── */}
      <header>
        <h1 className="text-2xl font-semibold">Track Record</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          가상 포트폴리오 누적 성과 · 월별·버킷별 분해 · Counterfactual
        </p>
      </header>

      {/* ── R3.11-1: 5 Summary Cards ──────────────────────────────────────── */}
      <section aria-label="누적 성과 요약">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {/* 누적 수익률 */}
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">누적 수익률</p>
            <p className={`mt-1 text-xl font-semibold tabular-nums ${colorClass(summary.cumulativeReturn)}`}>
              {fmtPct(summary.cumulativeReturn)}
            </p>
          </div>

          {/* KOSPI 동기간 */}
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">KOSPI 동기간</p>
            <p className={`mt-1 text-xl font-semibold tabular-nums ${colorClass(summary.cumulativeKospi)}`}>
              {fmtPct(summary.cumulativeKospi)}
            </p>
          </div>

          {/* Alpha */}
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">Alpha</p>
            <p className={`mt-1 text-xl font-semibold tabular-nums ${colorClass(summary.cumulativeAlpha)}`}>
              {fmtPct(summary.cumulativeAlpha)}
            </p>
          </div>

          {/* Sharpe */}
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">Sharpe</p>
            <p className={`mt-1 text-xl font-semibold tabular-nums ${colorClass(summary.cumulativeSharpe - 0.5)}`}>
              {fmtNum(summary.cumulativeSharpe)}
            </p>
          </div>

          {/* MDD */}
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">MDD</p>
            <p className={`mt-1 text-xl font-semibold tabular-nums ${colorClass(summary.cumulativeMdd)}`}>
              {fmtPct(summary.cumulativeMdd)}
            </p>
          </div>
        </div>
      </section>

      {/* ── R3.11-4: CAP Months 참조 카드 ────────────────────────────────── */}
      <section aria-label="NSM CAP Months">
        <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-4">
          <div>
            <p className="text-xs text-muted-foreground">NSM · CAP Months</p>
            <p className="mt-1 text-lg font-semibold">
              {summary.currentCapMonths}/12개월 진행 중
            </p>
          </div>
          <Link
            href="/admin/decision-tree"
            className="text-sm font-medium text-primary underline"
          >
            Decision Tree에서 상세 보기 →
          </Link>
        </div>
      </section>

      {/* ── R3.11-2: 월별 성과 테이블 ────────────────────────────────────── */}
      <section aria-labelledby="monthly-heading">
        <h2 id="monthly-heading" className="mb-3 text-lg font-semibold">
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

      {/* ── R3.11-2: 버킷별 집계 ─────────────────────────────────────────── */}
      <section aria-labelledby="bucket-heading">
        <h2 id="bucket-heading" className="mb-3 text-lg font-semibold">
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

      {/* ── R3.11-3: Counterfactual ───────────────────────────────────────── */}
      <section aria-labelledby="counterfactual-heading">
        <h2 id="counterfactual-heading" className="mb-3 text-lg font-semibold">
          Counterfactual
        </h2>
        <div className="rounded-lg border bg-card p-4 space-y-2">
          <p className="text-sm">
            AI 비중 그대로 따랐으면 수익률:{" "}
            <strong className={colorClass(cf.aiOnlyReturn)}>
              {fmtPct(cf.aiOnlyReturn)}
            </strong>
          </p>
          <p className="text-sm">
            실제(어드민 오버라이드 반영):{" "}
            <strong className={colorClass(cf.actualReturn)}>
              {fmtPct(cf.actualReturn)}
            </strong>
          </p>
          <p className="text-sm">
            차이:{" "}
            <strong className={colorClass(-cf.deltaPct)}>
              {fmtPct(cf.deltaPct)}
            </strong>{" "}
            {cf.deltaPct > 0
              ? "(오버라이드가 수익 감소)"
              : "(오버라이드가 수익 증대)"}
          </p>
          <p className="text-xs text-muted-foreground">{cf.note}</p>
        </div>
      </section>
    </div>
  );
}
