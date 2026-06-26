import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// 72차/D10: 이메일/Resend 전역 미사용 → M11 모닝 브리핑 채널 = telegram(best-effort) + dashboard.
// Step 2.7b.1 (2026-05-28): createServiceRoleClient() 주입 — 테스트 stub.
const adminNewsMock = vi.hoisted(() => ({
  getRecentNewsEvents: vi.fn(),
}));
const serviceRoleMock = vi.hoisted(() => ({
  client: { role: "service-role" },
  createServiceRoleClient: vi.fn(),
}));
const briefingLogMock = vi.hoisted(() => ({ insertBriefingLog: vi.fn() }));
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
vi.mock("@/lib/notify/telegram", () => ({
  sendTelegram: telegramMock.sendTelegram,
  isTelegramConfigured: telegramMock.isTelegramConfigured,
}));

function req() {
  return new NextRequest("http://localhost/api/cron/morning-briefing", {
    headers: { authorization: "Bearer cron-secret" },
  });
}

describe("GET /api/cron/morning-briefing", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-secret";
    delete process.env.MACRO_CONTEXT_ENABLED;
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "");
    adminNewsMock.getRecentNewsEvents.mockResolvedValue([]);
    serviceRoleMock.createServiceRoleClient.mockReturnValue(
      serviceRoleMock.client as never,
    );
    briefingLogMock.insertBriefingLog.mockReset();
    briefingLogMock.insertBriefingLog.mockResolvedValue(undefined);
    telegramMock.isTelegramConfigured.mockReset();
    telegramMock.isTelegramConfigured.mockReturnValue(false);
    telegramMock.sendTelegram.mockReset();
    telegramMock.sendTelegram.mockResolvedValue({ success: true, mockMode: false });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("success(telegram 미설정) → 200, sentChannels=[dashboard], 이메일 미발송", async () => {
    const { GET } = await import("../route");
    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.sentChannels).toEqual(["dashboard"]);
    expect(body.sentChannels).not.toContain("email");
    expect(briefingLogMock.insertBriefingLog).toHaveBeenCalledTimes(1);
    const [, opts] = briefingLogMock.insertBriefingLog.mock.calls[0];
    expect(opts).toHaveProperty("client", serviceRoleMock.client);
  });

  it("does not import or send via Resend (이메일 전역 미사용)", async () => {
    const sendEmailSpy = vi.fn();
    vi.doMock("@/lib/email/resend", () => ({ sendEmail: sendEmailSpy }));
    const { GET } = await import("../route");
    await GET(req());
    expect(sendEmailSpy).not.toHaveBeenCalled();
    vi.doUnmock("@/lib/email/resend");
  });

  it("injects a service-role client into the news_event read helper", async () => {
    const { GET } = await import("../route");
    await GET(req());
    expect(serviceRoleMock.createServiceRoleClient).toHaveBeenCalledTimes(1);
    expect(adminNewsMock.getRecentNewsEvents).toHaveBeenCalledWith({
      client: serviceRoleMock.client,
      limit: 20,
    });
  });

  it("briefing_log insert fail → dbError + 502", async () => {
    briefingLogMock.insertBriefingLog.mockRejectedValue(
      new Error("briefing_log_insert_failed:23505"),
    );
    const { GET } = await import("../route");
    const res = await GET(req());
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.dbError).toBe("briefing_log_insert_failed:23505");
  });

  describe("telegram best-effort (D10)", () => {
    it("configured + 성공 → sentChannels telegram 포함, status 200, text 전달", async () => {
      telegramMock.isTelegramConfigured.mockReturnValue(true);
      telegramMock.sendTelegram.mockResolvedValue({ success: true, mockMode: false });
      const { GET } = await import("../route");
      const res = await GET(req());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.sentChannels).toContain("telegram");
      expect(telegramMock.sendTelegram).toHaveBeenCalledTimes(1);
      expect(telegramMock.sendTelegram.mock.calls[0][0]).toHaveProperty("text");
    });

    it("configured + 실패 → status 200 불변(best-effort), telegram 채널 없음, telegramError 기록", async () => {
      telegramMock.isTelegramConfigured.mockReturnValue(true);
      telegramMock.sendTelegram.mockResolvedValue({
        success: false,
        mockMode: false,
        error: "telegram HTTP 403: forbidden",
      });
      const { GET } = await import("../route");
      const res = await GET(req());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.sentChannels).not.toContain("telegram");
      expect(body.telegramError).toBe("telegram HTTP 403: forbidden");
    });

    it("미설정 → sendTelegram 미호출", async () => {
      telegramMock.isTelegramConfigured.mockReturnValue(false);
      const { GET } = await import("../route");
      const res = await GET(req());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(telegramMock.sendTelegram).not.toHaveBeenCalled();
      expect(body.telegramError ?? null).toBeNull();
    });
  });

  describe("G4 macro context (dormant default)", () => {
    it("flag off → contentPreview에 거시 라인 없음", async () => {
      const { GET } = await import("../route");
      const res = await GET(req());
      const body = await res.json();
      expect(body.contentPreview).not.toMatch(/거시/);
    });

    it("flag on + fresh source → telegram 본문에 거시 컨텍스트 포함", async () => {
      // 실 source는 mock-macro(asOf 2026-04-11)라 staleness fail-safe로 ""가 될 수 있으나,
      // 라우트가 getMacroContextString()를 호출하는 연결만 검증(텔레그램 전송).
      telegramMock.isTelegramConfigured.mockReturnValue(true);
      const captured: Array<{ text: string }> = [];
      telegramMock.sendTelegram.mockImplementation(async (arg: { text: string }) => {
        captured.push(arg);
        return { success: true, mockMode: false };
      });
      const { GET } = await import("../route");
      await GET(req());
      expect(captured).toHaveLength(1);
      expect(typeof captured[0].text).toBe("string");
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
        const res = await GET(req());
        expect(res.status).toBe(401);
        expect(serviceRoleMock.createServiceRoleClient).not.toHaveBeenCalled();
        expect(adminNewsMock.getRecentNewsEvents).not.toHaveBeenCalled();
      },
    );
  });
});
