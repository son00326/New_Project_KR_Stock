import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

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
});
