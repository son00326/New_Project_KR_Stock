import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { ShortListItem, StockReport, StockReportSections } from "@/types/admin";
import {
  reportSection0Schema,
  reportSection1Schema,
  reportSection2Schema,
  reportSection3Schema,
  reportSection4Schema,
  reportSection5Schema,
  reportSection6Schema,
  reportSection7Schema,
  reportAppendixSchema,
  parseReportSection8,
  parseSectionSafe,
  type ReportSection0,
  type ReportSection1,
  type ReportSection2,
  type ReportSection3,
  type ReportSection4,
  type ReportSection5,
  type ReportSection6,
  type ReportSection7,
  type ReportSection8,
  type ReportAppendix,
  type ParseErrorContext,
} from "./report-section-schemas";

// PR3a — page.tsx의 기존 type import path 보존 (re-export).
export type {
  ReportSection0,
  ReportSection1,
  ReportSection2,
  ReportSection3,
  ReportSection4,
  ReportSection5,
  ReportSection6,
  ReportSection7,
  ReportSection8,
  ReportAppendix,
};

// ---------------------------------------------------------------------------
// DB row + transformer
// ---------------------------------------------------------------------------

export interface StockReportDbRow {
  id: string;
  ticker: string;
  month: string;
  version: number;
  schema_version: number;
  is_latest: boolean;
  section_0: unknown;
  section_1: unknown;
  section_2: unknown;
  section_3: unknown;
  section_4: unknown;
  section_5: unknown;
  section_6: unknown;
  section_7: unknown;
  section_8: unknown;
  appendix: unknown;
  regen_auto_count: number;
  regen_manual_count: number;
  generated_at: string;
}

// PR3a — 각 section을 zod safeParse 통과시켜 nullable typed 결과로 반환.
// page.tsx는 본 결과를 받아 null guard로 fallback UI 렌더.
// PR3a multi-source review (gsd WR-01): ValidatedStockReport는 StockReportSections
// (admin.ts SoT) 전체 키를 omit해서 lockstep 보존 — 후속 PR이 admin.ts에 신규 section
// 추가 시 ValidatedStockReport도 자동 갱신 필요 박제.
export interface ValidatedStockReport
  extends Omit<StockReport, keyof StockReportSections> {
  section_0: ReportSection0 | null;
  section_1: ReportSection1 | null;
  section_2: ReportSection2 | null;
  section_3: ReportSection3 | null;
  section_4: ReportSection4 | null;
  section_5: ReportSection5 | null;
  section_6: ReportSection6 | null;
  section_7: ReportSection7 | null;
  section_8: ReportSection8 | null;
  appendix: ReportAppendix | null;
}

const REPORT_COLUMNS =
  "id, ticker, month, version, schema_version, is_latest, section_0, section_1, section_2, section_3, section_4, section_5, section_6, section_7, section_8, appendix, regen_auto_count, regen_manual_count, generated_at";

// PR3a multi-source review (gsd CR-01 + red-team RT#2 + omxy R7 P2):
// silent null drop은 PR1 cron 가동 후 운영 monitoring blind spot. transformer가
// section context와 ticker를 cline → console.warn으로 위임. PR1 wire 시점에
// metric/logger로 격상하기 좋은 분리 지점.
function warnSectionValidationFailure(
  ticker: string,
  section: string,
  ctx: ParseErrorContext,
): void {
  const pathStr = ctx.path.length > 0 ? ctx.path.join('.') : '<root>';
  console.warn(
    `[admin-reports] ${section} validation failed for ticker=${ticker} ` +
      `path=${pathStr} message=${ctx.message}`,
  );
}

export function transformStockReportRow(
  row: StockReportDbRow,
): ValidatedStockReport {
  const warn = (section: string) => (ctx: ParseErrorContext) =>
    warnSectionValidationFailure(row.ticker, section, ctx);
  return {
    id: row.id,
    ticker: row.ticker,
    month: row.month,
    version: row.version,
    schemaVersion: row.schema_version,
    isLatest: row.is_latest,
    section_0: parseSectionSafe(reportSection0Schema, row.section_0, warn('section_0')),
    section_1: parseSectionSafe(reportSection1Schema, row.section_1, warn('section_1')),
    section_2: parseSectionSafe(reportSection2Schema, row.section_2, warn('section_2')),
    section_3: parseSectionSafe(reportSection3Schema, row.section_3, warn('section_3')),
    section_4: parseSectionSafe(reportSection4Schema, row.section_4, warn('section_4')),
    section_5: parseSectionSafe(reportSection5Schema, row.section_5, warn('section_5')),
    section_6: parseSectionSafe(reportSection6Schema, row.section_6, warn('section_6')),
    section_7: parseSectionSafe(reportSection7Schema, row.section_7, warn('section_7')),
    section_8: parseReportSection8(row.section_8, (s8ctx) => {
      console.warn(
        `[admin-reports] section_8 validation failed for ticker=${row.ticker} ` +
          `modernPath=${s8ctx.modernError.path.join('.') || '<root>'} ` +
          `modernMsg=${s8ctx.modernError.message} ` +
          `legacyPath=${s8ctx.legacyError.path.join('.') || '<root>'} ` +
          `legacyMsg=${s8ctx.legacyError.message}`,
      );
    }),
    appendix: parseSectionSafe(reportAppendixSchema, row.appendix, warn('appendix')),
    regenAutoCount: row.regen_auto_count,
    regenManualCount: row.regen_manual_count,
    generatedAt: row.generated_at,
  };
}

