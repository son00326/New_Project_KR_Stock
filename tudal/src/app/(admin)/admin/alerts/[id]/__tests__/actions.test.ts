import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AlertEvent } from "@/types/admin";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getAlertEventById: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
    rpc: mocks.rpc,
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
  mocks.rpc.mockResolvedValue({ error: null });
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
    expect(mocks.rpc).not.toHaveBeenCalled();
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
    expect(mocks.rpc).not.toHaveBeenCalled();
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
    expect(mocks.rpc).not.toHaveBeenCalled();
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
    expect(mocks.rpc).not.toHaveBeenCalled();
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
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("persists via record_alert_exit_decision RPC and returns success", async () => {
    const { recordExitDecision } = await import("../actions");
    const result = await recordExitDecision({
      alertId: "alert-exit-1",
      decision: "hold",
      memo: "익일 장전 재점검",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.decisionRecorded).toBe("hold");
    expect(mocks.rpc).toHaveBeenCalledWith("record_alert_exit_decision", {
      p_alert_id: "alert-exit-1",
      p_decision: "hold",
      p_memo: "익일 장전 재점검",
    });
  });

  it("maps RPC race (already decided) to already_decided", async () => {
    mocks.rpc.mockResolvedValue({
      error: { message: "alert_not_found_or_already_decided" },
    });
    const { recordExitDecision } = await import("../actions");
    const result = await recordExitDecision({
      alertId: "alert-exit-1",
      decision: "hold",
      memo: "동시 결정 race",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("already_decided");
  });

  it("maps admin_required RPC error to auth_unavailable", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "admin_required" } });
    const { recordExitDecision } = await import("../actions");
    const result = await recordExitDecision({
      alertId: "alert-exit-1",
      decision: "hold",
      memo: "비-admin",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("auth_unavailable");
  });

  it("maps unknown RPC error to exit_decision_write_failed", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "deadlock detected" } });
    const { recordExitDecision } = await import("../actions");
    const result = await recordExitDecision({
      alertId: "alert-exit-1",
      decision: "hold",
      memo: "알 수 없는 오류",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("exit_decision_write_failed");
  });
});
