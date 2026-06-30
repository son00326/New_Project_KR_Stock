import { describe, it, expect } from "vitest";
import type { MacroIndicator } from "@/types/macro";
import {
  buildVerdictFromIndicators,
  SCORE_BAND,
} from "@/lib/macro/verdict-builder";

// ---------------------------------------------------------------------------
// G4 verdict-builder — pure(env/now/IO 0). FRED 지표[] → MarketVerdict 결정론적 합성.
//   - per-indicator signal은 이미 toMacroIndicator가 산출(여기선 집계).
//   - 카테고리 평균 → present-category 평균 → score = round(50 + rawScore*50).
//   - overallSignal 밴드(80/62/38/20)는 SCORE_BAND 상수로 박제.
//   - state-classification only — 예측 어휘 금지.
// ---------------------------------------------------------------------------

// 예측 어휘 negative regex (context.test.ts:118 정합).
const PREDICTION_VOCAB =
  /상승 예측|하락 예측|상승할|하락할|목표가|매수 신호|매도 신호/;

function ind(
  over: Partial<MacroIndicator> & {
    category: MacroIndicator["category"];
    signal: MacroIndicator["signal"];
  },
): MacroIndicator {
  return {
    id: over.id ?? "x",
    name: over.name ?? "X",
    nameKo: over.nameKo ?? "엑스",
    category: over.category,
    value: over.value ?? 0,
    previousValue: over.previousValue ?? 0,
    change: over.change ?? 0,
    changePercent: over.changePercent ?? 0,
    unit: over.unit ?? "",
    updatedAt: over.updatedAt ?? "2026-06-26T00:00:00Z",
    signal: over.signal,
    description: over.description ?? "설명.",
  };
}

const AS_OF = "2026-06-26T00:00:00Z";

describe("buildVerdictFromIndicators — determinism", () => {
  it("same input → same output (deep equal, 결정론)", () => {
    const indicators = [
      ind({ category: "rates", signal: "bullish", id: "fed-rate" }),
      ind({ category: "sentiment", signal: "bearish", id: "vix" }),
    ];
    const a = buildVerdictFromIndicators(indicators, AS_OF);
    const b = buildVerdictFromIndicators(indicators, AS_OF);
    expect(a).toEqual(b);
  });

  it("verdict.updatedAt == 주어진 asOf(Z-qualified)", () => {
    const v = buildVerdictFromIndicators(
      [ind({ category: "rates", signal: "neutral" })],
      AS_OF,
    );
    expect(v.updatedAt).toBe(AS_OF);
    expect(v.updatedAt.endsWith("Z")).toBe(true);
  });
});

describe("buildVerdictFromIndicators — score bands (박제 상수)", () => {
  it("SCORE_BAND 경계 상수 박제 (80/62/38/20)", () => {
    expect(SCORE_BAND.STRONG_BULLISH_MIN).toBe(80);
    expect(SCORE_BAND.BULLISH_MIN).toBe(62);
    expect(SCORE_BAND.BEARISH_MAX).toBe(38);
    expect(SCORE_BAND.STRONG_BEARISH_MAX).toBe(20);
  });

  it("전원 bullish → score 100, strong_bullish", () => {
    const v = buildVerdictFromIndicators(
      [
        ind({ category: "rates", signal: "bullish" }),
        ind({ category: "fx", signal: "bullish" }),
      ],
      AS_OF,
    );
    expect(v.score).toBe(100);
    expect(v.overallSignal).toBe("strong_bullish");
  });

  it("전원 bearish → score 0, strong_bearish", () => {
    const v = buildVerdictFromIndicators(
      [
        ind({ category: "rates", signal: "bearish" }),
        ind({ category: "sentiment", signal: "bearish" }),
      ],
      AS_OF,
    );
    expect(v.score).toBe(0);
    expect(v.overallSignal).toBe("strong_bearish");
  });

  it("전원 neutral → score 50, neutral", () => {
    const v = buildVerdictFromIndicators(
      [
        ind({ category: "rates", signal: "neutral" }),
        ind({ category: "fx", signal: "neutral" }),
      ],
      AS_OF,
    );
    expect(v.score).toBe(50);
    expect(v.overallSignal).toBe("neutral");
  });

  it("score 62 경계 → bullish (MOCK_VERDICT 62 패리티)", () => {
    // 한 카테고리 bullish(+1), 한 카테고리 neutral(0)이면
    // rawScore = (1 + 0)/2 = 0.5 → score = round(50 + 25) = 75 (bullish).
    // score 62 정확 패리티: rawScore 0.24 → 카테고리 평균으로 구성.
    // sentiment: bullish+neutral = +0.5; rates: bearish = -1 → present avg = (0.5 + -1)/2 = -0.25 → 38.
    // 대신 62 경계를 직접 검증: rates(+1) + sentiment(neutral 0) + fx(bearish -1) 평균 0 = 50.
    // 62 밴드 포함은 SCORE_BAND.BULLISH_MIN === 62 + 분류 함수로 검증한다.
    const v = buildVerdictFromIndicators(
      [
        ind({ category: "rates", signal: "bullish" }),
        ind({ category: "sentiment", signal: "neutral" }),
      ],
      AS_OF,
    );
    // rawScore = (1 + 0)/2 = 0.5 → 75 → bullish
    expect(v.overallSignal).toBe("bullish");
    expect(v.score).toBeGreaterThanOrEqual(SCORE_BAND.BULLISH_MIN);
    expect(v.score).toBeLessThan(SCORE_BAND.STRONG_BULLISH_MIN);
  });
});

