import type { ReportViewLog } from "@/types/admin";
import { MOCK_ADMIN_REPORTS } from "@/lib/data/mock-admin-report";

// S2 mock — E10 ReportViewLog seed. T2.4 /admin/report/[ticker] 진입 Server Action에서
// 실제 INSERT onConflict do nothing. 본 시드는 M3 패널·D15 게이팅 테스트용.
//
// BL-5 B: 동일 admin_id·report_id·view_date 조합은 UNIQUE 제약에 의해 1일 1회만.
// G-5 B: 2인 게이팅 판정은 `SELECT COUNT(DISTINCT admin_id) FROM report_view_log WHERE report_id = ?`.
//
// 시드 정책 (mock):
//   - 대표 5종(005930·000660·012450·196170·373220): 2인 열람 완료 (게이팅 pass)
//   - 그 외 25종: 0~1인 열람 (게이팅 fail or pending)

// 실제 어드민 계정 UUID는 Supabase auth.users에서 오지만, mock에서는 고정 가상 ID 사용.
export const MOCK_ADMIN_IDS = {
  adminA: "aaaaaaaa-0000-0000-0000-000000000001",
  adminB: "bbbbbbbb-0000-0000-0000-000000000002",
  adminC: "cccccccc-0000-0000-0000-000000000003",
} as const;

const VIEW_DATE = "2026-04-02"; // D+1, 24h Hold 경과 후
const VIEWED_AT_A = "2026-04-02T00:30:00.000Z";
const VIEWED_AT_B = "2026-04-02T02:15:00.000Z";
const VIEWED_AT_C = "2026-04-02T05:00:00.000Z";

const GATING_PASS_TICKERS = new Set(["005930", "000660", "012450", "196170", "373220"]);
const SINGLE_VIEW_TICKERS = new Set(["079550", "034020", "267260", "278470"]); // 1인 열람만

export const MOCK_ADMIN_REPORT_VIEW_LOG: ReportViewLog[] = MOCK_ADMIN_REPORTS.flatMap(
  (report) => {
    const entries: ReportViewLog[] = [];
    if (GATING_PASS_TICKERS.has(report.ticker)) {
      // 2인 열람 (adminA + adminB)
      entries.push(
        {
          id: `rvl-${report.id}-A`,
          adminId: MOCK_ADMIN_IDS.adminA,
          reportId: report.id,
          viewDate: VIEW_DATE,
          viewedAt: VIEWED_AT_A,
        },
        {
          id: `rvl-${report.id}-B`,
          adminId: MOCK_ADMIN_IDS.adminB,
          reportId: report.id,
          viewDate: VIEW_DATE,
          viewedAt: VIEWED_AT_B,
        },
      );
      // 대표종에 한해 adminC도 열람 (3인 열람도 가능 시연)
      if (report.ticker === "000660" || report.ticker === "196170") {
        entries.push({
          id: `rvl-${report.id}-C`,
          adminId: MOCK_ADMIN_IDS.adminC,
          reportId: report.id,
          viewDate: VIEW_DATE,
          viewedAt: VIEWED_AT_C,
        });
      }
    } else if (SINGLE_VIEW_TICKERS.has(report.ticker)) {
      entries.push({
        id: `rvl-${report.id}-A`,
        adminId: MOCK_ADMIN_IDS.adminA,
        reportId: report.id,
        viewDate: VIEW_DATE,
        viewedAt: VIEWED_AT_A,
      });
    }
    return entries;
  },
);

// D15 R3.3-8 게이팅 판정 유틸 (mock — 실제는 Supabase COUNT DISTINCT)
export function getDistinctViewerCount(reportId: string): number {
  const rows = MOCK_ADMIN_REPORT_VIEW_LOG.filter((r) => r.reportId === reportId);
  return new Set(rows.map((r) => r.adminId)).size;
}

export function getViewersForReport(reportId: string): ReportViewLog[] {
  return MOCK_ADMIN_REPORT_VIEW_LOG.filter((r) => r.reportId === reportId);
}
