import "server-only";

// T2.4 report_view_log INSERT 파이프 (server-only 모듈).
// mock 단계: console.log로 관측만. 실 Supabase 연결 시 아래 TODO 블록을 활성화.
//
// G-5 B · BL-5 B:
//   - 테이블: report_view_log (E10)
//   - UNIQUE(admin_id, report_id, view_date) — 1일 1회 dedupe
//   - INSERT onConflict (admin_id, report_id, view_date) DO NOTHING

// mock 세션 내 중복 로그 방지용 (process 생존 동안만)
const SESSION_SEEN = new Set<string>();

export async function recordReportView(
  reportId: string,
  ticker: string,
): Promise<void> {
  // TODO (S2 Supabase 연결 시):
  //   const supabase = await createServerClient();
  //   const { data: { user } } = await supabase.auth.getUser();
  //   if (!user) return;
  //   await supabase
  //     .from("report_view_log")
  //     .upsert(
  //       {
  //         admin_id: user.id,
  //         report_id: reportId,
  //         view_date: new Date().toISOString().slice(0, 10),
  //       },
  //       { onConflict: "admin_id,report_id,view_date", ignoreDuplicates: true },
  //     );

  const today = new Date().toISOString().slice(0, 10);
  const key = `${reportId}:${today}`;
  if (SESSION_SEEN.has(key)) return;
  SESSION_SEEN.add(key);

  // 개발 관측용 — 실 배포 전 제거 예정
  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[report.view] report=${reportId} ticker=${ticker} date=${today} (mock — Supabase 연결 시 INSERT)`,
    );
  }
}
