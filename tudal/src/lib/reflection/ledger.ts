// PR-K Reflection — reflection_log row 조립 (pure).
// SoT: docs/superpowers/specs/2026-06-27-reflection-prk-build.md §3.3.

import type {
  ReflectionLogRow,
  ReflectionMetrics,
  ReflectionPriceBasis,
  ReflectionTrack,
} from "@/lib/reflection/types";

export interface BuildReflectionLogRowInput {
  metrics: ReflectionMetrics;
  cycle: {
    month: string; // YYYY-MM-01
    track: ReflectionTrack;
    periodKey: string;
    finalizedAt: string; // ISO
  };
  priceBasis: ReflectionPriceBasis;
  /** buildReflectionContext 산출(감사 스냅샷 = 주입될 컨텍스트). */
  snapshot: string;
}

export function buildReflectionLogRow(
  input: BuildReflectionLogRowInput,
): ReflectionLogRow {
  const { metrics, cycle, priceBasis, snapshot } = input;
  return {
    month: cycle.month,
    track: cycle.track,
    periodKey: cycle.periodKey,
    finalizedAt: cycle.finalizedAt,
    reflectionKind: "retrospective", // 예측 아님 박제(DB CHECK 1:1)
    selectedCount: metrics.selectedCount,
    pricedCount: metrics.pricedCount,
    overallHitRate: metrics.overallHitRate,
    overallAvgRealizedReturn: metrics.overallAvgRealizedReturn,
    perPersonaMetrics: metrics.perPersona,
    injectedContextSnapshot: snapshot,
    priceSource: priceBasis.source,
    priceBasisEntryDate: priceBasis.entryDate,
    priceBasisCurrentDate: priceBasis.currentDate,
  };
}
