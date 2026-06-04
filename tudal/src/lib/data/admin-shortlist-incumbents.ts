// W2b (D27 Q5) — incumbent 식별 + per-ticker thesis context builder.
// DI seam (admin-tier0-candidates 패턴): options.client 미지정 시 session createClient.
//   cron worker = service-role 명시 주입. screening 타입(IncumbentInfo)을 import (역참조 금지 방향).
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { IncumbentInfo } from "@/lib/screening/incumbent-merge";
import type { SelectionTrack, Timeframe } from "@/lib/screening/tier1-schema";
import { TRACK_SELECT_COUNT } from "@/lib/screening/tier1-schema";
import { reportSection0Schema } from "@/lib/data/report-section-schemas";

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

const THESIS_BULLET_MAX = 3;
const THESIS_HEADLINE_MAX = 160;
const THESIS_BULLET_CHAR_MAX = 220;
const COMMENT_MAX = 120;

function truncateText(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}…`;
}

interface ReportThesisRow {
  ticker: string;
  month: string;
  section_0: unknown;
}
interface SnapshotPerfRow {
  ticker: string;
  date: string;
  entry_price: string | number | null;
  total_return: string | number | null;
}

/**
 * incumbent별 직전 thesis 컨텍스트 (D27 Q5 — 토론/채점 프롬프트 {{REFLECTION_CONTEXT}} 주입용).
 * 구성: 직전 row(배지/점수/확신/논거) + stock_reports section_0(headline + thesis ≤3, incumbent month 이하 최신) +
 *      실현 성과(portfolio_snapshot entry_price>0시만 — W3 graceful) + 재점검 지시문.
 * 보조 조회(reports/snapshot)는 best-effort — 실패해도 직전 row 기반 컨텍스트는 생성 (throw 금지:
 * 컨텍스트 부분 결손이 선정 cron 전체를 막으면 안 됨. incumbent 평가 포함 자체는 union이 보장).
 */
export async function buildIncumbentThesisContexts(
  incumbents: readonly IncumbentInfo[],
  options: { client?: SupabaseClient } = {},
): Promise<Record<string, string>> {
  if (incumbents.length === 0) return {};
  const supabase = options.client ?? (await createClient());
  const tickers = incumbents.map((i) => i.ticker);
  // getIncumbents는 최신 month 단일 그룹을 반환하므로 사실상 동일 값 — 방어적 max.
  const latestIncumbentMonth = incumbents.reduce(
    (max, i) => (i.month > max ? i.month : max),
    incumbents[0].month,
  );

  // 1) 직전 리포트 section_0 (incumbent month 이하, ticker당 최신 month 1건) — best-effort.
  //    미래/현재 신규 리포트가 "직전" thesis를 덮어쓰면 안 됨 → lte(month) 가드.
  const thesisByTicker = new Map<string, { headline: string; bullets: string[] }>();
  try {
    const { data } = await supabase
      .from("stock_reports")
      .select("ticker, month, section_0")
      .in("ticker", tickers)
      .eq("is_latest", true)
      .lte("month", latestIncumbentMonth)
      .order("month", { ascending: false });
    for (const row of (data ?? []) as ReportThesisRow[]) {
      if (thesisByTicker.has(row.ticker)) continue; // month desc — 첫 행이 최신
      const parsed = reportSection0Schema.safeParse(row.section_0);
      if (!parsed.success) continue;
      thesisByTicker.set(row.ticker, {
        headline: truncateText(parsed.data.headline, THESIS_HEADLINE_MAX),
        bullets: parsed.data.thesis
          .slice(0, THESIS_BULLET_MAX)
          .map((bullet) => truncateText(bullet, THESIS_BULLET_CHAR_MAX)),
      });
    }
  } catch {
    // best-effort — 리포트 결손 시 직전 row 정보만으로 컨텍스트 생성.
  }

  // 2) 실현 성과 (entry_price>0 최신 snapshot의 total_return) — W3 graceful.
  const realizedByTicker = new Map<string, number>();
  try {
    const { data } = await supabase
      .from("portfolio_snapshot")
      .select("ticker, date, entry_price, total_return")
      .in("ticker", tickers)
      .order("date", { ascending: false });
    for (const row of (data ?? []) as SnapshotPerfRow[]) {
      if (realizedByTicker.has(row.ticker)) continue; // date desc — 첫 행이 최신
      const entry = numOrNull(row.entry_price);
      const ret = numOrNull(row.total_return);
      if (entry !== null && entry > 0 && ret !== null) {
        realizedByTicker.set(row.ticker, ret);
      }
    }
  } catch {
    // best-effort — W3 entry_price 실배선 전까지 생략이 기본.
  }

  // 3) 합성 (한국어, incumbent당 ≤ ~1.5k tok — W0 W2_TRACK_VOLUME 2k 가정 內).
  const out: Record<string, string> = {};
  for (const inc of incumbents) {
    const lines: string[] = [
      `[기존 선정 종목 재점검] 이 종목은 직전 선정 리스트(${inc.month.slice(0, 7)}, ${inc.bucket} ${inc.rank}위)에 포함되어 있었습니다.`,
    ];
    const meta: string[] = [];
    if (inc.consensusBadge) meta.push(`합의 배지 ${inc.consensusBadge}`);
    if (inc.aiScore !== null) meta.push(`AI 점수 ${inc.aiScore}`);
    if (inc.conviction !== null) meta.push(`확신도 ${inc.conviction}`);
    if (meta.length > 0) lines.push(`- 직전 평가: ${meta.join(" / ")}`);
    if (inc.aiCommentKr) {
      lines.push(
        `- 직전 한 줄 논거: "${truncateText(inc.aiCommentKr, COMMENT_MAX)}"`,
      );
    }
    const thesis = thesisByTicker.get(inc.ticker);
    if (thesis) {
      lines.push(`- 직전 리포트 핵심 thesis: ${thesis.headline}`);
      for (const b of thesis.bullets) lines.push(`  • ${b}`);
    }
    const realized = realizedByTicker.get(inc.ticker);
    if (realized !== undefined) {
      const pct = (realized * 100).toFixed(1);
      lines.push(`- 선정 이후 실현 성과: ${realized >= 0 ? "+" : ""}${pct}%`);
    }
    lines.push(
      "지시: 위 직전 논거가 여전히 유효한지 재점검하세요. 논거가 깨졌다면(더 이상 상승 여력이 없다면) 점수를 낮추고, 유효하다면 신규 후보와 동일 기준으로 점수화하세요. 유지가 자동이 아닙니다 — 이 종목도 다른 후보와 동일하게 랭킹 경쟁합니다.",
    );
    out[inc.ticker] = lines.join("\n");
  }
  return out;
}
