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
