import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Step 2.7a (2026-05-28): silent-health route는 createServiceRoleClient() + 실 SELECT 호출.
// 기존 telegram/email 발송 실패 path 테스트가 무리없게 stubbed helpers + service-role 사용.
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
// Step 2.7b.2 (omxy R4 HIGH-1 fix): vi.hoisted로 TDZ ReferenceError 차단.
const heartbeatLogMock = vi.hoisted(() => ({
  insertHeartbeatLog: vi.fn(),
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

describe("GET /api/cron/silent-health", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-secret";
    process.env.ADMIN_EMAILS = "admin@example.com";
    delete process.env.RESEND_API_KEY;
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
  });

  afterEach(() => {
    vi.doUnmock("@/lib/notify/telegram");
    vi.doUnmock("@/lib/email/resend");
    vi.unstubAllEnvs();
  });

  it("returns non-2xx status when all production delivery channels fail", async () => {
    const { GET } = await import("../route");

    const res = await GET(
      new NextRequest("http://localhost/api/cron/silent-health", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.ok).toBe(false);
    expect(body.sentChannels).toEqual(["dashboard"]);
    expect(body.alertEmitted).toMatch(/하트비트/);
  });

  it("injects one service-role client into both Supabase read helpers", async () => {
    const { GET } = await import("../route");

    await GET(
      new NextRequest("http://localhost/api/cron/silent-health", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );

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

  it("returns non-2xx status when production has no outbound heartbeat channel", async () => {
    delete process.env.ADMIN_EMAILS;
    process.env.RESEND_API_KEY = "resend-key";
    const { GET } = await import("../route");

    const res = await GET(
      new NextRequest("http://localhost/api/cron/silent-health", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.sentChannels).toEqual(["dashboard"]);
    expect(body.alertEmitted).toMatch(/하트비트/);
  });

  it("returns non-2xx status when configured Telegram fails and email has no recipients", async () => {
    delete process.env.ADMIN_EMAILS;
    process.env.TELEGRAM_BOT_TOKEN = "telegram-token";
    process.env.TELEGRAM_CHAT_ID = "telegram-chat";
    vi.doMock("@/lib/notify/telegram", () => ({
      sendTelegram: async () => ({
        success: false,
        mockMode: false,
        error: "telegram timeout",
      }),
    }));
    vi.doMock("@/lib/email/resend", () => ({
      sendEmail: vi.fn(),
    }));
    const { GET } = await import("../route");

    const res = await GET(
      new NextRequest("http://localhost/api/cron/silent-health", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.ok).toBe(false);
    expect(body.sentChannels).toEqual(["dashboard"]);
    expect(body.alertEmitted).toMatch(/telegram timeout/);
  });

  // Step 2.7b.2 (plan §Task 3): heartbeat_log INSERT wiring 검증.
  // 기존 describe 내부 placement = beforeEach 상속 (omxy R4 MED-1 정합).
  it("INSERT called with toHeartbeatLogRecord output + service-role client (Step 2.7b.2)", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "telegram-token";
    process.env.TELEGRAM_CHAT_ID = "telegram-chat";
    vi.doMock("@/lib/notify/telegram", () => ({
      sendTelegram: async () => ({ success: true, mockMode: false }),
    }));
    vi.doMock("@/lib/email/resend", () => ({
      sendEmail: async () => ({
        success: true,
        providerId: "test-msg",
        mockMode: false,
      }),
    }));
    const { GET } = await import("../route");

    const res = await GET(
      new NextRequest("http://localhost/api/cron/silent-health", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );
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

  it("INSERT fail → 502 + dbError audit body, response still includes log (Step 2.7b.2)", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "telegram-token";
    process.env.TELEGRAM_CHAT_ID = "telegram-chat";
    vi.doMock("@/lib/notify/telegram", () => ({
      sendTelegram: async () => ({ success: true, mockMode: false }),
    }));
    vi.doMock("@/lib/email/resend", () => ({
      sendEmail: async () => ({
        success: true,
        providerId: "test-msg",
        mockMode: false,
      }),
    }));
    heartbeatLogMock.insertHeartbeatLog.mockRejectedValue(
      new Error("heartbeat_log_insert_failed:23505"),
    );
    const { GET } = await import("../route");

    const res = await GET(
      new NextRequest("http://localhost/api/cron/silent-health", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.dbError).toBe("heartbeat_log_insert_failed:23505");
    expect(body.log).toBeDefined();
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
