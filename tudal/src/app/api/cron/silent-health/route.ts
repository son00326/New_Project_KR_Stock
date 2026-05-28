import { NextResponse, type NextRequest } from "next/server";
import { getRecentAlertEvents } from "@/lib/data/admin-alerts";
import { insertHeartbeatLog } from "@/lib/data/admin-heartbeat-log";
import { getRecentPipelineHealth } from "@/lib/data/admin-pipeline-health";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendEmail } from "@/lib/email/resend";
import {
  buildHeartbeatEmailSubject,
  buildHeartbeatMessage,
  buildHeartbeatMissingAlert,
  classifyHeartbeat,
  toHeartbeatLogRecord,
} from "@/lib/health/heartbeat";
import { sendTelegram } from "@/lib/notify/telegram";
import type { AlertEvent } from "@/types/admin";

// M19 Silent Health 일간 하트비트 (S6 T6.5).
// Vercel Cron 매일 15:00 UTC = 24:00 KST (전일 24h 집계 후 발송).
// ServicePlan-Admin §3.12 R3.12-7~8.
// Step 2.7a (2026-05-28): MOCK_ADMIN_PIPELINE_HEALTH + MOCK_ADMIN_ALERTS → 실 SELECT via
// createServiceRoleClient() + DI seam (admin-pipeline-health.ts + admin-alerts.ts). cron은
// admin cookie 없어 RLS using(is_admin())을 통과 못하므로 service-role 주입 필수.
// W-pipeline-health-admin-assertion read side 부분 해소. W-news는 admin-news.ts DI half만 별도 준비.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PR1 monthly-batch MF4 정합: service-role cron은 CRON_SECRET 누락 시 production-like
// 환경(NODE_ENV/VERCEL_ENV/NEXT_PUBLIC_APP_ENV)에서 반드시 fail-closed.
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
  const recipients = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Step 2.7a: service-role client 단일 인스턴스 생성 → 두 helper에 주입.
  // production pipeline_health=0 / alert_event=0 → 모두 [] (classification.status='ok';
  // pipeline summary는 "no run" warning일 수 있음 — 추후 row 적재 시 정확한 24h 통계).
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
  const emailSubject = buildHeartbeatEmailSubject(classification.status, date);
  const noConfiguredOutboundChannel =
    isProductionLike() &&
    recipients.length === 0 &&
    !process.env.TELEGRAM_BOT_TOKEN &&
    !process.env.TELEGRAM_CHAT_ID &&
    !process.env.TELEGRAM_CHAT_IDS;

  // 1) 텔·이메일 동시 발송 (recipients 없으면 이메일 채널 자동 skip)
  const [telegramRes, emailRes] = await Promise.all([
    sendTelegram({ text: message }),
    recipients.length > 0
      ? sendEmail({
          to: recipients,
          subject: emailSubject,
          text: message,
          tag: "silent-health",
        })
      : Promise.resolve({
          success: true,
          providerId: null,
          mockMode: true,
          error: undefined as string | undefined,
        }),
  ]);

  const sentChannels: string[] = ["dashboard"];
  if (telegramRes.success) sentChannels.push("telegram");
  if (emailRes.success && recipients.length > 0) sentChannels.push("email");

  // 2) D10 catch-up — 텔·이메일 모두 실패 시 이메일 1회 재시도 (recipients 있을 때만)
  let d10Triggered = false;
  let retrySuccess = emailRes.success;
  let retryError: string | undefined = emailRes.error;
  const emailAttempted = recipients.length > 0;
  if (!telegramRes.success && emailAttempted && !emailRes.success) {
    d10Triggered = true;
    const retry = await sendEmail({
      to: recipients,
      subject: emailSubject,
      text: message,
      tag: "silent-health-retry",
    });
    retrySuccess = retry.success;
    retryError = retry.error;
    if (retry.success && !sentChannels.includes("email")) {
      sentChannels.push("email");
    }
  }

  const emailDelivered = emailAttempted && retrySuccess;
  const allFailed = noConfiguredOutboundChannel || (!telegramRes.success && !emailDelivered);
  const sendFailed = allFailed;

  const log = toHeartbeatLogRecord(
    classification,
    date,
    message,
    sentChannels,
    sendFailed,
  );

  // Step 2.7b.2: heartbeat_log 실 INSERT (service-role 단일 인스턴스 재사용 — plan §0 D5).
  // ON CONFLICT (date) DO UPDATE — cron 재실행 / D10 catch-up retry / 수동 trigger 시 latest
  // status 갱신 (plan §0 D1). INSERT 실패 = audit trail loss → 5xx + dbError audit (plan §0 D3).
  let dbError: string | null = null;
  try {
    await insertHeartbeatLog(log, { client: serviceRoleClient });
  } catch (err) {
    dbError = err instanceof Error ? err.message : "heartbeat_log_insert_failed:unknown";
  }

  // 3) D10 catch-up도 실패하면 heartbeat_missing AlertEvent 적재
  let missingAlert: Omit<AlertEvent, "id" | "isRead"> | null = null;
  if (allFailed) {
    const reason = noConfiguredOutboundChannel
      ? "하트비트 발송 채널 미설정: ADMIN_EMAILS 또는 TELEGRAM_BOT_TOKEN/CHAT_ID 필요"
      : retryError ?? telegramRes.error ?? "발송 사유 불명 (mock-mode 가능성)";
    missingAlert = buildHeartbeatMissingAlert(date, reason);
  }

  // status 우선순위: noConfiguredOutboundChannel(500) → sendFailed(502) → dbError(502) → 200.
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
      d10Triggered,
      log,
      alertEmitted: missingAlert?.triggerReason ?? null,
      dbError,
    },
    { status: finalStatus },
  );
}
