import { getRecentPipelineHealth } from "@/lib/data/admin-pipeline-health";
import {
  aggregatePipelineHealth,
  overallSeverity,
  PIPELINE_LABEL,
  recentFailures,
} from "@/lib/health/pipeline-health";
import {
  PIPELINE_HEALTH_CRITICAL_THRESHOLD,
  PIPELINE_HEALTH_WARNING_THRESHOLD,
  PIPELINE_HEALTH_WINDOW_HOURS,
  type Severity,
} from "@/types/admin";

// M18 파이프라인 헬스 대시보드 (S5a T5a.4, BL-6 B 서브라우트).
// 5 파이프라인 × 24h 성공률 + 95% Critical / 99% warning 배너 + 실패 tail 50건.

export const dynamic = "force-dynamic";

const SEVERITY_STYLE: Record<Severity, string> = {
  critical:
    "border-[var(--color-market-down)] bg-[var(--color-market-down)]/10 text-[var(--color-market-down)]",
  warning:
    "border-yellow-500 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  info: "border-[var(--color-market-up)] bg-[var(--color-market-up)]/10 text-[var(--color-market-up)]",
};

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critical",
  warning: "Warning",
  info: "정상",
};

function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function formatLatency(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", { hour12: false });
}

export default async function AdminHealthPage() {
  // Mock cleanup Step 2.5: MOCK_ADMIN_PIPELINE_HEALTH → 실 pipeline_health SELECT.
  // 기본 7일 윈도우 (page aggregate 24h + recentFailures 50 most recent 양쪽 cover).
  // production pipeline_health=0 rows → 빈 위젯 / overall=warning / failures=[] (미확인 fail-closed).
  // RLS deny / non-finite / invalid enum 시 throw → admin 라우트 error boundary.
  const refNow = new Date();
  const records = await getRecentPipelineHealth({ refNow });
  const summaries = aggregatePipelineHealth(records, { now: refNow });
  const overall = overallSeverity(summaries);
  const failures = recentFailures(records, 50);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Health 대시보드</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          5개 파이프라인 × 최근 {PIPELINE_HEALTH_WINDOW_HOURS}h 성공률. 임계치:
          Critical &lt; {formatRate(PIPELINE_HEALTH_CRITICAL_THRESHOLD)} ·
          Warning &lt; {formatRate(PIPELINE_HEALTH_WARNING_THRESHOLD)}. M18
          R3.12-4 근거.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          ※ 실 pipeline_health SELECT — 5개 파이프라인 (dart/news/price/ai/alert)
          run 결과 자동 적재. production pipeline_health 적재 전에는 빈 위젯이며 미확인
          상태로 Warning 표시.
        </p>
      </header>

      <section
        aria-label="전체 파이프라인 상태"
        className={`rounded-lg border p-4 text-sm font-medium ${SEVERITY_STYLE[overall]}`}
      >
        전체 상태: {SEVERITY_LABEL[overall]}
        {overall === "critical" && (
          <span className="ml-2 text-xs font-normal">
            — 95% 미달 파이프라인 존재. 즉시 확인 필요.
          </span>
        )}
      </section>

      <section
        aria-label="파이프라인별 성공률"
        className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
      >
        {summaries.map((s) => (
          <article
            key={s.pipeline}
            className={`rounded-lg border p-4 ${SEVERITY_STYLE[s.severity]}`}
          >
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">
                {PIPELINE_LABEL[s.pipeline]}
              </h2>
              <span className="text-xs">{SEVERITY_LABEL[s.severity]}</span>
            </div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">
              {formatRate(s.successRate)}
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-1 text-xs text-foreground/80">
              <dt>전체 run</dt>
              <dd className="text-right tabular-nums">{s.total24h}</dd>
              <dt>성공</dt>
              <dd className="text-right tabular-nums">{s.success24h}</dd>
              <dt>실패</dt>
              <dd className="text-right tabular-nums">{s.failed24h}</dd>
              <dt>평균 지연</dt>
              <dd className="text-right tabular-nums">
                {formatLatency(s.avgLatencyMs)}
              </dd>
            </dl>
            {s.lastRun && (
              <div className="mt-2 text-xs text-foreground/70">
                최근: {formatTime(s.lastRun.startedAt)} · {s.lastRun.status}
              </div>
            )}
          </article>
        ))}
      </section>

      <section aria-label="실패 트레이스" className="rounded-lg border bg-card p-4">
        <header className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">
            실패 트레이스 (최근 {failures.length}건)
          </h2>
          <span className="text-xs text-muted-foreground">
            tail · 24h 외 건 포함
          </span>
        </header>
        {failures.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            최근 실패 기록 없음.
          </p>
        ) : (
          <ol className="mt-3 space-y-1 text-xs">
            {failures.map((f) => (
              <li key={f.id} className="font-mono text-foreground/80">
                <span className="text-muted-foreground">
                  {formatTime(f.startedAt)}
                </span>{" "}
                · <strong>{f.pipeline}</strong> · {f.error ?? "(no message)"}
              </li>
            ))}
          </ol>
        )}
      </section>

      <footer className="text-xs text-muted-foreground">
        ※ 본 페이지는 M18 DoD{" "}
        <span>
          &quot;5개 파이프라인 성공률 + 95% Critical 배너 + 실패 trace&quot;
        </span>{" "}
        충족. S6 M19 Silent Health 하트비트에서 주간 롤업 추가 예정.
      </footer>
    </div>
  );
}
