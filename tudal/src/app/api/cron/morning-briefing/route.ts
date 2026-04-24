import { NextResponse, type NextRequest } from "next/server";
import { composeBriefing, toBriefingLogRecord } from "@/lib/briefing/compose";
import { sendEmail } from "@/lib/email/resend";
import { MOCK_ADMIN_NEWS } from "@/lib/data/mock-admin-news";
import type { AlertEvent, NewsEvent } from "@/types/admin";

// Vercel Cron 매일 23:00 UTC = 08:00 KST. ServicePlan-Admin §3.9 R3.9-1.
// 실데이터 전환 시 전일 포트 스냅샷 + 주의 종목 + 뉴스 3건을 Supabase에서 SELECT.
// mock-mode에서는 고정 샘플로 compose + Resend mock 발송.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
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

  const composed = composeBriefing({
    date: todayKstIsoDate(),
    portfolioSnapshot: null, // mock-mode: null → "어제 포트 데이터 없음" 라인
    attentionTickers: [],
    topNews: pickTopNews(MOCK_ADMIN_NEWS),
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

  // 실데이터 전환: Supabase INSERT briefing_log + (실패 시) alert_event
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

  return NextResponse.json(
    {
      ok: !generationFailed,
      date: composed.date,
      sentChannels,
      contentPreview: composed.contentSummary.slice(0, 120),
      log: logPayload,
      alertEmitted: alertPayload?.triggerReason ?? null,
    },
    { status: configError ? 500 : generationFailed ? 502 : 200 },
  );
}
