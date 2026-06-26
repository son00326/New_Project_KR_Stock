import type { ActionTaken } from "@/lib/news/m12a/types";

// ---------------------------------------------------------------------------
// M12a — 부정 뉴스 재진입 컨텍스트 (R3.10-7c).
//   직전 자동제외/shadow 후보를 다음 선정 prompt에 "AI 컨텍스트 입력"으로 주입.
//   범주 분리(코드 불변식): context이지 forecast가 아니다 — 예측/전망 어휘 금지,
//   Tier0 스크리닝 팩터도 아니다(G4 macro와 동일한 격리).
//   additive · forward-validate · ₩0 · pure (env/IO/Date.now 없음).
// ---------------------------------------------------------------------------

export interface NegativeNewsItem {
  ticker: string;
  thesisBreakReason: string | null;
  newsTitle: string;
  actionTaken: ActionTaken;
  asOf: string; // ISO 또는 YYYY-MM-DD (date-only로 절단)
}

const HEADER =
  "[최근 부정 뉴스 컨텍스트 · AI 컨텍스트 입력(예측 아님 · Tier0 스크리닝 팩터 아님)]";

const REASON_MAX = 30;
const DEFAULT_MAX_ITEMS = 10;

// 30자 초과 시에만 앞 30자 + … (정확히 30자는 절단 안 함).
function truncateReason(reason: string): string {
  return reason.length > REASON_MAX
    ? `${reason.slice(0, REASON_MAX)}…`
    : reason;
}

export function buildNegativeNewsContext(
  items: NegativeNewsItem[],
  opts?: { maxItems?: number },
): string {
  if (items.length === 0) return ""; // dormant — consumer는 아무것도 덧붙이지 않음

  const maxItems = opts?.maxItems ?? DEFAULT_MAX_ITEMS;
  const lines = items.slice(0, maxItems).map((item) => {
    const reason = truncateReason(item.thesisBreakReason ?? item.newsTitle);
    const asOfDate = item.asOf.slice(0, 10); // YYYY-MM-DD
    return `${item.ticker}: ${reason} (${item.actionTaken}, asOf ${asOfDate})`;
  });

  return [HEADER, ...lines].join("\n");
}
