import { describe, expect, it } from "vitest";
import {
  transformShortListRow,
  aggregateShortListDelta,
  type ShortListDbRow,
} from "@/lib/data/admin-shortlist";

const baseRow: ShortListDbRow = {
  id: "11111111-1111-1111-1111-111111111111",
  month: "2026-04-01",
  ticker: "005930",
  bucket: "long",
  rank: 2,
  composite_score: "88",
  trend_score: "85",
  momentum_score: "78",
  volatility_score: "92",
  signal_label: "장기 보유",
  delta_status: "hold",
  delta_reason: "유지",
  summary_3line: "1\n2\n3",
  suggested_weight: "0.05",
  created_at: "2026-04-01T00:00:00.000Z",
};

describe("transformShortListRow", () => {
  it("maps snake_case DB columns to camelCase ShortListItem", () => {
    const item = transformShortListRow(baseRow);
    expect(item.id).toBe(baseRow.id);
    expect(item.month).toBe("2026-04-01");
    expect(item.ticker).toBe("005930");
    expect(item.bucket).toBe("long");
    expect(item.rank).toBe(2);
    expect(item.compositeScore).toBe(88);
    expect(item.trendScore).toBe(85);
    expect(item.momentumScore).toBe(78);
    expect(item.volatilityScore).toBe(92);
    expect(item.signalLabel).toBe("장기 보유");
    expect(item.deltaStatus).toBe("hold");
    expect(item.deltaReason).toBe("유지");
    expect(item.summary3Line).toBe("1\n2\n3");
    expect(item.suggestedWeight).toBe(0.05);
    expect(item.createdAt).toBe("2026-04-01T00:00:00.000Z");
  });

  it("derives divergencePct and sparkline7d from scores", () => {
    const item = transformShortListRow(baseRow);
    expect(typeof item.divergencePct).toBe("number");
    expect(item.sparkline7d).toHaveLength(7);
    item.sparkline7d.forEach((v) => expect(typeof v).toBe("number"));
  });

  it("falls back to placeholder name and sector when no meta provided", () => {
    const item = transformShortListRow(baseRow);
    expect(item.name).toBe("005930"); // ticker as placeholder
    expect(item.sector).toBe("미분류");
  });

  it("uses provided tickerMeta lookup when available", () => {
    const meta = { "005930": { name: "삼성전자", sector: "반도체" } };
    const item = transformShortListRow(baseRow, meta);
    expect(item.name).toBe("삼성전자");
    expect(item.sector).toBe("반도체");
  });

  it("handles null scores and labels gracefully", () => {
    const sparseRow: ShortListDbRow = {
      ...baseRow,
      composite_score: null,
      trend_score: null,
      momentum_score: null,
      volatility_score: null,
      signal_label: null,
      delta_reason: null,
      summary_3line: null,
      suggested_weight: null,
    };
    const item = transformShortListRow(sparseRow);
    expect(item.compositeScore).toBe(0);
    expect(item.trendScore).toBe(0);
    expect(item.momentumScore).toBe(0);
    expect(item.volatilityScore).toBe(0);
    expect(item.signalLabel).toBe("");
    expect(item.deltaReason).toBe("");
    expect(item.summary3Line).toBe("");
    expect(item.suggestedWeight).toBe(0);
  });

  it("accepts numeric inputs as well as string-typed numerics from supabase", () => {
    const numericRow: ShortListDbRow = {
      ...baseRow,
      composite_score: 70 as unknown as string,
      suggested_weight: 0.04 as unknown as string,
    };
    const item = transformShortListRow(numericRow);
    expect(item.compositeScore).toBe(70);
    expect(item.suggestedWeight).toBe(0.04);
  });
});

describe("aggregateShortListDelta", () => {
  it("counts new/hold/removed statuses and reports the month from the first row", () => {
    const rows = [
      transformShortListRow({ ...baseRow, ticker: "A", delta_status: "new" }),
      transformShortListRow({ ...baseRow, ticker: "B", delta_status: "new" }),
      transformShortListRow({ ...baseRow, ticker: "C", delta_status: "hold" }),
      transformShortListRow({ ...baseRow, ticker: "D", delta_status: "removed" }),
    ];
    const delta = aggregateShortListDelta(rows);
    expect(delta.month).toBe("2026-04-01");
    expect(delta.newCount).toBe(2);
    expect(delta.holdCount).toBe(1);
    expect(delta.removedCount).toBe(1);
  });

  it("returns zero counts and empty month when input is empty", () => {
    const delta = aggregateShortListDelta([]);
    expect(delta.month).toBe("");
    expect(delta.newCount).toBe(0);
    expect(delta.holdCount).toBe(0);
    expect(delta.removedCount).toBe(0);
  });
});
