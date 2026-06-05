// W3b-2b (T1) — buildSnapshotRowsFromProposal pure helper.
//   proposal.positions → per-position snapshot(weight=proposal weight) + aggregate row(ticker=NULL, weight=1).
//   entry_price 누락/≤0 → throw(전체 거부). omitted active ticker는 row 없음(편입 종목만).
import { describe, it, expect } from "vitest";
import { buildSnapshotRowsFromProposal } from "../proposal-snapshots";

const POSITIONS = [
  { ticker: "005930", weight: 0.5, timeframe: "long" as const },
  { ticker: "000660", weight: 0.3, timeframe: "mid" as const },
];
const priceMap = new Map<string, number>([
  ["005930", 70000],
  ["000660", 180000],
]);

describe("buildSnapshotRowsFromProposal", () => {
  it("positions → per-position row(weight=proposal weight) + aggregate row(ticker=NULL, weight=1)", () => {
    const rows = buildSnapshotRowsFromProposal({
      positions: POSITIONS,
      priceMap,
      month: "2026-06-01",
      acceptDate: "2026-06-05",
    });
    expect(rows).toHaveLength(3); // 2 positions + 1 aggregate
    const samsung = rows.find((r) => r.ticker === "005930")!;
    expect(samsung.weight).toBe(0.5);
    expect(samsung.entryPrice).toBe(70000);
    expect(samsung.currentPrice).toBe(70000);
    expect(samsung.isCash).toBe(false);
    expect(samsung.dailyReturn).toBe(0);
    expect(samsung.month).toBe("2026-06-01");
    expect(samsung.date).toBe("2026-06-05");
    const agg = rows.find((r) => r.ticker === null)!;
    expect(agg.weight).toBe(1);
    expect(agg.isCash).toBe(false);
    expect(agg.entryPrice).toBe(0);
  });

  it("편입 종목만 row — omitted active ticker는 0-row 생성 안 함", () => {
    const rows = buildSnapshotRowsFromProposal({
      positions: [POSITIONS[0]], // 1종목만 편입
      priceMap,
      month: "2026-06-01",
      acceptDate: "2026-06-05",
    });
    expect(rows.filter((r) => r.ticker !== null)).toHaveLength(1);
    expect(rows.some((r) => r.ticker === "000660")).toBe(false); // 미편입 = row 없음
  });

  it("entry_price 누락 → throw entry_price_unavailable (부분 snapshot 금지)", () => {
    const partial = new Map<string, number>([["005930", 70000]]); // 000660 누락
    expect(() =>
      buildSnapshotRowsFromProposal({
        positions: POSITIONS,
        priceMap: partial,
        month: "2026-06-01",
        acceptDate: "2026-06-05",
      }),
    ).toThrow("entry_price_unavailable");
  });

  it("entry_price ≤0 → throw entry_price_unavailable", () => {
    const zero = new Map<string, number>([
      ["005930", 70000],
      ["000660", 0],
    ]);
    expect(() =>
      buildSnapshotRowsFromProposal({
        positions: POSITIONS,
        priceMap: zero,
        month: "2026-06-01",
        acceptDate: "2026-06-05",
      }),
    ).toThrow("entry_price_unavailable");
  });
});
