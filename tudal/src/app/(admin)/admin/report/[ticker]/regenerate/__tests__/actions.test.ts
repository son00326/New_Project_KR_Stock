import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  reportExistsForMonth: vi.fn(),
  incrementManualRegenCount: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
  }),
}));

vi.mock("@/lib/data/admin-reports", () => ({
  reportExistsForMonth: mocks.reportExistsForMonth,
}));

vi.mock("@/lib/data/admin-regen-counters", () => ({
  incrementManualRegenCount: mocks.incrementManualRegenCount,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({
    data: { user: { id: "mock-admin-1" } },
  });
  mocks.reportExistsForMonth.mockResolvedValue(true);
  mocks.incrementManualRegenCount.mockResolvedValue({
    ok: true,
    manualCount: 1,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("regenerateReport", () => {
  it("rejects malformed month values before touching the counter", async () => {
    const { regenerateReport } = await import("../actions");

    const result = await regenerateReport({
      ticker: "005930",
      month: "bad-month",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("invalid_month");
    expect(mocks.incrementManualRegenCount).not.toHaveBeenCalled();
  });

  it("normalizes ticker before applying the monthly manual cap", async () => {
    const calls: string[] = [];
    mocks.incrementManualRegenCount.mockImplementation(
      async (ticker: string, month: string) => {
        calls.push(`${ticker}|${month}`);
        if (calls.length <= 2) return { ok: true, manualCount: calls.length };
        return { ok: false, reason: "cap_exhausted", manualCount: 2 };
      },
    );
    const { regenerateReport } = await import("../actions");

    const first = await regenerateReport({
      ticker: "035420 ",
      month: "2026-04-01",
    });
    const second = await regenerateReport({
      ticker: "035420",
      month: "2026-04-01",
    });
    const third = await regenerateReport({
      ticker: " 035420",
      month: "2026-04-01",
    });

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(third.success).toBe(false);
    if (!third.success) expect(third.error).toBe("manual_cap_exhausted");
    expect(calls).toEqual([
      "035420|2026-04-01",
      "035420|2026-04-01",
      "035420|2026-04-01",
    ]);
  });

  it("rejects malformed payload values instead of throwing", async () => {
    const { regenerateReport } = await import("../actions");

    const result = await regenerateReport({
      ticker: null,
      month: 20260401,
    } as unknown as Parameters<typeof regenerateReport>[0]);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("invalid_input");
  });

  it("rejects non-object payloads instead of throwing", async () => {
    const { regenerateReport } = await import("../actions");

    const result = await regenerateReport(
      null as unknown as Parameters<typeof regenerateReport>[0],
    );

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("invalid_input");
  });

  it("rejects syntactically valid tickers that have no report for the month", async () => {
    mocks.reportExistsForMonth.mockResolvedValueOnce(false);
    const { regenerateReport } = await import("../actions");

    const result = await regenerateReport({
      ticker: "999999",
      month: "2026-04-01",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("report_not_found");
    expect(mocks.incrementManualRegenCount).not.toHaveBeenCalled();
  });

  it("returns report_lookup_failed when Supabase select throws", async () => {
    mocks.reportExistsForMonth.mockRejectedValueOnce(new Error("rls denied"));
    const { regenerateReport } = await import("../actions");

    const result = await regenerateReport({
      ticker: "005930",
      month: "2026-04-01",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("report_lookup_failed");
  });

  it("fails closed when auth lookup fails in production-like environments", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mocks.getUser.mockRejectedValue(new Error("auth down"));
    const { regenerateReport } = await import("../actions");

    const result = await regenerateReport({
      ticker: "005930",
      month: "2026-04-01",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("auth_unavailable");
  });

  it("returns success with manualRemaining when increment succeeds", async () => {
    mocks.incrementManualRegenCount.mockResolvedValueOnce({
      ok: true,
      manualCount: 1,
    });
    const { regenerateReport } = await import("../actions");

    const result = await regenerateReport({
      ticker: "005930",
      month: "2026-04-01",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.manualCount).toBe(1);
      expect(result.data.manualRemaining).toBe(1);
    }
    expect(mocks.incrementManualRegenCount).toHaveBeenCalledWith(
      "005930",
      "2026-04-01",
    );
  });

  it("returns manual_cap_exhausted when data layer reports cap reached", async () => {
    mocks.incrementManualRegenCount.mockResolvedValueOnce({
      ok: false,
      reason: "cap_exhausted",
      manualCount: 2,
    });
    const { regenerateReport } = await import("../actions");

    const result = await regenerateReport({
      ticker: "005930",
      month: "2026-04-01",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("manual_cap_exhausted");
  });

  it("maps lookup failures to regen_counter_lookup_failed", async () => {
    mocks.incrementManualRegenCount.mockRejectedValueOnce(
      new Error("regen_counter lookup failed: rls denied"),
    );
    const { regenerateReport } = await import("../actions");

    const result = await regenerateReport({
      ticker: "005930",
      month: "2026-04-01",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("regen_counter_lookup_failed");
  });

  it("maps insert/update failures to regen_counter_write_failed", async () => {
    mocks.incrementManualRegenCount.mockRejectedValueOnce(
      new Error("regen_counter update failed: connection broken"),
    );
    const { regenerateReport } = await import("../actions");

    const result = await regenerateReport({
      ticker: "005930",
      month: "2026-04-01",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("regen_counter_write_failed");
  });

  it("maps CAS race losses to regen_counter_write_conflict", async () => {
    mocks.incrementManualRegenCount.mockRejectedValueOnce(
      new Error("regen_counter write conflict"),
    );
    const { regenerateReport } = await import("../actions");

    const result = await regenerateReport({
      ticker: "005930",
      month: "2026-04-01",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("regen_counter_write_conflict");
  });
});
