import Link from "next/link";
import { notFound } from "next/navigation";
import { ExitDecisionForm } from "@/app/(admin)/admin/alerts/[id]/exit-decision-form";
import { MOCK_ADMIN_ALERTS } from "@/lib/data/mock-admin-alerts";
import type { AlertType, ExitDecision } from "@/types/admin";

// 알림 상세 — S5a(M12 뉴스 Critical · M10 scheduler_fail · M11 briefing_failed)
// S5b(M13 intraday_anomaly · M15 exit_signal + 결정 기록 UI + §7 대조 패널 stub).

interface AlertDetailPageProps {
  params: Promise<{ id: string }>;
}

const ALERT_TYPE_LABEL: Record<AlertType, string> = {
  exit_signal: "Exit 시그널",
  news_critical: "뉴스 Critical",
  news_warning: "뉴스 Warning",
  price_anomaly: "시세 이상",
  intraday_anomaly: "장중 이상 감지",
  briefing: "브리핑",
  briefing_failed: "브리핑 실패",
  scheduler_fail: "스케줄러 실패",
  gating_auto_relief: "게이팅 자동 바이패스",
  cost_warning: "AI 비용 경보 (35만)",
  cost_hardcap: "AI 비용 하드캡 (40만)",
  heartbeat_missing: "하트비트 발송 실패",
};

const DECISION_LABEL: Record<ExitDecision, string> = {
  sell_all: "매도 전량",
  partial_sell: "분할매도",
  hold: "홀딩",
};

// §7 Exit 조건 대조 — S5b T5b.3 stub. 실 리포트 section_7 연결은 실데이터 전환 시.
const EXIT_SCENARIOS = [
  {
    key: "sell_all",
    title: "매도 전량",
    body: "목표가 근접 또는 §7 악재 시나리오 매칭 시 즉시 청산. KOSPI 방향·유동성 확보 우선.",
  },
  {
    key: "partial_sell",
    title: "분할매도",
    body: "불확실성 잔존 — 50% 축소 후 재진입 포인트 관찰. 헷지 포지션 가능.",
  },
  {
    key: "hold",
    title: "홀딩",
    body: "트리거가 단기 소음일 가능성. §7 원시 시나리오 유지. 익일 장전 재점검.",
  },
];

function computeT7Badge(t7PriceChange: number | null): {
  label: string;
  color: string;
} | null {
  if (t7PriceChange === null) return null;
  const color =
    t7PriceChange < 0
      ? "text-[var(--color-market-down)]"
      : t7PriceChange > 0
        ? "text-[var(--color-market-up)]"
        : "text-muted-foreground";
  const sign = t7PriceChange > 0 ? "+" : "";
  return { label: `${sign}${t7PriceChange.toFixed(2)}%`, color };
}

export default async function AdminAlertDetailPage({
  params,
}: AlertDetailPageProps) {
  const { id } = await params;
  const alert = MOCK_ADMIN_ALERTS.find((a) => a.id === id);
  if (!alert) notFound();

  const isExit = alert.alertType === "exit_signal";
  const t7Badge = computeT7Badge(alert.t7PriceChange);

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/admin/alerts"
          className="text-xs text-muted-foreground underline underline-offset-2"
        >
          ← 알림 이력
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">
          {ALERT_TYPE_LABEL[alert.alertType]}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {new Date(alert.signalSentAt).toLocaleString("ko-KR", {
            hour12: false,
          })}
          {alert.ticker && <> · 종목 {alert.ticker}</>} · 심각도{" "}
          <strong>{alert.severity.toUpperCase()}</strong>
        </p>
      </header>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">트리거 사유</h2>
        <p className="mt-2 text-sm leading-relaxed">{alert.triggerReason}</p>
      </section>

      {isExit && (
        <section className="rounded-lg border bg-card p-4">
          <header className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">§7 Exit 조건 대조</h2>
            <span className="text-xs text-muted-foreground">
              StockReport §7 Exit 조건 대비 현재 상황 (stub)
            </span>
          </header>
          <ul className="mt-2 space-y-2">
            {EXIT_SCENARIOS.map((s) => (
              <li key={s.key} className="rounded-md border bg-background p-3">
                <div className="text-sm font-medium">{s.title}</div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {s.body}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            ※ 실제 Report.section_7 연결은 S5 실데이터 전환 시 반영.
          </p>
        </section>
      )}

      {isExit && t7Badge && (
        <section className="rounded-lg border bg-card p-4">
          <h2 className="text-sm font-semibold">T+7 Outcome</h2>
          <p className="mt-2 text-sm">
            T+7일 가격 변화:{" "}
            <strong className={`tabular-nums ${t7Badge.color}`}>
              {t7Badge.label}
            </strong>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            outcome 적재: {alert.outcomeAt ? new Date(alert.outcomeAt).toLocaleString("ko-KR", { hour12: false }) : "대기 중"} · IM-3(Exit 시그널 신뢰도) 입력값
          </p>
        </section>
      )}

      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">결정 기록</h2>
        {alert.decisionRecorded ? (
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex gap-2">
              <dt className="w-24 text-muted-foreground">결정</dt>
              <dd>{DECISION_LABEL[alert.decisionRecorded]}</dd>
            </div>
            {alert.decisionMemo && (
              <div className="flex gap-2">
                <dt className="w-24 text-muted-foreground">메모</dt>
                <dd className="whitespace-pre-wrap">{alert.decisionMemo}</dd>
              </div>
            )}
          </dl>
        ) : isExit ? (
          <div className="mt-3">
            <ExitDecisionForm alertId={alert.id} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Exit 시그널만 결정 기록 UI가 활성됩니다.
          </p>
        )}
      </section>
    </div>
  );
}
