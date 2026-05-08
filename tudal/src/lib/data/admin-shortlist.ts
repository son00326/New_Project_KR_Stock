import { createClient } from "@/lib/supabase/server";
import type {
  BucketKind,
  DeltaStatus,
  ShortListItem,
} from "@/types/admin";

export interface ShortListDbRow {
  id: string;
  month: string;
  ticker: string;
  bucket: BucketKind;
  rank: number;
  composite_score: string | number | null;
  trend_score: string | number | null;
  momentum_score: string | number | null;
  volatility_score: string | number | null;
  signal_label: string | null;
  delta_status: DeltaStatus;
  delta_reason: string | null;
  summary_3line: string | null;
  suggested_weight: string | number | null;
  created_at: string;
}

export interface ShortListDelta {
  month: string;
  newCount: number;
  holdCount: number;
  removedCount: number;
}

// T7e.2 갭 — short_list_30 스키마는 ticker만 보관(name·sector 컬럼 없음).
// 본 transformer는 fallback (name=ticker · sector="미분류") 또는 외부 lookup 사용.
// T7e.8 prep (B-1 Python 스크립트) 단계에서 둘 중 하나로 해소 예정:
//   (a) short_list_30 ALTER TABLE로 name/sector 컬럼 추가 (마이그 0011 충돌 시 0012)
//   (b) 별도 tickers_meta 테이블 + JOIN
//   (c) 정적 lookup TS 파일 (Python 스크립트가 함께 갱신)
export type TickerMetaLookup = Record<string, { name: string; sector: string }>;

function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: string | null | undefined): string {
  return v ?? "";
}

function deriveVisual(
  trendScore: number,
  momentumScore: number,
  volatilityScore: number,
  deltaStatus: DeltaStatus,
): { divergencePct: number; sparkline7d: number[] } {
  const divergenceRaw =
    deltaStatus === "removed"
      ? -((100 - momentumScore) * 0.08 + 1)
      : (trendScore - 60) * 0.14 + (momentumScore - 70) * 0.06;
  const divergencePct = Math.round(divergenceRaw * 10) / 10;

  const slope = (momentumScore - 70) / 30;
  const amp = Math.max(0.3, (100 - volatilityScore) / 25);
  const seed = trendScore * 31 + momentumScore * 17 + volatilityScore * 7;
  const base = 100;
  const sparkline7d = Array.from({ length: 7 }, (_, i) => {
    const t = i / 6;
    const wiggle = Math.sin(seed * 0.013 + i * 1.1) * amp;
    const value = base + slope * 3 * t + wiggle;
    return Math.round(value * 100) / 100;
  });

  return { divergencePct, sparkline7d };
}

export function transformShortListRow(
  row: ShortListDbRow,
  tickerMeta?: TickerMetaLookup,
): ShortListItem {
  const compositeScore = num(row.composite_score);
  const trendScore = num(row.trend_score);
  const momentumScore = num(row.momentum_score);
  const volatilityScore = num(row.volatility_score);
  const meta = tickerMeta?.[row.ticker];
  const { divergencePct, sparkline7d } = deriveVisual(
    trendScore,
    momentumScore,
    volatilityScore,
    row.delta_status,
  );

  return {
    id: row.id,
    month: row.month,
    ticker: row.ticker,
    name: meta?.name ?? row.ticker,
    sector: meta?.sector ?? "미분류",
    bucket: row.bucket,
    rank: row.rank,
    compositeScore,
    trendScore,
    momentumScore,
    volatilityScore,
    divergencePct,
    sparkline7d,
    signalLabel: str(row.signal_label),
    deltaStatus: row.delta_status,
    deltaReason: str(row.delta_reason),
    summary3Line: str(row.summary_3line),
    suggestedWeight: num(row.suggested_weight),
    createdAt: row.created_at,
  };
}

export function aggregateShortListDelta(items: ShortListItem[]): ShortListDelta {
  if (items.length === 0) {
    return { month: "", newCount: 0, holdCount: 0, removedCount: 0 };
  }
  let newCount = 0;
  let holdCount = 0;
  let removedCount = 0;
  for (const item of items) {
    if (item.deltaStatus === "new") newCount++;
    else if (item.deltaStatus === "hold") holdCount++;
    else if (item.deltaStatus === "removed") removedCount++;
  }
  return {
    month: items[0].month,
    newCount,
    holdCount,
    removedCount,
  };
}

export async function getActiveShortList(
  options?: { month?: string; tickerMeta?: TickerMetaLookup },
): Promise<ShortListItem[]> {
  const client = await createClient();
  let query = client
    .from("short_list_30")
    .select(
      "id, month, ticker, bucket, rank, composite_score, trend_score, momentum_score, volatility_score, signal_label, delta_status, delta_reason, summary_3line, suggested_weight, created_at",
    );

  if (options?.month) {
    query = query.eq("month", options.month);
  }

  query = query
    .order("month", { ascending: false })
    .order("bucket", { ascending: true })
    .order("rank", { ascending: true });

  const { data, error } = await query;
  if (error) {
    throw new Error(
      `short_list_30 query failed: ${error.message ?? "unknown error"}`,
    );
  }

  const rows = (data ?? []) as ShortListDbRow[];
  const targetMonth = options?.month ?? rows[0]?.month;
  const filtered = targetMonth
    ? rows.filter((row) => row.month === targetMonth)
    : [];
  return filtered.map((row) => transformShortListRow(row, options?.tickerMeta));
}

export async function getShortListDelta(): Promise<ShortListDelta> {
  const items = await getActiveShortList();
  return aggregateShortListDelta(items);
}
