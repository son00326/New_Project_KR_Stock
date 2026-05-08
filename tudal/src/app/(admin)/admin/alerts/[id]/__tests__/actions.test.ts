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

describe("recordExitDecision", () => {
  it("rejects non-object payloads instead of throwing", async () => {
    const { recordExitDecision } = await import("../actions");

    const result = await recordExitDecision(
      null as unknown as Parameters<typeof recordExitDecision>[0],
    );

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("invalid_input");
  });

  it("rejects malformed memo values instead of throwing", async () => {
    const { recordExitDecision } = await import("../actions");

    const result = await recordExitDecision({
      alertId: "alert-exit-1",
      decision: "hold",
      memo: null,
    } as unknown as Parameters<typeof recordExitDecision>[0]);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("invalid_memo");
  });

  it("fails closed when auth lookup fails in production-like environments", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mocks.getUser.mockRejectedValue(new Error("auth down"));
    const { recordExitDecision } = await import("../actions");

    const result = await recordExitDecision({
      alertId: "alert-exit-1",
      decision: "hold",
      memo: "확인 전까지 보류",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("auth_unavailable");
  });

  it("does not report mock alert persistence as success in production-like environments", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { recordExitDecision } = await import("../actions");

    const result = await recordExitDecision({
      alertId: "alert-exit-1",
      decision: "hold",
      memo: "실제 저장소 연결 전에는 성공 처리하지 않음",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("real_persistence_not_configured");
  });
});
