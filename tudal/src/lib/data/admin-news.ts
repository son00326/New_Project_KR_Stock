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

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { NewsEvent, Severity } from "@/types/admin";

// Step 2.7a (2026-05-28): cron 호출자 service-role client DI seam 추가.
// admin pages는 options.client 없이 호출 → 기존 session client (`createClient`) 사용.
// cron route가 createServiceRoleClient()를 주입하면 RLS bypass + 정상 SELECT.
// Step 2.7b.1 (2026-05-28): news-sweep + morning-briefing route wiring 완료 →
// W-news-cron-service-role-read 완전 해소.

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

export type TickerNewsEvent = Omit<NewsEvent, "ticker"> & {
  readonly ticker: string;
};

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

// per-ticker fan-out 행수 상한(= Core-11 평가 비용 driver). 비정상/대형 입력이 와도 read·비용을 bound.
const PER_TICKER_LIMIT_MAX = 20;

function compareNewsByPublishedAtDesc(a: NewsEvent, b: NewsEvent): number {
  const aMs = Date.parse(a.publishedAt);
  const bMs = Date.parse(b.publishedAt);
  if (Number.isFinite(aMs) && Number.isFinite(bMs) && aMs !== bMs) {
    return bMs - aMs;
  }
  return b.publishedAt.localeCompare(a.publishedAt);
}

function toTickerNewsEvent(
  row: NewsEventDbRow,
  expectedTicker: string,
): TickerNewsEvent | null {
  const event = transformNewsEventRow(row);
  if (event.ticker !== expectedTicker) {
    console.warn(
      JSON.stringify({
        event: "news_event_universe_ticker_mismatch",
        expectedTicker,
        actualTicker: event.ticker,
        newsEventId: event.id,
      }),
    );
    return null;
  }
  return { ...event, ticker: event.ticker };
}

function warnUniverseTickerQueryFailure(input: {
  readonly ticker: string;
  readonly kind: "error" | "rejected";
  readonly code: string;
}): void {
  console.warn(
    JSON.stringify({
      event: "news_event_universe_ticker_query_failed",
      ticker: input.ticker,
      kind: input.kind,
      code: input.code,
    }),
  );
}

function rejectionCode(reason: unknown): string {
  if (reason instanceof Error) return reason.name;
  if (typeof reason === "string" && reason.length > 0) return reason;
  return "unknown";
}

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

// universe-aware per-ticker bounded read (M12a tail starvation fix).
//   결함: getRecentNewsEvents({limit:50})은 전역 published_at desc 1윈도라 hot 종목이 윈도를
//   잠식 → quiet 종목들이 0건으로 굶음(tail starvation). M12a는 굶은 종목을 thesis-break 평가에서
//   통째로 누락(evaluator 유니버스 게이트). fix = 종목별 독립 .eq('ticker',t).limit(per) 쿼리 —
//   한 종목이 다른 종목의 슬롯을 못 먹고, null-ticker 시장뉴스는 아예 쿼리되지 않는다.
//   각 쿼리는 production partial index news_event_ticker_published_idx (ticker, published_at desc)
//   WHERE ticker is not null 를 range scan(마이그 0006). 새 마이그/RPC 없이 순수 PostgREST 합성.

/**
 * 종목 유니버스(활성 short_list_30)별로 최근 news_event를 perTickerLimit 건씩 읽어 병합.
 *
 * - tickers 비면 즉시 [] (0 round-trip, ₩0).
 * - severity 무효면 DB 접근 전 throw (getRecentNewsEvents parity).
 * - 종목별 독립 쿼리(Promise.allSettled) → 한 종목이 다른 종목 슬롯을 잠식 불가(starvation 차단).
 * - 종목 단위 graceful: reject/.error 쿼리는 warn 후 skip → 부분 실패는 partial 반환(news-sweep allSettled 선례).
 * - 단, 전(全) 종목 실패는 throw(news_event_universe_read_all_failed) — infra 장애를 "뉴스 없음"으로 오인 방지.
 * - 반환 행은 전부 ticker != null (eq('ticker',t)로 null 제외) → caller의 .filter(n=>n.ticker) 불필요.
 * - 병합 후 publishedAt desc 재정렬.
 */
