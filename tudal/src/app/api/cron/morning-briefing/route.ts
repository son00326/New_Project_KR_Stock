import { NextResponse, type NextRequest } from "next/server";
import { composeBriefing, toBriefingLogRecord } from "@/lib/briefing/compose";
import { sendEmail } from "@/lib/email/resend";
import { getRecentNewsEvents } from "@/lib/data/admin-news";
import { insertBriefingLog } from "@/lib/data/admin-briefing-log";
import { insertAlertEvents } from "@/lib/data/admin-alerts-insert";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { AlertEvent, NewsEvent } from "@/types/admin";

// Vercel Cron 매일 23:00 UTC = 08:00 KST. ServicePlan-Admin §3.9 R3.9-1.
// Step 2.6 (2026-05-28): MOCK_ADMIN_NEWS → 실 news_event SELECT 전환.
// Step 2.7b.1 (2026-05-28): admin-news.getRecentNewsEvents() 호출 시 createServiceRoleClient()
// 주입 → cron context RLS using(is_admin()) 우회. W-news-cron-service-role-read 완전 해소.
// portfolio_snapshot / attentionTickers 실 SELECT는 별도 트랙 (briefing 메인 콘텐츠 미정).
// production news_event 행 부재 시 topNews=[] (정상 — "오늘의 주요 뉴스 없음" 라인).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PR1 monthly-batch MF4 / PR #48 silent-health 정합: service-role cron은 CRON_SECRET
// 누락 시 production-like 환경 4-way fail-closed.
function isProductionLikeForAuth(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.VERCEL_ENV === "preview" ||
    process.env.NEXT_PUBLIC_APP_ENV === "production"
  );
}

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return !isProductionLikeForAuth();
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function isProductionLike(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.NEXT_PUBLIC_APP_ENV === "production"
  );
}

function pickTopNews(items: NewsEvent[]): NewsEvent[] {
  return [...items]
    .sort((a, b) => {
      const weight = (n: NewsEvent) =>
        n.severity === "critical" ? 3 : n.severity === "warning" ? 2 : 1;
      const wDiff = weight(b) - weight(a);
      if (wDiff !== 0) return wDiff;
      return (
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );
    })
    .slice(0, 3);
}

function todayKstIsoDate(): string {
  const now = new Date();
  // KST = UTC+9. toISOString은 UTC라 +9h 더해 날짜만 추출.
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const recipients = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Step 2.7b.1: service-role client 주입 → cron context RLS 우회 (W-news-cron-service-role-read
  // 완전 해소). production news_event rows=0 → topNews=[] (정상). helper throw 시 (DB error)
  // Server route는 500을 자연스럽게 반환 (Next.js default).
  // Step 2.7b.3: service-role client 변수 추출 → news SELECT + briefing_log/alert INSERT 재사용.
  const serviceRoleClient = createServiceRoleClient();
  const recentNewsEvents = await getRecentNewsEvents({
    client: serviceRoleClient,
    limit: 20,
  });
  const composed = composeBriefing({
    date: todayKstIsoDate(),
    portfolioSnapshot: null, // mock-mode: null → "어제 포트 데이터 없음" 라인 (Step 2.7 scope)
    attentionTickers: [],
    topNews: pickTopNews(recentNewsEvents),
  });

  const sentChannels: string[] = ["dashboard"]; // 대시보드는 항상
  let emailError: string | null = null;
  let configError: string | null = null;

  if (recipients.length === 0 && isProductionLike()) {
    configError = "모닝 브리핑 수신자 ADMIN_EMAILS가 설정되지 않았습니다";
  }

  if (recipients.length > 0) {
    const result = await sendEmail({
      to: recipients,
      subject: composed.email.subject,
      html: composed.email.html,
      text: composed.email.text,
      tag: "morning-briefing",
    });
    if (result.success) sentChannels.push("email");
    else emailError = result.error ?? "email send failed";
  }

  const generationFailed = Boolean(configError || (emailError && recipients.length > 0));
  const logPayload = toBriefingLogRecord(composed, sentChannels, generationFailed);

  let alertPayload: Omit<AlertEvent, "id" | "isRead"> | null = null;
  if (generationFailed) {
    alertPayload = {
      alertType: "briefing_failed",
      ticker: null,
      severity: "warning",
      triggerReason: configError ?? `모닝 브리핑 이메일 발송 실패: ${emailError}`,
      signalSentAt: new Date().toISOString(),
      outcomeAt: null,
      t7PriceChange: null,
      decisionRecorded: null,
      decisionMemo: null,
    };
  }

  // Step 2.7b.3: briefing_log INSERT (date upsert) + briefing_failed alert_event INSERT.
  // independent best-effort (plan §0 D6 omxy R1 MED-2): 둘 다 독립 시도. dbError ??= 첫 실패 보존.
  let dbError: string | null = null;
  try {
    await insertBriefingLog(logPayload, { client: serviceRoleClient });
  } catch (err) {
    dbError ??= err instanceof Error ? err.message : "briefing_log_insert_failed:unknown";
  }
  try {
    await insertAlertEvents(alertPayload ? [alertPayload] : [], {
      client: serviceRoleClient,
    });
  } catch (err) {
    dbError ??= err instanceof Error ? err.message : "alert_event_insert_failed:unknown";
  }

  // status 우선순위: configError(500) → generationFailed(502) → dbError(502) → 200.
  const finalStatus = configError
    ? 500
    : generationFailed
    ? 502
    : dbError
    ? 502
    : 200;

  return NextResponse.json(
    {
      ok: !generationFailed && !dbError,
      date: composed.date,
      sentChannels,
      contentPreview: composed.contentSummary.slice(0, 120),
      log: logPayload,
      alertEmitted: alertPayload?.triggerReason ?? null,
      dbError,
    },
    { status: finalStatus },
  );
}
