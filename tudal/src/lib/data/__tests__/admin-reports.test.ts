import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  transformStockReportRow,
  deriveBucketNeighbors,
  getReportByTicker,
  reportExistsAndCompleteForMonth,
  type StockReportDbRow,
  type ValidatedStockReport,
} from "@/lib/data/admin-reports";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShortListItem } from "@/types/admin";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
}));

interface CompleteSelectChain {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
}

function buildCompletenessClient(result: {
  data: unknown | null;
  error: { message: string; code?: string } | null;
}): {
  client: SupabaseClient;
  from: ReturnType<typeof vi.fn>;
  chain: CompleteSelectChain;
} {
  const chain: CompleteSelectChain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => result),
  };
  const rawClient = {
    from: vi.fn(() => chain),
  };
  return {
    client: rawClient as unknown as SupabaseClient,
    from: rawClient.from,
    chain,
  };
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: mocks.from,
  })),
}));

// PR3a — 유효한 full-shape section fixture. validation 도입 후 partial shape는
// null로 떨어지므로 의도적으로 valid full shape 사용.
const validSection0 = {
  headline: "테스트 헤드라인",
  thesis: ["논제 1", "논제 2"],
  conviction: 80,
  committeeMini: {
    core: { approve: 7, reject: 2, abstain: 2 },
    sector: { approve: 8, reject: 4, abstain: 2 },
  },
  priceBands: { bear: "5만원", base: "7만원", bull: "9만원" },
};

const baseRow: StockReportDbRow = {
  id: "11111111-1111-1111-1111-111111111111",
  ticker: "005930",
  month: "2026-04-01",
  version: 1,
  schema_version: 1,
  is_latest: true,
  section_0: validSection0,
  section_1: null,
  section_2: null,
  section_3: null,
  section_4: null,
  section_5: null,
  section_6: null,
  section_7: null,
  section_8: null,
  appendix: null,
  regen_auto_count: 0,
  regen_manual_count: 0,
  generated_at: "2026-04-01T00:05:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  const query = {
    select: mocks.select,
    eq: mocks.eq,
    maybeSingle: mocks.maybeSingle,
  };
  mocks.from.mockReturnValue(query);
  mocks.select.mockReturnValue(query);
  mocks.eq.mockReturnValue(query);
  mocks.maybeSingle.mockResolvedValue({ data: baseRow, error: null });
});

