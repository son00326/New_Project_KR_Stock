// admin-news.ts — news_event 테이블 SELECT helper (58차 Mock cleanup Step 2.1)
//
// MOCK_ADMIN_NEWS는 `/admin/alerts` 페이지에서 "Critical/Warning 뉴스" 섹션에 거짓 표시하던
// fixture. 실 운영에서는 S5a news-sweep cron (네이버 뉴스 API + 분류)이 news_event 테이블에
// INSERT 하고, Critical은 alert_event news_critical 발행.
//
// 0 rows = empty state (현재 production news_event row 부재 → "Critical 뉴스 없음" 렌더).
//
// SoT: 0006_s5a_automation.sql §news_event (severity check + published_at desc index +
//      admin RLS) + 0010 RLS 정합.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { NewsEvent, Severity } from "@/types/admin";

// Step 2.7a (2026-05-28): cron 호출자 service-role client DI seam 추가.
// admin pages는 options.client 없이 호출 → 기존 session client (`createClient`) 사용.
// cron route가 createServiceRoleClient()를 주입하면 RLS bypass + 정상 SELECT.
// W-news-cron-service-role-read는 본 파일의 DI half만 준비됨; route wiring은 별도 scope.

export interface NewsEventDbRow {
  id: string;
  ticker: string | null;
  severity: string;
  title: string;
  source: string;
  url: string;
  published_at: string;
  fetched_at: string;
  classification_reason: string | null;
}

const SEVERITY_SET: ReadonlySet<Severity> = new Set<Severity>([
  "critical",
  "warning",
  "info",
]);

/**
 * snake_case news_event row → camelCase NewsEvent.
 *
 * - severity enum 검증 (DB check constraint 정합).
 * - classification_reason은 nullable text (sweep classifier 미세팅 row 정상).
 */
export function transformNewsEventRow(row: NewsEventDbRow): NewsEvent {
  if (!SEVERITY_SET.has(row.severity as Severity)) {
    throw new Error(`news_event_invalid_severity:${row.severity}`);
  }
  return {
    id: row.id,
    ticker: row.ticker,
    severity: row.severity as Severity,
    title: row.title,
    source: row.source,
    url: row.url,
    publishedAt: row.published_at,
    fetchedAt: row.fetched_at,
    classificationReason: row.classification_reason,
  };
}

const NEWS_SELECT_COLUMNS =
  "id, ticker, severity, title, source, url, published_at, fetched_at, classification_reason";

/**
 * 최근 news_event 목록 반환 (published_at desc).
 *
 * - severity 필터 옵션 (critical / warning / info).
 * - 0 rows → empty array.
 */
export async function getRecentNewsEvents(
  options: {
    severity?: Severity;
    limit?: number;
    client?: SupabaseClient;
  } = {},
): Promise<NewsEvent[]> {
  if (options.severity && !SEVERITY_SET.has(options.severity)) {
    throw new Error(`news_event_invalid_severity_filter:${options.severity}`);
  }
  // Step 2.7a DI seam: cron service-role client 주입 시 session client 우회.
  const supabase = options.client ?? (await createClient());
  let query = supabase
    .from("news_event")
    .select(NEWS_SELECT_COLUMNS)
    .order("published_at", { ascending: false });
  if (options.severity) {
    query = query.eq("severity", options.severity);
  }
  if (typeof options.limit === "number" && options.limit > 0) {
    query = query.limit(options.limit);
  }
  const { data, error } = await query;
  if (error) {
    throw new Error(`news_event_select_failed:${error.code ?? "unknown"}`);
  }
  return (data ?? []).map((r) => transformNewsEventRow(r as NewsEventDbRow));
}
