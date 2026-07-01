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
          <h1 className="text-2xl font-bold tracking-tight">Decision Tree</h1>
          <p className="text-sm text-muted-foreground">
            운영 결과를 확인하는 분석 화면입니다 — 목표 달성 개월 · 초과수익 ·
            위험 대비 수익 지표를 종합 판정합니다.
          </p>
        </header>
        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 px-6 py-12 text-center">
          <p className="text-base font-semibold">운용 데이터 누적 후 산출</p>
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
        <h1 className="text-2xl font-bold tracking-tight">Decision Tree</h1>
        <p className="text-sm text-muted-foreground">
          운영 결과를 확인하는 분석 화면입니다 — 목표 달성 개월 · 초과수익 ·
          위험 대비 수익 지표를 종합 판정합니다.
        </p>
      </header>

      {/* R3.11-6: 게이지 3종 */}
      <section aria-label="게이지">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* CAP Months gauge */}
          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-toss-sm">
            <p
              className="text-xs text-muted-foreground"
              title="목표를 연속으로 달성한 개월 수"
            >
              목표 달성 개월
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {capMonths.currentStreak}/{CAP_MONTHS_TARGET}
            </p>
            <div className="mt-3 h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-[width]"
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
          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-toss-sm">
            <p
              className="text-xs text-muted-foreground"
              title="시장 기준보다 더 낸 수익"
            >
              누적 초과수익
            </p>
            <p
              className={`mt-1 text-2xl font-bold tabular-nums ${
                snap.cumulativeAlpha > 0
                  ? "text-market-up"
                  : snap.cumulativeAlpha < 0
                    ? "text-market-down"
                    : "text-market-neutral"
              }`}
            >
              {(snap.cumulativeAlpha * 100).toFixed(2)}%
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              목표: ≥ {(ALPHA_THRESHOLD * 100).toFixed(0)}% (양수)
            </p>
          </div>

          {/* Sharpe gauge */}
          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-toss-sm">
            <p
              className="text-xs text-muted-foreground"
              title="출렁임을 감안한 수익"
            >
              위험 대비 수익
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
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
        className="rounded-2xl border border-border/60 bg-card p-5 shadow-toss-sm"
      >
        <div className="flex items-center justify-between">
          <div>
            <p
              className="text-xs text-muted-foreground"
              title="세 기준을 모두 충족해야 통과"
            >
              종합 판정
            </p>
            <p
              className={`mt-1 text-3xl font-bold ${
                result.overall === "○"
                  ? "text-success"
                  : result.overall === "△"
                  ? "text-warning"
                  : "text-destructive"
              }`}
            >
              {result.overall}
            </p>
          </div>
          <ul className="space-y-1 text-sm">
            <li title="시장 기준보다 더 낸 수익이 0 이상">
              초과수익 0 이상 {result.breakdown.alpha ? "✅" : "❌"}
            </li>
            <li title={`위험 대비 수익이 ${SHARPE_THRESHOLD} 이상`}>
              위험 대비 수익 {SHARPE_THRESHOLD} 이상{" "}
              {result.breakdown.sharpe ? "✅" : "❌"}
            </li>
            <li title={`최대 낙폭이 ${(MDD_THRESHOLD * 100).toFixed(0)}% 이내`}>
              최대 낙폭 {(MDD_THRESHOLD * 100).toFixed(0)}% 이내{" "}
              {result.breakdown.mdd ? "✅" : "❌"}
            </li>
          </ul>
        </div>
      </section>

      {/* R3.11-7: 월별 추이 라인 차트 */}
      <section aria-labelledby="trend-heading">
        <h2 id="trend-heading" className="text-base font-semibold mb-3">
          월별 추이
        </h2>
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-toss-sm">
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
        className="rounded-2xl border border-border/60 bg-muted/40 p-5"
      >
        <p className="text-sm">
          <strong>Y1 목표 달성 예상</strong>: 현재 경로 기준{" "}
          <strong
            className={
              result.overall === "○"
                ? "text-success"
                : result.overall === "△"
                ? "text-warning"
                : "text-destructive"
            }
          >
            {result.overall}
          </strong>
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          판정 기준: 초과수익 0 이상 · 위험 대비 수익 0.5 이상 · 최대 낙폭 -15%
          이내를 모두 충족해야 통과합니다.
        </p>
        <Link
          href="/admin/track-record"
          className="mt-2 inline-block text-xs text-primary underline underline-offset-2 transition-colors hover:text-primary/80"
        >
          ← Track Record로 돌아가기
        </Link>
      </section>
    </div>
  );
}
