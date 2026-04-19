import Link from "next/link";
import { notFound } from "next/navigation";
import { MOCK_ADMIN_ALERTS } from "@/lib/data/mock-admin-alerts";
import type { AlertType } from "@/types/admin";

// 알림 상세 페이지 (M12 뉴스 Critical + M10 scheduler_fail + M11 briefing_failed).
// S5b에서 Exit 시그널 결정 기록 UI(sell_all/partial_sell/hold + 메모) 확장 예정.

interface AlertDetailPageProps {
  params: Promise<{ id: string }>;
}

const ALERT_TYPE_LABEL: Record<AlertType, string> = {
  exit_signal: "Exit 시그널",
  news_critical: "뉴스 Critical",
  news_warning: "뉴스 Warning",
  price_anomaly: "시세 이상",
  briefing: "브리핑",
  briefing_failed: "브리핑 실패",
  scheduler_fail: "스케줄러 실패",
  gating_auto_relief: "게이팅 자동 바이패스",
};

export default async function AdminAlertDetailPage({
  params,
}: AlertDetailPageProps) {
  const { id } = await params;
  const alert = MOCK_ADMIN_ALERTS.find((a) => a.id === id);
  if (!alert) notFound();

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

      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">결정 기록</h2>
        {alert.decisionRecorded ? (
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex gap-2">
              <dt className="w-24 text-muted-foreground">결정</dt>
              <dd>{alert.decisionRecorded}</dd>
            </div>
            {alert.decisionMemo && (
              <div className="flex gap-2">
                <dt className="w-24 text-muted-foreground">메모</dt>
                <dd>{alert.decisionMemo}</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            기록된 결정 없음. S5b M15에서 Exit 시그널 결정 입력 UI 추가 예정.
          </p>
        )}
      </section>

      {alert.alertType === "exit_signal" && (
        <section className="rounded-lg border bg-card p-4">
          <h2 className="text-sm font-semibold">§7 Exit 조건 대조</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            S5b M15에서 StockReport §7 Exit 조건 대조 패널 추가 예정.
          </p>
        </section>
      )}
    </div>
  );
}
