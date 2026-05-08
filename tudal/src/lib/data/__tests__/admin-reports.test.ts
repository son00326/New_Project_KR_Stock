import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  transformStockReportRow,
  deriveBucketNeighbors,
  getReportByTicker,
  type StockReportDbRow,
} from "@/lib/data/admin-reports";
import type { ShortListItem } from "@/types/admin";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: mocks.from,
  })),
}));

const baseRow: StockReportDbRow = {
  id: "11111111-1111-1111-1111-111111111111",
  ticker: "005930",
  month: "2026-04-01",
  version: 1,
  schema_version: 1,
  is_latest: true,
  section_0: { headline: "테스트 헤드라인", conviction: 80 },
  section_1: { description: "기업 개요" },
  section_2: { summary: "재무" },
  section_3: { summary: "밸류에이션" },
  section_4: { summary: "성장성" },
  section_5: { summary: "리스크" },
  section_6: { summary: "모멘텀", axis: { trend: 80, momentum: 70, volatility: 85 } },
  section_7: { summary: "Exit" },
  section_8: { conclusion: "최종" },
  appendix: { dataSources: ["pykrx"] },
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
  it("maps snake_case DB columns to camelCase StockReport fields", () => {
    const report = transformStockReportRow(baseRow);
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

  it("preserves jsonb section payloads as-is (no shape mutation)", () => {
    const report = transformStockReportRow(baseRow);
    expect(report.section_0).toEqual(baseRow.section_0);
    expect(report.section_6).toEqual(baseRow.section_6);
    expect(report.appendix).toEqual(baseRow.appendix);
  });

  it("preserves null jsonb sections without coercion", () => {
    const sparse: StockReportDbRow = {
      ...baseRow,
      section_2: null,
      section_5: null,
      appendix: null,
    };
    const report = transformStockReportRow(sparse);
    expect(report.section_2).toBeNull();
    expect(report.section_5).toBeNull();
    expect(report.appendix).toBeNull();
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
