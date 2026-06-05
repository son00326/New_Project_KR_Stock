// W3b-2b (D4/T1) — proposal 기반 snapshot row 구성 (pure, money-path).
//   proposal.positions(편입 종목만) → per-position snapshot(weight=proposal weight) + aggregate row(ticker=NULL, weight=1).
//   entry_price 누락/≤0 → throw entry_price_unavailable(부분 snapshot 금지 — caller가 catch해 전체 거부).
// W3b-2c — 명시 cash 행(Option B: ticker=NULL, is_cash=true, weight=cashWeight)을 emitCashRow 게이트로 선택 추가.
//   cash-implicit(aggregate weight=1=포트 전체, equity sum=1-cashWeight)는 이미 consumer-safe라 off가 기본(behavior-neutral).
//   consumer는 is_cash=false / ticker IS NOT NULL 필터로 cash 행을 제외(코드 무변경). 0035 CHECK가 invariant(is_cash⟹ticker null) 강제.
import type { PortfolioProposal } from "@/lib/ai/portfolio-proposal-client";
import type { NewPortfolioSnapshot } from "@/lib/data/admin-snapshots";

export function buildSnapshotRowsFromProposal(input: {
  positions: PortfolioProposal["positions"];
  cashWeight: number; // proposal.cashWeight (0..0.3) — emitCashRow 시 명시 cash 행 weight.
  emitCashRow: boolean; // PORTFOLIO_EXPLICIT_CASH_ROW_ENABLED. off → cash 행 생략(implicit, 0035 미적용 안전).
  priceMap: Map<string, number>;
  month: string; // YYYY-MM-01
  acceptDate: string; // YYYY-MM-DD
}): NewPortfolioSnapshot[] {
  const snapshots: NewPortfolioSnapshot[] = [];

  for (const pos of input.positions) {
    // 누락(priceMap에 없음) 또는 ≤0 → 전체 거부(부분 snapshot 금지, money-path 안전). W3a 패턴 동형.
    const entryPrice = input.priceMap.get(pos.ticker);
    if (entryPrice == null || entryPrice <= 0) {
      throw new Error("entry_price_unavailable");
    }
    snapshots.push({
      date: input.acceptDate,
      month: input.month,
      ticker: pos.ticker,
      entryPrice,
      currentPrice: entryPrice,
      weight: pos.weight, // W3b-2b — AI proposal weight (현 suggestedWeight 대체).
      isCash: false,
      dailyReturn: 0,
      totalReturn: 0,
      kospiReturn: 0,
      alpha: 0,
      sharpe: 0,
    });
  }

  // E5 contract: ticker=NULL aggregate row(weight=1 = 포트 전체). cash implicit(1 - equity sum).
  snapshots.push({
    date: input.acceptDate,
    month: input.month,
    ticker: null,
    entryPrice: 0,
    currentPrice: 0,
    weight: 1,
    isCash: false,
    dailyReturn: 0,
    totalReturn: 0,
    kospiReturn: 0,
    alpha: 0,
    sharpe: 0,
  });

  // W3b-2c — 명시 cash 행(Option B). emitCashRow(flag) + cashWeight>0일 때만. aggregate 행과 별개(ticker=NULL but is_cash=true).
  //   0035 인덱스 분할(date,is_cash) + CHECK(not is_cash or ticker null)가 DB invariant 강제. flag off면 implicit 유지(현 동작 불변).
  if (input.emitCashRow && input.cashWeight > 0) {
    snapshots.push({
      date: input.acceptDate,
      month: input.month,
      ticker: null,
      entryPrice: 0,
      currentPrice: 0,
      weight: input.cashWeight,
      isCash: true,
      dailyReturn: 0,
      totalReturn: 0,
      kospiReturn: 0,
      alpha: 0,
      sharpe: 0,
    });
  }

  return snapshots;
}
