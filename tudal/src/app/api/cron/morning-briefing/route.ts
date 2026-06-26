import { NextResponse, type NextRequest } from "next/server";
import { composeBriefing, toBriefingLogRecord } from "@/lib/briefing/compose";
import { sendTelegram, isTelegramConfigured } from "@/lib/notify/telegram";
import { getRecentNewsEvents } from "@/lib/data/admin-news";
import { insertBriefingLog } from "@/lib/data/admin-briefing-log";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getMacroContextString } from "@/lib/macro/source";
import type { NewsEvent } from "@/types/admin";

// Vercel Cron 매일 23:00 UTC = 08:00 KST. ServicePlan-Admin §3.10 R3.10-1~2 (M11).
// 72차/D10: 이메일/Resend 전역 미사용 → 채널 = telegram(best-effort) + dashboard(/admin) 2-layer.
// G4 (D33 §4): getMacroContextString()으로 거시 컨텍스트 1줄 주입(flag MACRO_CONTEXT_ENABLED off면
//   "" → 라인 생략·현행 동작; Tier0 factor 아님·M12a와 범주 분리).
// production news_event 행 부재 시 topNews=[] (정상 — "핵심 뉴스 없음" 라인).

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

  // Step 2.7b.1: service-role client 주입 → cron context RLS 우회. production rows=0 → topNews=[].
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
    macroContext: getMacroContextString(), // G4 (off/stale → "" → 라인 생략)
  });

  // 채널: dashboard(/admin 홈 카드)는 항상 + telegram best-effort.
  // telegram 실패/미설정은 finalStatus에 절대 미반영(best-effort, silent-health 정합).
  const sentChannels: string[] = ["dashboard"];
  let telegramError: string | null = null;
  if (isTelegramConfigured()) {
    const tg = await sendTelegram({ text: composed.telegram });
    if (tg.success) sentChannels.push("telegram");
    else telegramError = tg.error ?? "telegram send failed";
  }

  // briefing_log INSERT (date upsert). 브리핑은 항상 생성됨 → generationFailed=false.
  // DB persist 실패만 dbError로 502 (telegram best-effort는 미반영).
  const logPayload = toBriefingLogRecord(composed, sentChannels, false);
  let dbError: string | null = null;
  try {
    await insertBriefingLog(logPayload, { client: serviceRoleClient });
  } catch (err) {
    dbError = err instanceof Error ? err.message : "briefing_log_insert_failed:unknown";
  }

  return NextResponse.json(
    {
      ok: !dbError,
      date: composed.date,
      sentChannels,
      contentPreview: composed.contentSummary.slice(0, 120),
      log: logPayload,
      dbError,
      telegramError,
    },
    { status: dbError ? 502 : 200 },
  );
}
