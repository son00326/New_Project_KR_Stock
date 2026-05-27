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

  const viewDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD KST 기준 dedupe (BL-5)
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
