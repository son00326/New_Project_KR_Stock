import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  transformTier0CandidateRow,
  getTier0Candidates,
  type Tier0CandidateDbRow,
} from "@/lib/data/admin-tier0-candidates";

// ---------------------------------------------------------------------------
// transformTier0CandidateRow — DB row → Tier1Candidate (disjoint bucket mapping)
// ---------------------------------------------------------------------------
describe("transformTier0CandidateRow", () => {
  it("maps short bucket row → tier0_buckets.short + single non-null tier0_scores.short", () => {
    const row: Tier0CandidateDbRow = {
      ticker: "005930",
      sector: "반도체",
      bucket: "short",
      tier0_score: "88.5",
    };
    const c = transformTier0CandidateRow(row);
    expect(c.ticker).toBe("005930");
    expect(c.sector).toBe("반도체");
    expect(c.tier0_buckets).toEqual({ short: true, mid: false, long: false });
    expect(c.tier0_scores).toEqual({ short: 88.5, mid: null, long: null });
  });

  it("maps mid bucket row → tier0_scores.mid only", () => {
    const c = transformTier0CandidateRow({
      ticker: "000660",
      sector: "반도체",
      bucket: "mid",
      tier0_score: 70,
    });
    expect(c.tier0_buckets).toEqual({ short: false, mid: true, long: false });
    expect(c.tier0_scores).toEqual({ short: null, mid: 70, long: null });
  });

  it("maps long bucket row → tier0_scores.long only", () => {
    const c = transformTier0CandidateRow({
      ticker: "035420",
      sector: "IT/SW",
      bucket: "long",
      tier0_score: 55,
    });
    expect(c.tier0_buckets).toEqual({ short: false, mid: false, long: true });
    expect(c.tier0_scores).toEqual({ short: null, mid: null, long: 55 });
  });

  it("maps non-canonical or null sector → null (Tier1Candidate.sector contract)", () => {
    expect(
      transformTier0CandidateRow({ ticker: "005930", sector: null, bucket: "short", tier0_score: 1 }).sector,
    ).toBeNull();
    expect(
      transformTier0CandidateRow({ ticker: "005930", sector: "unresolved", bucket: "short", tier0_score: 1 }).sector,
    ).toBeNull();
    expect(
      transformTier0CandidateRow({ ticker: "005930", sector: "코스피", bucket: "short", tier0_score: 1 }).sector,
    ).toBeNull();
  });

  it("coerces null tier0_score → null (defensive; DB column is NOT NULL but map stays total)", () => {
    const c = transformTier0CandidateRow({ ticker: "005930", sector: "반도체", bucket: "short", tier0_score: null });
    expect(c.tier0_scores.short).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getTier0Candidates — track-scoped SELECT + DI client
// W2a Task 7: track param (short=50/midlong=100), bucket-scoped SELECT,
//   per-track assert. 150-row monolith assert는 폐기.
// ---------------------------------------------------------------------------
interface QueryResult {
  data: Tier0CandidateDbRow[] | null;
  error: { code?: string; message?: string } | null;
}

// chain: from → select → eq(month) → in(bucket) → order(bucket) → order(rank)
function buildClient(result: QueryResult) {
  const order2 = vi.fn().mockResolvedValue(result); // 2nd order (rank) resolves the awaited query
  const order1 = vi.fn().mockReturnValue({ order: order2 });
  const inFn = vi.fn().mockReturnValue({ order: order1 });
  const eq = vi.fn().mockReturnValue({ in: inFn });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return {
    client: { from } as unknown as SupabaseClient,
    spies: { from, select, eq, in: inFn, order1, order2 },
  };
}

// helper: build N rows in one bucket with sequential ranks 1..N.
function bucketRows(
  bucket: "short" | "mid" | "long",
  count: number,
  baseIdx: number,
): Tier0CandidateDbRow[] {
  return Array.from({ length: count }, (_, i) => ({
    ticker: `${baseIdx + i}`.padStart(6, "0"),
    sector: "반도체",
    bucket,
    rank: i + 1,
    tier0_score: 100 - i,
  }));
}

describe("getTier0Candidates", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects malformed month before any query", async () => {
    const { client, spies } = buildClient({ data: [], error: null });
    await expect(
      getTier0Candidates({ track: "short", month: "2026-6", client }),
    ).rejects.toThrow(/invalid_month_format/);
    await expect(
      getTier0Candidates({ track: "short", month: "2026-13", client }),
    ).rejects.toThrow(/invalid_month_format/);
    expect(spies.from).not.toHaveBeenCalled();
  });

  it("short track: queries bucket in [short] by YYYY-MM-01 and maps 50 rows", async () => {
    const rows = bucketRows("short", 50, 0);
    const { client, spies } = buildClient({ data: rows, error: null });

    const out = await getTier0Candidates({ track: "short", month: "2026-06", client });

    expect(spies.from).toHaveBeenCalledWith("tier0_candidates_150");
    expect(spies.select).toHaveBeenCalledWith("ticker, sector, bucket, rank, tier0_score");
    expect(spies.eq).toHaveBeenCalledWith("month", "2026-06-01");
    expect(spies.in).toHaveBeenCalledWith("bucket", ["short"]);
    expect(spies.order1).toHaveBeenCalledWith("bucket", { ascending: true });
    expect(spies.order2).toHaveBeenCalledWith("rank", { ascending: true });
    expect(out).toHaveLength(50);
    expect(out[0].tier0_scores.short).toBe(100);
  });

  it("midlong track: queries bucket in [mid, long] and maps 100 rows (50 mid + 50 long)", async () => {
    const rows = [...bucketRows("mid", 50, 0), ...bucketRows("long", 50, 100)];
    const { client, spies } = buildClient({ data: rows, error: null });

    const out = await getTier0Candidates({ track: "midlong", month: "2026-06", client });

    expect(spies.in).toHaveBeenCalledWith("bucket", ["mid", "long"]);
    expect(out).toHaveLength(100);
    expect(out[0].tier0_scores.mid).toBe(100);
    expect(out[50].tier0_scores.long).toBe(100);
  });

  it("returns [] when no rows for the track (degraded path handled by worker pool-size assert)", async () => {
    const { client } = buildClient({ data: null, error: null });
    const out = await getTier0Candidates({ track: "short", month: "2026-06", client });
    expect(out).toEqual([]);
  });

  it("short track: under-sized payload (49 short rows) returns degraded — worker pool-size assert handles `got N`", async () => {
    const rows = bucketRows("short", 49, 0); // one short of 50: not full → degraded passthrough
    const { client } = buildClient({ data: rows, error: null });
    const out = await getTier0Candidates({ track: "short", month: "2026-06", client });
    expect(out).toHaveLength(49);
  });

  it("midlong track: rejects a full(100) payload that is not exactly 50 per bucket (mid 51 / long 49)", async () => {
    const rows = [...bucketRows("mid", 51, 0), ...bucketRows("long", 49, 100)];
    const { client } = buildClient({ data: rows, error: null });
    await expect(
      getTier0Candidates({ track: "midlong", month: "2026-06", client }),
    ).rejects.toThrow(/tier0_candidates_(bucket|rank)_contract_violation/);
  });

  it("short track: rejects a row with the wrong bucket (cross-track leak)", async () => {
    const rows = bucketRows("short", 50, 0);
    rows[10] = { ...rows[10], bucket: "mid" }; // mid leaked into a short-track payload
    const { client } = buildClient({ data: rows, error: null });
    await expect(
      getTier0Candidates({ track: "short", month: "2026-06", client }),
    ).rejects.toThrow(/tier0_candidates_bucket_contract_violation/);
  });

  it("short track: rejects duplicate/missing bucket ranks", async () => {
    const rows = bucketRows("short", 50, 0);
    rows[49] = { ...rows[49], rank: 49 }; // duplicate of rank 49, missing 50
    const { client } = buildClient({ data: rows, error: null });
    await expect(
      getTier0Candidates({ track: "short", month: "2026-06", client }),
    ).rejects.toThrow(/tier0_candidates_rank_contract_violation/);
  });

  it("midlong track: rejects duplicate/missing bucket ranks within a bucket", async () => {
    const mid = bucketRows("mid", 50, 0);
    mid[49] = { ...mid[49], rank: 49 };
    const rows = [...mid, ...bucketRows("long", 50, 100)];
    const { client } = buildClient({ data: rows, error: null });
    await expect(
      getTier0Candidates({ track: "midlong", month: "2026-06", client }),
    ).rejects.toThrow(/tier0_candidates_rank_contract_violation/);
  });

  it("short track: rejects non-canonical sector", async () => {
    const rows = bucketRows("short", 50, 0);
    rows[0] = { ...rows[0], sector: "코스피" };
    const { client } = buildClient({ data: rows, error: null });
    await expect(
      getTier0Candidates({ track: "short", month: "2026-06", client }),
    ).rejects.toThrow(/tier0_candidates_sector_contract_violation/);
  });

  it("throws wrapped error when supabase select errors", async () => {
    const { client } = buildClient({
      data: null,
      error: { code: "PGRST116", message: "rls denied" },
    });
    await expect(
      getTier0Candidates({ track: "short", month: "2026-06", client }),
    ).rejects.toThrow(/tier0_candidates_query_failed/);
  });
});
