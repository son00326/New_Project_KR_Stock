import Link from "next/link";
import {
  aggregateMonthlyCost,
  COST_PURPOSE_LABEL,
} from "@/lib/cost/aggregate";
import { buildDryRunReport } from "@/lib/cost/dry-run-estimate";
import { DEFAULT_MODEL } from "@/lib/cost/anthropic-pricing";
import {
  MOCK_ADMIN_COST_LOG,
  MOCK_ADMIN_COST_LOG_OVER_HARDCAP,
  MOCK_ADMIN_COST_LOG_OVER_WARNING,
} from "@/lib/data/mock-admin-cost-log";
import {
  COST_HARDCAP_KRW,
  COST_WARNING_THRESHOLD_KRW,
} from "@/types/admin";

// M17 AI API 비용 실시간 모니터링 대시보드 (S6 T6.2)
// ref: ServicePlan-Admin §3.12 R3.12-1~3
// 35만 경보 배너 · 40만 hardcap 활성 · purpose별 비중 · Top 5 기여 · BL-18 견적 비교

export const dynamic = "force-dynamic";

const KRW = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

function formatKrw(v: number): string {
  return KRW.format(Math.round(v));
}

function currentMonth(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  return `${kst.toISOString().slice(0, 7)}-01`;
}

function PurposeBar({ share }: { share: number }) {
  const pct = Math.max(0, Math.min(1, share)) * 100;
  return (
    <div className="h-1.5 w-full rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-foreground/60"
        style={{ width: `${pct.toFixed(1)}%` }}
      />
    </div>
  );
}

interface ScenarioRow {
  label: string;
  total: number;
  triggered: "hardcap" | "warning" | "ok";
}

