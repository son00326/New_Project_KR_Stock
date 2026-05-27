import "server-only";

import { createClient } from "@/lib/supabase/server";

// T2.4 report_view_log INSERT 파이프 (server-only 모듈).
// Mock cleanup Step 1.3 (58차, omxy Arendt/Singer HIGH catch): mock console.log 제거 → real Supabase INSERT.
//
// G-5 B · BL-5 B:
//   - 테이블: report_view_log (E10, 마이그 0003)
//   - UNIQUE(admin_id, report_id, view_date) — 1일 1회 dedupe
//   - upsert ignoreDuplicates=true → 중복 row 무시
//   - 인증 안 됐거나 INSERT 실패해도 throw하지 않음 (view 기록은 best-effort, 페이지 렌더는 막지 않음).

export async function recordReportView(
  reportId: string,
  ticker: string,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return;

  // KST 기준 YYYY-MM-DD (omxy R2 Gödel MEDIUM fix): toISOString()은 UTC라 0~8:59 KST 구간이
  // 전날 UTC date가 되어 UNIQUE(admin_id,report_id,view_date) dedupe 약화.
  // ko-CA locale (YYYY-MM-DD 포맷) + Asia/Seoul timezone으로 정확한 KST 날짜 산출.
  const viewDate = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  const { error } = await supabase.from("report_view_log").upsert(
    {
      admin_id: user.id,
      report_id: reportId,
      view_date: viewDate,
    },
    { onConflict: "admin_id,report_id,view_date", ignoreDuplicates: true },
  );

  if (error && process.env.NODE_ENV !== "production") {
    console.warn(
      `[report.view] insert failed report=${reportId} ticker=${ticker} code=${error.code ?? "unknown"}`,
    );
  }
}
