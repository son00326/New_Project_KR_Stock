import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// S7d (2026-06-27): silent-health 이메일/Resend 제거 → 텔레그램 best-effort + dashboard durable only.
//   noConfiguredOutboundChannel(텔레그램 미설정·production) → 500 / sendFailed(텔레그램 실패) → 502.
const serviceRoleMock = vi.hoisted(() => ({
  client: { role: "service-role" },
  createServiceRoleClient: vi.fn(),
}));
const pipelineHealthMock = vi.hoisted(() => ({
  getRecentPipelineHealth: vi.fn(),
}));
const alertEventsMock = vi.hoisted(() => ({
  getRecentAlertEvents: vi.fn(),
}));
const heartbeatLogMock = vi.hoisted(() => ({
  insertHeartbeatLog: vi.fn(),
}));
const alertsInsertMock = vi.hoisted(() => ({
  insertAlertEvents: vi.fn(),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: serviceRoleMock.createServiceRoleClient,
}));
vi.mock("@/lib/data/admin-pipeline-health", () => ({
  getRecentPipelineHealth: pipelineHealthMock.getRecentPipelineHealth,
}));
vi.mock("@/lib/data/admin-alerts", () => ({
  getRecentAlertEvents: alertEventsMock.getRecentAlertEvents,
}));
vi.mock("@/lib/data/admin-heartbeat-log", () => ({
  insertHeartbeatLog: heartbeatLogMock.insertHeartbeatLog,
}));
vi.mock("@/lib/data/admin-alerts-insert", () => ({
  insertAlertEvents: alertsInsertMock.insertAlertEvents,
}));

const req = () =>
  new NextRequest("http://localhost/api/cron/silent-health", {
    headers: { authorization: "Bearer cron-secret" },
  });

