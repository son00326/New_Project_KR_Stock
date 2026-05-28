import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Mock cleanup Step 2.6 (2026-05-28): MOCK_ADMIN_NEWS → 실 news_event SELECT.
// topNews 산출이 admin-news.getRecentNewsEvents()를 호출하므로 테스트에서 stub 필요.
vi.mock("@/lib/data/admin-news", () => ({
  getRecentNewsEvents: vi.fn(() => Promise.resolve([])),
}));

describe("GET /api/cron/morning-briefing", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-secret";
    process.env.ADMIN_EMAILS = "admin@example.com";
    delete process.env.RESEND_API_KEY;
    vi.stubEnv("NODE_ENV", "production");
  });

  afterEach(() => {
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

  describe("authorization (G-cron-auth)", () => {
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
  });
});
