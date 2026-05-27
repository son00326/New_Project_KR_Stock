import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AlertEvent } from "@/types/admin";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getAlertEventById: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
  }),
}));

vi.mock("@/lib/data/admin-alerts", () => ({
  getAlertEventById: mocks.getAlertEventById,
}));

const exitAlert: AlertEvent = {
  id: "alert-exit-1",
  alertType: "exit_signal",
  ticker: "005930",
  severity: "critical",
  triggerReason: "삼성전자 목표가 근접 + 모멘텀 꺾임",
  signalSentAt: "2026-05-27T04:45:22.000Z",
  outcomeAt: null,
  t7PriceChange: null,
  decisionRecorded: null,
  decisionMemo: null,
  isRead: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({
    data: { user: { id: "mock-admin-1" } },
  });
  mocks.getAlertEventById.mockResolvedValue(exitAlert);
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

  it("rejects empty alertId before hitting Supabase", async () => {
    const { recordExitDecision } = await import("../actions");
    const result = await recordExitDecision({
      alertId: "  ",
      decision: "hold",
      memo: "메모",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("invalid_input");
    expect(mocks.getAlertEventById).not.toHaveBeenCalled();
  });

  it("rejects unknown decision enum values", async () => {
    const { recordExitDecision } = await import("../actions");
    const result = await recordExitDecision({
      alertId: "alert-exit-1",
      decision: "buy_more" as never,
      memo: "메모",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("invalid_decision");
  });

  it("fails closed with auth_unavailable when auth lookup fails", async () => {
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

  it("fails closed with auth_unavailable when user is missing", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const { recordExitDecision } = await import("../actions");
    const result = await recordExitDecision({
      alertId: "alert-exit-1",
      decision: "hold",
      memo: "메모",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("auth_unavailable");
  });

  it("returns alert_lookup_failed when getAlertEventById throws", async () => {
    mocks.getAlertEventById.mockRejectedValue(
      new Error("alert_event_lookup_failed:PGRST301"),
    );
    const { recordExitDecision } = await import("../actions");
    const result = await recordExitDecision({
      alertId: "alert-exit-1",
      decision: "hold",
      memo: "메모",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("alert_lookup_failed");
  });

  it("returns alert_not_found when no row matches the id", async () => {
    mocks.getAlertEventById.mockResolvedValue(null);
    const { recordExitDecision } = await import("../actions");
    const result = await recordExitDecision({
      alertId: "alert-missing",
      decision: "hold",
      memo: "메모",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("alert_not_found");
  });

  it("rejects non exit_signal alerts as not_exit_signal", async () => {
    mocks.getAlertEventById.mockResolvedValue({
      ...exitAlert,
      alertType: "news_critical",
    });
    const { recordExitDecision } = await import("../actions");
    const result = await recordExitDecision({
      alertId: "alert-news-1",
      decision: "hold",
      memo: "메모",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("not_exit_signal");
  });

  it("rejects alerts that already have a decision recorded", async () => {
    mocks.getAlertEventById.mockResolvedValue({
      ...exitAlert,
      decisionRecorded: "sell_all",
      decisionMemo: "이미 처리됨",
      isRead: true,
    });
    const { recordExitDecision } = await import("../actions");
    const result = await recordExitDecision({
      alertId: "alert-exit-1",
      decision: "hold",
      memo: "재시도",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("already_decided");
  });

  it("returns real_persistence_not_configured for valid input regardless of environment (Mock cleanup Step 2.1 boundary)", async () => {
    const { recordExitDecision } = await import("../actions");
    const result = await recordExitDecision({
      alertId: "alert-exit-1",
      decision: "hold",
      memo: "실 저장소 연결 전에는 성공 처리하지 않음",
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error).toBe("real_persistence_not_configured");
  });

  it("still returns boundary error even when NODE_ENV=production (no env-gated mock mutation)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { recordExitDecision } = await import("../actions");
    const result = await recordExitDecision({
      alertId: "alert-exit-1",
      decision: "hold",
      memo: "운영 환경에서도 동일 boundary",
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error).toBe("real_persistence_not_configured");
  });
});
