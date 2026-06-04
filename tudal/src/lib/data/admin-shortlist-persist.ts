// PR1 Task 3 → W1b 정리: 구 단발 writer(upsertShortList30)는 제거(67차 follow-up ②, live caller 0).
// 현 SoT writer = upsertShortListTrack(원자 RPC).
// runTier1Screening 산출 30 selected를 short_list_30 (month, ticker) 유니크 키로 UPSERT.
// B4 fix (omxy R1): delta_status NOT NULL constraint 통과 — 모든 row 'new' (전월 diff는 후속 PR scope).
// MF1 fix (deep-review #1, 3-track Fix-First): supabase client DI — cron path는 service-role, server action은 session-based.
// MF2 fix (deep-review #2): month-level idempotency — 신규 30 set 외 기존 row DELETE (stale row 누적 차단).
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  SelectionTrack,
  TickerAggregate,
  Timeframe,
} from '@/lib/screening/tier1-schema';
import { TRACK_SELECT_COUNT } from '@/lib/screening/tier1-schema';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
// B23 fix (omxy R11): ticker는 한국 종목 6자리 숫자만 허용. MF2 stale delete의 PostgREST filter
// raw string 조립 안전성 보장 (malformed ticker → invalid_ticker throw, DELETE 미호출).
const TICKER_RE = /^\d{6}$/;

interface ShortListRow {
  month: string; // YYYY-MM-01 date literal
  ticker: string;
  bucket: 'short' | 'mid' | 'long';
  rank: number;
  assigned_by: 'primary' | 'backfill' | null;
  prompt_version_id: string;
  personas_version_id: string;
  // B4 fix (omxy R1) — 마이그 0002 `delta_status text not null check ('new','hold','removed')`
  delta_status: 'new' | 'hold' | 'removed';
  delta_reason: string | null;
  // PR-E (마이그 0029, ADR D-7) — Tier 1 AI 산출 컬럼.
  consensus_badge: TickerAggregate['consensus_badges_by_timeframe']['short'];
  ai_score: number;
  weighted_score_short: number;
  weighted_score_mid: number;
  weighted_score_long: number;
  winning_timeframe: TickerAggregate['primary_timeframe'];
  conviction: number | null;
  ai_comment_kr: string | null;
  // SHORTLIST-PERSIST-METADATA-1 fix (omxy 교차검증 ROUND 1 P1) — Tier0/display 메타데이터 carry.
  // 기존엔 AI 컬럼만 persist → AI가 새로 선정한 ticker가 short_list_30에 name/sector/composite/signal
  // 없이 INSERT되어 홈 카드·리포트 헤더·포트폴리오에서 빈 카드로 렌더되던 결함. sector는 agg에서 직접,
  // name/composite_score/signal_label은 tier0_candidates_150(동일 month) best-effort lookup으로 채움.
  name: string | null;
  sector: string | null;
  composite_score: number | null;
  signal_label: string | null;
}

// PR-E — runTier1Screening.commentsByTicker carry (성공 panel ticker만, degraded는 부재).
export type TickerCommentMap = Record<
  string,
  { comment_kr: string; conviction: number }
>;

// W2b (D27 Q5) — incumbent-only selected가 tier0_candidates_150에 없을 때 기존 카드 메타 보존 fallback.
// sector는 제외 — agg.sector(canonical 검증 통과분)만 사용 (B93 비-canonical 재유입 방지).
export type IncumbentMetadataMap = Record<
  string,
  {
    name: string | null;
    compositeScore: number | null;
    signalLabel: string | null;
  }
>;

function toMonthDate(monthYM: string): string {
  if (!MONTH_RE.test(monthYM)) {
    throw new Error(`invalid_month_format:${monthYM}`);
  }
  return `${monthYM}-01`;
}

// W2a Task 6 — 트랙별 활성 bucket subset. assigned_timeframe(Timeframe)이 트랙 bucket purity 검증 기준.
const TRACK_BUCKETS: Record<SelectionTrack, readonly Timeframe[]> = {
  short: ['short'],
  midlong: ['mid', 'long'],
};

/**
 * W2a Task 6 — 공유 row 빌더 (upsertShortListTrack 전용 — 구 단발 writer는 W1b에서 제거).
 *
 * - 입력 selected를 bucket(assigned_timeframe)별로 묶어 rank(1-based)·AI 컬럼·delta_status='new'로 매핑.
 * - tier0_candidates_150(동일 month) best-effort lookup으로 name/composite_score/signal_label patch.
 *   ⚠ persist는 이 lookup 때문에 실패하지 않는다 — error/부재 시 placeholder null 유지.
 * - bucket order는 buckets 인자 순서를 따른다 (short → [short] / midlong → [mid, long]).
 *
 * 선검증(count/bucket purity/ticker/null)은 caller(upsertShortListTrack)에서 수행.
 * 본 헬퍼는 row가 trusted(검증 통과)임을 전제하되, ticker 형식만 방어적으로 재검증(lookup filter 안전성).
 */
