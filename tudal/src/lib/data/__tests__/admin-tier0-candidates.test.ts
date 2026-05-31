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
// getTier0Candidates — SELECT + DI client
// ---------------------------------------------------------------------------
interface QueryResult {
  data: Tier0CandidateDbRow[] | null;
  error: { code?: string; message?: string } | null;
}

function buildClient(result: QueryResult) {
  const order2 = vi.fn().mockResolvedValue(result); // 2nd order (rank) resolves the awaited query
  const order1 = vi.fn().mockReturnValue({ order: order2 });
  const eq = vi.fn().mockReturnValue({ order: order1 });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return {
    client: { from } as unknown as SupabaseClient,
    spies: { from, select, eq, order1, order2 },
  };
}

describe("getTier0Candidates", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects malformed month before any query", async () => {
    const { client, spies } = buildClient({ data: [], error: null });
    await expect(getTier0Candidates({ month: "2026-6", client })).rejects.toThrow(
      /invalid_month_format/,
    );
    await expect(getTier0Candidates({ month: "2026-13", client })).rejects.toThrow(
      /invalid_month_format/,
    );
    expect(spies.from).not.toHaveBeenCalled();
  });

  it("queries tier0_candidates_150 by YYYY-MM-01 and maps rows to Tier1Candidate[]", async () => {
    const rows: Tier0CandidateDbRow[] = [
      { ticker: "005930", sector: "반도체", bucket: "short", tier0_score: "90" },
      { ticker: "000660", sector: "반도체", bucket: "mid", tier0_score: "80" },
      { ticker: "035420", sector: "IT/SW", bucket: "long", tier0_score: "70" },
    ];
    const { client, spies } = buildClient({ data: rows, error: null });

    const out = await getTier0Candidates({ month: "2026-06", client });

    expect(spies.from).toHaveBeenCalledWith("tier0_candidates_150");
    expect(spies.eq).toHaveBeenCalledWith("month", "2026-06-01");
    expect(spies.order1).toHaveBeenCalledWith("bucket", { ascending: true });
    expect(spies.order2).toHaveBeenCalledWith("rank", { ascending: true });
    expect(out).toHaveLength(3);
    expect(out[0].tier0_scores.short).toBe(90);
    expect(out[1].tier0_scores.mid).toBe(80);
    expect(out[2].tier0_scores.long).toBe(70);
  });

  it("returns [] when no rows for the month (degraded path handled by orchestrator 150-assert)", async () => {
    const { client } = buildClient({ data: null, error: null });
    const out = await getTier0Candidates({ month: "2026-06", client });
    expect(out).toEqual([]);
  });

  it("throws wrapped error when supabase select errors", async () => {
    const { client } = buildClient({
      data: null,
      error: { code: "PGRST116", message: "rls denied" },
    });
    await expect(getTier0Candidates({ month: "2026-06", client })).rejects.toThrow(
      /tier0_candidates_query_failed/,
    );
  });
});
