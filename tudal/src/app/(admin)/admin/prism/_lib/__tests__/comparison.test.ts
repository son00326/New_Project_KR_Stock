import { describe, expect, it } from "vitest";

import type { PrismHistoryPoint } from "@/lib/data/admin-prism";

import {
  actualEntryTickers,
  buildComparisonSeries,
  maxDate,
} from "../comparison";
import { formatPrismTooltipName } from "../comparison-tooltip";

function historyPoint(
  date: string,
  prismSimulatorReturn: number,
  snapshotSlot: "am" | "pm" = "pm",
): PrismHistoryPoint {
  return {
    market: "kr",
    snapshotDate: date,
    snapshotSlot,
    marketSessionDate: date,
    terminalPerformance: {
      date,
      cumulativeRealizedProfit: 0,
      prismSimulatorReturn,
    },
  };
}

describe("PRISM comparison series", () => {
  it("chooses the later benchmark start date", () => {
    // Given/When/Then: upstream history cannot move the aligned period before JooPick exists.
    expect(maxDate("2026-01-01", "2026-02-01")).toBe("2026-02-01");
    expect(maxDate("2026-03-01", "2026-02-01")).toBe("2026-03-01");
  });

  it("filters upstream history, subtracts both baselines, converts units, and sorts dates", () => {
    // Given: unsorted PRISM and JooPick observations including pre-benchmark contamination.
    const history = [
      historyPoint("2026-01-03", 15),
      historyPoint("2025-12-31", 100),
      historyPoint("2026-01-01", 10, "am"),
      historyPoint("2026-01-02", 12),
    ];
    const joopick = [
      { date: "2026-01-03", totalReturn: 0.16 },
      { date: "2025-12-31", totalReturn: 0.8 },
      { date: "2026-01-01", totalReturn: 0.1 },
      { date: "2026-01-02", totalReturn: 0.13 },
    ];

    // When: both tracks are aligned to the fixed start date.
    const result = buildComparisonSeries(history, joopick, "kr", "2026-01-01");

    // Then: each track starts at zero in percentage-point units and remains chronological.
    expect(result.map((point) => point.date)).toEqual([
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
    ]);
    expect(result.map((point) => point.prism)).toEqual([0, 2, 5]);
    expect(result.map((point) => point.joopick)).toEqual([0, 3, 6]);
    expect(result[0]?.slot).toBe("am");
  });

  it("uses only trading history and holdings for actual entry tickers", () => {
    // Given: an unentered watchlist ticker beside two actual entry sources.
    const payload = {
      tradingHistory: [{ ticker: "005930" }],
      holdings: [{ ticker: "000660" }],
      watchlist: [{ ticker: "035420" }],
    };

    // When: actual entries are collected.
    const result = actualEntryTickers(payload);

    // Then: watchlist candidates cannot inflate pick overlap.
    expect([...result].sort()).toEqual(["000660", "005930"]);
  });

  it("labels only PRISM am observations as fallback in tooltips", () => {
    // Given/When/Then: an am slot is explicit while pm and JooPick labels remain stable.
    expect(formatPrismTooltipName("프리즘", { payload: { slot: "am" } })).toBe("프리즘 (AM 대체)");
    expect(formatPrismTooltipName("프리즘", { payload: { slot: "pm" } })).toBe("프리즘");
    expect(formatPrismTooltipName("주픽", { payload: { slot: "am" } })).toBe("주픽");
  });
});