async function buildShortListRows(
  supabase: SupabaseClient,
  monthDate: string,
  buckets: readonly Timeframe[],
  selected: readonly TickerAggregate[],
  commentsByTicker?: TickerCommentMap,
  incumbentTickers?: ReadonlySet<string>,
  incumbentMetadataByTicker?: IncumbentMetadataMap,
): Promise<ShortListRow[]> {
  const byTf: Record<Timeframe, TickerAggregate[]> = {
    short: [],
    mid: [],
    long: [],
  };
  for (const agg of selected) {
    // B23 fix (omxy R11): ticker 형식 검증 — lookup filter / RPC p_rows 안전성.
    if (!TICKER_RE.test(agg.ticker)) {
      throw new Error(`invalid_ticker:${agg.ticker}`);
    }
    if (agg.assigned_timeframe === null) {
      throw new Error(
        `assigned_timeframe_null_for_selected:${agg.ticker}`,
      );
    }
    byTf[agg.assigned_timeframe].push(agg);
  }

  const rows: ShortListRow[] = [];
  const newTickers: string[] = [];
  for (const tf of buckets) {
    byTf[tf].forEach((agg, idx) => {
      // PR-E — AI 컬럼 매핑. tf = assigned_timeframe (byTf 키). 배지/ai_score는 assigned timeframe 기준.
      const comment = commentsByTicker?.[agg.ticker];
      rows.push({
        month: monthDate,
        ticker: agg.ticker,
        bucket: tf,
        rank: idx + 1,
        assigned_by: agg.assigned_by,
        prompt_version_id: agg.prompt_version_id,
        personas_version_id: agg.personas_version_id,
        // W2b (D27 Q5) — delta_status 실계산: 직전 리스트(incumbent)에 있던 ticker가 재선정되면 'hold'.
        // incumbentTickers 미지정(단발 경로 등)은 전부 'new' (B4 fix — NOT NULL 보존).
        delta_status: incumbentTickers?.has(agg.ticker) ? 'hold' : 'new',
        delta_reason: null,
        // PR-E (ADR D-7) — assigned_timeframe(tf) 기준 배지/점수 + primary_timeframe + panel 코멘트/conviction.
        consensus_badge: agg.consensus_badges_by_timeframe[tf],
        ai_score: agg.weighted_scores[tf],
        weighted_score_short: agg.weighted_scores.short,
        weighted_score_mid: agg.weighted_scores.mid,
        weighted_score_long: agg.weighted_scores.long,
        winning_timeframe: agg.primary_timeframe,
        // degraded(⚪) ticker는 commentsByTicker 부재 → null (마이그 0029 nullable).
        conviction: comment?.conviction ?? null,
        ai_comment_kr: comment?.comment_kr ?? null,
        // SHORTLIST-PERSIST-METADATA-1 fix — sector는 aggregate에서 직접 carry (canonical 14|null).
        // name/composite_score/signal_label은 아래 tier0_candidates_150 lookup으로 patch (placeholder null).
        name: null,
        sector: agg.sector ?? null,
        composite_score: null,
        signal_label: null,
      });
      newTickers.push(agg.ticker);
    });
  }

  // SHORTLIST-PERSIST-METADATA-1 fix (omxy 교차검증 ROUND 1 P1) — 선정 ticker의 display 메타데이터
  // (name / composite_score=tier0_score / signal_label)를 tier0_candidates_150(동일 month, AI 선정 입력
  // 원천)에서 best-effort lookup해 row에 patch. tier0_candidates_150엔 trend/momentum/volatility/
  // summary_3line/suggested_weight가 없으므로 그 컬럼은 null 유지(카드 transform이 0/""로 표시).
  // ⚠ persist 자체는 절대 이 lookup 때문에 실패하지 않는다 — error/부재 시 placeholder null 유지.
  try {
    const { data: metaRows } = await supabase
      .from('tier0_candidates_150')
      .select('ticker, name, tier0_score, signal_label')
      .eq('month', monthDate)
      .in('ticker', newTickers);
    if (metaRows) {
      const metaByTicker = new Map<
        string,
        { name: string | null; composite_score: number | null; signal_label: string | null }
      >();
      for (const m of metaRows as Array<{
        ticker: string;
        name: string | null;
        tier0_score: string | number | null;
        signal_label: string | null;
      }>) {
        const raw = m.tier0_score;
        const cs = raw == null ? null : typeof raw === 'number' ? raw : parseFloat(raw);
        metaByTicker.set(m.ticker, {
          name: m.name ?? null,
          composite_score: cs != null && Number.isFinite(cs) ? cs : null,
          signal_label: m.signal_label ?? null,
        });
      }
      for (const row of rows) {
        const meta = metaByTicker.get(row.ticker);
        if (meta) {
          row.name = meta.name;
          row.composite_score = meta.composite_score;
          row.signal_label = meta.signal_label;
        }
      }
    }
  } catch {
    // best-effort display-meta lookup only; short_list_30 persist must not be blocked here.
  }

  // W2b (D27 Q5/D9) — incumbent-only display meta fallback. tier0 lookup이 채우지 못한 필드만
  // 기존 short_list_30 row 메타로 보존 (incumbent-only ticker는 tier0_candidates_150에 없음).
  // sector는 fallback 제외 — agg.sector(canonical 검증 통과분)만 사용 (B93).
  if (incumbentMetadataByTicker) {
    for (const row of rows) {
      const incMeta = incumbentMetadataByTicker[row.ticker];
      if (!incMeta) continue;
      row.name ??= incMeta.name;
      row.composite_score ??= incMeta.compositeScore;
      row.signal_label ??= incMeta.signalLabel;
    }
  }

  return rows;
}

