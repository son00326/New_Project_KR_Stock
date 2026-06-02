import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getRecentAlertEvents } from "@/lib/data/admin-alerts";
import { getRecentNewsEvents } from "@/lib/data/admin-news";
import type { AlertEvent, AlertType, NewsEvent, Severity } from "@/types/admin";

// M12 Critical 뉴스 이력 + scheduler_fail·briefing_failed 이력 (S5a T5a.3).
// S5b에서 exit_signal·price_anomaly 추가 예정.
//
// Mock cleanup Step 2.1 (58차): MOCK_ADMIN_ALERTS + MOCK_ADMIN_NEWS 제거 →
// alert_event / news_event 실 SELECT. 0 rows = empty state ("알림 없음" 등 정직 렌더).

export const dynamic = "force-dynamic";

const SEVERITY_BADGE: Record<Severity, string> = {
  critical:
    "bg-[var(--color-market-down)]/15 text-[var(--color-market-down)] border-[var(--color-market-down)]/40",
  warning:
    "bg-yellow-500/15 text-yellow-700 border-yellow-500/40 dark:text-yellow-400",
  info: "bg-[var(--color-market-up)]/15 text-[var(--color-market-up)] border-[var(--color-market-up)]/40",
};

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

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", { hour12: false });
}

function sortedAlerts(items: AlertEvent[]): AlertEvent[] {
  return [...items].sort(
    (a, b) =>
      new Date(b.signalSentAt).getTime() - new Date(a.signalSentAt).getTime(),
  );
}

function sortedNewsDesc(items: NewsEvent[]): NewsEvent[] {
  return [...items].sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
}

// Mock cleanup Step 2.1 R1 (omxy LOW fix): 무제한 SELECT 회피.
// alert_event / news_event는 append log → 운영 누적 시 page-load 부담.
// 100 / 50 / 50 cap = 어드민 dashboard 가독성 + 1y+ 데이터 적재 대비.
const ALERT_LIMIT = 100;
const NEWS_LIMIT_PER_SEVERITY = 50;

export default async function AdminAlertsPage() {
  // PR-A (c): line 83 캡션 '0건 = 실제 미발생'은 RLS-deny(비-admin은 0 rows fail-open)와
  // 실제 미발생을 구분 못 함. is_admin()은 SECURITY DEFINER + authenticated execute grant(0015a:28)로
  // RLS 우회 → admin assertion. adminErr || !isAdmin 모두 fail-closed
  // (track-record/actions.ts:77 + portfolio/actions.ts:552 패턴). server component라 return 대신
  // boolean으로 변환해 캡션을 조건부 정직화 (데이터는 RLS가 이미 게이트, throw 금지).
  const supabase = await createClient();
  const { data: isAdmin, error: adminErr } = await supabase.rpc("is_admin");
  const adminVerified = !(adminErr || !isAdmin);

  // alert_event / news_event 실 SELECT — 실패 시 page error.tsx로 위임.
  // helper는 이미 alert_event_select_failed / news_event_select_failed 구체 에러 throw.
  const [alertRows, criticalNewsRows, warningNewsRows] = await Promise.all([
    getRecentAlertEvents({ limit: ALERT_LIMIT }),
    getRecentNewsEvents({ severity: "critical", limit: NEWS_LIMIT_PER_SEVERITY }),
    getRecentNewsEvents({ severity: "warning", limit: NEWS_LIMIT_PER_SEVERITY }),
  ]);
  const alerts = sortedAlerts(alertRows);
  const criticalNews = sortedNewsDesc(criticalNewsRows);
  const warningNews = sortedNewsDesc(warningNewsRows);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">알림 이력</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          M12 뉴스 Critical · M10 스케줄러 실패 · M11 브리핑 실패 이력. Critical은
          즉시 알림, Warning은 대시보드 전용.
        </p>
        {adminVerified ? (
          <p className="mt-1 text-xs text-muted-foreground">
            ※ alert_event · news_event 실 SELECT (58차 Mock cleanup Step 2.1).
            0건 = 실제 미발생 (cron/exit detector가 INSERT하기 전 정상 상태).
          </p>
        ) : (
          <p className="mt-2 rounded-md border border-yellow-500 bg-yellow-500/10 px-3 py-2 text-xs font-medium text-yellow-700 dark:text-yellow-400">
            ⚠ 권한 미확인 — admin_emails 등록 확인 필요. 표시된 0건은 실제 미발생이
            아니라 권한 검증 실패(RLS deny)일 수 있습니다.
          </p>
        )}
      </header>

      <section aria-label="알림 이벤트" className="rounded-lg border bg-card">
        <header className="flex items-baseline justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">AlertEvent ({alerts.length}건)</h2>
          <span className="text-xs text-muted-foreground">최신순</span>
        </header>
        {alerts.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            알림 없음.
          </p>
        ) : (
          <ul className="divide-y">
            {alerts.map((a) => (
              <li key={a.id} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span
                    className={`rounded-sm border px-1.5 py-0.5 text-xs ${SEVERITY_BADGE[a.severity]}`}
                  >
                    {a.severity.toUpperCase()}
                  </span>
                  <span className="text-xs font-medium text-foreground/80">
                    {ALERT_TYPE_LABEL[a.alertType]}
                  </span>
                  {a.ticker && (
                    <span className="text-xs font-mono text-muted-foreground">
                      {a.ticker}
                    </span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatTime(a.signalSentAt)}
                  </span>
                </div>
                <p className="mt-1 text-sm">{a.triggerReason}</p>
                <div className="mt-1 text-xs">
                  <Link
                    className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    href={`/admin/alerts/${a.id}`}
                  >
                    상세 →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Critical 뉴스" className="rounded-lg border bg-card">
        <header className="flex items-baseline justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">
            Critical 뉴스 ({criticalNews.length}건)
          </h2>
          <span className="text-xs text-muted-foreground">
            즉시 알림 대상 (AlertEvent news_critical 자동 발행)
          </span>
        </header>
        {criticalNews.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            Critical 뉴스 없음.
          </p>
        ) : (
          <ul className="divide-y">
            {criticalNews.map((n) => (
              <li key={n.id} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span
                    className={`rounded-sm border px-1.5 py-0.5 text-xs ${SEVERITY_BADGE.critical}`}
                  >
                    CRITICAL
                  </span>
                  {n.ticker && (
                    <span className="text-xs font-mono text-muted-foreground">
                      {n.ticker}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {n.source}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatTime(n.publishedAt)}
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium">{n.title}</p>
                {n.classificationReason && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    분류 근거: {n.classificationReason}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Warning 뉴스" className="rounded-lg border bg-card">
        <header className="flex items-baseline justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">
            Warning 뉴스 ({warningNews.length}건)
          </h2>
          <span className="text-xs text-muted-foreground">
            대시보드 전용 · 즉시 알림 미발송
          </span>
        </header>
        {warningNews.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            Warning 뉴스 없음.
          </p>
        ) : (
          <ul className="divide-y">
            {warningNews.map((n) => (
              <li key={n.id} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span
                    className={`rounded-sm border px-1.5 py-0.5 text-xs ${SEVERITY_BADGE.warning}`}
                  >
                    WARNING
                  </span>
                  {n.ticker && (
                    <span className="text-xs font-mono text-muted-foreground">
                      {n.ticker}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {n.source}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatTime(n.publishedAt)}
                  </span>
                </div>
                <p className="mt-1 text-sm">{n.title}</p>
                {n.classificationReason && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    분류 근거: {n.classificationReason}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
