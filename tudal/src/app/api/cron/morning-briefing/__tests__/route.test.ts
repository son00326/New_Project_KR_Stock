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

vi.mock("@/lib/data/admin-news", () => ({
  getRecentNewsEvents: adminNewsMock.getRecentNewsEvents,
}));
vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: serviceRoleMock.createServiceRoleClient,
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
