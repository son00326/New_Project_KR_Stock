import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const naverMock = vi.hoisted(() => ({
  fetchNaverNews: vi.fn(),
}));

vi.mock("@/lib/news/naver-api", () => ({
  fetchNaverNews: naverMock.fetchNaverNews,
}));

// Mock cleanup Step 2.6 (2026-05-28): MOCK_ADMIN_NEWS → 실 news_event SELECT.
// dev mock-mode 흐름은 admin-news.getRecentNewsEvents()를 호출하므로 테스트에서 stub 필요.
vi.mock("@/lib/data/admin-news", () => ({
  getRecentNewsEvents: vi.fn(() => Promise.resolve([])),
}));

describe("GET /api/cron/news-sweep", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    process.env.CRON_SECRET = "cron-secret";
    delete process.env.NAVER_CLIENT_ID;
    delete process.env.NAVER_CLIENT_SECRET;
    naverMock.fetchNaverNews.mockReset();
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

  it("Step 2.6 — non-production + NAVER 키 미설정 → getRecentNewsEvents() empty → mockMode summary", async () => {
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
  });

  describe("authorization (G-cron-auth)", () => {
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
  });
});
