// settings actions.test.ts — 58차 Mock cleanup Step 2.2
//
// WRITE 경로 (setIntradayMode + setTickerAlertEnabled)는 모든 환경에서
// `real_persistence_not_configured` boundary 반환 (Step 2.1 recordExitDecision +
// Step 1.3 lesson "가짜 성공 응답 금지" 정합). S5b real persistence RPC 연결 시 교체.

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
    data: { user: { id: "00000000-0000-0000-0000-000000000abc" } },
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("setIntradayMode", () => {
  it("rejects malformed intraday mode value (string)", async () => {
    const { setIntradayMode } = await import("../actions");
    const result = await setIntradayMode("false" as unknown as boolean);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("invalid_intraday_mode");
  });

  it("returns auth_unavailable when getUser returns no user (production env)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const { setIntradayMode } = await import("../actions");
    const result = await setIntradayMode(true);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("auth_unavailable");
  });

  it("returns auth_unavailable when getUser throws (development env, no MOCK fallback)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    mocks.getUser.mockRejectedValue(new Error("auth down"));
    const { setIntradayMode } = await import("../actions");
    const result = await setIntradayMode(true);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("auth_unavailable");
  });

  it("returns real_persistence_not_configured boundary in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { setIntradayMode } = await import("../actions");
    const result = await setIntradayMode(true);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error).toBe("real_persistence_not_configured");
  });

  it("returns real_persistence_not_configured boundary in development (no mock mutation)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { setIntradayMode } = await import("../actions");
    const result = await setIntradayMode(true);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error).toBe("real_persistence_not_configured");
  });
});

describe("setTickerAlertEnabled", () => {
  it("rejects malformed enabled value (string)", async () => {
    const { setTickerAlertEnabled } = await import("../actions");
    const result = await setTickerAlertEnabled(
      "005930",
      "false" as unknown as boolean,
    );
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error).toBe("invalid_ticker_alert_enabled");
  });

  it("rejects malformed ticker value (null) instead of throwing", async () => {
    const { setTickerAlertEnabled } = await import("../actions");
    const result = await setTickerAlertEnabled(
      null as unknown as string,
      true,
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("invalid_ticker");
  });

  it("returns ticker_required when ticker is empty/whitespace after trim", async () => {
    const { setTickerAlertEnabled } = await import("../actions");
    const result = await setTickerAlertEnabled("   ", true);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("ticker_required");
  });

  it("returns auth_unavailable when getUser returns no user", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const { setTickerAlertEnabled } = await import("../actions");
    const result = await setTickerAlertEnabled("005930", true);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("auth_unavailable");
  });

  it("returns real_persistence_not_configured boundary in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { setTickerAlertEnabled } = await import("../actions");
    const result = await setTickerAlertEnabled("005930", true);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error).toBe("real_persistence_not_configured");
  });

  it("returns real_persistence_not_configured boundary in development (no mock mutation)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { setTickerAlertEnabled } = await import("../actions");
    const result = await setTickerAlertEnabled("005930", false);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error).toBe("real_persistence_not_configured");
  });
});
