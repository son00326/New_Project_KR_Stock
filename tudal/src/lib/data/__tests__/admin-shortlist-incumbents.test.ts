// W2b (D27 Q5) — getIncumbents + buildIncumbentThesisContexts 유닛테스트.
// mock chain 타이핑: feedback_test_mock_typing (any 금지, admin-tier0-candidates.test.ts 패턴).
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getIncumbents } from "@/lib/data/admin-shortlist-incumbents";

interface IncumbentQueryRow {
  ticker: string;
  bucket: "short" | "mid" | "long";
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

interface QueryResult {
  data: IncumbentQueryRow[] | null;
  error: { code?: string; message?: string } | null;
}

// chain: from → select → in(bucket) → lte(month) → order(month) → order(bucket) → order(rank)
function buildClient(result: QueryResult) {
  const order3 = vi.fn().mockResolvedValue(result);
  const order2 = vi.fn().mockReturnValue({ order: order3 });
  const order1 = vi.fn().mockReturnValue({ order: order2 });
  const lte = vi.fn().mockReturnValue({ order: order1 });
  const inFn = vi.fn().mockReturnValue({ lte });
  const select = vi.fn().mockReturnValue({ in: inFn });
  const from = vi.fn().mockReturnValue({ select });
  return {
    client: { from } as unknown as SupabaseClient,
    spies: { from, select, in: inFn, lte, order1, order2, order3 },
  };
}

function row(
  ticker: string,
  bucket: "short" | "mid" | "long",
  month: string,
  rank = 1,
): IncumbentQueryRow {
  return {
    ticker,
    bucket,
    rank,
    month,
    sector: "반도체",
    name: `종목${ticker}`,
    composite_score: "72.5",
    signal_label: "기존 신호",
    ai_comment_kr: "직전 논거",
    consensus_badge: "🟢",
    ai_score: "78.2",
    conviction: 71,
    delta_status: "new",
  };
}

describe("getIncumbents", () => {
  beforeEach(() => vi.clearAllMocks());

  it("invalid month → throw invalid_month_format (쿼리 0회)", async () => {
    const { client, spies } = buildClient({ data: [], error: null });
    await expect(
      getIncumbents({ track: "short", month: "2026-13", client }),
    ).rejects.toThrow(/invalid_month_format/);
    expect(spies.from).not.toHaveBeenCalled();
  });

  it("midlong: month<=기준 최신 month 그룹의 mid/long rows만 반환 (이전 달 잔재 제외)", async () => {
    const latest = [
      ...Array.from({ length: 10 }, (_, i) =>
        row(`10${String(i).padStart(4, "0")}`, "mid", "2026-06-01", i + 1),
      ),
      ...Array.from({ length: 10 }, (_, i) =>
        row(`20${String(i).padStart(4, "0")}`, "long", "2026-06-01", i + 1),
      ),
    ];
    const older = [row("999999", "mid", "2026-05-01")];
    const { client, spies } = buildClient({ data: [...latest, ...older], error: null });
    const result = await getIncumbents({ track: "midlong", month: "2026-07", client });
    expect(result).toHaveLength(20);
    expect(result.every((r) => r.month === "2026-06-01")).toBe(true);
    expect(spies.in).toHaveBeenCalledWith("bucket", ["mid", "long"]);
    expect(spies.lte).toHaveBeenCalledWith("month", "2026-07-01");
  });

  it("short: 최신 그룹 10 반환 + IncumbentInfo 필드 매핑(aiCommentKr/배지/aiScore/conviction/name/compositeScore/signalLabel)", async () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      row(`00${String(i).padStart(4, "0")}`, "short", "2026-06-01", i + 1),
    );
    const { client } = buildClient({ data: rows, error: null });
    const result = await getIncumbents({ track: "short", month: "2026-06", client });
    expect(result).toHaveLength(10);
    expect(result[0]).toMatchObject({
      ticker: "000000",
      bucket: "short",
      rank: 1,
      month: "2026-06-01",
      sector: "반도체",
      name: "종목000000",
      aiCommentKr: "직전 논거",
      consensusBadge: "🟢",
      aiScore: 78.2,
      conviction: 71,
      deltaStatus: "new",
      compositeScore: 72.5,
      signalLabel: "기존 신호",
    });
  });

  it("cold start: rows 0 → [] (throw 아님)", async () => {
    const { client } = buildClient({ data: [], error: null });
    expect(await getIncumbents({ track: "short", month: "2026-06", client })).toEqual([]);
  });

  it("short: 월초 carry 졸업 제외로 최신 그룹 9행이어도 정당 → 9행 반환", async () => {
    const rows = Array.from({ length: 9 }, (_, i) =>
      row(`00${String(i).padStart(4, "0")}`, "short", "2026-07-01", i + 1),
    );
    const { client } = buildClient({ data: rows, error: null });
    const result = await getIncumbents({ track: "short", month: "2026-07", client });
    expect(result).toHaveLength(9);
  });

  it("최신 그룹이 TRACK_SELECT_COUNT를 초과하면(11) → throw incumbents_count_exceeded", async () => {
    const rows = Array.from({ length: 11 }, (_, i) =>
      row(`00${String(i).padStart(4, "0")}`, "short", "2026-06-01", i + 1),
    );
    const { client } = buildClient({ data: rows, error: null });
    await expect(
      getIncumbents({ track: "short", month: "2026-06", client }),
    ).rejects.toThrow("incumbents_count_exceeded:short:11>10");
  });

  it("query error → throw incumbents_query_failed", async () => {
    const { client } = buildClient({ data: null, error: { code: "PGRST000" } });
    await expect(
      getIncumbents({ track: "short", month: "2026-06", client }),
    ).rejects.toThrow("incumbents_query_failed:PGRST000");
  });
});
