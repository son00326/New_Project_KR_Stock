import type { CashoutRecord } from "@/lib/news/m12a/types";

// ---------------------------------------------------------------------------
// M12a — cashout (GAP2) · removed 종목의 가상 EOD 청산 레코드 빌더
// fail-closed: price가 유한 양수가 아니거나 priceBasisDate가 비면 null 반환
//   → 가격 미확정 시 가상 청산 기록을 만들지 않는다(R3.10-7c GAP2).
// SoT: docs/superpowers/specs/2026-06-26-m12a-news-auto-remove-shadow-first.md
// ---------------------------------------------------------------------------

export function buildCashoutRecord(input: {
  ticker: string;
  price: number;
  priceBasisDate: string;
}): CashoutRecord | null {
  if (!Number.isFinite(input.price) || input.price <= 0 || !input.priceBasisDate) {
    return null;
  }
  return {
    ticker: input.ticker,
    price: input.price,
    priceBasisDate: input.priceBasisDate,
    priceSource: "KRX_EOD",
    executionAssumption: "virtual_eod",
  };
}
