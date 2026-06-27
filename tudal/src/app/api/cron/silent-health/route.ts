import { NextResponse, type NextRequest } from "next/server";
import { getRecentAlertEvents } from "@/lib/data/admin-alerts";
import { insertHeartbeatLog } from "@/lib/data/admin-heartbeat-log";
import { insertAlertEvents } from "@/lib/data/admin-alerts-insert";
import { getRecentPipelineHealth } from "@/lib/data/admin-pipeline-health";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  buildHeartbeatMessage,
  buildHeartbeatMissingAlert,
  classifyHeartbeat,
  toHeartbeatLogRecord,
} from "@/lib/health/heartbeat";
import { sendTelegram } from "@/lib/notify/telegram";
import type { AlertEvent } from "@/types/admin";

// M19 Silent Health 일간 하트비트 (S6 T6.5 · S7d 이메일 제거).
// Vercel Cron 매일 15:00 UTC = 24:00 KST (전일 24h 집계 후 발송).
// ServicePlan-Admin §3.12 R3.12-7~8.
//
// 72차 사용자 override (S7d, 2026-06-27): 이메일/Resend 전역 제거.
//   - 채널 = 텔레그램 best-effort + `/admin` durable(heartbeat_log) + unread badge.
//   - D10 catch-up = 텔레그램 실패 시 dashboard durable + heartbeat_missing AlertEvent (이메일 재시도 폐기).
//   - 상태: noConfiguredOutboundChannel(텔레그램 미설정·production) → 500(config 오류);
//           sendFailed(텔레그램 설정됐으나 실패) → 502; dbError → 502; else 200.
// cron은 admin cookie 없어 RLS using(is_admin())을 통과 못하므로 service-role 주입 필수.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function isTelegramConfigured(): boolean {
  return Boolean(
    process.env.TELEGRAM_BOT_TOKEN &&
      (process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_IDS),
  );
}

function yesterdayKstIsoDate(now: Date): string {
  const kstNow = new Date(now.getTime() + 9 * 3600 * 1000);
  const kstYesterday = new Date(kstNow.getTime() - 24 * 3600 * 1000);
  return kstYesterday.toISOString().slice(0, 10);
}

function alertsWithin24h(alerts: AlertEvent[], now: Date): AlertEvent[] {
  const cutoff = now.getTime() - 24 * 3600 * 1000;
  return alerts.filter((a) => new Date(a.signalSentAt).getTime() >= cutoff);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const date = yesterdayKstIsoDate(now);

  // Step 2.7a: service-role client 단일 인스턴스 → 두 helper에 주입.
  const serviceRoleClient = createServiceRoleClient();
  const [pipelineHealth, recentAlerts] = await Promise.all([
    getRecentPipelineHealth({ client: serviceRoleClient, refNow: now }),
    getRecentAlertEvents({ client: serviceRoleClient, limit: 200 }),
  ]);

  const classification = classifyHeartbeat({
    date,
    pipelineHealth,
    recentAlerts: alertsWithin24h(recentAlerts, now),
    referenceNow: now,
  });

  const message = buildHeartbeatMessage(classification, date);

  // production에서 텔레그램 미설정 = 발송 채널 없음(config 오류). dev mock-mode는 정상.
  const noConfiguredOutboundChannel = isProductionLike() && !isTelegramConfigured();

  // 텔레그램 best-effort (이메일 채널 제거). 미설정/실패해도 dashboard durable + badge가 catch-up.
  const telegramRes = await sendTelegram({ text: message });

  const sentChannels: string[] = ["dashboard"];
  if (telegramRes.success) sentChannels.push("telegram");

  const sendFailed = noConfiguredOutboundChannel || !telegramRes.success;

  const log = toHeartbeatLogRecord(
    classification,
    date,
    message,
    sentChannels,
    sendFailed,
  );

  // Step 2.7b.2: heartbeat_log 실 INSERT (ON CONFLICT(date) DO UPDATE — 재실행/수동 trigger 시 latest 갱신).
  let dbError: string | null = null;
  try {
    await insertHeartbeatLog(log, { client: serviceRoleClient });
  } catch (err) {
    dbError =
      err instanceof Error ? err.message : "heartbeat_log_insert_failed:unknown";
  }

  // D10 catch-up: 발송 실패 시 heartbeat_missing AlertEvent (dashboard durable + badge).
  let missingAlert: Omit<AlertEvent, "id" | "isRead"> | null = null;
  if (sendFailed) {
    const reason = noConfiguredOutboundChannel
      ? "하트비트 발송 채널 미설정: TELEGRAM_BOT_TOKEN/CHAT_ID 필요"
      : telegramRes.error ?? "텔레그램 발송 실패 (mock-mode 가능성)";
    missingAlert = buildHeartbeatMissingAlert(date, reason);
  }

  // heartbeat_missing alert_event INSERT (independent best-effort — heartbeat_log 실패와 무관).
  try {
    await insertAlertEvents(missingAlert ? [missingAlert] : [], {
      client: serviceRoleClient,
    });
  } catch (err) {
    dbError ??=
      err instanceof Error ? err.message : "alert_event_insert_failed:unknown";
  }

  // status: noConfiguredOutboundChannel(500) → sendFailed(502) → dbError(502) → 200.
  const finalStatus = noConfiguredOutboundChannel
    ? 500
    : sendFailed
      ? 502
      : dbError
        ? 502
        : 200;

  return NextResponse.json(
    {
      ok: !sendFailed && !dbError,
      date,
      status: classification.status,
      sentChannels,
      log,
      alertEmitted: missingAlert?.triggerReason ?? null,
      dbError,
    },
    { status: finalStatus },
  );
}
