import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  reportExistsForMonth: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
  }),
}));

vi.mock("@/lib/data/admin-reports", () => ({
  reportExistsForMonth: mocks.reportExistsForMonth,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({
    data: { user: { id: "mock-admin-1" } },
  });
  mocks.reportExistsForMonth.mockResolvedValue(true);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("regenerateReport", () => {
  it("rejects malformed month values before mutating counters", async () => {
    const { MOCK_ADMIN_REGEN_COUNTERS } = await import(
      "@/lib/data/mock-admin-regen-counters"
    );
    const initialLength = MOCK_ADMIN_REGEN_COUNTERS.length;
    const { regenerateReport } = await import("../actions");

    const result = await regenerateReport({
      ticker: "005930",
      month: "bad-month",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("invalid_month");
    expect(MOCK_ADMIN_REGEN_COUNTERS).toHaveLength(initialLength);
  });

  it("normalizes ticker before applying the monthly manual cap", async () => {
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
    const { MOCK_ADMIN_REGEN_COUNTERS } = await import(
      "@/lib/data/mock-admin-regen-counters"
    );
    const initialLength = MOCK_ADMIN_REGEN_COUNTERS.length;
    const { regenerateReport } = await import("../actions");

    const result = await regenerateReport({
      ticker: "999999",
      month: "2026-04-01",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("report_not_found");
    expect(MOCK_ADMIN_REGEN_COUNTERS).toHaveLength(initialLength);
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

  it("does not report mock regeneration as success in production-like environments", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { regenerateReport } = await import("../actions");

    const result = await regenerateReport({
      ticker: "005930",
      month: "2026-04-01",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("real_persistence_not_configured");
  });
});
