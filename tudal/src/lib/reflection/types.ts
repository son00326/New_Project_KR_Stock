// PR-K Reflection (AI 자가 학습) — pure types.
// SoT: docs/superpowers/specs/2026-06-27-reflection-prk-build.md §1.
//
// 범주 분리: PR-K Reflection(전체 회고 → 선정 prompt 주입, track별) ≠ D27 Q5 incumbent thesis
//   (선정 시점 per-incumbent, reflectionContext seam) ≠ M12a(뉴스 thesis-break) ≠ G4(거시).
// 회고지 예측 아님(retrospective) — 메트릭/컨텍스트에 예측 어휘 0.

import type { PersonaScore } from "@/lib/screening/tier1-schema";
import type { SelectionTrack } from "@/lib/screening/tier1-schema";

export type ReflectionTrack = SelectionTrack; // 'short' | 'midlong'

/** finalize된 추천 종목 1건 + 그 종목의 11-persona 패널 결과. */
export interface CycleSelection {
  ticker: string;
  panel: PersonaScore[];
}

export interface ComputeReflectionMetricsInput {
  selections: CycleSelection[];
  /** KRX EOD close @ 사이클 finalize 거래일. */
  entryPrices: Map<string, number>;
  /** KRX EOD close @ 회고 실행 거래일. */
  currentPrices: Map<string, number>;
  /** CORE_11 persona_id 권위 명부 — 누락 페르소나도 표본 0으로 표기. */
  personaRoster: string[];
}

export interface PersonaReflectionMetric {
  personaId: string;
  /** priced 표본 수(해당 persona가 채점한 priced 종목 수). */
  sampleSize: number;
  /** favored(conviction≥50) 정렬 적중률. 표본 0 → null. */
  hitRate: number | null;
  /** Σ(conviction·r)/Σ(conviction). Σconviction=0 → null. */
  convictionWeightedReturn: number | null;
  /** priced 종목 평균 conviction. 표본 0 → null. */
  avgConviction: number | null;
}

export interface TickerRealizedReturn {
  ticker: string;
  /** (current-entry)/entry 비율(0.05=+5%). priced=false면 null. */
  realizedReturn: number | null;
  priced: boolean;
}

export interface ReflectionMetrics {
  selectedCount: number;
  pricedCount: number;
  /** priced 중 r>0 종목 수(raw — 컨텍스트 표시는 비율×N 재구성 대신 이 값을 직접 사용). */
  overallHitCount: number;
  /** priced 중 r>0 비율. priced 0 → null. */
  overallHitRate: number | null;
  /** priced r 평균. priced 0 → null. */
  overallAvgRealizedReturn: number | null;
  perPersona: PersonaReflectionMetric[];
  tickerReturns: TickerRealizedReturn[];
}

export interface ReflectionPriceBasis {
  source: "KRX_EOD" | null;
  entryDate: string | null; // YYYYMMDD
  currentDate: string | null; // YYYYMMDD
}

/** reflection_log row(영속 payload). reflection_kind는 항상 'retrospective'(예측 아님 박제). */
export interface ReflectionLogRow {
  month: string; // YYYY-MM-01
  track: ReflectionTrack;
  periodKey: string;
  finalizedAt: string; // ISO
  reflectionKind: "retrospective";
  selectedCount: number;
  pricedCount: number;
  overallHitRate: number | null;
  overallAvgRealizedReturn: number | null;
  perPersonaMetrics: PersonaReflectionMetric[];
  injectedContextSnapshot: string;
  priceSource: "KRX_EOD" | null;
  priceBasisEntryDate: string | null;
  priceBasisCurrentDate: string | null;
}

export interface ReflectionRunResult {
  skipped: boolean;
  reason?: "flag_off" | "no_finalized_cycle" | "no_panels";
  track: ReflectionTrack;
  periodKey: string | null;
  selectedCount: number;
  pricedCount: number;
  overallHitRate: number | null;
  overallAvgRealizedReturn: number | null;
}
