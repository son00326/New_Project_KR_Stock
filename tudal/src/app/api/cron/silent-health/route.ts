import { NextResponse, type NextRequest } from "next/server";
import { MOCK_ADMIN_ALERTS } from "@/lib/data/mock-admin-alerts";
import { MOCK_ADMIN_PIPELINE_HEALTH } from "@/lib/data/mock-admin-pipeline-health";
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
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

  const classification = classifyHeartbeat({
    date,
    pipelineHealth: MOCK_ADMIN_PIPELINE_HEALTH,
    recentAlerts: alertsWithin24h(MOCK_ADMIN_ALERTS, now),
    referenceNow: now,
  });

  const message = buildHeartbeatMessage(classification, date);
  const emailSubject = buildHeartbeatEmailSubject(classification.status, date);

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
  if (!telegramRes.success && !emailRes.success && recipients.length > 0) {
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

  const allFailed = !telegramRes.success && !retrySuccess;
  const sendFailed = allFailed;

  const log = toHeartbeatLogRecord(
    classification,
    date,
    message,
    sentChannels,
    sendFailed,
  );

  // 3) D10 catch-up도 실패하면 heartbeat_missing AlertEvent 적재
  let missingAlert: Omit<AlertEvent, "id" | "isRead"> | null = null;
  if (allFailed) {
    const reason =
      retryError ?? telegramRes.error ?? "발송 사유 불명 (mock-mode 가능성)";
    missingAlert = buildHeartbeatMissingAlert(date, reason);
  }

  return NextResponse.json({
    ok: !sendFailed,
    date,
    status: classification.status,
    sentChannels,
    d10Triggered,
    log,
    alertEmitted: missingAlert?.triggerReason ?? null,
  });
}
