import { createClient } from "@/lib/supabase/server";
import type { ShortListItem, StockReport } from "@/types/admin";

// ---------------------------------------------------------------------------
// jsonb section 타입 (T7e.3) — `stock_reports.section_X` 컬럼은 jsonb이고
// `StockReport.section_X`는 `unknown`이다. 아래 타입들은 UI 렌더 시점의
// shape 가정이며 실제 jsonb 적재는 S5 M10 / S7a 배치가 보증한다.
// ---------------------------------------------------------------------------

export type ReportSection0 = {
  headline: string;
  thesis: string[];
  conviction: number;
  committeeMini: {
    core: { approve: number; reject: number; abstain: number };
    sector: { approve: number; reject: number; abstain: number };
  };
  priceBands: { bear: string; base: string; bull: string };
};

export type ReportSection1 = {
  description: string;
  segments: { name: string; share: string }[];
  keyFacts: { label: string; value: string }[];
};

export type ReportSection2 = {
  summary: string;
  revenue: { fy: string; value: string; yoy: string }[];
  margins: { operating: string; net: string };
  balance: { debtRatio: string; cash: string };
};

export type ReportSection3 = {
  summary: string;
  multiples: { metric: string; value: string; peer: string }[];
};

export type ReportSection4 = {
  summary: string;
  drivers: string[];
  tam: string;
};

export type ReportSection5 = {
  summary: string;
  risks: { title: string; severity: "high" | "medium" | "low"; detail: string }[];
};

export type ReportSection6 = {
  summary: string;
  signals: { name: string; state: "on" | "watch" | "off"; note: string }[];
  axis: { trend: number; momentum: number; volatility: number };
  divergencePct: number;
};

export type ReportSection7 = {
  summary: string;
  triggers: string[];
  alternatives: { label: string; detail: string }[];
};

export type ReportSection8 = {
  conclusion: string;
  recommendation: string;
  keyQuotes: { side: "pro" | "con" | "neutral"; quote: string }[];
};

export type ReportAppendix = {
  technicals: { name: string; value: string }[];
  dataSources: string[];
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

const REPORT_COLUMNS =
  "id, ticker, month, version, schema_version, is_latest, section_0, section_1, section_2, section_3, section_4, section_5, section_6, section_7, section_8, appendix, regen_auto_count, regen_manual_count, generated_at";

export function transformStockReportRow(row: StockReportDbRow): StockReport {
  return {
    id: row.id,
    ticker: row.ticker,
    month: row.month,
    version: row.version,
    schemaVersion: row.schema_version,
    isLatest: row.is_latest,
    section_0: row.section_0,
    section_1: row.section_1,
    section_2: row.section_2,
    section_3: row.section_3,
    section_4: row.section_4,
    section_5: row.section_5,
    section_6: row.section_6,
    section_7: row.section_7,
    section_8: row.section_8,
    appendix: row.appendix,
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
): Promise<StockReport | null> {
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