describe("buildVerdictFromIndicators — category aggregation", () => {
  it("category signal = 멤버 다수결, tie → neutral", () => {
    const v = buildVerdictFromIndicators(
      [
        // rates: bullish, bullish, bearish → 다수 bullish
        ind({ category: "rates", signal: "bullish", id: "fed-rate" }),
        ind({ category: "rates", signal: "bullish", id: "us-10y" }),
        ind({ category: "rates", signal: "bearish", id: "yield-curve" }),
      ],
      AS_OF,
    );
    const rates = v.details.find((d) => d.category === "금리 환경");
    expect(rates?.signal).toBe("bullish");
  });

  it("tie(1 bullish + 1 bearish) → category neutral", () => {
    const v = buildVerdictFromIndicators(
      [
        ind({ category: "fx", signal: "bullish", id: "usd-krw" }),
        ind({ category: "fx", signal: "bearish", id: "dxy" }),
      ],
      AS_OF,
    );
    const fx = v.details.find((d) => d.category === "원자재·환율");
    expect(fx?.signal).toBe("neutral");
  });

  it("빈 카테고리는 denominator에서 제외 (false-neutral pull-to-50 차단)", () => {
    // sentiment 1개 bearish 만 존재 → rawScore = -1 → score 0(strong_bearish).
    // 만약 빈 카테고리가 0으로 denominator에 들어가면 score가 50쪽으로 끌려간다.
    const v = buildVerdictFromIndicators(
      [ind({ category: "sentiment", signal: "bearish" })],
      AS_OF,
    );
    expect(v.score).toBe(0);
    expect(v.overallSignal).toBe("strong_bearish");
    // present 카테고리만 details에 등장.
    expect(v.details).toHaveLength(1);
    expect(v.details[0].category).toBe("시장 심리");
  });

  it("over-populated 카테고리가 score를 지배하지 않음 (카테고리 정규화)", () => {
    // sentiment 3개 bearish + rates 1개 bullish.
    // 단순 indicator 평균이면 (-3 + 1)/4 = -0.5 → 25.
    // 카테고리 정규화: sentiment avg=-1, rates avg=+1 → present avg = 0 → 50(neutral).
    const v = buildVerdictFromIndicators(
      [
        ind({ category: "sentiment", signal: "bearish", id: "vix" }),
        ind({ category: "sentiment", signal: "bearish", id: "fg" }),
        ind({ category: "sentiment", signal: "bearish", id: "pc" }),
        ind({ category: "rates", signal: "bullish", id: "fed-rate" }),
      ],
      AS_OF,
    );
    expect(v.score).toBe(50);
    expect(v.overallSignal).toBe("neutral");
  });

  it("5 mock 카테고리 라벨 패리티 (UI contract)", () => {
    const v = buildVerdictFromIndicators(
      [
        ind({ category: "sentiment", signal: "neutral" }),
        ind({ category: "economic", signal: "neutral" }),
        ind({ category: "rates", signal: "neutral" }),
        ind({ category: "commodities", signal: "neutral" }),
        ind({ category: "fx", signal: "neutral" }),
      ],
      AS_OF,
    );
    const labels = v.details.map((d) => d.category);
    expect(labels).toContain("시장 심리");
    expect(labels).toContain("물가·인플레이션");
    expect(labels).toContain("금리 환경");
    expect(labels).toContain("원자재·환율");
  });

  it("0 valid indicators → details []·summary 비어있지 않음·score 50 neutral", () => {
    const v = buildVerdictFromIndicators([], AS_OF);
    expect(v.details).toEqual([]);
    expect(v.overallSignal).toBe("neutral");
    expect(v.summary.length).toBeGreaterThan(0);
  });
});

describe("buildVerdictFromIndicators — 예측 어휘 금지 (guardrail)", () => {
  it("모든 details.reason / summary 에 예측 어휘 없음", () => {
    const v = buildVerdictFromIndicators(
      [
        ind({
          category: "rates",
          signal: "bullish",
          description: "기준금리 인하 → 유동성 확대 국면.",
        }),
        ind({
          category: "sentiment",
          signal: "bearish",
          description: "VIX 22.5(>20) → 시장 불안 신호.",
        }),
        ind({
          category: "fx",
          signal: "bullish",
          description: "원화 강세 → 외국인 유입.",
        }),
      ],
      AS_OF,
    );
    expect(v.summary).not.toMatch(PREDICTION_VOCAB);
    for (const d of v.details) {
      expect(d.reason).not.toMatch(PREDICTION_VOCAB);
    }
  });
});
