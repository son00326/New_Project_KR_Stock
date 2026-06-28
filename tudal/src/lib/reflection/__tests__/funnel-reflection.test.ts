import { describe, expect, it } from "vitest";
import {
  buildFunnelReflection,
  rankCorrelation,
  type FunnelReflectionInput,
} from "@/lib/reflection/funnel-reflection";

describe("rankCorrelation", () => {
  it("monotonic increasing → +1", () => {
    expect(rankCorrelation([1, 2, 3, 4], [10, 20, 30, 40])).toBe(1);
  });
  it("monotonic decreasing → -1", () => {
    expect(rankCorrelation([1, 2, 3, 4], [40, 30, 20, 10])).toBe(-1);
  });
  it("n<2 or zero variance → 0", () => {
    expect(rankCorrelation([1], [2])).toBe(0);
    expect(rankCorrelation([5, 5, 5], [1, 2, 3])).toBe(0);
  });
});

function input(overrides: Partial<FunnelReflectionInput> = {}): FunnelReflectionInput {
  return {
    periodKey: "2026-06",
    championConfig: { trend: 0.5, size: 0.3 },
    candidates: [
      { ticker: "001", factorExposures: { trend: 1, size: 1 } },
      { ticker: "002", factorExposures: { trend: 2, size: 2 } },
      { ticker: "003", factorExposures: { trend: 3, size: 3 } },
      { ticker: "004", factorExposures: { trend: 4, size: 4 } },
    ],
    realizedReturns: new Map([
      ["001", 1],
      ["002", 5],
      ["003", 9],
      ["004", 13], // trend↑ → return↑ (+corr); size same exposure order
    ]),
    ...overrides,
  };
}

describe("buildFunnelReflection", () => {
  it("positive factor↔return corr → challenger nudges weight up (bounded)", () => {
    const out = buildFunnelReflection(input());
    expect(out.evidence.factorReturnRankCorr.trend).toBe(1);
    expect(out.challengerConfig.trend).toBe(0.55); // 0.5 + 0.05 nudge
    expect(out.evidence.pricedCount).toBe(4);
  });

  it("negative corr → nudge down", () => {
    const out = buildFunnelReflection(
      input({
        realizedReturns: new Map([
          ["001", 13],
          ["002", 9],
          ["003", 5],
          ["004", 1], // trend↑ → return↓ (-corr)
        ]),
      }),
    );
    expect(out.evidence.factorReturnRankCorr.trend).toBe(-1);
    expect(out.challengerConfig.trend).toBe(0.45); // 0.5 - 0.05
  });

  it("nudge is bounded (single δ step) + clamped to [0,1]", () => {
    const out = buildFunnelReflection(
      input({ championConfig: { trend: 0.98 } }),
    );
    // +0.05 from 0.98 = 1.03 → clamp 1.0
    expect(out.challengerConfig.trend).toBe(1);
  });

  it("weak corr (|c|<0.1) → no nudge (champion preserved)", () => {
    const out = buildFunnelReflection(
      input({
        candidates: [
          { ticker: "001", factorExposures: { trend: 1 } },
          { ticker: "002", factorExposures: { trend: 2 } },
          { ticker: "003", factorExposures: { trend: 3 } },
          { ticker: "004", factorExposures: { trend: 4 } },
        ],
        championConfig: { trend: 0.5 },
        realizedReturns: new Map([
          ["001", 2],
          ["002", 4],
          ["003", 1],
          ["004", 3],
        ]),
      }),
    );
    expect(out.evidence.factorReturnRankCorr.trend).toBe(0);
    expect(out.challengerConfig.trend).toBe(0.5);
  });

  it("low sample (<2 priced) → no proposal + diagnostic rationale", () => {
    const out = buildFunnelReflection(
      input({ realizedReturns: new Map([["001", 5]]) }),
    );
    expect(out.evidence.pricedCount).toBe(1);
    expect(out.challengerConfig.trend).toBe(0.5); // unchanged
    expect(out.rationale).toContain("표본 부족");
  });

  it("rationale always carries diagnostic/no-auto-apply/forward-validate guard (예측 아님)", () => {
    const out = buildFunnelReflection(input());
    expect(out.rationale).toContain("자동 적용 금지");
    expect(out.rationale).toContain("forward-validate");
    expect(out.rationale).toContain("예측 아님");
  });

  it("only priced candidates counted (unpriced excluded)", () => {
    const out = buildFunnelReflection(
      input({
        realizedReturns: new Map([
          ["001", 1],
          ["002", 5],
          // 003, 004 unpriced
        ]),
      }),
    );
    expect(out.evidence.pricedCount).toBe(2);
  });
});
