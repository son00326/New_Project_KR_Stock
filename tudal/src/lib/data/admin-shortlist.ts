import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type {
  BucketKind,
  ConsensusBadge,
  DeltaStatus,
  ShortListItem,
} from "@/types/admin";

export interface ShortListDbRow {
  id: string;
  month: string;
  ticker: string;
  // 마이그 0012 (T7e.8) 추가 — Tier 0 Python seed가 채우는 컬럼. 시드 전 기존 row는 null.
  name?: string | null;
  sector?: string | null;
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
  // 마이그 0029 (PR-E) — Tier 1 AI 산출 컬럼. AI 선정 전(Tier 0 fallback) row는 null.
  consensus_badge?: string | null;
  ai_score?: string | number | null;
  winning_timeframe?: string | null;
  conviction?: string | number | null;
  ai_comment_kr?: string | null;
}

const CONSENSUS_BADGES: readonly ConsensusBadge[] = ["🟢", "🔵", "🟣", "🟡", "⚪"];

function toBadge(v: string | null | undefined): ConsensusBadge | null {
  return v != null && (CONSENSUS_BADGES as readonly string[]).includes(v)
    ? (v as ConsensusBadge)
    : null;
}

function toTimeframe(v: string | null | undefined): BucketKind | null {
  return v === "short" || v === "mid" || v === "long" ? v : null;
}

// num()은 null→0 (점수 0과 무AI 구분 안 됨). AI 필드는 null 보존이 필요 → numOrNull.
function numOrNull(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

export interface ShortListDelta {
  month: string;
  newCount: number;
  holdCount: number;
  removedCount: number;
}

// T7e.8(41차) — short_list_30에 name/sector 컬럼 추가 완료 (마이그 0012, (a) 채택).
// row.name / row.sector가 채워져 있으면 우선 사용, 비어있으면 tickerMeta fallback,
// 둘 다 없으면 기존 (name=ticker · sector="미분류") placeholder.
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

  const rowName = row.name?.trim();
  const rowSector = row.sector?.trim();
  return {
    id: row.id,
    month: row.month,
    ticker: row.ticker,
    name: rowName || meta?.name || row.ticker,
    sector: rowSector || meta?.sector || "미분류",
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
    // PR-F (마이그 0029) — Tier 1 AI 산출. DB null(Tier 0 fallback) → null 보존 (AI 대기 UI 판정).
    consensusBadge: toBadge(row.consensus_badge),
    aiScore: numOrNull(row.ai_score),
    aiCommentKr: row.ai_comment_kr ?? null,
    winningTimeframe: toTimeframe(row.winning_timeframe),
    conviction: numOrNull(row.conviction),
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
  options?: { month?: string; tickerMeta?: TickerMetaLookup; client?: SupabaseClient },
): Promise<ShortListItem[]> {
  // PR5 (DI seam): cron worker가 service-role client 주입 (auth.uid()=null이라 session client는 RLS reject).
  const client = options?.client ?? (await createClient());
  let query = client
    .from("short_list_30")
    .select(
      "id, month, ticker, name, sector, bucket, rank, composite_score, trend_score, momentum_score, volatility_score, signal_label, delta_status, delta_reason, summary_3line, suggested_weight, created_at, consensus_badge, ai_score, winning_timeframe, conviction, ai_comment_kr",
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