/**
 * W2a Task 6 — rolling composite writer. 트랙(short=10 / midlong=20) 단위로 short_list_30를 갱신하되
 * 다른 트랙 bucket(예: short 갱신 시 mid/long 20)은 보존한다 (bucket-scoped DELETE는 RPC 내부).
 *
 * 선검증(count / bucket purity / ticker / month) 통과 후 `replace_shortlist_track` **단일 RPC 호출**.
 * atomic DELETE+INSERT · cross-bucket overlap · p_rows 내부검증 · authz guard · midlong carry는
 * 전부 RPC(마이그 0031, Task 5)의 단일 트랜잭션 내부에서 수행 — TS는 carry RPC를 별도 호출하지 않는다
 * (R2 HIGH-2).
 */
export async function upsertShortListTrack(
  monthYM: string,
  track: SelectionTrack,
  selected: readonly TickerAggregate[],
  options: {
    client?: SupabaseClient;
    commentsByTicker?: TickerCommentMap;
    /** W2b (D27 Q5) — 직전 리스트 ticker set. 포함 selected는 delta_status='hold'. */
    incumbentTickers?: ReadonlySet<string>;
    /** W2b (D9) — incumbent-only selected의 display meta 보존 fallback (sector 제외). */
    incumbentMetadataByTicker?: IncumbentMetadataMap;
  } = {},
): Promise<void> {
  // ① count 선검증.
  const expected = TRACK_SELECT_COUNT[track]; // 10 / 20
  if (selected.length !== expected) {
    throw new Error(
      `shortlist_track_count_mismatch:${track}:${selected.length}!=${expected}`,
    );
  }
  // ② ticker 형식 + bucket purity 선검증 (트랙 외 bucket·null → throw, RPC 미호출).
  const allowed = new Set<Timeframe>(TRACK_BUCKETS[track]);
  const bucketCounts = new Map<Timeframe, number>(
    TRACK_BUCKETS[track].map((tf) => [tf, 0]),
  );
  for (const a of selected) {
    if (!TICKER_RE.test(a.ticker)) {
      throw new Error(`invalid_ticker:${a.ticker}`);
    }
    if (a.assigned_timeframe === null || !allowed.has(a.assigned_timeframe)) {
      throw new Error(
        `shortlist_track_bucket_impurity:${track}:${a.ticker}:${a.assigned_timeframe}`,
      );
    }
    bucketCounts.set(
      a.assigned_timeframe,
      (bucketCounts.get(a.assigned_timeframe) ?? 0) + 1,
    );
  }
  for (const tf of TRACK_BUCKETS[track]) {
    const actual = bucketCounts.get(tf) ?? 0;
    if (actual !== 10) {
      throw new Error(
        `shortlist_track_bucket_count_mismatch:${track}:${tf}:${actual}!=10`,
      );
    }
  }
  // ③ month 선검증.
  const monthDate = toMonthDate(monthYM);
  const supabase = options.client ?? (await createClient());

  // ④ row 빌드 (공유 헬퍼 — bucket order = 트랙 bucket subset, AI 컬럼 + 메타 lookup +
  //    W2b delta_status 실계산 + incumbent-only meta fallback).
  const rows = await buildShortListRows(
    supabase,
    monthDate,
    TRACK_BUCKETS[track],
    selected,
    options.commentsByTicker,
    options.incumbentTickers,
    options.incumbentMetadataByTicker,
  );

  // ⑤ 원자적 RPC 단일 호출. carry는 midlong일 때 RPC 내부에서 수행 (R2 HIGH-2).
  const { error } = await supabase.rpc('replace_shortlist_track', {
    p_month: monthDate,
    p_track: track,
    p_rows: rows,
  });
  if (error) {
    throw new Error(`shortlist_persist_failed:${error.code ?? 'unknown'}`);
  }
}
