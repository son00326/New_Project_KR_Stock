import { describe, it, expect } from "vitest";
import { buildReflectionLogRow } from "@/lib/reflection/ledger";
import { buildReflectionContext } from "@/lib/reflection/reflection-context";
import type { ReflectionMetrics } from "@/lib/reflection/types";

const metrics: ReflectionMetrics = {
  selectedCount: 2,
  pricedCount: 2,
  overallHitCount: 1,
  overallHitRate: 0.5,
  overallAvgRealizedReturn: 0.03,
  perPersona: [
    { personaId: "p1", sampleSize: 2, hitRate: 1, convictionWeightedReturn: 0.08, avgConviction: 75 },
  ],
  tickerReturns: [],
};

describe("buildReflectionLogRow", () => {
  it("메타 + metrics 매핑 + reflection_kind='retrospective'(예측 아님 박제)", () => {
    const row = buildReflectionLogRow({
      metrics,
      cycle: { month: "2026-06-01", track: "short", periodKey: "s:2026-06-22", finalizedAt: "2026-06-26T01:00:00Z" },
      priceBasis: { source: "KRX_EOD", entryDate: "20260626", currentDate: "20260627" },
      snapshot: "ctx",
    });
    expect(row.month).toBe("2026-06-01");
    expect(row.track).toBe("short");
    expect(row.periodKey).toBe("s:2026-06-22");
    expect(row.finalizedAt).toBe("2026-06-26T01:00:00Z");
    expect(row.reflectionKind).toBe("retrospective");
    expect(row.selectedCount).toBe(2);
    expect(row.pricedCount).toBe(2);
    expect(row.overallHitRate).toBe(0.5);
    expect(row.overallAvgRealizedReturn).toBe(0.03);
    expect(row.perPersonaMetrics).toEqual(metrics.perPersona);
    expect(row.injectedContextSnapshot).toBe("ctx");
    expect(row.priceSource).toBe("KRX_EOD");
    expect(row.priceBasisEntryDate).toBe("20260626");
    expect(row.priceBasisCurrentDate).toBe("20260627");
  });

  it("snapshot은 buildReflectionContext 산출과 일치(감사 정합)", () => {
    const snapshot = buildReflectionContext(metrics);
    const row = buildReflectionLogRow({
      metrics,
      cycle: { month: "2026-06-01", track: "midlong", periodKey: "m:2026-06", finalizedAt: "2026-06-26T01:00:00Z" },
      priceBasis: { source: null, entryDate: null, currentDate: null },
      snapshot,
    });
    expect(row.injectedContextSnapshot).toBe(snapshot);
    expect(row.priceSource).toBeNull();
  });
});