describe("GET /api/cron/silent-health (telegram-only, 이메일 제거)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-secret";
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    delete process.env.TELEGRAM_CHAT_IDS;
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "");
    serviceRoleMock.createServiceRoleClient.mockReturnValue(
      serviceRoleMock.client as never,
    );
    pipelineHealthMock.getRecentPipelineHealth.mockResolvedValue([]);
    alertEventsMock.getRecentAlertEvents.mockResolvedValue([]);
    heartbeatLogMock.insertHeartbeatLog.mockResolvedValue(undefined);
    alertsInsertMock.insertAlertEvents.mockReset();
    alertsInsertMock.insertAlertEvents.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.doUnmock("@/lib/notify/telegram");
    vi.unstubAllEnvs();
  });

  it("production + no telegram channel → 500 config error + dashboard durable + missing alert", async () => {
    const { GET } = await import("../route");
    const res = await GET(req());
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.sentChannels).toEqual(["dashboard"]);
    expect(body.alertEmitted).toMatch(/하트비트|채널 미설정/);
  });

  it("never imports/sends email (Resend 전역 제거)", async () => {
    // 라우트 소스가 resend/이메일을 참조하지 않음 — import 실패 없이 동작 + 본문에 email 채널 없음.
    const { GET } = await import("../route");
    const res = await GET(req());
    const body = await res.json();
    expect(body.sentChannels).not.toContain("email");
  });

  it("injects one service-role client into both Supabase read helpers", async () => {
    const { GET } = await import("../route");
    await GET(req());
    expect(serviceRoleMock.createServiceRoleClient).toHaveBeenCalledTimes(1);
    expect(pipelineHealthMock.getRecentPipelineHealth).toHaveBeenCalledWith(
      expect.objectContaining({
        client: serviceRoleMock.client,
        refNow: expect.any(Date),
      }),
    );
    expect(alertEventsMock.getRecentAlertEvents).toHaveBeenCalledWith({
      client: serviceRoleMock.client,
      limit: 200,
    });
  });

  it("telegram configured but fails → 502 + missing alert carries telegram error", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "telegram-token";
    process.env.TELEGRAM_CHAT_ID = "telegram-chat";
    vi.doMock("@/lib/notify/telegram", () => ({
      sendTelegram: async () => ({
        success: false,
        mockMode: false,
        error: "telegram timeout",
      }),
    }));
    const { GET } = await import("../route");
    const res = await GET(req());
    const body = await res.json();
    expect(res.status).toBe(502);
    expect(body.ok).toBe(false);
    expect(body.sentChannels).toEqual(["dashboard"]);
    expect(body.alertEmitted).toMatch(/telegram timeout/);
  });

  it("telegram success → 200 + sentChannels [dashboard, telegram] + no missing alert", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "telegram-token";
    process.env.TELEGRAM_CHAT_ID = "telegram-chat";
    vi.doMock("@/lib/notify/telegram", () => ({
      sendTelegram: async () => ({ success: true, mockMode: false }),
    }));
    const { GET } = await import("../route");
    const res = await GET(req());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.sentChannels).toEqual(["dashboard", "telegram"]);
    expect(body.alertEmitted).toBeNull();
    expect(alertsInsertMock.insertAlertEvents.mock.calls[0][0]).toHaveLength(0);
  });

  it("heartbeat_log INSERT called with record + service-role client (telegram ok)", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "telegram-token";
    process.env.TELEGRAM_CHAT_ID = "telegram-chat";
    vi.doMock("@/lib/notify/telegram", () => ({
      sendTelegram: async () => ({ success: true, mockMode: false }),
    }));
    const { GET } = await import("../route");
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(heartbeatLogMock.insertHeartbeatLog).toHaveBeenCalledTimes(1);
    const [record, opts] = heartbeatLogMock.insertHeartbeatLog.mock.calls[0];
    expect(record).toEqual(
      expect.objectContaining({
        date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        status: expect.stringMatching(/^(ok|red_alert)$/),
        message: expect.any(String),
      }),
    );
    expect(opts).toHaveProperty("client", serviceRoleMock.client);
  });

  it("heartbeat_log INSERT fail → 502 + dbError audit + log in body", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "telegram-token";
    process.env.TELEGRAM_CHAT_ID = "telegram-chat";
    vi.doMock("@/lib/notify/telegram", () => ({
      sendTelegram: async () => ({ success: true, mockMode: false }),
    }));
    heartbeatLogMock.insertHeartbeatLog.mockRejectedValue(
      new Error("heartbeat_log_insert_failed:23505"),
    );
    const { GET } = await import("../route");
    const res = await GET(req());
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.dbError).toBe("heartbeat_log_insert_failed:23505");
    expect(body.log).toBeDefined();
  });

  it("sendFailed → missingAlert(heartbeat_missing) INSERT via service-role", async () => {
    // beforeEach: production + no telegram → noConfiguredOutboundChannel → sendFailed.
    const { GET } = await import("../route");
    const res = await GET(req());
    expect([500, 502]).toContain(res.status);
    expect(alertsInsertMock.insertAlertEvents).toHaveBeenCalledTimes(1);
    const [arr, opts] = alertsInsertMock.insertAlertEvents.mock.calls[0];
    expect(arr).toHaveLength(1);
    expect(arr[0].alertType).toBe("heartbeat_missing");
    expect(opts).toHaveProperty("client", serviceRoleMock.client);
  });

  it("alert INSERT fail → 5xx + dbError", async () => {
    alertsInsertMock.insertAlertEvents.mockRejectedValue(
      new Error("alert_event_insert_failed:23514"),
    );
    const { GET } = await import("../route");
    const res = await GET(req());
    expect([500, 502]).toContain(res.status);
    const body = await res.json();
    expect(body.dbError).toBe("alert_event_insert_failed:23514");
  });

  it("heartbeat_log fail + alert success → both attempted, dbError=heartbeat", async () => {
    heartbeatLogMock.insertHeartbeatLog.mockRejectedValue(
      new Error("heartbeat_log_insert_failed:23505"),
    );
    alertsInsertMock.insertAlertEvents.mockResolvedValue(undefined);
    const { GET } = await import("../route");
    const res = await GET(req());
    expect([500, 502]).toContain(res.status);
    expect(alertsInsertMock.insertAlertEvents).toHaveBeenCalledTimes(1);
    const body = await res.json();
    expect(body.dbError).toBe("heartbeat_log_insert_failed:23505");
  });

  describe("authorization (G-cron-auth)", () => {
    function neutralizeProductionLikeEnvs() {
      vi.stubEnv("NODE_ENV", "test");
      vi.stubEnv("VERCEL_ENV", "");
      vi.stubEnv("NEXT_PUBLIC_APP_ENV", "");
      delete process.env.CRON_SECRET;
    }

    it("rejects request without Authorization header", async () => {
      const { GET } = await import("../route");
      const res = await GET(
        new NextRequest("http://localhost/api/cron/silent-health"),
      );
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("unauthorized");
    });

    it("rejects Bearer with wrong secret", async () => {
      const { GET } = await import("../route");
      const res = await GET(
        new NextRequest("http://localhost/api/cron/silent-health", {
          headers: { authorization: "Bearer wrong-secret" },
        }),
      );
      expect(res.status).toBe(401);
    });

    it("rejects non-Bearer scheme", async () => {
      const { GET } = await import("../route");
      const res = await GET(
        new NextRequest("http://localhost/api/cron/silent-health", {
          headers: { authorization: "Basic cron-secret" },
        }),
      );
      expect(res.status).toBe(401);
    });

    it.each([
      ["NODE_ENV=production", "NODE_ENV", "production"],
      ["VERCEL_ENV=preview", "VERCEL_ENV", "preview"],
      ["VERCEL_ENV=production", "VERCEL_ENV", "production"],
      ["NEXT_PUBLIC_APP_ENV=production", "NEXT_PUBLIC_APP_ENV", "production"],
    ])(
      "rejects when CRON_SECRET is undefined in %s",
      async (_label, envKey, envValue) => {
        neutralizeProductionLikeEnvs();
        vi.stubEnv(envKey, envValue);
        const { GET } = await import("../route");
        const res = await GET(
          new NextRequest("http://localhost/api/cron/silent-health", {
            headers: { authorization: "Bearer anything" },
          }),
        );
        expect(res.status).toBe(401);
        expect(serviceRoleMock.createServiceRoleClient).not.toHaveBeenCalled();
      },
    );
  });
});