describe("transformStockReportRow", () => {
  it("maps snake_case DB columns to camelCase ValidatedStockReport fields", () => {
    const report: ValidatedStockReport = transformStockReportRow(baseRow);
    expect(report.id).toBe(baseRow.id);
    expect(report.ticker).toBe("005930");
    expect(report.month).toBe("2026-04-01");
    expect(report.version).toBe(1);
    expect(report.schemaVersion).toBe(1);
    expect(report.isLatest).toBe(true);
    expect(report.regenAutoCount).toBe(0);
    expect(report.regenManualCount).toBe(0);
    expect(report.generatedAt).toBe("2026-04-01T00:05:00.000Z");
  });

  it("validates and returns typed section_0 when full-shape jsonb", () => {
    const report = transformStockReportRow(baseRow);
    expect(report.section_0).not.toBeNull();
    expect(report.section_0?.conviction).toBe(80);
    expect(report.section_0?.headline).toBe("테스트 헤드라인");
  });

  it("returns null for partial/invalid section_0 (missing thesis/committeeMini)", () => {
    const row: StockReportDbRow = {
      ...baseRow,
      section_0: { headline: "h", conviction: 80 },
    };
    expect(transformStockReportRow(row).section_0).toBeNull();
  });

  it("returns null for every section when DB row is fully null (PR3b 미구현 상태)", () => {
    const sparse: StockReportDbRow = {
      ...baseRow,
      section_0: null,
    };
    const report = transformStockReportRow(sparse);
    expect(report.section_0).toBeNull();
    expect(report.section_1).toBeNull();
    expect(report.section_2).toBeNull();
    expect(report.section_3).toBeNull();
    expect(report.section_4).toBeNull();
    expect(report.section_5).toBeNull();
    expect(report.section_6).toBeNull();
    expect(report.section_7).toBeNull();
    expect(report.section_8).toBeNull();
    expect(report.appendix).toBeNull();
  });

  it("detects modern section_8 shape (writer.ts 신규 출력)", () => {
    const row: StockReportDbRow = {
      ...baseRow,
      section_8: {
        partA: [],
        partB: [
          { issue: "i1", pro_quote: "p", con_quote: "c" },
          { issue: "i2", pro_quote: "p", con_quote: "c" },
          { issue: "i3", pro_quote: "p", con_quote: "c" },
        ],
        partC: {
          sector_aggregate: { buy: 0, hold: 0, sell: 0 },
          core_revote: { buy: 7, hold: 3, sell: 1 },
          co_chair_unanimous: false,
          verdict: "BUY",
          rationale: ["근거"],
        },
        partD: Array.from({ length: 11 }, (_, i) => ({
          persona_id: `c${i}`,
          label: `l${i}`,
          philosophy: "v",
          vote: "BUY",
          one_line: "o",
        })),
      },
    };
    expect(transformStockReportRow(row).section_8?.shape).toBe("modern");
  });

  it("detects legacy section_8 shape (전환기 잔존 row)", () => {
    const row: StockReportDbRow = {
      ...baseRow,
      section_8: {
        conclusion: "c",
        recommendation: "r",
        keyQuotes: [{ side: "pro", quote: "q" }],
      },
    };
    expect(transformStockReportRow(row).section_8?.shape).toBe("legacy");
  });

  it("returns null section_8 when neither shape matches", () => {
    const row: StockReportDbRow = {
      ...baseRow,
      section_8: { foo: "bar" },
    };
    expect(transformStockReportRow(row).section_8).toBeNull();
  });
});

describe("getReportByTicker", () => {
  it("filters by active shortlist month when month option is provided", async () => {
    await getReportByTicker("005930", { month: "2026-04-01" });

    expect(mocks.from).toHaveBeenCalledWith("stock_reports");
    expect(mocks.eq).toHaveBeenCalledWith("ticker", "005930");
    expect(mocks.eq).toHaveBeenCalledWith("is_latest", true);
    expect(mocks.eq).toHaveBeenCalledWith("month", "2026-04-01");
    expect(mocks.maybeSingle).toHaveBeenCalledTimes(1);
  });

  it("throws wrapped Error with table prefix on supabase error (G-wrapper-error)", async () => {
    mocks.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { code: "PGRST116", message: "rls denied" },
    });

    await expect(
      getReportByTicker("005930", { month: "2026-04-01" }),
    ).rejects.toThrow(/stock_reports/);
  });
});

describe("reportExistsAndCompleteForMonth", () => {
  it("section_0 set + section_7 null → exists true, complete false", async () => {
    const { client } = buildCompletenessClient({
      data: { id: "r1", section_0: { headline: "h" }, section_7: null },
      error: null,
    });
    await expect(
      reportExistsAndCompleteForMonth("005930", "2026-06-01", { client }),
    ).resolves.toEqual({ exists: true, complete: false });
  });

  it("section_0 null + section_7 set → exists true, complete false", async () => {
    const { client } = buildCompletenessClient({
      data: { id: "r1", section_0: null, section_7: { conclusion: "c" } },
      error: null,
    });
    await expect(
      reportExistsAndCompleteForMonth("005930", "2026-06-01", { client }),
    ).resolves.toEqual({ exists: true, complete: false });
  });

  it("section_0 and section_7 both set → exists true, complete true", async () => {
    const { client } = buildCompletenessClient({
      data: {
        id: "r1",
        section_0: { headline: "h" },
        section_7: { conclusion: "c" },
      },
      error: null,
    });
    await expect(
      reportExistsAndCompleteForMonth("005930", "2026-06-01", { client }),
    ).resolves.toEqual({ exists: true, complete: true });
  });

  it("no row → exists false, complete false", async () => {
    const { client } = buildCompletenessClient({
      data: null,
      error: null,
    });
    await expect(
      reportExistsAndCompleteForMonth("005930", "2026-06-01", { client }),
    ).resolves.toEqual({ exists: false, complete: false });
  });

  it("filters latest row with .eq('is_latest', true)", async () => {
    const { client, chain } = buildCompletenessClient({
      data: null,
      error: null,
    });
    await reportExistsAndCompleteForMonth("005930", "2026-06-01", { client });
    expect(chain.eq).toHaveBeenCalledWith("ticker", "005930");
    expect(chain.eq).toHaveBeenCalledWith("month", "2026-06-01");
    expect(chain.eq).toHaveBeenCalledWith("is_latest", true);
  });
});

