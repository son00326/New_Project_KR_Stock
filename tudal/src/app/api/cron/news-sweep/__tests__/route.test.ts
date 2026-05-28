import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const naverMock = vi.hoisted(() => ({
  fetchNaverNews: vi.fn(),
}));
const adminNewsMock = vi.hoisted(() => ({
  getRecentNewsEvents: vi.fn(),
  insertNewsEvents: vi.fn(),
}));
const serviceRoleMock = vi.hoisted(() => ({
  client: { role: "service-role" },
  createServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/news/naver-api", () => ({
  fetchNaverNews: naverMock.fetchNaverNews,
}));

// Mock cleanup Step 2.6 (2026-05-28): MOCK_ADMIN_NEWS → 실 news_event SELECT.
// Step 2.7b.1 (2026-05-28): createServiceRoleClient() 주입 — 테스트에서 stub 필요.
vi.mock("@/lib/data/admin-news", () => ({
  getRecentNewsEvents: adminNewsMock.getRecentNewsEvents,
  insertNewsEvents: adminNewsMock.insertNewsEvents,
}));
vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: serviceRoleMock.createServiceRoleClient,
}));

describe("GET /api/cron/news-sweep", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    process.env.CRON_SECRET = "cron-secret";
    delete process.env.NAVER_CLIENT_ID;
    delete process.env.NAVER_CLIENT_SECRET;
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "");
    naverMock.fetchNaverNews.mockReset();
    adminNewsMock.getRecentNewsEvents.mockResolvedValue([]);
    adminNewsMock.insertNewsEvents.mockResolvedValue(undefined);
    serviceRoleMock.createServiceRoleClient.mockReturnValue(
      serviceRoleMock.client as never,
    );
  });

  it("fails closed when only one Naver credential is configured", async () => {
    process.env.NAVER_CLIENT_ID = "client-id";
    const { GET } = await import("../route");

    const res = await GET(
      new NextRequest("http://localhost/api/cron/news-sweep", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/NAVER_CLIENT_ID.*NAVER_CLIENT_SECRET/);
  });

  it("fails closed in production when Naver credentials are not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { GET } = await import("../route");

    const res = await GET(
      new NextRequest("http://localhost/api/cron/news-sweep", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.mockMode).toBe(false);
    expect(body.error).toMatch(/NAVER_CLIENT_ID.*NAVER_CLIENT_SECRET/);
  });

  it("fails closed when any live Naver watchlist query fails", async () => {
    process.env.NAVER_CLIENT_ID = "client-id";
    process.env.NAVER_CLIENT_SECRET = "client-secret";
    naverMock.fetchNaverNews
      .mockResolvedValueOnce([
        {
          ticker: "005930",
          title: "삼성전자 실적 개선",
          source: "Naver",
          url: "https://example.com/1",
          publishedAt: "2026-04-24T00:00:00.000Z",
        },
      ])
      .mockRejectedValueOnce(new Error("naver timeout"))
      .mockRejectedValueOnce(new Error("naver 500"));
    const { GET } = await import("../route");

    const res = await GET(
      new NextRequest("http://localhost/api/cron/news-sweep", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.ok).toBe(false);
    expect(body.failedQueries).toBe(2);
  });

  it("Step 2.7b.1 — non-production + NAVER 키 미설정 → service-role read → mockMode summary", async () => {
    // 명시적: vi.stubEnv NODE_ENV development (production 아님). NAVER 키 둘 다 unset.
    vi.stubEnv("NODE_ENV", "development");
    const { GET } = await import("../route");

    const res = await GET(
      new NextRequest("http://localhost/api/cron/news-sweep", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.mockMode).toBe(true);
    expect(body.fetched).toBe(0);
    expect(body.alertsEmitted).toBe(0);
    expect(serviceRoleMock.createServiceRoleClient).toHaveBeenCalledTimes(1);
    expect(adminNewsMock.getRecentNewsEvents).toHaveBeenCalledWith({
      client: serviceRoleMock.client,
      limit: 50,
    });
  });

  // Step 2.7b.2 (omxy R1 HIGH-1 + R2 MED-2): live mode는 service-role을 INSERT 위해 1회 lazy
  // create, READ는 호출 안 함. WRITE only invariant.
  it("creates service-role client once in live Naver mode (WRITE only, no READ call)", async () => {
    process.env.NAVER_CLIENT_ID = "client-id";
    process.env.NAVER_CLIENT_SECRET = "client-secret";
    naverMock.fetchNaverNews.mockResolvedValue([]);
    const { GET } = await import("../route");

    const res = await GET(
      new NextRequest("http://localhost/api/cron/news-sweep", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );

    expect(res.status).toBe(200);
    expect(serviceRoleMock.createServiceRoleClient).toHaveBeenCalledTimes(1);
    expect(adminNewsMock.getRecentNewsEvents).not.toHaveBeenCalled();
    expect(adminNewsMock.insertNewsEvents).toHaveBeenCalledTimes(1);
  });

  // Step 2.7b.2 (plan §Task 4): mock-mode classified events INSERT.
  it("mock-mode (Naver keys missing): classified events INSERT with service-role client (Step 2.7b.2)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { GET } = await import("../route");

    const res = await GET(
      new NextRequest("http://localhost/api/cron/news-sweep", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );

    expect(res.status).toBe(200);
    expect(adminNewsMock.insertNewsEvents).toHaveBeenCalledTimes(1);
    const [events, opts] = adminNewsMock.insertNewsEvents.mock.calls[0];
    expect(Array.isArray(events)).toBe(true);
    expect(opts).toHaveProperty("client", serviceRoleMock.client);
  });

  // Step 2.7b.2 (omxy R2 MED-2 — lazy per branch): live Naver all-fail → 502 early return
  // + insertNewsEvents NOT called + service-role NOT created.
  it("live-mode Naver all-fail → 502 early + insertNewsEvents NOT called + service-role NOT created", async () => {
    process.env.NAVER_CLIENT_ID = "client-id";
    process.env.NAVER_CLIENT_SECRET = "client-secret";
    naverMock.fetchNaverNews
      .mockRejectedValueOnce(new Error("naver 500"))
      .mockRejectedValueOnce(new Error("naver timeout"))
      .mockRejectedValueOnce(new Error("naver 429"));
    const { GET } = await import("../route");

    const res = await GET(
      new NextRequest("http://localhost/api/cron/news-sweep", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );

    expect(res.status).toBe(502);
    expect(adminNewsMock.insertNewsEvents).not.toHaveBeenCalled();
    expect(serviceRoleMock.createServiceRoleClient).not.toHaveBeenCalled();
  });

  // Step 2.7b.2 (plan §0 D3): INSERT 실패 → 502 + dbError audit + alertsEmitted=0 + classified preserved.
  it("INSERT fail → 502 + dbError, alertsEmitted=0 + classified preserved (Step 2.7b.2)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    adminNewsMock.insertNewsEvents.mockRejectedValue(
      new Error("news_event_insert_failed:23502"),
    );
    const { GET } = await import("../route");

    const res = await GET(
      new NextRequest("http://localhost/api/cron/news-sweep", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.dbError).toBe("news_event_insert_failed:23502");
    expect(body.classified).toBeDefined();
    expect(body.alertsEmitted).toBe(0);
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
        new NextRequest("http://localhost/api/cron/news-sweep"),
      );
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("unauthorized");
    });

    it("rejects Bearer with wrong secret", async () => {
      const { GET } = await import("../route");
      const res = await GET(
        new NextRequest("http://localhost/api/cron/news-sweep", {
          headers: { authorization: "Bearer wrong-secret" },
        }),
      );
      expect(res.status).toBe(401);
    });

    it("rejects non-Bearer scheme", async () => {
      const { GET } = await import("../route");
      const res = await GET(
        new NextRequest("http://localhost/api/cron/news-sweep", {
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
          new NextRequest("http://localhost/api/cron/news-sweep", {
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
