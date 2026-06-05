// W3b-2b (D4/T1) — proposal 기반 snapshot row 구성 (pure, money-path).
//   proposal.positions(편입 종목만) → per-position snapshot(weight=proposal weight) + aggregate row(ticker=NULL, weight=1).
//   entry_price 누락/≤0 → throw entry_price_unavailable(부분 snapshot 금지 — caller가 catch해 전체 거부).
//   cash는 implicit(aggregate weight=1 = 포트 전체, equity sum=1-cashWeight). 명시 cash row=W3b-2c.
import type { PortfolioProposal } from "@/lib/ai/portfolio-proposal-client";
import type { NewPortfolioSnapshot } from "@/lib/data/admin-snapshots";

export function buildSnapshotRowsFromProposal(input: {
  positions: PortfolioProposal["positions"];
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
  // 명시적 cash row(isCash=true, weight=cashWeight)는 W3b-2c 분리.
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

  return snapshots;
}
