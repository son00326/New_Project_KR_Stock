// admin-report-view-log.ts — D15 R3.3-8 "2인 어드민 열람" 게이팅 실 DB SELECT
//
// Mock cleanup Step 1.3 (58차): MOCK_ADMIN_REPORT_VIEW_LOG가 대표 5종에 가짜 2인 열람을
// 시드해 D15 게이트 판정을 오염시키던 mock 제거. 실 운영에서는 어드민이 /admin/report/[ticker]
// 페이지를 방문할 때 server action이 report_view_log 테이블에 INSERT (BL-5 1일 1회 dedupe).
//
// 본 wrapper는 stock_reports(ticker, month, is_latest=true) ↔ report_view_log(report_id) JOIN으로
// 티커별 distinct admin_id 카운트를 반환. 0건이면 게이트는 honestly viewers_insufficient로 차단됨.
//
// SoT: 0003_s2_reports.sql §3 report_view_log + 마이그 0008 read RLS.

import { createClient } from "@/lib/supabase/server";
import type { ReportViewLog } from "@/types/admin";

export interface ReportViewerCountInput {
  month: string; // YYYY-MM (caller가 YYYY-MM-01로 변환)
  tickers: readonly string[];
}

/**
 * 입력 티커들에 대해 (월간 최신 stock_reports row 기준) report_view_log에 기록된
 * distinct admin_id 수를 ticker → count Map으로 반환.
 *
 * - stock_reports row가 없는 ticker → count 0 (게이트 차단 = honest behavior)
 * - report_view_log row가 없는 ticker → count 0
 * - 빈 tickers 입력 → empty Map
 *
 * SELECT 실패 시 throw — 호출자가 catch + 에러 코드 매핑.
 */
export async function getDistinctViewerCountsByTicker(
  input: ReportViewerCountInput,
): Promise<Map<string, number>> {
  const tickers = input.tickers;
  if (tickers.length === 0) return new Map();
  const monthDate = `${input.month}-01`;
  const supabase = await createClient();

  // (1) 해당 월·티커들의 latest stock_reports id 조회
  const reportsRes = await supabase
    .from("stock_reports")
    .select("id, ticker")
    .eq("month", monthDate)
    .eq("is_latest", true)
    .in("ticker", tickers as string[]);

  if (reportsRes.error) {
    throw new Error(`report_view_log_reports_lookup_failed:${reportsRes.error.code ?? "unknown"}`);
  }

  const reports = reportsRes.data ?? [];
  // 모든 티커 0으로 초기화 (report row 없는 ticker는 default 0 유지)
  const result = new Map<string, number>();
  for (const t of tickers) result.set(t, 0);

  if (reports.length === 0) return result;

  const tickerByReportId = new Map<string, string>();
  for (const r of reports) {
    if (r.id && r.ticker) tickerByReportId.set(r.id, r.ticker);
  }
  const reportIds = Array.from(tickerByReportId.keys());

  // (2) report_view_log에서 distinct admin_id 집계
  const viewsRes = await supabase
    .from("report_view_log")
    .select("report_id, admin_id")
    .in("report_id", reportIds);

  if (viewsRes.error) {
    throw new Error(`report_view_log_views_lookup_failed:${viewsRes.error.code ?? "unknown"}`);
  }

  const distinctPerReport = new Map<string, Set<string>>();
  for (const v of viewsRes.data ?? []) {
    if (!v.report_id || !v.admin_id) continue;
    if (!distinctPerReport.has(v.report_id)) {
      distinctPerReport.set(v.report_id, new Set());
    }
    distinctPerReport.get(v.report_id)!.add(v.admin_id);
  }

  for (const [reportId, adminSet] of distinctPerReport) {
    const ticker = tickerByReportId.get(reportId);
    if (ticker) result.set(ticker, adminSet.size);
  }

  return result;
}

/**
 * 단일 report_id에 대해 distinct admin_id 수 반환 (D15 R3.3-8 게이팅용).
 * RLS 정책 admin all (마이그 0003)로 authenticated admin만 SELECT 가능.
 * report_view_log 부재 시 0 반환.
 */
export async function getDistinctViewerCountForReport(reportId: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("report_view_log")
    .select("admin_id")
    .eq("report_id", reportId);
  if (error) {
    throw new Error(`report_view_log_count_failed:${error.code ?? "unknown"}`);
  }
  return new Set((data ?? []).map((r) => r.admin_id)).size;
}

/**
 * 단일 report_id의 ReportViewLog row 목록 반환 (UI 열람 패널용).
 * 빈 배열 fallback. RLS admin all 정책 통과 가정.
 */
export async function getViewersForReport(reportId: string): Promise<ReportViewLog[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("report_view_log")
    .select("id, admin_id, report_id, view_date, viewed_at")
    .eq("report_id", reportId)
    .order("viewed_at", { ascending: true });
  if (error) {
    throw new Error(`report_view_log_select_failed:${error.code ?? "unknown"}`);
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    adminId: r.admin_id,
    reportId: r.report_id,
    viewDate: r.view_date,
    viewedAt: r.viewed_at,
  }));
}
