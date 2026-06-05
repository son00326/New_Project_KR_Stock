// W3b-2b (T1) — buildSnapshotRowsFromProposal pure helper.
//   proposal.positions → per-position snapshot(weight=proposal weight) + aggregate row(ticker=NULL, weight=1).
//   entry_price 누락/≤0 → throw(전체 거부). omitted active ticker는 row 없음(편입 종목만).
// W3b-2c (R33) — emitCashRow flag + cashWeight>0 → 명시 cash 행(ticker=NULL, is_cash=true, weight=cashWeight).
//   off(기본) → cash 행 생략(implicit, behavior-neutral). aggregate(is_cash=false)와 별개 행으로 공존.
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

// 공통 base — W3b-2c 인자(cashWeight/emitCashRow) 기본 off(behavior-neutral, 기존 W3b-2b 동작).
function base(overrides?: Partial<Parameters<typeof buildSnapshotRowsFromProposal>[0]>) {
  return {
    positions: POSITIONS,
    cashWeight: 0.2,
    emitCashRow: false,
    priceMap,
    month: "2026-06-01",
    acceptDate: "2026-06-05",
    ...overrides,
  };
}

describe("buildSnapshotRowsFromProposal", () => {
  it("positions → per-position row(weight=proposal weight) + aggregate row(ticker=NULL, weight=1)", () => {
    const rows = buildSnapshotRowsFromProposal(base());
    expect(rows).toHaveLength(3); // 2 positions + 1 aggregate (cash off)
    const samsung = rows.find((r) => r.ticker === "005930")!;
    expect(samsung.weight).toBe(0.5);
    expect(samsung.entryPrice).toBe(70000);
    expect(samsung.currentPrice).toBe(70000);
    expect(samsung.isCash).toBe(false);
    expect(samsung.dailyReturn).toBe(0);
    expect(samsung.month).toBe("2026-06-01");
    expect(samsung.date).toBe("2026-06-05");
    const agg = rows.find((r) => r.ticker === null && !r.isCash)!;
    expect(agg.weight).toBe(1);
    expect(agg.isCash).toBe(false);
    expect(agg.entryPrice).toBe(0);
  });

  it("편입 종목만 row — omitted active ticker는 0-row 생성 안 함", () => {
    const rows = buildSnapshotRowsFromProposal(base({ positions: [POSITIONS[0]] }));
    expect(rows.filter((r) => r.ticker !== null)).toHaveLength(1);
    expect(rows.some((r) => r.ticker === "000660")).toBe(false); // 미편입 = row 없음
  });

  it("entry_price 누락 → throw entry_price_unavailable (부분 snapshot 금지)", () => {
    const partial = new Map<string, number>([["005930", 70000]]); // 000660 누락
    expect(() => buildSnapshotRowsFromProposal(base({ priceMap: partial }))).toThrow(
      "entry_price_unavailable",
    );
  });

  it("entry_price ≤0 → throw entry_price_unavailable", () => {
    const zero = new Map<string, number>([
      ["005930", 70000],
      ["000660", 0],
    ]);
    expect(() => buildSnapshotRowsFromProposal(base({ priceMap: zero }))).toThrow(
      "entry_price_unavailable",
    );
  });

  // ── W3b-2c — 명시 cash 행 ──────────────────────────────────────────────
  describe("W3b-2c 명시 cash 행 (emitCashRow)", () => {
    it("emitCashRow=true + cashWeight>0 → cash 행(ticker=NULL, is_cash=true, weight=cashWeight) 추가 + aggregate 유지", () => {
      const rows = buildSnapshotRowsFromProposal(base({ emitCashRow: true, cashWeight: 0.2 }));
      expect(rows).toHaveLength(4); // 2 positions + aggregate + cash
      const nullRows = rows.filter((r) => r.ticker === null);
      expect(nullRows).toHaveLength(2); // aggregate + cash 공존(둘 다 ticker=NULL, is_cash로 구분)
      const cash = rows.find((r) => r.ticker === null && r.isCash)!;
      expect(cash.weight).toBe(0.2);
      expect(cash.isCash).toBe(true);
      expect(cash.entryPrice).toBe(0);
      expect(cash.currentPrice).toBe(0);
      const agg = rows.find((r) => r.ticker === null && !r.isCash)!;
      expect(agg.weight).toBe(1); // aggregate는 불변(포트 전체)
      expect(agg.isCash).toBe(false);
    });

    it("emitCashRow=false(기본) → cashWeight>0이어도 cash 행 없음(implicit, behavior-neutral)", () => {
      const rows = buildSnapshotRowsFromProposal(base({ emitCashRow: false, cashWeight: 0.25 }));
      expect(rows).toHaveLength(3);
      expect(rows.some((r) => r.isCash)).toBe(false);
    });

    it("emitCashRow=true + cashWeight=0 → cash 행 없음(weight 0 noise 방지)", () => {
      const rows = buildSnapshotRowsFromProposal(base({ emitCashRow: true, cashWeight: 0 }));
      expect(rows).toHaveLength(3);
      expect(rows.some((r) => r.isCash)).toBe(false);
    });
  });
});
