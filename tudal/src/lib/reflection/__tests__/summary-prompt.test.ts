import { describe, it, expect } from "vitest";
import { buildReflectionSummaryPrompt } from "@/lib/reflection/summary-prompt";
import type { ReflectionMetrics } from "@/lib/reflection/types";

const metrics: ReflectionMetrics = {
  selectedCount: 3,
  pricedCount: 3,
  overallHitCount: 2,
  overallHitRate: 0.6667,
  overallAvgRealizedReturn: 0.041,
  perPersona: [
    { personaId: "p1", sampleSize: 3, hitRate: 1, convictionWeightedReturn: 0.08, avgConviction: 78 },
    { personaId: "p2", sampleSize: 3, hitRate: 0.33, convictionWeightedReturn: -0.02, avgConviction: 41 },
  ],
  tickerReturns: [],
};

describe("buildReflectionSummaryPrompt", () => {
  it("track + 실현 성과 + 페르소나 메트릭을 포함", () => {
    const p = buildReflectionSummaryPrompt(metrics, "short");
    expect(p).toContain("short");
    expect(p).toContain("p1");
    expect(p).toContain("p2");
  });

  it("회고지 예측 아님 지시(미래 예측 금지) 포함", () => {
    const p = buildReflectionSummaryPrompt(metrics, "midlong");
    expect(p).toContain("예측");
    // '예측하지 마' 류 부정 지시 — 미래 예측을 요구하지 않음
    expect(p).toMatch(/예측.*(말|금지|아님|마세요|하지)/);
  });

  it("결정론(순수): 동일 입력 동일 출력", () => {
    expect(buildReflectionSummaryPrompt(metrics, "short")).toBe(
      buildReflectionSummaryPrompt(metrics, "short"),
    );
  });
});
