// admin-briefing-log.ts — briefing_log INSERT helper (60차 Mock cleanup Step 2.7b.3).
// morning-briefing cron 일 1회 (23:00 UTC). ON CONFLICT (date) DO UPDATE — cron 재실행 시
// latest content 갱신 (plan §0 D2, heartbeat_log Step 2.7b.2 D1 패턴 정합). RLS admin all →
// cron context는 service-role client 주입 필수.
// SoT: 0006_s5a_automation.sql §briefing_log (date UNIQUE + admin RLS).

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { BriefingLog } from "@/types/admin";

export interface BriefingLogInsertOptions {
  client?: SupabaseClient;
}

export async function insertBriefingLog(
  record: Omit<BriefingLog, "id" | "viewEvents">,
  options: BriefingLogInsertOptions = {},
): Promise<void> {
  const supabase = options.client ?? (await createClient());
  const { error } = await supabase
    .from("briefing_log")
    .upsert(
      {
        date: record.date,
        content_summary: record.contentSummary,
        generated_at: record.generatedAt,
        sent_channels: record.sentChannels,
        generation_failed: record.generationFailed,
      },
      { onConflict: "date" },
    );
  if (error) {
    throw new Error(`briefing_log_insert_failed:${error.code ?? "unknown"}`);
  }
}
