import { describe, expect, it } from "vitest";
import { computeRealizedReturns } from "@/lib/screening/shortlist-returns";

describe("computeRealizedReturns", () => {
  it("computes per-ticker return, avg, median", () => {
    const entry = new Map([
      ["005930", 100],
      ["000660", 200],
      ["035720", 50],
    ]);
    const current = new Map([
      ["005930", 110], // +10%
      ["000660", 180], // -10%
      ["035720", 75], // +50%
    ]);
    const out = computeRealizedReturns(["005930", "000660", "035720"], entry, current);
    expect(out.pricedCount).toBe(3);
    expect(out.missingCount).toBe(0);
    expect(out.perTicker.find((p) => p.ticker === "005930")?.returnPct).toBe(10);
    expect(out.avgReturnPct).toBe(round2((10 - 10 + 50) / 3));
    expect(out.medianReturnPct).toBe(10); // sorted [-10,10,50] → 10
  });

  it("even count median = average of middle two", () => {
    const entry = new Map([["a", 100], ["b", 100]]);
    const current = new Map([["a", 104], ["b", 110]]);
    const out = computeRealizedReturns(["a", "b"], entry, current);
    expect(out.medianReturnPct).toBe(7); // (4+10)/2
  });

  it("counts missing when price absent or non-positive", () => {
    const entry = new Map([["a", 100], ["b", 0], ["c", 100]]);
    const current = new Map([["a", 110], ["b", 50] /* c missing */]);
    const out = computeRealizedReturns(["a", "b", "c"], entry, current);
    expect(out.pricedCount).toBe(1); // only a
    expect(out.missingCount).toBe(2); // b (entry 0) + c (current missing)
  });

  it("current-price guard: valid entry + zero/negative current → missing (mutation-pin current>0)", () => {
    const entry = new Map([["a", 100], ["b", 100]]);
    const current = new Map([["a", 0], ["b", -5]]); // both non-positive current
    const out = computeRealizedReturns(["a", "b"], entry, current);
    expect(out.pricedCount).toBe(0);
    expect(out.missingCount).toBe(2);
  });

  it("dedups repeated tickers (counted once)", () => {
    const entry = new Map([["a", 100]]);
    const current = new Map([["a", 110]]);
    const out = computeRealizedReturns(["a", "a", "a"], entry, current);
    expect(out.pricedCount).toBe(1);
    expect(out.missingCount).toBe(0);
  });

  it("empty / all-missing → null avg & median", () => {
    const out = computeRealizedReturns(["a"], new Map(), new Map());
    expect(out.pricedCount).toBe(0);
    expect(out.avgReturnPct).toBeNull();
    expect(out.medianReturnPct).toBeNull();
  });
});

function round2(n: number): number {
  return Number(n.toFixed(2));
}
