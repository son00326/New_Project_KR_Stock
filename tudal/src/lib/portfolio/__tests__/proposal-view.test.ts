// W3b-3 (T1) — proposal-view pure 헬퍼 (positions enrich + summary).
import { describe, it, expect } from "vitest";
import {
  enrichProposalPositions,
  computeProposalSummary,
} from "../proposal-view";

const PROPOSAL = {
  positions: [
    { ticker: "005930", weight: 0.5, timeframe: "long" as const },
    { ticker: "000660", weight: 0.3, timeframe: "mid" as const },
  ],
  cashWeight: 0.2,
  rationale_kr: "반도체 집중 + 현금 20%",
};

const VIEW = [
  { ticker: "005930", name: "삼성전자", sector: "반도체" },
  { ticker: "000660", name: "SK하이닉스", sector: "반도체" },
];

describe("enrichProposalPositions", () => {
  it("ticker로 name/sector 조인", () => {
    const out = enrichProposalPositions(PROPOSAL.positions, VIEW);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      ticker: "005930",
      name: "삼성전자",
      sector: "반도체",
      weight: 0.5,
      timeframe: "long",
    });
  });
  it("view model에 없는 ticker → name=ticker fallback, sector=''", () => {
    const out = enrichProposalPositions(
      [{ ticker: "999999", weight: 1, timeframe: "short" as const }],
      VIEW,
    );
    expect(out[0].name).toBe("999999");
    expect(out[0].sector).toBe("");
  });
});

describe("computeProposalSummary", () => {
  it("count + equityWeightPct + cashPct", () => {
    const s = computeProposalSummary(PROPOSAL);
    expect(s.positionCount).toBe(2);
    expect(s.equityWeightPct).toBeCloseTo(80, 5); // 0.5+0.3
    expect(s.cashPct).toBeCloseTo(20, 5);
  });
});
