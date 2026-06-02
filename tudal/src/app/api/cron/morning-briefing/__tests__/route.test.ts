import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Mock cleanup Step 2.6 (2026-05-28): MOCK_ADMIN_NEWS → 실 news_event SELECT.
// Step 2.7b.1 (2026-05-28): createServiceRoleClient() 주입 — 테스트에서 stub 필요.
const adminNewsMock = vi.hoisted(() => ({
  getRecentNewsEvents: vi.fn(),
}));
const serviceRoleMock = vi.hoisted(() => ({
  client: { role: "service-role" },
  createServiceRoleClient: vi.fn(),
}));
// Step 2.7b.3: briefing_log + alert_event INSERT mocks.
const briefingLogMock = vi.hoisted(() => ({ insertBriefingLog: vi.fn() }));
const alertsInsertMock = vi.hoisted(() => ({ insertAlertEvents: vi.fn() }));
// PR-fix2 (C): telegram best-effort mock.
const telegramMock = vi.hoisted(() => ({
  sendTelegram: vi.fn(),
  isTelegramConfigured: vi.fn(),
}));

vi.mock("@/lib/data/admin-news", () => ({
  getRecentNewsEvents: adminNewsMock.getRecentNewsEvents,
}));
vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: serviceRoleMock.createServiceRoleClient,
}));
vi.mock("@/lib/data/admin-briefing-log", () => ({
  insertBriefingLog: briefingLogMock.insertBriefingLog,
}));
vi.mock("@/lib/data/admin-alerts-insert", () => ({
  insertAlertEvents: alertsInsertMock.insertAlertEvents,
}));
vi.mock("@/lib/notify/telegram", () => ({
  sendTelegram: telegramMock.sendTelegram,
  isTelegramConfigured: telegramMock.isTelegramConfigured,
}));

