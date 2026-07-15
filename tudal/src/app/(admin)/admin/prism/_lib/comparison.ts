import {
  joopickFractionToPrismPercent,
  type ParsedPrismPayload,
  type PrismHistoryPoint,
  type PrismMarket,
} from "@/lib/data/admin-prism";

import type { JoopickPerformancePoint } from "./joopick-series";
import { tickerOf } from "./section-values";

export interface PrismComparisonPoint {
  readonly date: string;
  readonly prism: number;
  readonly joopick?: number;
  readonly slot?: "am" | "pm" | "daily";
}

export function maxDate(left: string, right: string): string {
  return left >= right ? left : right;
}

export function buildComparisonSeries(
  history: readonly PrismHistoryPoint[],
  joopick: readonly JoopickPerformancePoint[],
  market: PrismMarket,
  startDate: string,
): readonly PrismComparisonPoint[] {
  const prism = history
    .filter((point) => point.marketSessionDate >= startDate && point.terminalPerformance !== null)
    .toSorted((left, right) => left.marketSessionDate.localeCompare(right.marketSessionDate));
  const joopickAligned = market === "kr"
    ? joopick
      .filter((point) => point.date >= startDate)
      .toSorted((left, right) => left.date.localeCompare(right.date))
    : [];
  const prismBaseline = prism[0]?.terminalPerformance?.prismSimulatorReturn ?? 0;
  const joopickBaseline = joopickAligned[0] === undefined
    ? 0
    : joopickFractionToPrismPercent(joopickAligned[0].totalReturn);

  return prism.flatMap((point) => {
    if (point.terminalPerformance === null) return [];
    const alignedJoopick = joopickAligned
      .filter((candidate) => candidate.date <= point.marketSessionDate)
      .at(-1);
    const base = {
      date: point.marketSessionDate,
      prism: point.terminalPerformance.prismSimulatorReturn - prismBaseline,
      slot: point.snapshotSlot,
    };
    return alignedJoopick === undefined ? [base] : [{
      ...base,
      joopick: joopickFractionToPrismPercent(alignedJoopick.totalReturn) - joopickBaseline,
    }];
  });
}

export function actualEntryTickers(
  payload: Pick<ParsedPrismPayload, "tradingHistory" | "holdings">,
): ReadonlySet<string> {
  const entries = [...(payload.tradingHistory ?? []), ...(payload.holdings ?? [])];
  return new Set(entries.map(tickerOf).filter((ticker): ticker is string => ticker !== null));
}
