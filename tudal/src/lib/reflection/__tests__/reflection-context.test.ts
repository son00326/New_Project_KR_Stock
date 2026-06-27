import { describe, it, expect } from "vitest";
import { buildReflectionContext } from "@/lib/reflection/reflection-context";
import type { ReflectionMetrics } from "@/lib/reflection/types";

function metrics(over: Partial<ReflectionMetrics> = {}): ReflectionMetrics {
  return {
    selectedCount: 2,
    pricedCount: 2,
    overallHitCount: 1,
    overallHitRate: 0.5,
    overallAvgRealizedReturn: 0.03,
    perPersona: [
      {
        personaId: "p1",
        sampleSize: 2,
        hitRate: 1,
        convictionWeightedReturn: 0.08,
        avgConviction: 75,
      },
      {
        personaId: "p2",
        sampleSize: 2,
        hitRate: 0,
        convictionWeightedReturn: -0.05,
        avgConviction: 40,
      },
    ],
    tickerReturns: [],
    ...over,
  };
}

// 예측/전망 어휘 블랙리스트(회고지 예측 아님 박제).
const FORECAST_WORDS = ["예측", "전망", "예상", "오를", "상승할", "будет", "forecast", "will rise"];

describe("buildReflectionContext", () => {
  it("selectedCount 0 → '' (dormant)", () => {
    expect(buildReflectionContext(metrics({ selectedCount: 0, pricedCount: 0 }))).toBe("");
  });

  it("pricedCount 0 → '' (가격 전부 부재 fail-soft)", () => {
    expect(buildReflectionContext(metrics({ pricedCount: 0 }))).toBe("");
  });

  it("비어있지 않으면 forward-validate 면책 헤더 포함(예측 아님·Tier0 팩터 아님)", () => {
    const out = buildReflectionContext(metrics());
    expect(out).toContain("회고");
    expect(out).toContain("예측 아님");
    expect(out).toContain("Tier0");
  });

  it("예측/전망 어휘 0 (회고 박제)", () => {
    const out = buildReflectionContext(metrics());
    // 면책 문구의 '예측 아님'은 허용(부정형). 그 외 예측 어휘 없어야.
    const body = out.replaceAll("예측 아님", "");
    for (const w of FORECAST_WORDS) {
      expect(body).not.toContain(w);
    }
  });

  it("강점 페르소나 top-N = convictionWeightedReturn desc 정렬", () => {
    const out = buildReflectionContext(metrics(), { maxPersonas: 1 });
    // p1(weighted 0.08) > p2(-0.05) → p1만 표면화
    expect(out).toContain("p1");
    expect(out).not.toContain("p2");
  });

  it("maxPersonas cap 적용", () => {
    const out = buildReflectionContext(metrics(), { maxPersonas: 2 });
    expect(out).toContain("p1");
    expect(out).toContain("p2");
  });

  it("convictionWeightedReturn null 페르소나는 강점 digest에서 제외", () => {
    const out = buildReflectionContext(
      metrics({
        perPersona: [
          { personaId: "p1", sampleSize: 0, hitRate: null, convictionWeightedReturn: null, avgConviction: null },
        ],
      }),
    );
    // 강점 데이터 없음 — 헤더/요약은 있으나 persona 라인 없음(빈 digest 허용, throw 0)
    expect(out).not.toContain("p1");
  });
});
