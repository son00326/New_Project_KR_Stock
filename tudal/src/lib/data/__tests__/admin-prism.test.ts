import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPrismHistorySeries,
  getPrismStaleStatus,
  isPrismSnapshotStale,
  joopickFractionToPrismPercent,
  parsePrismPayload,
  prismPercentToJoopickFraction,
} from "@/lib/data/admin-prism";

const mocks = vi.hoisted(() => {
  const state: {
    queryResult: {
      data: unknown[];
      error: { message: string } | null;
    };
  } = {
    queryResult: { data: [], error: null },
  };
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    then: vi.fn(),
  };
  return {
    state,
    chain,
    rpc: vi.fn(),
    from: vi.fn(),
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    rpc: mocks.rpc,
    from: mocks.from,
  })),
}));

const validEnvelope = {
  generated_at: "2026-07-15T17:10:00",
  trading_mode: "virtual",
  summary: { total_return: 12.3 },
  holdings: [],
  real_portfolio: [],
  account_summary: {},
  trading_history: [{ ticker: "005930" }],
  watchlist: [],
  market: "KR",
  currency: "KRW",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.queryResult = { data: [], error: null };
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.from.mockReturnValue(mocks.chain);
  mocks.chain.select.mockReturnValue(mocks.chain);
  mocks.chain.eq.mockReturnValue(mocks.chain);
  mocks.chain.in.mockReturnValue(mocks.chain);
  mocks.chain.order.mockReturnValue(mocks.chain);
  mocks.chain.then.mockImplementation((resolve: (value: unknown) => unknown) =>
    Promise.resolve(mocks.state.queryResult).then(resolve),
  );
});

describe("PRISM stale schedule", () => {
  it("walks Friday KR pm forward to Monday am before applying the grace window", () => {
    // Given: Friday's final KR snapshot.
    const latest = { market: "kr" as const, snapshotDate: "2026-07-17", snapshotSlot: "pm" as const };

    // When: the next scheduled-slot boundary is calculated.
    const status = getPrismStaleStatus(latest, new Date("2026-07-20T23:20:00+09:00"));

    // Then: Monday am is the heartbeat and equality at +12h is still fresh.
    expect(status.nextScheduledAt.toISOString()).toBe("2026-07-20T02:20:00.000Z");
    expect(status.isStale).toBe(false);
    expect(isPrismSnapshotStale(latest, new Date("2026-07-20T23:20:00.001+09:00"))).toBe(true);
  });

  it("walks Saturday US daily forward to Tuesday daily", () => {
    // Given: Saturday's US daily snapshot.
    const latest = { market: "us" as const, snapshotDate: "2026-07-18", snapshotSlot: "daily" as const };

    // When: the Tuesday slot plus grace has just elapsed.
    const status = getPrismStaleStatus(latest, new Date("2026-07-21T20:15:00.001+09:00"));

    // Then: Sunday and Monday are not treated as missing heartbeats.
    expect(status.nextScheduledAt.toISOString()).toBe("2026-07-20T23:15:00.000Z");
    expect(status.isStale).toBe(true);
  });

  it("uses a successful KR pm snapshot after a missing am slot as the new heartbeat", () => {
    // Given: Monday am was absent but Monday pm succeeded.
    const latest = { market: "kr" as const, snapshotDate: "2026-07-20", snapshotSlot: "pm" as const };

    // When: freshness is evaluated at Tuesday am plus exactly 12 hours.
    const status = getPrismStaleStatus(latest, new Date("2026-07-21T23:20:00+09:00"));

    // Then: the previous missing am does not make the recovered stream stale.
    expect(status.nextScheduledAt.toISOString()).toBe("2026-07-21T02:20:00.000Z");
    expect(status.isStale).toBe(false);
  });
});

describe("PRISM return units", () => {
  it("converts JooPick fractional returns to PRISM percentage points", () => {
    // Given/When/Then: 12.34% is represented by 0.1234 in JooPick.
    expect(joopickFractionToPrismPercent(0.1234)).toBeCloseTo(12.34);
  });

  it("converts PRISM percentage points to JooPick fractional returns", () => {
    // Given/When/Then: PRISM 12.34 percent maps back to 0.1234.
    expect(prismPercentToJoopickFraction(12.34)).toBeCloseTo(0.1234);
  });
});