describe("deriveBucketNeighbors", () => {
  function makeItem(
    ticker: string,
    bucket: ShortListItem["bucket"],
    rank: number,
    deltaStatus: ShortListItem["deltaStatus"] = "hold",
  ): ShortListItem {
    return {
      id: `id-${ticker}`,
      month: "2026-04-01",
      ticker,
      name: `이름-${ticker}`,
      sector: "테스트",
      bucket,
      rank,
      compositeScore: 80,
      trendScore: 80,
      momentumScore: 70,
      volatilityScore: 85,
      divergencePct: 0,
      sparkline7d: [100, 100, 100, 100, 100, 100, 100],
      signalLabel: "테스트",
      deltaStatus,
      deltaReason: "",
      summary3Line: "",
      suggestedWeight: 0.05,
      createdAt: "2026-04-01T00:00:00.000Z",
    };
  }

  it("finds prev and next within the same bucket sorted by rank", () => {
    const items = [
      makeItem("A", "long", 1),
      makeItem("B", "long", 2),
      makeItem("C", "long", 3),
      makeItem("D", "short", 1),
    ];
    const neighbors = deriveBucketNeighbors("B", items);
    expect(neighbors.prev?.ticker).toBe("A");
    expect(neighbors.prev?.name).toBe("이름-A");
    expect(neighbors.next?.ticker).toBe("C");
    expect(neighbors.next?.name).toBe("이름-C");
  });

  it("returns no prev for the first ranked item", () => {
    const items = [makeItem("A", "long", 1), makeItem("B", "long", 2)];
    const neighbors = deriveBucketNeighbors("A", items);
    expect(neighbors.prev).toBeUndefined();
    expect(neighbors.next?.ticker).toBe("B");
  });

  it("returns no next for the last ranked item", () => {
    const items = [makeItem("A", "long", 1), makeItem("B", "long", 2)];
    const neighbors = deriveBucketNeighbors("B", items);
    expect(neighbors.prev?.ticker).toBe("A");
    expect(neighbors.next).toBeUndefined();
  });

  it("excludes removed items from neighbor candidates", () => {
    const items = [
      makeItem("A", "long", 1, "hold"),
      makeItem("B", "long", 2, "removed"),
      makeItem("C", "long", 3, "hold"),
    ];
    const neighbors = deriveBucketNeighbors("A", items);
    expect(neighbors.next?.ticker).toBe("C");
  });

  it("returns empty object when ticker is not in items", () => {
    const items = [makeItem("A", "long", 1)];
    const neighbors = deriveBucketNeighbors("ZZZ", items);
    expect(neighbors).toEqual({});
  });

  it("does not cross bucket boundaries", () => {
    const items = [
      makeItem("A", "short", 1),
      makeItem("B", "mid", 1),
      makeItem("C", "mid", 2),
      makeItem("D", "long", 1),
    ];
    const neighbors = deriveBucketNeighbors("C", items);
    expect(neighbors.prev?.ticker).toBe("B");
    expect(neighbors.next).toBeUndefined();
  });
});
