import { describe, it, expect } from "vitest";
import { decideRecommendedAction } from "@/lib/news/m12a/verdict";
import type { M12aScope, PerTickerAssessment } from "@/lib/news/m12a/types";

// ---------------------------------------------------------------------------
// R3.10-6/7 — recommended_action 결정론 파생 (AI self-report 미신뢰).
//   auto_remove IFF (thesisBreak && direct && materiality=high && confidence=high
//                    && affectedTickers.includes(ticker)). 그 외 alert_only.
//   hold_for_review는 절대 per-ticker에서 산출 안 함(brake run-level 책임).
//   scope는 메타데이터 — 게이트 아님.
// ---------------------------------------------------------------------------

// 5개 자동제외 조건이 모두 충족된 base fixture.
function fullPositive(
  overrides: Partial<PerTickerAssessment> = {},
): PerTickerAssessment {
  return {
    ticker: "005930",
    surface: "list",
    track: "short",
    scope: "company",
    severity: "critical",
    confidence: "high",
    materiality: "high",
    directness: "direct",
    thesisBreak: true,
    thesisBreakReason: "실적 가이던스 하향 + 핵심 고객 이탈",
    affectedTickers: ["005930", "000660"],
    newsEventId: "evt-1",
    newsTitle: "삼성전자 어닝 쇼크",
    newsUrl: "https://example.com/news/1",
    ...overrides,
  };
}

describe("decideRecommendedAction", () => {
  it("5개 조건 모두 충족 → auto_remove", () => {
    expect(decideRecommendedAction(fullPositive())).toBe("auto_remove");
  });

  it("thesisBreak=false면 → alert_only (조건 1 flip)", () => {
    expect(decideRecommendedAction(fullPositive({ thesisBreak: false }))).toBe(
      "alert_only",
    );
  });

  it("directness='indirect'면 → alert_only (조건 2 flip)", () => {
    expect(
      decideRecommendedAction(fullPositive({ directness: "indirect" })),
    ).toBe("alert_only");
  });

  it("materiality='medium'면 → alert_only (조건 3 flip)", () => {
    expect(
      decideRecommendedAction(fullPositive({ materiality: "medium" })),
    ).toBe("alert_only");
  });

  it("confidence='medium'면 → alert_only (조건 4 flip)", () => {
    expect(
      decideRecommendedAction(fullPositive({ confidence: "medium" })),
    ).toBe("alert_only");
  });

  it("ticker가 affectedTickers에 없으면 → alert_only (조건 5 flip)", () => {
    expect(
      decideRecommendedAction(
        fullPositive({ ticker: "005930", affectedTickers: ["000660", "035720"] }),
      ),
    ).toBe("alert_only");
  });

  it("scope='market'이어도 나머지 5조건 충족이면 → auto_remove (scope는 게이트 아님)", () => {
    expect(
      decideRecommendedAction(fullPositive({ scope: "market" })),
    ).toBe("auto_remove");
  });

  it("모든 scope 값에서 5조건 충족이면 → auto_remove (scope 메타데이터 불변식)", () => {
    const scopes: M12aScope[] = ["company", "sector", "market", "unknown"];
    for (const scope of scopes) {
      expect(decideRecommendedAction(fullPositive({ scope }))).toBe(
        "auto_remove",
      );
    }
  });

  it("뉴스 무영향(no-break, indirect, medium, medium, 미영향) → alert_only", () => {
    const neutral = fullPositive({
      thesisBreak: false,
      thesisBreakReason: null,
      directness: "indirect",
      materiality: "medium",
      confidence: "medium",
      affectedTickers: [],
    });
    expect(decideRecommendedAction(neutral)).toBe("alert_only");
  });

  it("어떤 입력에서도 hold_for_review를 절대 반환하지 않음", () => {
    const battery: PerTickerAssessment[] = [
      fullPositive(),
      fullPositive({ thesisBreak: false }),
      fullPositive({ directness: "indirect" }),
      fullPositive({ materiality: "low" }),
      fullPositive({ confidence: "low" }),
      fullPositive({ affectedTickers: [] }),
      fullPositive({ scope: "sector", thesisBreak: false, directness: "indirect" }),
    ];
    for (const a of battery) {
      expect(decideRecommendedAction(a)).not.toBe("hold_for_review");
    }
  });
});
