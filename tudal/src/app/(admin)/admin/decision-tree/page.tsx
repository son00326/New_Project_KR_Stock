import Link from "next/link";
import {
  judgeDecisionTree,
  ALPHA_THRESHOLD,
  SHARPE_THRESHOLD,
  MDD_THRESHOLD,
} from "@/lib/performance/judge";
import { computeCapMonths, CAP_MONTHS_TARGET } from "@/lib/performance/cap-months";
import { getDecisionTreeSnapshot } from "@/lib/data/admin-decision-tree";
import { DecisionTreeTrendChart } from "./trend-chart";

export default async function AdminDecisionTreePage() {
  const snap = await getDecisionTreeSnapshot();

  if (snap === null) {
    return (
      <div className="space-y-8">
        <header>
          <h1 className="text-2xl font-semibold">Decision Tree</h1>
          <p className="text-sm text-muted-foreground">
            CAP Months · 누적 Alpha · Sharpe 게이지 3종 · 복합 AND 판정 (BL-8 A).
          </p>
        </header>
        <div className="rounded-lg border border-dashed bg-muted/20 px-6 py-10 text-center">
          <p className="text-sm font-medium">운용 데이터 누적 후 산출</p>
          <p className="mt-2 text-sm text-muted-foreground">
            가상 포트 스냅샷이 적재되면 게이지 · 판정 · 월별 추이가 표시됩니다.
          </p>
        </div>
      </div>
    );
  }

  const result = judgeDecisionTree({
    alpha: snap.cumulativeAlpha,
    sharpe: snap.cumulativeSharpe,
    mdd: snap.cumulativeMdd,
  });
  const capMonths = computeCapMonths(snap.monthlyVerdicts);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Decision Tree</h1>
        <p className="text-sm text-muted-foreground">
          CAP Months · 누적 Alpha · Sharpe 게이지 3종 · 복합 AND 판정 (BL-8 A).
        </p>
      </header>

      {/* R3.11-6: 게이지 3종 */}
      <section aria-label="게이지">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* CAP Months gauge */}
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">CAP Months</p>
            <p className="mt-1 text-2xl font-semibold">
              {capMonths.currentStreak}/{CAP_MONTHS_TARGET}
            </p>
            <div className="mt-3 h-2 w-full rounded bg-muted overflow-hidden">
              <div
                className="h-full bg-primary"
                style={{
                  width: `${(capMonths.currentStreak / CAP_MONTHS_TARGET) * 100}%`,
                }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {capMonths.currentStreak}/12개월 진행 중
            </p>
          </div>

          {/* Alpha gauge */}
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">누적 Alpha</p>
            <p
              className={`mt-1 text-2xl font-semibold ${
                snap.cumulativeAlpha >= 0
                  ? "text-[color:var(--color-market-up)]"
                  : "text-[color:var(--color-market-down)]"
              }`}
            >
              {(snap.cumulativeAlpha * 100).toFixed(2)}%
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              목표: ≥ {(ALPHA_THRESHOLD * 100).toFixed(0)}% (양수)
            </p>
          </div>

          {/* Sharpe gauge */}
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">Sharpe</p>
            <p className="mt-1 text-2xl font-semibold">
              {snap.cumulativeSharpe.toFixed(2)}
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              목표: ≥ {SHARPE_THRESHOLD}
            </p>
          </div>
        </div>
      </section>

      {/* Verdict badge + breakdown (R3.11-9 + judge) */}
      <section
        aria-label="판정 결과"
        className="rounded-lg border bg-card p-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">종합 판정 (복합 AND)</p>
            <p
              className={`mt-1 text-3xl font-bold ${
                result.overall === "○"
                  ? "text-[color:var(--color-market-up)]"
                  : result.overall === "△"
                  ? "text-amber-500"
                  : "text-[color:var(--color-market-down)]"
              }`}
            >
              {result.overall}
            </p>
          </div>
          <ul className="space-y-1 text-sm">
            <li>Alpha ≥ 0 {result.breakdown.alpha ? "✅" : "❌"}</li>
            <li>
              Sharpe ≥ {SHARPE_THRESHOLD} {result.breakdown.sharpe ? "✅" : "❌"}
            </li>
            <li>
              MDD ≥ {(MDD_THRESHOLD * 100).toFixed(0)}%{" "}
              {result.breakdown.mdd ? "✅" : "❌"}
            </li>
          </ul>
        </div>
      </section>

      {/* R3.11-7: 월별 추이 라인 차트 */}
      <section aria-labelledby="trend-heading">
        <h2 id="trend-heading" className="text-lg font-semibold mb-3">
          월별 추이
        </h2>
        <div className="rounded-lg border bg-card p-4">
          <DecisionTreeTrendChart
            data={snap.monthlyHistory.map((m) => ({
              month: m.month,
              alpha: m.alpha,
              sharpe: m.sharpe,
              mdd: m.mdd,
            }))}
          />
        </div>
      </section>

      {/* R3.11-8: 부분 게이지 안내 */}
      {capMonths.currentStreak < CAP_MONTHS_TARGET && (
        <p className="text-xs text-muted-foreground">
          현재 운용 {snap.monthlyVerdicts.length}개월째 · 12개월 완주까지
          데이터를 축적 중입니다.
        </p>
      )}

      {/* R3.11-9: Y1 요약 + BusinessPlan 참조 */}
      <section
        aria-label="Y1 목표"
        className="rounded-lg border bg-muted/50 p-4"
      >
        <p className="text-sm">
          <strong>Y1 목표 달성 예상</strong>: 현재 경로 기준{" "}
          <strong
            className={
              result.overall === "○"
                ? "text-[color:var(--color-market-up)]"
                : result.overall === "△"
                ? "text-amber-500"
                : "text-[color:var(--color-market-down)]"
            }
          >
            {result.overall}
          </strong>
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          상세 기준: BusinessPlan §Q4 (내부 문서) · alpha≥0 AND Sharpe≥0.5 AND
          MDD≥-15% 복합 AND.
        </p>
        <Link
          href="/admin/track-record"
          className="mt-2 inline-block text-xs text-primary underline"
        >
          ← Track Record로 돌아가기
        </Link>
      </section>
    </div>
  );
}
