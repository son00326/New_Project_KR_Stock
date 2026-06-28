import Link from "next/link";
import { notFound } from "next/navigation";
import { ExitDecisionForm } from "@/app/(admin)/admin/alerts/[id]/exit-decision-form";
import { getAlertEventById } from "@/lib/data/admin-alerts";
import { createClient } from "@/lib/supabase/server";
import type { AlertType, ExitDecision } from "@/types/admin";

// 알림 상세 — S5a(M12 뉴스 Critical · M10 scheduler_fail · M11 briefing_failed)
// S5b(M13 intraday_anomaly · M15 exit_signal + 결정 기록 UI + §7 대조 패널 stub).
//
// Mock cleanup Step 2.1 (58차): MOCK_ADMIN_ALERTS 제거 → alert_event 실 SELECT.
// row 부재 시 notFound() (Next.js 16 표준 404 처리).

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
  cost_warning: "AI 비용 경보 (45만)",
  cost_hardcap: "AI 비용 하드캡 (50만)",
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
      ? "text-market-down"
      : t7PriceChange > 0
        ? "text-market-up"
        : "text-muted-foreground";
  const sign = t7PriceChange > 0 ? "+" : "";
  return { label: `${sign}${t7PriceChange.toFixed(2)}%`, color };
}

export default async function AdminAlertDetailPage({
  params,
}: AlertDetailPageProps) {
  const { id } = await params;
  // PR-A follow-up: alert_event RLS silent-0이면 실제 row 부재와 권한 검증 실패가 모두
  // null로 보일 수 있다. adminVerified=true일 때만 notFound로 확정하고, 권한 미확인 시
  // 404로 숨기지 않고 진단을 표시한다.
  const supabase = await createClient();
  const { data: isAdmin, error: adminErr } = await supabase.rpc("is_admin");
  const adminVerified = !(adminErr || !isAdmin);
  const alert = await getAlertEventById(id);
  if (!alert && adminVerified) notFound();
  if (!alert) {
    return (
      <div className="space-y-6">
        <header>
          <Link
            href="/admin/alerts"
            className="text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
          >
            ← 알림 이력
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">알림 상세</h1>
          <p
            role="status"
            aria-live="polite"
            className="mt-2 rounded-xl border border-yellow-500 bg-yellow-500/10 px-3 py-2 text-xs font-medium text-yellow-700 dark:text-yellow-400"
          >
            ⚠ 권한 미확인 — admin_emails 등록 확인 필요. 표시된 404/알림 부재는 실제
            미발생이 아니라 권한 검증 실패(RLS deny)일 수 있습니다.
          </p>
        </header>
      </div>
    );
  }

  const isExit = alert.alertType === "exit_signal";
  const t7Badge = computeT7Badge(alert.t7PriceChange);

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/admin/alerts"
          className="text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
        >
          ← 알림 이력
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
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

      <section className="rounded-2xl border bg-card p-4 shadow-toss-sm">
        <h2 className="text-sm font-semibold">트리거 사유</h2>
        <p className="mt-2 text-sm leading-relaxed">{alert.triggerReason}</p>
      </section>

      {isExit && (
        <section className="rounded-2xl border bg-card p-4 shadow-toss-sm">
          <header className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">§7 Exit 조건 대조</h2>
            <span className="text-xs text-muted-foreground">
              StockReport §7 Exit 조건 대비 현재 상황 (stub)
            </span>
          </header>
          <ul className="mt-2 space-y-2">
            {EXIT_SCENARIOS.map((s) => (
              <li key={s.key} className="rounded-xl border bg-background p-3">
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
        <section className="rounded-2xl border bg-card p-4 shadow-toss-sm">
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

      <section className="rounded-2xl border bg-card p-4 shadow-toss-sm">
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
