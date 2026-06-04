import { describe, expect, it } from "vitest";
import { aggregateMonthlyCost, isHardcapBlocked } from "@/lib/cost/aggregate";
import type { CostLog } from "@/types/admin";

function log(
  id: string,
  month: string,
  cost: number,
  purpose: CostLog["purpose"],
  ticker: string | null = null,
  section: string | null = null,
  personaId: string | null = null,
): CostLog {
  return {
    id,
    ts: `${month.slice(0, 7)}-15T12:00:00Z`,
    month,
    model: "claude-sonnet-4-6",
    purpose,
    ticker,
    personaId,
    section,
    tokensPrompt: 1000,
    tokensCompletion: 500,
    costKrw: cost,
  };
}

describe("aggregateMonthlyCost", () => {
  it("정상 집계 — total·warning·hardcap 미도달", () => {
    const logs = [
      log("a", "2026-04-01", 100_000, "report", "005930", "section_3"),
      log("b", "2026-04-01", 50_000, "committee", "005930", null, "core-buffett"),
      log("c", "2026-04-01", 30_000, "briefing"),
    ];
    const summary = aggregateMonthlyCost(logs, "2026-04-01");
    expect(summary.totalKrw).toBe(180_000);
    expect(summary.warningTriggered).toBe(false);
    expect(summary.hardcapTriggered).toBe(false);
    expect(summary.remainingKrw).toBe(320_000); // 65차 LOCKED #5: 50만 hardcap - 18만
  });

  it("45만 경보 — warning 트리거 + hardcap 미도달 (65차 LOCKED #5)", () => {
    const logs = [log("a", "2026-04-01", 460_000, "report")];
    const summary = aggregateMonthlyCost(logs, "2026-04-01");
    expect(summary.warningTriggered).toBe(true);
    expect(summary.hardcapTriggered).toBe(false);
  });

  it("50만 hardcap — 양쪽 트리거 + remaining 음수 (65차 LOCKED #5)", () => {
    const logs = [log("a", "2026-04-01", 550_000, "report")];
    const summary = aggregateMonthlyCost(logs, "2026-04-01");
    expect(summary.warningTriggered).toBe(true);
    expect(summary.hardcapTriggered).toBe(true);
    expect(summary.remainingKrw).toBeLessThan(0);
  });

  it("byPurpose share 합계는 1 (반올림 오차 허용)", () => {
    const logs = [
      log("a", "2026-04-01", 100, "report"),
      log("b", "2026-04-01", 50, "committee"),
      log("c", "2026-04-01", 50, "briefing"),
    ];
    const summary = aggregateMonthlyCost(logs, "2026-04-01");
    const total = summary.byPurpose.reduce((s, p) => s + p.share, 0);
    expect(total).toBeCloseTo(1, 5);
  });

  it("topContributors — 같은 (ticker·section·persona) 묶음 합산 + 정렬", () => {
    const logs = [
      log("a", "2026-04-01", 30, "report", "005930", "section_3"),
      log("b", "2026-04-01", 70, "report", "005930", "section_3"), // 동일 라벨 → 100 합산
      log("c", "2026-04-01", 80, "committee", "005930", null, "core-buffett"),
      log("d", "2026-04-01", 20, "briefing"),
    ];
    const summary = aggregateMonthlyCost(logs, "2026-04-01", { topN: 3 });
    expect(summary.topContributors.length).toBe(3);
    expect(summary.topContributors[0].costKrw).toBe(100); // 합산된 report
    expect(summary.topContributors[1].costKrw).toBe(80); // committee
  });

  it("다른 month는 무시", () => {
    const logs = [
      log("a", "2026-04-01", 100, "report"),
      log("b", "2026-03-01", 999_999, "report"),
    ];
    const summary = aggregateMonthlyCost(logs, "2026-04-01");
    expect(summary.totalKrw).toBe(100);
  });

  it("month 입력은 ISO/연월/연월일 모두 정규화", () => {
    const logs = [log("a", "2026-04-01", 100, "report")];
    expect(aggregateMonthlyCost(logs, "2026-04").totalKrw).toBe(100);
    expect(aggregateMonthlyCost(logs, "2026-04-15").totalKrw).toBe(100);
    expect(aggregateMonthlyCost(logs, "2026-04-15T08:00:00Z").totalKrw).toBe(
      100,
    );
  });
});

describe("isHardcapBlocked", () => {
  it("50만 미만이면 false (65차 LOCKED #5)", () => {
    const logs = [log("a", "2026-04-01", 499_999, "report")];
    expect(isHardcapBlocked(logs, "2026-04-01")).toBe(false);
  });

  it("정확히 50만이면 true (경계 포함 · 65차 LOCKED #5)", () => {
    const logs = [log("a", "2026-04-01", 500_000, "report")];
    expect(isHardcapBlocked(logs, "2026-04-01")).toBe(true);
  });

  it("custom hardcap 인자 적용", () => {
    const logs = [log("a", "2026-04-01", 100, "report")];
    expect(isHardcapBlocked(logs, "2026-04-01", 50)).toBe(true);
    expect(isHardcapBlocked(logs, "2026-04-01", 200)).toBe(false);
  });
});
