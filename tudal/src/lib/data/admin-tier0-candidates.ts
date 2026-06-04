// PR-D (ADR D-3 / B1) — tier0_candidates_150 consumer.
// Python --emit-candidates producer가 write한 150 후보(단/중/장 disjoint 50씩)를 SELECT →
// runMonthlyBatchOrchestrator의 tier0Source 입력 (Tier1Candidate[]).
//
// DI seam (admin-shortlist.ts 패턴): options.client 미지정 시 session-based createClient.
//   - cron route = createServiceRoleClient() 명시 주입 (auth.uid()=null → RLS bypass 필요).
//   - admin server action = session client 주입 (is_admin() RLS).
//   본 모듈은 createServiceRoleClient를 직접 import하지 않는다 (server-only import boundary 보존).
//
// shape: producer가 cross-bucket disjoint 보장 (ticker 1개 = bucket 1개). DB unique(month,ticker)가
//   150 distinct 2차 방어. count(===150)/distinct assert는 호출자(runMonthlyBatchOrchestrator /
//   runTier1Screening)가 수행 — 본 consumer는 SELECT 결과를 그대로 매핑 (부족 시 orchestrator가
//   `tier1_candidates_must_be_150 (got N)` throw → 정상 degraded 경로).
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Tier1Candidate } from "@/lib/screening/persona-eval";
import { isCanonicalSector, type CanonicalSector } from "@/lib/screening/canonical-sectors";
import type { SelectionTrack, Timeframe } from "@/lib/screening/tier1-schema";

const MONTH_YM_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const EXPECTED_PER_BUCKET = 50;

// W2a Task 7 — 트랙별 활성 bucket subset. SELECT 필터 + per-track assert 양쪽 기준.
const TRACK_BUCKETS: Record<SelectionTrack, readonly Timeframe[]> = {
  short: ["short"],
  midlong: ["mid", "long"],
};

export interface Tier0CandidateDbRow {
  ticker: string;
  sector: string | null;
  bucket: "short" | "mid" | "long";
  rank?: number | null;
  // PostgREST는 numeric 컬럼을 string으로 반환할 수 있다 (admin-shortlist.ts num() 패턴 동일).
  tier0_score: string | number | null;
}

