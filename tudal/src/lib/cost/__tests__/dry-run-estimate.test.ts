import { describe, expect, it } from "vitest";
import { computeCostKrw } from "@/lib/cost/anthropic-pricing";
import {
  BASE_WORKLOAD,
  buildDryRunReport,
  estimateMonthlyCost,
} from "@/lib/cost/dry-run-estimate";
import {
  COST_HARDCAP_KRW,
  COST_WARNING_THRESHOLD_KRW,
} from "@/types/admin";

describe("anthropic-pricing", () => {
  it("Sonnet 4.6: 1M input + 1M output = 18 USD = ₩25,740", () => {
    const krw = computeCostKrw("claude-sonnet-4-6", 1_000_000, 1_000_000);
    // (3 + 15) USD × 1430 = 25,740
    expect(krw).toBe(25_740);
  });

  it("Opus 4.7: 1M input + 1M output = 30 USD = ₩42,900 (50차 §2.D 정정)", () => {
    const krw = computeCostKrw("claude-opus-4-7", 1_000_000, 1_000_000);
    // 공식 Opus 4.7 단가 $5 input + $25 output → (5 + 25) USD × 1430 = 42,900
    expect(krw).toBe(42_900);
  });

  it("Haiku 4.5: 1M input + 1M output = 6 USD = ₩8,580", () => {
    const krw = computeCostKrw("claude-haiku-4-5", 1_000_000, 1_000_000);
    expect(krw).toBe(8_580);
  });

  it("알 수 없는 모델은 Sonnet 가격으로 fallback", () => {
    const krw = computeCostKrw("unknown-model", 1_000_000, 1_000_000);
    expect(krw).toBe(25_740);
  });
});

describe("estimateMonthlyCost (Sonnet 4.6, base workload)", () => {
  const result = estimateMonthlyCost(BASE_WORKLOAD, "claude-sonnet-4-6");

  it("4 카테고리(shortlist·report·committee·briefing) 비용 모두 양수", () => {
    expect(result.shortlistKrw).toBeGreaterThan(0);
    expect(result.reportKrw).toBeGreaterThan(0);
    expect(result.committeeKrw).toBeGreaterThan(0);
    expect(result.briefingKrw).toBeGreaterThan(0);
  });

  it("totalKrw = 4 카테고리 합 (반올림 오차 ≤1원)", () => {
    const sum =
      result.shortlistKrw +
      result.reportKrw +
      result.committeeKrw +
      result.briefingKrw;
    expect(Math.abs(result.totalKrw - sum)).toBeLessThanOrEqual(1);
  });

  it("base 시나리오는 35만 경보 미만 (Sonnet 가정)", () => {
    expect(result.totalKrw).toBeLessThan(COST_WARNING_THRESHOLD_KRW);
  });
});

describe("buildDryRunReport", () => {
  const report = buildDryRunReport("claude-sonnet-4-6");

  it("3 시나리오(low·base·worst) 모두 채워짐", () => {
    expect(report.scenarios.low.totalKrw).toBeGreaterThan(0);
    expect(report.scenarios.base.totalKrw).toBeGreaterThan(0);
    expect(report.scenarios.worst.totalKrw).toBeGreaterThan(0);
  });

  it("low < base < worst (단조 증가)", () => {
    expect(report.scenarios.low.totalKrw).toBeLessThan(report.scenarios.base.totalKrw);
    expect(report.scenarios.base.totalKrw).toBeLessThan(report.scenarios.worst.totalKrw);
  });

  it("verdict 분기 일관성", () => {
    if (report.worstExceedsHardcap) {
      expect(report.verdict).toBe("over");
    } else if (report.worstExceedsWarning) {
      expect(report.verdict).toBe("tight");
    } else {
      expect(report.verdict).toBe("safe");
    }
  });

  it("Opus 모델은 Sonnet보다 base 비용이 큼", () => {
    const opusReport = buildDryRunReport("claude-opus-4-7");
    expect(opusReport.scenarios.base.totalKrw).toBeGreaterThan(
      report.scenarios.base.totalKrw,
    );
  });

  it("hardcap·warning 임계치는 상수 일치", () => {
    expect(report.warningThresholdKrw).toBe(COST_WARNING_THRESHOLD_KRW);
    expect(report.hardcapKrw).toBe(COST_HARDCAP_KRW);
  });
});