export default function AdminCostPage() {
  const month = currentMonth();
  // 현재 월 = 2026-04 (정상 운용) · 2026-03 = 경보 시연 · 2026-02 = hardcap 시연
  const allLogs = [
    ...MOCK_ADMIN_COST_LOG,
    ...MOCK_ADMIN_COST_LOG_OVER_WARNING,
    ...MOCK_ADMIN_COST_LOG_OVER_HARDCAP,
  ];
  const summary = aggregateMonthlyCost(allLogs, month);
  const warningDemo = aggregateMonthlyCost(allLogs, "2026-03-01");
  const hardcapDemo = aggregateMonthlyCost(allLogs, "2026-02-01");
  const dryRun = buildDryRunReport(DEFAULT_MODEL);

  const banner: { tone: string; label: string; body: string } | null =
    summary.hardcapTriggered
      ? {
          tone: "border-[var(--color-market-down)] bg-[var(--color-market-down)]/10 text-[var(--color-market-down)]",
          label: "🚨 40만 Hardcap 도달",
          body: "이번 달 AI 비용이 40만원을 초과했습니다. M9 수동 재생성·M7 Reject 재분석 모두 차단됩니다. 대표 1인 override 토글로만 해제 가능 (BL-17 B).",
        }
      : summary.warningTriggered
        ? {
            tone: "border-yellow-500 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
            label: "⚠️ 35만 경보",
            body: "이번 달 AI 비용이 35만원을 넘었습니다. 40만 hardcap까지 잔여 ₩" +
              Math.round(summary.remainingKrw).toLocaleString("ko-KR") +
              ". 재생성 cap·페르소나 호출 빈도를 점검하세요.",
          }
        : null;

  const scenarios: ScenarioRow[] = [
    {
      label: "이번 달 (실측)",
      total: summary.totalKrw,
      triggered: summary.hardcapTriggered
        ? "hardcap"
        : summary.warningTriggered
          ? "warning"
          : "ok",
    },
    {
      label: "BL-18 base 견적",
      total: dryRun.scenarios.base.totalKrw,
      triggered:
        dryRun.scenarios.base.totalKrw >= COST_HARDCAP_KRW
          ? "hardcap"
          : dryRun.scenarios.base.totalKrw >= COST_WARNING_THRESHOLD_KRW
            ? "warning"
            : "ok",
    },
    {
      label: "BL-18 worst 견적 (base × 1.5)",
      total: dryRun.scenarios.worst.totalKrw,
      triggered: dryRun.worstExceedsHardcap
        ? "hardcap"
        : dryRun.worstExceedsWarning
          ? "warning"
          : "ok",
    },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">AI 비용 모니터</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          M17 R3.12-1~3 · 월간 누적 + 35만 경보 + 40만 hardcap. 임계 도달 시
          M9 수동 재생성·M7 Reject 재분석 동시 차단. 자세한 의사결정은{" "}
          <Link
            href="/admin/settings/health"
            className="underline underline-offset-2"
          >
            /admin/settings/health
          </Link>
          .
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          ※ mock fixture · 실데이터 전환 시 cost_log SELECT SUM(cost_krw) WHERE
          month=? 로 교체. BL-16 A 실시간 usage 파싱은 Anthropic API 호출 wrapper
          (TODO).
        </p>
      </header>

      {banner && (
        <section
          aria-label="비용 경보"
          className={`rounded-lg border p-4 text-sm ${banner.tone}`}
        >
          <div className="font-semibold">{banner.label}</div>
          <p className="mt-1 text-xs leading-relaxed">{banner.body}</p>
        </section>
      )}

      <section
        aria-label="당월 누적 위젯"
        className="grid gap-3 md:grid-cols-3"
      >
        <article className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">{summary.month.slice(0, 7)} 누적</div>
          <div className="mt-1 text-3xl font-semibold tabular-nums">
            {formatKrw(summary.totalKrw)}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            잔여 hardcap{" "}
            <strong className="tabular-nums">
              {formatKrw(Math.max(0, summary.remainingKrw))}
            </strong>
          </div>
        </article>
        <article className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">35만 경보</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {formatKrw(COST_WARNING_THRESHOLD_KRW)}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            도달 여부:{" "}
            <strong>
              {summary.warningTriggered ? "도달" : "미도달"}
            </strong>
          </div>
        </article>
        <article className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">40만 Hardcap</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {formatKrw(COST_HARDCAP_KRW)}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            도달 여부:{" "}
            <strong>
              {summary.hardcapTriggered ? "도달 — 차단 활성" : "미도달"}
            </strong>
          </div>
        </article>
      </section>

      <section
        aria-label="시나리오 비교"
        className="rounded-lg border bg-card p-4"
      >
        <header className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">시나리오 비교</h2>
          <span className="text-xs text-muted-foreground">
            BL-18 견적 (모델: {dryRun.model})
          </span>
        </header>
        <table className="mt-3 w-full text-sm tabular-nums">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="py-1 text-left font-normal">시나리오</th>
              <th className="py-1 text-right font-normal">월 비용</th>
              <th className="py-1 text-right font-normal">상태</th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map((s) => (
              <tr key={s.label} className="border-b last:border-0">
                <td className="py-2">{s.label}</td>
                <td className="py-2 text-right">{formatKrw(s.total)}</td>
                <td className="py-2 text-right text-xs">
                  {s.triggered === "hardcap" ? (
                    <span className="text-[var(--color-market-down)]">
                      Hardcap
                    </span>
                  ) : s.triggered === "warning" ? (
                    <span className="text-yellow-600 dark:text-yellow-400">
                      Warning
                    </span>
                  ) : (
                    <span className="text-[var(--color-market-up)]">정상</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
          {dryRun.notes.map((n) => (
            <div key={n}>{n}</div>
          ))}
        </div>
      </section>

      <section
        aria-label="Purpose별 비중"
        className="rounded-lg border bg-card p-4"
      >
        <h2 className="text-sm font-semibold">Purpose별 비용 비중</h2>
        {summary.byPurpose.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            이번 달 적재된 비용 없음.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {summary.byPurpose.map((p) => (
              <li key={p.purpose}>
                <div className="flex items-baseline justify-between text-sm">
                  <span>{COST_PURPOSE_LABEL[p.purpose]}</span>
                  <span className="tabular-nums">
                    {formatKrw(p.costKrw)}{" "}
                    <span className="text-xs text-muted-foreground">
                      ({(p.share * 100).toFixed(1)}%)
                    </span>
                  </span>
                </div>
                <div className="mt-1">
                  <PurposeBar share={p.share} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-label="Top 5 비용 기여"
        className="rounded-lg border bg-card p-4"
      >
        <h2 className="text-sm font-semibold">Top 5 비용 기여 (이번 달)</h2>
        {summary.topContributors.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">기여 항목 없음.</p>
        ) : (
          <ol className="mt-3 space-y-1 text-sm">
            {summary.topContributors.map((c, idx) => (
              <li
                key={c.label}
                className="flex items-baseline justify-between border-b py-1.5 last:border-0"
              >
                <span className="flex items-baseline gap-2">
                  <span className="text-xs text-muted-foreground">
                    #{idx + 1}
                  </span>
                  <span className="font-mono text-xs">{c.label}</span>
                </span>
                <span className="tabular-nums">
                  {formatKrw(c.costKrw)}{" "}
                  <span className="text-xs text-muted-foreground">
                    · {c.tokensTotal.toLocaleString("ko-KR")} tok
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section
        aria-label="시연 — 35만/40만 트리거 미리보기"
        className="rounded-lg border border-dashed bg-card/50 p-4"
      >
        <h2 className="text-sm font-semibold">시연 (mock-only)</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          실데이터 전환 전, 35만·40만 임계가 어떻게 표시되는지 확인용.
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-md border p-3">
            <dt className="text-xs text-muted-foreground">2026-03 (경보 시연)</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">
              {formatKrw(warningDemo.totalKrw)}
            </dd>
            <dd className="mt-1 text-xs text-yellow-700 dark:text-yellow-400">
              {warningDemo.warningTriggered ? "⚠️ 경보" : "정상"} ·{" "}
              {warningDemo.hardcapTriggered ? "🚨 hardcap" : "hardcap 미도달"}
            </dd>
          </div>
          <div className="rounded-md border p-3">
            <dt className="text-xs text-muted-foreground">
              2026-02 (hardcap 시연)
            </dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">
              {formatKrw(hardcapDemo.totalKrw)}
            </dd>
            <dd className="mt-1 text-xs text-[var(--color-market-down)]">
              {hardcapDemo.hardcapTriggered
                ? "🚨 hardcap 도달 — 재생성 차단"
                : "정상"}
            </dd>
          </div>
        </dl>
      </section>

      <footer className="text-xs text-muted-foreground">
        ※ 본 페이지는 M17 DoD{" "}
        <span>
          &quot;당월 누적 + 35만 경보 + 40만 hardcap + Top 5 + override&quot;
        </span>{" "}
        충족. override 토글(BL-17 B 대표 1인)은 실데이터 전환 시 추가.
      </footer>
    </div>
  );
}