function numOrNull(v: string | number | null): number | null {
  if (v === null) return null;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * tier0_candidates_150 DB row → Tier1Candidate.
 * disjoint bucket: ticker가 선정된 단일 bucket만 tier0_buckets=true + 해당 tier0_scores 채움.
 * sector: canonical 14만 통과, 그 외(null/unresolved/placeholder)는 null (Tier1Candidate.sector 계약).
 */
export function transformTier0CandidateRow(row: Tier0CandidateDbRow): Tier1Candidate {
  const score = numOrNull(row.tier0_score);
  const sector: CanonicalSector | null =
    row.sector !== null && isCanonicalSector(row.sector) ? row.sector : null;
  return {
    ticker: row.ticker,
    sector,
    tier0_buckets: {
      short: row.bucket === "short",
      mid: row.bucket === "mid",
      long: row.bucket === "long",
    },
    tier0_scores: {
      short: row.bucket === "short" ? score : null,
      mid: row.bucket === "mid" ? score : null,
      long: row.bucket === "long" ? score : null,
    },
  };
}

/**
 * W2a Task 7 — 트랙별 row 계약 검증. 단발 150 monolith 폐기, 트랙 bucket subset에서 유도.
 *   - short: 1 bucket × 50 (rank 1..50)
 *   - midlong: 2 bucket(mid,long) × 50 (각 rank 1..50) = 100
 * Empty/short payload은 기존 degraded 경로 유지 (worker pool-size assert가 `got N` throw).
 * full payload(= track 기대 총 수)일 때만 50/50/rank/sector/cross-track-leak hole을 닫는다.
 */
function assertTier0CandidateRows(rows: Tier0CandidateDbRow[], track: SelectionTrack): void {
  const buckets = TRACK_BUCKETS[track];
  const expectedTotal = buckets.length * EXPECTED_PER_BUCKET;
  if (rows.length !== expectedTotal) return;

  const allowed = new Set<Timeframe>(buckets);
  const bucketCounts = new Map<Timeframe, number>(buckets.map((b) => [b, 0]));
  const ranksByBucket = new Map<Timeframe, Set<number>>(
    buckets.map((b) => [b, new Set<number>()]),
  );
  const tickers = new Set<string>();
  for (const row of rows) {
    if (!allowed.has(row.bucket)) {
      throw new Error(
        `tier0_candidates_bucket_contract_violation:cross_track:${row.ticker}:${row.bucket}`,
      );
    }
    if (row.sector === null || !isCanonicalSector(row.sector)) {
      throw new Error(`tier0_candidates_sector_contract_violation:${row.ticker}`);
    }
    if (
      row.rank == null ||
      !Number.isInteger(row.rank) ||
      row.rank < 1 ||
      row.rank > EXPECTED_PER_BUCKET
    ) {
      throw new Error(`tier0_candidates_rank_contract_violation:${row.ticker}`);
    }
    bucketCounts.set(row.bucket, (bucketCounts.get(row.bucket) ?? 0) + 1);
    ranksByBucket.get(row.bucket)!.add(row.rank);
    tickers.add(row.ticker);
  }

  if (tickers.size !== rows.length) {
    throw new Error(
      `tier0_candidates_duplicate_tickers:${tickers.size}/${rows.length}`,
    );
  }
  const badBuckets = [...bucketCounts.entries()].filter(
    ([, count]) => count !== EXPECTED_PER_BUCKET,
  );
  if (badBuckets.length > 0) {
    throw new Error(
      `tier0_candidates_bucket_contract_violation:${JSON.stringify(Object.fromEntries(bucketCounts))}`,
    );
  }
  for (const [bucket, ranks] of ranksByBucket.entries()) {
    if (
      ranks.size !== EXPECTED_PER_BUCKET ||
      !Array.from({ length: EXPECTED_PER_BUCKET }, (_, i) => i + 1).every((rank) =>
        ranks.has(rank),
      )
    ) {
      throw new Error(`tier0_candidates_rank_contract_violation:${bucket}`);
    }
  }
}

/**
 * 해당 month·track의 Tier 0 fresh 후보를 SELECT → Tier1Candidate[].
 *   - short: bucket in [short] → 50
 *   - midlong: bucket in [mid, long] → 100
 * @param options.track 선정 트랙 (W2a 주간/월간 split).
 * @param options.month YYYY-MM (consumer가 YYYY-MM-01 date로 변환해 조회).
 * @param options.client DI Supabase client (cron=service-role / admin=session). 미지정 시 session.
 */
export async function getTier0Candidates(options: {
  track: SelectionTrack;
  month: string;
  client?: SupabaseClient;
}): Promise<Tier1Candidate[]> {
  if (!MONTH_YM_RE.test(options.month)) {
    throw new Error(`invalid_month_format:${options.month}`);
  }
  const monthDate = `${options.month}-01`;
  const supabase = options.client ?? (await createClient());

  const { data, error } = await supabase
    .from("tier0_candidates_150")
    .select("ticker, sector, bucket, rank, tier0_score")
    .eq("month", monthDate)
    .in("bucket", [...TRACK_BUCKETS[options.track]])
    .order("bucket", { ascending: true })
    .order("rank", { ascending: true });

  if (error) {
    throw new Error(
      `tier0_candidates_query_failed:${error.code ?? error.message ?? "unknown"}`,
    );
  }

  const rows = (data ?? []) as Tier0CandidateDbRow[];
  assertTier0CandidateRows(rows, options.track);
  return rows.map(transformTier0CandidateRow);
}
