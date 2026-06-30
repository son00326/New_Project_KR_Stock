import type { MacroIndicator, MarketVerdict } from "@/types/macro";

// ---------------------------------------------------------------------------
// G4 verdict-builder — FRED 지표[] → 결정론적 MarketVerdict 합성. pure(env/now/IO 0).
// SoT: docs/superpowers/specs/2026-06-26-g4-macro-news-ai-context-layer-design.md
//
// context.ts(buildMacroContext)는 regime/score/headline/drivers를 src.verdict에서만 파생한다.
// 따라서 FRED 경로는 raw 관측치(MacroIndicator[])뿐 아니라 MarketVerdict도 합성해야 한다.
//   - per-indicator signal은 이미 toMacroIndicator가 산출(여기선 집계만).
//   - 카테고리 평균(정규화) → present 카테고리 평균 → score = round(50 + rawScore*50).
//   - state-classification only — 예측 어휘 금지(면책은 renderMacroContextString이 부착).
// ---------------------------------------------------------------------------

// overallSignal 밴드 경계(박제 상수). MOCK_VERDICT score 62 → bullish 패리티.
export const SCORE_BAND = {
  STRONG_BULLISH_MIN: 80, // score >= 80
  BULLISH_MIN: 62, // 62 <= score < 80
  // 38 < score < 62 → neutral
  BEARISH_MAX: 38, // 20 < score <= 38
  STRONG_BEARISH_MAX: 20, // score <= 20
} as const;

// MacroCategory → mock UI 5 카테고리 라벨(verdict-panel.tsx/macro-dashboard.tsx 패리티).
// "calendar"는 buildMacroContext가 EconomicEvent 미사용 → 비대상(FRED 9 series에 없음).
const CATEGORY_LABEL: Partial<Record<MacroIndicator["category"], string>> = {
  sentiment: "시장 심리",
  economic: "물가·인플레이션",
  rates: "금리 환경",
  commodities: "원자재·환율",
  fx: "원자재·환율",
};

// details[] 노출 순서(mock 정합). commodities/fx는 단일 "원자재·환율" 라벨로 병합.
const CATEGORY_ORDER: ReadonlyArray<MacroIndicator["category"]> = [
  "sentiment",
  "economic",
  "rates",
  "commodities",
  "fx",
];

type Signal = MacroIndicator["signal"];

function signalScore(s: Signal): number {
  return s === "bullish" ? 1 : s === "bearish" ? -1 : 0;
}

function majoritySignal(signals: Signal[]): Signal {
  let net = 0;
  for (const s of signals) net += signalScore(s);
  if (net > 0) return "bullish";
  if (net < 0) return "bearish";
  return "neutral";
}

function bandToSignal(score: number): MarketVerdict["overallSignal"] {
  if (score >= SCORE_BAND.STRONG_BULLISH_MIN) return "strong_bullish";
  if (score >= SCORE_BAND.BULLISH_MIN) return "bullish";
  if (score <= SCORE_BAND.STRONG_BEARISH_MAX) return "strong_bearish";
  if (score <= SCORE_BAND.BEARISH_MAX) return "bearish";
  return "neutral";
}

const SIGNAL_KO: Record<Signal, string> = {
  bullish: "호재",
  bearish: "악재",
  neutral: "중립",
};

/**
 * FRED 지표[] → 결정론적 MarketVerdict. asOf(Z-qualified)를 verdict.updatedAt 으로 사용.
 *
 * 카테고리 정규화: 카테고리별 멤버 signal 평균 → present 카테고리 평균(rawScore -1..+1).
 *   빈 카테고리는 denominator에서 제외(false-neutral pull-to-50 차단).
 *   score = round(50 + rawScore*50). over-populated 카테고리가 score를 지배하지 않는다.
 */
export function buildVerdictFromIndicators(
  indicators: MacroIndicator[],
  asOf: string,
  totalExpected?: number,
): MarketVerdict {
  // 라벨 단위로 그룹핑(commodities + fx → "원자재·환율" 1 카테고리). present만.
  const byLabel = new Map<
    string,
    { signals: Signal[]; reasons: string[]; order: number }
  >();
  for (const cat of CATEGORY_ORDER) {
    const members = indicators.filter((i) => i.category === cat);
    if (members.length === 0) continue;
    const label = CATEGORY_LABEL[cat];
    if (!label) continue;
    const entry = byLabel.get(label) ?? {
      signals: [],
      reasons: [],
      order: CATEGORY_ORDER.indexOf(cat),
    };
    for (const m of members) {
      entry.signals.push(m.signal);
      entry.reasons.push(m.description);
    }
    if (!byLabel.has(label)) byLabel.set(label, entry);
  }

  const details: MarketVerdict["details"] = [];
  const categoryScores: number[] = [];
  const ordered = [...byLabel.entries()].sort((a, b) => a[1].order - b[1].order);
  for (const [label, entry] of ordered) {
    const catSignal = majoritySignal(entry.signals);
    const catAvg =
      entry.signals.reduce((acc, s) => acc + signalScore(s), 0) /
      entry.signals.length;
    categoryScores.push(catAvg);
    details.push({
      category: label,
      signal: catSignal,
      reason: entry.reasons.join(" "),
    });
  }

  const rawScore =
    categoryScores.length === 0
      ? 0
      : categoryScores.reduce((a, b) => a + b, 0) / categoryScores.length;
  const score = Math.round(50 + rawScore * 50);
  const overallSignal = bandToSignal(score);

  // 일부 series가 degrade로 빠지면 커버리지를 명시(편중 verdict가 "전체 국면"으로 오독되지 않도록).
  const coverageNote =
    totalExpected != null && indicators.length < totalExpected
      ? ` (유효 지표 ${indicators.length}/${totalExpected})`
      : "";
  const summary =
    details.length === 0
      ? `유효 거시 지표 없음. 종합 ${score}/100(중립).${coverageNote}`
      : `종합 ${score}/100. ${details
          .map((d) => `${d.category}(${SIGNAL_KO[d.signal]})`)
          .join(", ")}.${coverageNote}`;

  return { overallSignal, score, summary, details, updatedAt: asOf };
}
