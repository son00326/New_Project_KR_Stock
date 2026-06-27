// admin-heartbeat-log.ts — heartbeat_log INSERT helper (59차 Mock cleanup Step 2.7b.2).
//
// silent-health cron이 일 1회 (15:00 UTC) 호출. ON CONFLICT (date) DO UPDATE upsert로
// catch-up retry / 수동 trigger / D10 재시도 시 latest status 반영. RLS는 admin all →
// cron context (admin cookie 없음)는 service-role client 주입 필수.
//
// Plan SoT: docs/superpowers/plans/2026-05-28-mock-cleanup-step-2-7b-2-cron-insert.md
// (omxy R-debate 5 rounds CONVERGED, 누적 13 catches fix).
// SoT migration: 0008_s6_hardening.sql §heartbeat_log (date UNIQUE + status check + admin RLS).

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { HeartbeatLog, HeartbeatStatus } from "@/types/admin";

const STATUS_SET: ReadonlySet<HeartbeatStatus> = new Set<HeartbeatStatus>([
  "ok",
  "red_alert",
]);

export interface HeartbeatLogInsertOptions {
  client?: SupabaseClient;
}

interface HeartbeatLogDbRow {
  id: string;
  date: string;
  status: string;
  generated_at: string;
  pipeline_summary: HeartbeatLog["pipelineSummary"] | null;
  critical_alert_count: number | string | null;
  warning_alert_count: number | string | null;
  sent_channels: string[] | null;
  send_failed: boolean | null;
  message: string | null;
}

function toIntOrZero(v: number | string | null): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : 0;
}

function transformHeartbeatLogRow(row: HeartbeatLogDbRow): HeartbeatLog {
  const status: HeartbeatStatus = STATUS_SET.has(row.status as HeartbeatStatus)
    ? (row.status as HeartbeatStatus)
    : "red_alert"; // 알 수 없는 status는 보수적으로 red_alert 취급 (fail-closed 표시).
  return {
    id: row.id,
    date: row.date,
    status,
    generatedAt: row.generated_at,
    pipelineSummary: Array.isArray(row.pipeline_summary)
      ? row.pipeline_summary
      : [],
    criticalAlertCount: toIntOrZero(row.critical_alert_count),
    warningAlertCount: toIntOrZero(row.warning_alert_count),
    sentChannels: Array.isArray(row.sent_channels) ? row.sent_channels : [],
    sendFailed: Boolean(row.send_failed),
    message: row.message ?? "",
  };
}

const HEARTBEAT_SELECT_COLUMNS =
  "id, date, status, generated_at, pipeline_summary, critical_alert_count, warning_alert_count, sent_channels, send_failed, message";

/**
 * 최신 heartbeat_log 1건 (date desc). 부재/오류 시 null (fail-soft — 대시보드 표시용).
 * M19 Silent Health 상태 카드(ok/red_alert) — admin 페이지 표시.
 */
export async function getLatestHeartbeatLog(
  options: HeartbeatLogInsertOptions = {},
): Promise<HeartbeatLog | null> {
  try {
    const supabase = options.client ?? (await createClient());
    const { data, error } = await supabase
      .from("heartbeat_log")
      .select(HEARTBEAT_SELECT_COLUMNS)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return transformHeartbeatLogRow(data as HeartbeatLogDbRow);
  } catch {
    return null;
  }
}

export async function insertHeartbeatLog(
  record: Omit<HeartbeatLog, "id">,
  options: HeartbeatLogInsertOptions = {},
): Promise<void> {
  if (!STATUS_SET.has(record.status)) {
    throw new Error(`heartbeat_log_invalid_status:${record.status}`);
  }
  const supabase = options.client ?? (await createClient());
  const { error } = await supabase
    .from("heartbeat_log")
    .upsert(
      {
        date: record.date,
        status: record.status,
        generated_at: record.generatedAt,
        pipeline_summary: record.pipelineSummary,
        critical_alert_count: record.criticalAlertCount,
        warning_alert_count: record.warningAlertCount,
        sent_channels: record.sentChannels,
        send_failed: record.sendFailed,
        message: record.message,
      },
      { onConflict: "date" },
    );
  if (error) {
    throw new Error(`heartbeat_log_insert_failed:${error.code ?? "unknown"}`);
  }
}
