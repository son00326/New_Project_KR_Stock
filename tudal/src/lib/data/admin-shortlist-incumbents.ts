// W2b (D27 Q5) — incumbent 식별 + per-ticker thesis context builder.
// DI seam (admin-tier0-candidates 패턴): options.client 미지정 시 session createClient.
//   cron worker = service-role 명시 주입. screening 타입(IncumbentInfo)을 import (역참조 금지 방향).
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { IncumbentInfo } from "@/lib/screening/incumbent-merge";
import type { SelectionTrack, Timeframe } from "@/lib/screening/tier1-schema";
import { TRACK_SELECT_COUNT } from "@/lib/screening/tier1-schema";

const MONTH_YM_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const TRACK_BUCKETS: Record<SelectionTrack, readonly Timeframe[]> = {
  short: ["short"],
  midlong: ["mid", "long"],
};

interface IncumbentDbRow {
  ticker: string;
  bucket: Timeframe;
  rank: number;
  month: string;
  sector: string | null;
  name: string | null;
  composite_score: string | number | null;
  signal_label: string | null;
  ai_comment_kr: string | null;
  consensus_badge: string | null;
  ai_score: string | number | null;
  conviction: string | number | null;
  delta_status: string;
}

function numOrNull(v: string | number | null): number | null {
  if (v === null) return null;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * 직전 선정 리스트의 트랙 incumbent rows (D1 — 최신 month 그룹).
 * cold start(0 rows) = [] 반환(신규 취급).
 * 부분 그룹(예: short 9/10)은 carry_short_into_month가 midlong 졸업 ticker를 제외하는 정당 상태라 허용한다.
 * `> TRACK_SELECT_COUNT`만 corruption/수동 DB 조작 방어로 fail-closed throw.
 */
export async function getIncumbents(options: {
  track: SelectionTrack;
  month: string; // 선정 대상 YYYY-MM
  client?: SupabaseClient;
}): Promise<IncumbentInfo[]> {
  if (!MONTH_YM_RE.test(options.month)) {
    throw new Error(`invalid_month_format:${options.month}`);
  }
  const monthDate = `${options.month}-01`;
  const supabase = options.client ?? (await createClient());
  const { data, error } = await supabase
    .from("short_list_30")
    .select(
      "ticker, bucket, rank, month, sector, name, composite_score, signal_label, ai_comment_kr, consensus_badge, ai_score, conviction, delta_status",
    )
    .in("bucket", [...TRACK_BUCKETS[options.track]])
    .lte("month", monthDate)
    .order("month", { ascending: false })
    .order("bucket", { ascending: true })
    .order("rank", { ascending: true });
  if (error) {
    throw new Error(`incumbents_query_failed:${error.code ?? "unknown"}`);
  }
  const rows = (data ?? []) as IncumbentDbRow[];
  if (rows.length === 0) return [];
  const latestMonth = rows[0].month;
  const latest = rows.filter((r) => r.month === latestMonth);
  const expected = TRACK_SELECT_COUNT[options.track];
  if (latest.length > expected) {
    throw new Error(
      `incumbents_count_exceeded:${options.track}:${latest.length}>${expected}`,
    );
  }
  return latest.map((r) => ({
    ticker: r.ticker,
    bucket: r.bucket,
    rank: r.rank,
    month: r.month,
    sector: r.sector,
    name: r.name,
    aiCommentKr: r.ai_comment_kr,
    consensusBadge: r.consensus_badge,
    aiScore: numOrNull(r.ai_score),
    conviction: numOrNull(r.conviction),
    deltaStatus: r.delta_status,
    compositeScore: numOrNull(r.composite_score),
    signalLabel: r.signal_label,
  }));
}
