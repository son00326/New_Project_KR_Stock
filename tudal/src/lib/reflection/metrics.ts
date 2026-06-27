// PR-K Reflection — 실현 수익률 + per-persona 메트릭 (pure·결정론).
// SoT: docs/superpowers/specs/2026-06-27-reflection-prk-build.md §3.1.
//
// 회고지 예측 아님(retrospective): 메트릭은 과거 실현 정렬도이며 미래 수익 예측이 아니다.
// env/IO/Date.now 없음. 가격 누락은 fail-soft(priced:false·null) — throw 0.
//
// ⚠️ '적중률(hitRate)' 두 의미 분리(L2 clarity): overallHitRate = priced 중 r>0 비율(순수 방향성);
//   per-persona hitRate = 확신-결과 정렬도((favored&&up)|(!favored&&!up)). 컨텍스트엔 overall만 '적중 N/M'로
//   노출(충돌 없음). FAVORED_CONVICTION_THRESHOLD=50(중립 midpoint) 이상을 favored로 본다(spec §3.1 박제).

import { FAVORED_CONVICTION_THRESHOLD } from "@/lib/reflection/config";
import type {
  ComputeReflectionMetricsInput,
  PersonaReflectionMetric,
  ReflectionMetrics,
  TickerRealizedReturn,
} from "@/lib/reflection/types";

interface PricedSelection {
  ticker: string;
  realizedReturn: number;
  convictionById: Map<string, number>;
}

export function computeReflectionMetrics(
  input: ComputeReflectionMetricsInput,
): ReflectionMetrics {
  const { selections, entryPrices, currentPrices, personaRoster } = input;

  const tickerReturns: TickerRealizedReturn[] = [];
  const priced: PricedSelection[] = [];

  for (const sel of selections) {
    const entry = entryPrices.get(sel.ticker);
    const current = currentPrices.get(sel.ticker);
    const isPriced =
      typeof entry === "number" &&
      typeof current === "number" &&
      Number.isFinite(entry) &&
      Number.isFinite(current) &&
      entry > 0 &&
      current > 0;
    if (!isPriced) {
      tickerReturns.push({ ticker: sel.ticker, realizedReturn: null, priced: false });
      continue;
    }
    const r = (current - entry) / entry;
    tickerReturns.push({ ticker: sel.ticker, realizedReturn: r, priced: true });
    const convictionById = new Map<string, number>();
    for (const s of sel.panel) {
      convictionById.set(s.persona_id, s.conviction);
    }
    priced.push({ ticker: sel.ticker, realizedReturn: r, convictionById });
  }

  const pricedCount = priced.length;
  const overallHitCount = priced.filter((p) => p.realizedReturn > 0).length;
  const overallAvgRealizedReturn =
    pricedCount === 0
      ? null
      : priced.reduce((acc, p) => acc + p.realizedReturn, 0) / pricedCount;
  const overallHitRate = pricedCount === 0 ? null : overallHitCount / pricedCount;

  // per-persona: roster 순서(권위 명부) — 누락 persona도 표본 0으로 표기.
  const perPersona: PersonaReflectionMetric[] = personaRoster.map((personaId) => {
    let sampleSize = 0;
    let hits = 0;
    let convSum = 0;
    let convWeightedReturnSum = 0;
    for (const p of priced) {
      const conviction = p.convictionById.get(personaId);
      if (conviction === undefined) continue;
      sampleSize += 1;
      const favored = conviction >= FAVORED_CONVICTION_THRESHOLD;
      const up = p.realizedReturn > 0;
      // 확신이 결과와 정렬됐는가: (favored & up) | (!favored & not-up)
      if ((favored && up) || (!favored && !up)) hits += 1;
      convSum += conviction;
      convWeightedReturnSum += conviction * p.realizedReturn;
    }
    return {
      personaId,
      sampleSize,
      hitRate: sampleSize === 0 ? null : hits / sampleSize,
      convictionWeightedReturn: convSum === 0 ? null : convWeightedReturnSum / convSum,
      avgConviction: sampleSize === 0 ? null : convSum / sampleSize,
    };
  });

  return {
    selectedCount: selections.length,
    pricedCount,
    overallHitCount,
    overallHitRate,
    overallAvgRealizedReturn,
    perPersona,
    tickerReturns,
  };
}
