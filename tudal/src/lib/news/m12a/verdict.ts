import type {
  PerTickerAssessment,
  RecommendedAction,
} from "@/lib/news/m12a/types";

// ---------------------------------------------------------------------------
// M12a per-ticker 최종 판정 (R3.10-6/7, 결정론).
//   AI self-report(recommended_action)는 신뢰하지 않고 구조화 필드에서 파생한다.
//   auto_remove IFF 5조건 동시 충족:
//     thesisBreak && directness=direct && materiality=high
//     && confidence=high && affectedTickers.includes(ticker).
//   그 외 전부 alert_only.
//   scope(company|sector|market|unknown)는 메타데이터일 뿐 게이트가 아니다 —
//     market/sector-scope 뉴스라도 위 5조건이면 여전히 auto_remove.
//   hold_for_review는 절대 산출하지 않는다(brake의 run-level 책임).
// ---------------------------------------------------------------------------
export function decideRecommendedAction(
  a: PerTickerAssessment,
): RecommendedAction {
  const qualifiesForAutoRemove =
    a.thesisBreak === true &&
    a.directness === "direct" &&
    a.materiality === "high" &&
    a.confidence === "high" &&
    a.affectedTickers.includes(a.ticker);

  return qualifiesForAutoRemove ? "auto_remove" : "alert_only";
}