describe("GET /api/cron/morning-briefing", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-secret";
    process.env.ADMIN_EMAILS = "admin@example.com";
    delete process.env.RESEND_API_KEY;
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "");
    adminNewsMock.getRecentNewsEvents.mockResolvedValue([]);
    serviceRoleMock.createServiceRoleClient.mockReturnValue(
      serviceRoleMock.client as never,
    );
    briefingLogMock.insertBriefingLog.mockReset();
    briefingLogMock.insertBriefingLog.mockResolvedValue(undefined);
    alertsInsertMock.insertAlertEvents.mockReset();
    alertsInsertMock.insertAlertEvents.mockResolvedValue(undefined);
    // PR-fix2 (C): default 미설정 → 기존 test는 telegram 미시도 (sentChannels 무영향).
    telegramMock.isTelegramConfigured.mockReset();
    telegramMock.isTelegramConfigured.mockReturnValue(false);
    telegramMock.sendTelegram.mockReset();
    telegramMock.sendTelegram.mockResolvedValue({ success: true, mockMode: false });
  });

  afterEach(() => {
    // omxy R1 HIGH-2: vi.doMock("resend") mock leakage 차단.
    vi.doUnmock("@/lib/email/resend");
    vi.unstubAllEnvs();
  });

  it("returns non-2xx status when production email delivery is not configured", async () => {
    const { GET } = await import("../route");

    const res = await GET(
      new NextRequest("http://localhost/api/cron/morning-briefing", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.ok).toBe(false);
    expect(body.sentChannels).not.toContain("email");
    expect(body.alertEmitted).toMatch(/이메일 발송 실패/);
  });

  it("injects a service-role client into the news_event read helper", async () => {
    const { GET } = await import("../route");

    await GET(
      new NextRequest("http://localhost/api/cron/morning-briefing", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );

    expect(serviceRoleMock.createServiceRoleClient).toHaveBeenCalledTimes(1);
    expect(adminNewsMock.getRecentNewsEvents).toHaveBeenCalledWith({
      client: serviceRoleMock.client,
      limit: 20,
    });
  });

  it("returns non-2xx status when production has no briefing recipients", async () => {
    delete process.env.ADMIN_EMAILS;
    process.env.RESEND_API_KEY = "resend-key";
    const { GET } = await import("../route");

    const res = await GET(
      new NextRequest("http://localhost/api/cron/morning-briefing", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.sentChannels).toEqual(["dashboard"]);
    expect(body.alertEmitted).toMatch(/수신자/);
  });

  // Step 2.7b.3: briefing_log + briefing_failed alert_event INSERT wiring.
  function mockResendSuccess() {
    vi.doMock("@/lib/email/resend", () => ({
      sendEmail: async () => ({
        success: true,
        providerId: "test-msg",
        mockMode: false,
        error: undefined as string | undefined,
      }),
    }));
  }

  it("success → briefing_log INSERT + alert_event empty array (Step 2.7b.3)", async () => {
    mockResendSuccess(); // ADMIN_EMAILS set (beforeEach) + email success → generationFailed=false.
    const { GET } = await import("../route");
    const res = await GET(
      new NextRequest("http://localhost/api/cron/morning-briefing", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );
    expect(res.status).toBe(200);
    expect(briefingLogMock.insertBriefingLog).toHaveBeenCalledTimes(1);
    const [rec, opts] = briefingLogMock.insertBriefingLog.mock.calls[0];
    expect(rec).toHaveProperty("date");
    expect(opts).toHaveProperty("client", serviceRoleMock.client);
    expect(alertsInsertMock.insertAlertEvents).toHaveBeenCalledTimes(1);
    expect(alertsInsertMock.insertAlertEvents.mock.calls[0][0]).toHaveLength(0);
  });

  it("email-fail generationFailed → briefing_failed alert_event INSERT non-empty (Step 2.7b.3)", async () => {
    // 기본 beforeEach: production + ADMIN_EMAILS + no RESEND → 실 sendEmail 실패 → generationFailed=true.
    const { GET } = await import("../route");
    const res = await GET(
      new NextRequest("http://localhost/api/cron/morning-briefing", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );
    expect(res.status).toBe(502);
    expect(briefingLogMock.insertBriefingLog).toHaveBeenCalledTimes(1);
    expect(alertsInsertMock.insertAlertEvents).toHaveBeenCalledTimes(1);
    const arr = alertsInsertMock.insertAlertEvents.mock.calls[0][0];
    expect(arr).toHaveLength(1);
    expect(arr[0].alertType).toBe("briefing_failed");
  });

  it("briefing_log fail + alert success → both attempted, non-empty alert, dbError=briefing_log (skip 0, omxy R2 MED-1+MED-2)", async () => {
    briefingLogMock.insertBriefingLog.mockRejectedValue(
      new Error("briefing_log_insert_failed:23505"),
    );
    alertsInsertMock.insertAlertEvents.mockResolvedValue(undefined);
    const { GET } = await import("../route");
    const res = await GET(
      new NextRequest("http://localhost/api/cron/morning-briefing", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );
    expect(res.status).toBe(502);
    expect(alertsInsertMock.insertAlertEvents).toHaveBeenCalledTimes(1);
    const arr = alertsInsertMock.insertAlertEvents.mock.calls[0][0];
    expect(arr).toHaveLength(1);
    expect(arr[0].alertType).toBe("briefing_failed");
    const body = await res.json();
    expect(body.dbError).toBe("briefing_log_insert_failed:23505");
  });

  it("alert INSERT fail → dbError recorded (omxy R1 MED-1)", async () => {
    briefingLogMock.insertBriefingLog.mockResolvedValue(undefined);
    alertsInsertMock.insertAlertEvents.mockRejectedValue(
      new Error("alert_event_insert_failed:23514"),
    );
    const { GET } = await import("../route");
    const res = await GET(
      new NextRequest("http://localhost/api/cron/morning-briefing", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.dbError).toBe("alert_event_insert_failed:23514");
  });

  // PR-fix2 (C) — telegram best-effort. composeBriefing이 composed.telegram을 만들지만 종전엔 미발송(dead branch).
  //   isTelegramConfigured() 가드 + telegram 실패/미설정은 generationFailed/finalStatus에 절대 미반영(best-effort).
  describe("telegram best-effort (PR-fix2 C)", () => {
    it("configured + send 성공 + email 성공 → sentChannels telegram 포함, status 200", async () => {
      mockResendSuccess();
      telegramMock.isTelegramConfigured.mockReturnValue(true);
      telegramMock.sendTelegram.mockResolvedValue({
        success: true,
        mockMode: false,
      });
      const { GET } = await import("../route");
      const res = await GET(
        new NextRequest("http://localhost/api/cron/morning-briefing", {
          headers: { authorization: "Bearer cron-secret" },
        }),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.sentChannels).toContain("telegram");
      expect(telegramMock.sendTelegram).toHaveBeenCalledTimes(1);
      // composed.telegram 본문(text 필드)이 전달돼야 함.
      expect(telegramMock.sendTelegram.mock.calls[0][0]).toHaveProperty("text");
    });

    it("configured + send 실패 + email 성공 → status 200 불변(best-effort), telegram 채널 없음, telegramError 기록", async () => {
      mockResendSuccess();
      telegramMock.isTelegramConfigured.mockReturnValue(true);
      telegramMock.sendTelegram.mockResolvedValue({
        success: false,
        mockMode: false,
        error: "telegram HTTP 403: forbidden",
      });
      const { GET } = await import("../route");
      const res = await GET(
        new NextRequest("http://localhost/api/cron/morning-briefing", {
          headers: { authorization: "Bearer cron-secret" },
        }),
      );
      // telegram 실패가 briefing status를 502로 escalate하면 안 됨.
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.sentChannels).not.toContain("telegram");
      expect(body.telegramError).toBe("telegram HTTP 403: forbidden");
    });

    it("미설정 → sendTelegram 미호출, telegram 채널 없음 (prod success:false 잡음 회피)", async () => {
      mockResendSuccess();
      telegramMock.isTelegramConfigured.mockReturnValue(false);
      const { GET } = await import("../route");
      const res = await GET(
        new NextRequest("http://localhost/api/cron/morning-briefing", {
          headers: { authorization: "Bearer cron-secret" },
        }),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(telegramMock.sendTelegram).not.toHaveBeenCalled();
      expect(body.sentChannels).not.toContain("telegram");
      expect(body.telegramError ?? null).toBeNull();
    });
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
        new NextRequest("http://localhost/api/cron/morning-briefing"),
      );
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("unauthorized");
    });

    it("rejects Bearer with wrong secret", async () => {
      const { GET } = await import("../route");
      const res = await GET(
        new NextRequest("http://localhost/api/cron/morning-briefing", {
          headers: { authorization: "Bearer wrong-secret" },
        }),
      );
      expect(res.status).toBe(401);
    });

    it("rejects non-Bearer scheme", async () => {
      const { GET } = await import("../route");
      const res = await GET(
        new NextRequest("http://localhost/api/cron/morning-briefing", {
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
          new NextRequest("http://localhost/api/cron/morning-briefing", {
            headers: { authorization: "Bearer anything" },
          }),
        );

        expect(res.status).toBe(401);
        expect(serviceRoleMock.createServiceRoleClient).not.toHaveBeenCalled();
        expect(adminNewsMock.getRecentNewsEvents).not.toHaveBeenCalled();
      },
    );
  });
});