export async function getRecentNewsEventsForUniverse(
  tickers: readonly string[],
  options: {
    perTickerLimit?: number;
    severity?: Severity;
    client?: SupabaseClient;
  } = {},
): Promise<TickerNewsEvent[]> {
  if (tickers.length === 0) return [];
  if (options.severity && !SEVERITY_SET.has(options.severity)) {
    throw new Error(`news_event_invalid_severity_filter:${options.severity}`);
  }
  // perTickerLimit 클램프: 유한값은 [1, PER_TICKER_LIMIT_MAX]로 trunc·clamp, 비유한(NaN/Infinity)은 기본값 2.
  //   (구 Math.max(1, Math.trunc(NaN))=NaN → .limit(NaN), Infinity → unbounded read 결함 fix.)
  const requestedPer = options.perTickerLimit ?? 2;
  const per = Number.isFinite(requestedPer)
    ? Math.min(PER_TICKER_LIMIT_MAX, Math.max(1, Math.trunc(requestedPer)))
    : 2;
  const uniq = [...new Set(tickers)];
  const supabase = options.client ?? (await createClient());

  const queries = uniq.map((ticker) => {
    let query = supabase
      .from("news_event")
      .select(NEWS_SELECT_COLUMNS)
      .eq("ticker", ticker)
      .order("published_at", { ascending: false })
      .limit(per);
    if (options.severity) {
      query = query.eq("severity", options.severity);
    }
    return { ticker, response: query };
  });
  const settled = await Promise.allSettled(queries.map((q) => q.response));

  const rows: Array<{
    readonly expectedTicker: string;
    readonly row: NewsEventDbRow;
  }> = [];
  let failureCount = 0;
  for (const [index, result] of settled.entries()) {
    const query = queries[index];
    if (!query) continue;
    if (result.status === "rejected") {
      failureCount += 1;
      warnUniverseTickerQueryFailure({
        ticker: query.ticker,
        kind: "rejected",
        code: rejectionCode(result.reason),
      });
      continue;
    }
    const { data, error }: {
      data: NewsEventDbRow[] | null;
      error: PostgrestError | null;
    } = result.value;
    if (error) {
      failureCount += 1;
      warnUniverseTickerQueryFailure({
        ticker: query.ticker,
        kind: "error",
        code: error.code ?? "unknown",
      });
      continue;
    }
    for (const row of data ?? []) {
      rows.push({ expectedTicker: query.ticker, row });
    }
  }

  // 전(全) 종목 쿼리 실패 = infra 장애. []를 반환하면 M12a가 "뉴스 없음(thesis 정상)"으로 오인하는
  //   false all-clear가 된다 → throw로 morning-briefing try/catch에 표면화(부분 실패는 위에서 graceful).
  //   uniq.length>0 가드: 빈 유니버스는 함수 진입부에서 이미 [] 반환됨.
  if (uniq.length > 0 && failureCount === uniq.length) {
    throw new Error(
      `news_event_universe_read_all_failed:${failureCount}/${uniq.length}`,
    );
  }

  return rows
    .flatMap(({ expectedTicker, row }) => {
      const event = toTickerNewsEvent(row, expectedTicker);
      return event ? [event] : [];
    })
    .sort(compareNewsByPublishedAtDesc);
}

// 59차 Mock cleanup Step 2.7b.2: news-sweep cron classifier 결과를 news_event 테이블에 batch
// upsert. ON CONFLICT (url) DO NOTHING (news_event_url_uniq) — append-only news, classifier
// deterministic → 동일 URL 재분류 무의미 (plan §0 D2). service-role client 주입 시 RLS
// using(is_admin()) 우회 (cron context).

export async function insertNewsEvents(
  events: NewsEvent[],
  options: { client?: SupabaseClient } = {},
): Promise<void> {
  if (events.length === 0) return;
  for (const e of events) {
    if (!SEVERITY_SET.has(e.severity)) {
      throw new Error(`news_event_invalid_severity:${e.severity}`);
    }
  }
  const supabase = options.client ?? (await createClient());
  const rows = events.map((e) => ({
    ticker: e.ticker,
    severity: e.severity,
    title: e.title,
    source: e.source,
    url: e.url,
    published_at: e.publishedAt,
    fetched_at: e.fetchedAt,
    classification_reason: e.classificationReason,
  }));
  const { error } = await supabase
    .from("news_event")
    .upsert(rows, { onConflict: "url", ignoreDuplicates: true });
  if (error) {
    throw new Error(`news_event_insert_failed:${error.code ?? "unknown"}`);
  }
}
