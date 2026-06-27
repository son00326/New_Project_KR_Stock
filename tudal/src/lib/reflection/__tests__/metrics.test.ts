import { describe, it, expect } from "vitest";
import { computeReflectionMetrics } from "@/lib/reflection/metrics";
import type { CycleSelection } from "@/lib/reflection/types";
import type { PersonaScore } from "@/lib/screening/tier1-schema";

// PersonaScore 헬퍼 — conviction만 의미있게, 나머지는 schema-valid 더미.
function score(personaId: string, conviction: number): PersonaScore {
  return {
    persona_id: personaId,
    scores: { short: 50, mid: 50, long: 50 },
    winning_timeframe: "short",
    rationale_kr: "",
    conviction,
  };
}

const ROSTER = ["p1", "p2", "p3"];

function sel(ticker: string, convs: Record<string, number>): CycleSelection {
  return {
    ticker,
    panel: Object.entries(convs).map(([id, c]) => score(id, c)),
  };
}

describe("computeReflectionMetrics", () => {
  it("realized return = (current-entry)/entry 비율, priced=true", () => {
    const m = computeReflectionMetrics({
      selections: [sel("000001", { p1: 80 })],
      entryPrices: new Map([["000001", 100]]),
      currentPrices: new Map([["000001", 110]]),
      personaRoster: ["p1"],
    });
    const tr = m.tickerReturns.find((t) => t.ticker === "000001")!;
    expect(tr.priced).toBe(true);
    expect(tr.realizedReturn).toBeCloseTo(0.1, 6);
    expect(m.selectedCount).toBe(1);
    expect(m.pricedCount).toBe(1);
  });

  it("음수 실현 수익률(손실) 정확", () => {
    const m = computeReflectionMetrics({
      selections: [sel("000001", { p1: 80 })],
      entryPrices: new Map([["000001", 100]]),
      currentPrices: new Map([["000001", 90]]),
      personaRoster: ["p1"],
    });
    expect(m.tickerReturns[0].realizedReturn).toBeCloseTo(-0.1, 6);
    expect(m.overallAvgRealizedReturn).toBeCloseTo(-0.1, 6);
  });

  it("가격 누락(entry 또는 current 부재) → priced=false·return null, throw 0", () => {
    const m = computeReflectionMetrics({
      selections: [sel("000001", { p1: 80 }), sel("000002", { p1: 80 })],
      entryPrices: new Map([["000001", 100]]), // 000002 entry 없음
      currentPrices: new Map([
        ["000001", 110],
        ["000002", 120],
      ]),
      personaRoster: ["p1"],
    });
    const a = m.tickerReturns.find((t) => t.ticker === "000001")!;
    const b = m.tickerReturns.find((t) => t.ticker === "000002")!;
    expect(a.priced).toBe(true);
    expect(b.priced).toBe(false);
    expect(b.realizedReturn).toBeNull();
    expect(m.pricedCount).toBe(1);
  });

  it("entry<=0 → priced=false (0 분모 방지)", () => {
    const m = computeReflectionMetrics({
      selections: [sel("000001", { p1: 80 })],
      entryPrices: new Map([["000001", 0]]),
      currentPrices: new Map([["000001", 110]]),
      personaRoster: ["p1"],
    });
    expect(m.tickerReturns[0].priced).toBe(false);
    expect(m.pricedCount).toBe(0);
  });

  it("가격 전부 누락 → overall null·priced 0(fail-soft, throw 아님)", () => {
    const m = computeReflectionMetrics({
      selections: [sel("000001", { p1: 80 })],
      entryPrices: new Map(),
      currentPrices: new Map(),
      personaRoster: ["p1"],
    });
    expect(m.pricedCount).toBe(0);
    expect(m.overallHitRate).toBeNull();
    expect(m.overallAvgRealizedReturn).toBeNull();
    expect(m.perPersona[0].hitRate).toBeNull();
    expect(m.perPersona[0].convictionWeightedReturn).toBeNull();
  });

  it("favored(conviction>=50) + r>0 = hit; conviction 50 경계 포함", () => {
    // p1: conv 50(favored), r>0 → hit. p2: conv 49(not favored), r>0 → miss.
    const m = computeReflectionMetrics({
      selections: [sel("000001", { p1: 50, p2: 49 })],
      entryPrices: new Map([["000001", 100]]),
      currentPrices: new Map([["000001", 110]]),
      personaRoster: ["p1", "p2"],
    });
    const p1 = m.perPersona.find((p) => p.personaId === "p1")!;
    const p2 = m.perPersona.find((p) => p.personaId === "p2")!;
    expect(p1.hitRate).toBe(1); // favored & up
    expect(p2.hitRate).toBe(0); // not favored & up = miss
  });

  it("not favored + r<=0 = hit (확신 안 한 종목이 떨어지면 적중)", () => {
    const m = computeReflectionMetrics({
      selections: [sel("000001", { p1: 20 })],
      entryPrices: new Map([["000001", 100]]),
      currentPrices: new Map([["000001", 90]]),
      personaRoster: ["p1"],
    });
    expect(m.perPersona[0].hitRate).toBe(1);
  });

  it("favored + r<=0 = miss; r=0 경계는 not-up(<=0)", () => {
    const m = computeReflectionMetrics({
      selections: [sel("000001", { p1: 80 })],
      entryPrices: new Map([["000001", 100]]),
      currentPrices: new Map([["000001", 100]]), // r=0
      personaRoster: ["p1"],
    });
    // favored & not-up(r=0) → miss
    expect(m.perPersona[0].hitRate).toBe(0);
  });

  it("convictionWeightedReturn = Σ(conv·r)/Σ(conv)", () => {
    // 두 종목: A conv80 r=+0.10, B conv20 r=-0.10 → (80*0.1 + 20*-0.1)/100 = 0.06
    const m = computeReflectionMetrics({
      selections: [sel("000001", { p1: 80 }), sel("000002", { p1: 20 })],
      entryPrices: new Map([
        ["000001", 100],
        ["000002", 100],
      ]),
      currentPrices: new Map([
        ["000001", 110],
        ["000002", 90],
      ]),
      personaRoster: ["p1"],
    });
    expect(m.perPersona[0].convictionWeightedReturn).toBeCloseTo(0.06, 6);
    expect(m.perPersona[0].avgConviction).toBeCloseTo(50, 6);
    expect(m.perPersona[0].sampleSize).toBe(2);
  });

  it("Σconviction=0 → convictionWeightedReturn null (분모 0 방지)", () => {
    const m = computeReflectionMetrics({
      selections: [sel("000001", { p1: 0 })],
      entryPrices: new Map([["000001", 100]]),
      currentPrices: new Map([["000001", 110]]),
      personaRoster: ["p1"],
    });
    expect(m.perPersona[0].convictionWeightedReturn).toBeNull();
  });

  it("roster에 있으나 패널에 없는 persona → 표본 0·null (누락 표기)", () => {
    const m = computeReflectionMetrics({
      selections: [sel("000001", { p1: 80 })],
      entryPrices: new Map([["000001", 100]]),
      currentPrices: new Map([["000001", 110]]),
      personaRoster: ["p1", "ghost"],
    });
    const ghost = m.perPersona.find((p) => p.personaId === "ghost")!;
    expect(ghost.sampleSize).toBe(0);
    expect(ghost.hitRate).toBeNull();
    expect(ghost.convictionWeightedReturn).toBeNull();
  });

  it("perPersona는 roster 순서·결정론(persona_id 권위 명부)", () => {
    const m = computeReflectionMetrics({
      selections: [sel("000001", { p2: 80, p1: 70, p3: 60 })],
      entryPrices: new Map([["000001", 100]]),
      currentPrices: new Map([["000001", 110]]),
      personaRoster: ROSTER,
    });
    expect(m.perPersona.map((p) => p.personaId)).toEqual(["p1", "p2", "p3"]);
  });

  it("overallHitRate = priced 중 r>0 비율", () => {
    const m = computeReflectionMetrics({
      selections: [
        sel("000001", { p1: 80 }),
        sel("000002", { p1: 80 }),
        sel("000003", { p1: 80 }),
      ],
      entryPrices: new Map([
        ["000001", 100],
        ["000002", 100],
        ["000003", 100],
      ]),
      currentPrices: new Map([
        ["000001", 110], // up
        ["000002", 90], // down
        ["000003", 130], // up
      ]),
      personaRoster: ["p1"],
    });
    expect(m.overallHitRate).toBeCloseTo(2 / 3, 6);
    expect(m.overallHitCount).toBe(2); // raw 적중 수(비율 재구성 아님)
    expect(m.pricedCount).toBe(3);
  });
});