describe("parsePrismPayload", () => {
  it("fails closed when a required envelope key is absent", () => {
    // Given: an object that is missing the top-level watchlist contract.
    const payload = Object.fromEntries(
      Object.entries(validEnvelope).filter(([key]) => key !== "watchlist"),
    );

    // When/Then: envelope parsing rejects instead of presenting partial data.
    expect(() => parsePrismPayload(payload, "kr")).toThrow(/envelope/i);
  });

  it("nulls one malformed section while preserving valid sibling sections", () => {
    // Given: a valid envelope with only holdings drifted from array to object.
    const payload = { ...validEnvelope, holdings: { ticker: "005930" } };

    // When: each view section is parsed independently.
    const parsed = parsePrismPayload(payload, "kr");

    // Then: holdings falls back without taking trading history down with it.
    expect(parsed.holdings).toBeNull();
    expect(parsed.tradingHistory).toEqual([{ ticker: "005930" }]);
  });

  it("applies the section item-count cap without invalidating siblings", () => {
    // Given: one oversized section beside a small valid section.
    const payload = {
      ...validEnvelope,
      holdings: Array.from({ length: 5_001 }, () => ({})),
    };

    // When: bounded section parsing runs.
    const parsed = parsePrismPayload(payload, "kr");

    // Then: only the oversized section falls back.
    expect(parsed.holdings).toBeNull();
    expect(parsed.tradingHistory).toHaveLength(1);
  });
});

describe("getPrismHistorySeries", () => {
  it("requests only the five-column history projection and never payload", async () => {
    // Given: one valid archived terminal observation.
    mocks.state.queryResult = {
      data: [
        {
          market: "kr",
          snapshot_date: "2026-07-15",
          snapshot_slot: "pm",
          market_session_date: "2026-07-15",
          terminal_performance: {
            date: "2026-07-15",
            cumulative_realized_profit: 1200,
            prism_simulator_return: 1.2,
          },
        },
      ],
      error: null,
    };

    // When: history is loaded through the authenticated admin selector.
    const result = await getPrismHistorySeries("kr");

    // Then: the transport projection excludes the multi-megabyte payload column.
    expect(mocks.chain.select).toHaveBeenCalledWith(
      "market, snapshot_date, snapshot_slot, market_session_date, terminal_performance",
    );
    expect(mocks.chain.select.mock.calls[0]?.[0]).not.toContain("payload");
    expect(result).toHaveLength(1);
  });

  it("fails closed before selecting when is_admin is false", async () => {
    // Given: RLS would otherwise disguise denial as an empty array.
    mocks.rpc.mockResolvedValue({ data: false, error: null });

    // When/Then: explicit authorization rejects before table access.
    await expect(getPrismHistorySeries("kr")).rejects.toThrow(/admin/i);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("prefers KR pm and labels am only when that date has no pm snapshot", async () => {
    // Given: one complete day and one am-only day.
    const terminal = {
      date: "2026-07-15",
      cumulative_realized_profit: 1200,
      prism_simulator_return: 1.2,
    };
    mocks.state.queryResult = {
      data: [
        { market: "kr", snapshot_date: "2026-07-15", snapshot_slot: "am", market_session_date: "2026-07-15", terminal_performance: terminal },
        { market: "kr", snapshot_date: "2026-07-15", snapshot_slot: "pm", market_session_date: "2026-07-15", terminal_performance: terminal },
        { market: "kr", snapshot_date: "2026-07-16", snapshot_slot: "am", market_session_date: "2026-07-16", terminal_performance: { ...terminal, date: "2026-07-16" } },
      ],
      error: null,
    };

    // When: rows are collapsed to one observation per snapshot date.
    const result = await getPrismHistorySeries("kr");

    // Then: pm wins when present and the fallback remains explicitly labelled am.
    expect(result.map((point) => point.snapshotSlot)).toEqual(["pm", "am"]);
  });
});
