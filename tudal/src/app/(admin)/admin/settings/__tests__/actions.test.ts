import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({
    data: { user: { id: "mock-admin-1" } },
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("settings actions", () => {
  it("rejects malformed intraday mode values", async () => {
    const { setIntradayMode } = await import("../actions");

    const result = await setIntradayMode("false" as unknown as boolean);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("invalid_intraday_mode");
  });

  it("rejects malformed ticker alert enabled values", async () => {
    const { setTickerAlertEnabled } = await import("../actions");

    const result = await setTickerAlertEnabled(
      "005930",
      "false" as unknown as boolean,
    );

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("invalid_ticker_alert_enabled");
  });

  it("rejects malformed ticker values instead of throwing", async () => {
    const { setTickerAlertEnabled } = await import("../actions");

    const result = await setTickerAlertEnabled(
      null as unknown as string,
      true,
    );

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("invalid_ticker");
  });

  it("fails closed when auth lookup fails in production-like environments", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mocks.getUser.mockRejectedValue(new Error("auth down"));
    const { setIntradayMode } = await import("../actions");

    const result = await setIntradayMode(true);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("auth_unavailable");
  });

  it("does not report mock settings persistence as success in production-like environments", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { setIntradayMode, setTickerAlertEnabled } = await import("../actions");

    const modeResult = await setIntradayMode(true);
    const tickerResult = await setTickerAlertEnabled("005930", true);

    expect(modeResult.success).toBe(false);
    if (!modeResult.success) expect(modeResult.error).toBe("real_persistence_not_configured");
    expect(tickerResult.success).toBe(false);
    if (!tickerResult.success) expect(tickerResult.error).toBe("real_persistence_not_configured");
  });
});
