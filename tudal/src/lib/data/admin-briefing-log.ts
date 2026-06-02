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

export interface BriefingLogReadOptions {
  client?: SupabaseClient;
}

// PR-fix1 (E) — date-scoped briefing reader. /admin 홈 BriefingCard가 읽을 SELECT.
//   omxy 락: "latest" 무조건 표시 금지(stale 브리핑 부활 위험) → 호출자가 오늘 KST date를 넘기고,
//   해당 date row가 없으면 undefined(카드 empty state). cron이 일 1회 upsert(date)하므로 date당 1행.
//   RLS admin all → 서버 컴포넌트 세션 client(인증된 admin) 또는 주입 client로 읽는다.
export async function getBriefingLogForDate(
  date: string,
  options: BriefingLogReadOptions = {},
): Promise<BriefingLog | undefined> {
  const supabase = options.client ?? (await createClient());
  const { data, error } = await supabase
    .from("briefing_log")
    .select(
      "id, date, content_summary, generated_at, sent_channels, generation_failed",
    )
    .eq("date", date)
    .maybeSingle();
  if (error) {
    throw new Error(`briefing_log_read_failed:${error.code ?? "unknown"}`);
  }
  if (!data) return undefined;
  return {
    id: data.id,
    date: data.date,
    contentSummary: data.content_summary,
    generatedAt: data.generated_at,
    sentChannels: data.sent_channels ?? [],
    // viewEvents(IM-4 참여율)는 별도 테이블 — 카드 렌더(empty/failed/요약)에 불필요하므로 []로 둔다.
    viewEvents: [],
    generationFailed: data.generation_failed ?? false,
  };
}