// ---------------------------------------------------------------------------
// Supabase wrappers — 에러는 throw (T7e.2 정책 동일).
// 호출부 Server Component는 error.tsx 바운더리, Server Action은 try/catch 변환.
// ---------------------------------------------------------------------------

export async function getReportByTicker(
  ticker: string,
  options?: { month?: string },
): Promise<ValidatedStockReport | null> {
  const client = await createClient();
  let query = client
    .from("stock_reports")
    .select(REPORT_COLUMNS)
    .eq("ticker", ticker)
    .eq("is_latest", true);

  if (options?.month) {
    query = query.eq("month", options.month);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new Error(
      `stock_reports query failed: ${error.message ?? "unknown error"}`,
    );
  }
  if (!data) return null;
  return transformStockReportRow(data as StockReportDbRow);
}

export async function reportExistsForMonth(
  ticker: string,
  month: string,
): Promise<boolean> {
  const client = await createClient();
  const { data, error } = await client
    .from("stock_reports")
    .select("id")
    .eq("ticker", ticker)
    .eq("month", month)
    .eq("is_latest", true)
    .maybeSingle();

  if (error) {
    throw new Error(
      `stock_reports existence check failed: ${error.message ?? "unknown error"}`,
    );
  }
  return data !== null;
}

// PR5 (R3 MEDIUM-1 / MEDIUM-1): cron resume/skip predicate.
// reportExistsForMonth는 row 존재만 본다 — screening/PR5b가 section_8만 채운 row(본문 부재)도 true.
// cron worker는 "본문 완성"까지 판별해야 함: cron UPSERT가 section_0~7을 atomic write하므로
// 양끝(section_0 AND section_7) non-null을 complete proxy로 사용 (section_0만 채워진 partial 식별).
// DI seam: cron service-role client 주입.
export async function reportExistsAndCompleteForMonth(
  ticker: string,
  month: string,
  options?: { client?: SupabaseClient },
): Promise<{ exists: boolean; complete: boolean }> {
  const client = options?.client ?? (await createClient());
  const { data, error } = await client
    .from("stock_reports")
    .select("id, section_0, section_7")
    .eq("ticker", ticker)
    .eq("month", month)
    .eq("is_latest", true)
    .maybeSingle();

  if (error) {
    throw new Error(
      `stock_reports completeness check failed: ${error.message ?? "unknown error"}`,
    );
  }
  if (data === null) {
    return { exists: false, complete: false };
  }
  const row = data as { section_0: unknown; section_7: unknown };
  const complete = row.section_0 !== null && row.section_7 !== null;
  return { exists: true, complete };
}

// ---------------------------------------------------------------------------
// 버킷 내 prev/next 내비 — 실 shortlist에서 파생.
// removed 종목은 제외. 빈 입력에는 {} 반환.
// ---------------------------------------------------------------------------

export interface BucketNeighbor {
  ticker: string;
  name: string;
}

export function deriveBucketNeighbors(
  ticker: string,
  items: ShortListItem[],
): { prev?: BucketNeighbor; next?: BucketNeighbor } {
  const current = items.find((r) => r.ticker === ticker);
  if (!current) return {};
  const bucketMembers = items
    .filter((r) => r.bucket === current.bucket && r.deltaStatus !== "removed")
    .sort((a, b) => a.rank - b.rank);
  const idx = bucketMembers.findIndex((r) => r.ticker === ticker);
  if (idx === -1) return {};
  return {
    prev:
      idx > 0
        ? {
            ticker: bucketMembers[idx - 1].ticker,
            name: bucketMembers[idx - 1].name,
          }
        : undefined,
    next:
      idx < bucketMembers.length - 1
        ? {
            ticker: bucketMembers[idx + 1].ticker,
            name: bucketMembers[idx + 1].name,
          }
        : undefined,
  };
}
