// W3b-3 (T1) — portfolio_proposal 표시용 view 헬퍼 (pure, client/server import 가능 — no directive).
//   proposal.positions(ticker만) + shortlist {ticker,name,sector} view model → 표시용 enriched positions.
//   client island(PortfolioPanel)에 plain object만 전달되도록 server에서 view model 구성 후 join.
import type { PortfolioProposal } from "@/lib/ai/portfolio-proposal-client";
import type { BucketKind } from "@/types/admin";

export interface ShortlistNameItem {
  ticker: string;
  name: string;
  sector: string;
}

export interface ProposalPositionView {
  ticker: string;
  name: string;
  sector: string;
  weight: number;
  timeframe: BucketKind;
}

/** positions를 shortlist view model의 name/sector로 enrich. 미존재 ticker → name=ticker fallback, sector=''. */
export function enrichProposalPositions(
  positions: PortfolioProposal["positions"],
  viewModel: readonly ShortlistNameItem[],
): ProposalPositionView[] {
  const byTicker = new Map(viewModel.map((v) => [v.ticker, v]));
  return positions.map((p) => {
    const v = byTicker.get(p.ticker);
    return {
      ticker: p.ticker,
      name: v?.name ?? p.ticker,
      sector: v?.sector ?? "",
      weight: p.weight,
      timeframe: p.timeframe,
    };
  });
}

export interface ProposalSummary {
  positionCount: number;
  equityWeightPct: number; // sum(positions.weight) * 100
  cashPct: number; // cashWeight * 100
}

export function computeProposalSummary(
  proposal: PortfolioProposal,
): ProposalSummary {
  const equity = proposal.positions.reduce((s, p) => s + p.weight, 0);
  return {
    positionCount: proposal.positions.length,
    equityWeightPct: equity * 100,
    cashPct: proposal.cashWeight * 100,
  };
}
