import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { ShortListItem } from "@/types/admin";

// 실 getActiveShortList 반환(ShortListItem)의 컴파일러 결속 subset — 필드 드리프트 시 즉시 표면화.
type NewsSweepShortlistItem = Pick<ShortListItem, "ticker" | "name" | "bucket">;

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
// Step 2.7b.3: alert_event INSERT mock (news_critical).
const alertsInsertMock = vi.hoisted(() => ({
  insertAlertEvents: vi.fn(),
}));
// 2026-06-29: live 유니버스 = 활성 short_list_30 (3종 하드코딩 대체).
const shortlistMock = vi.hoisted(() => ({
  getActiveShortList: vi.fn<() => Promise<NewsSweepShortlistItem[]>>(),
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
vi.mock("@/lib/data/admin-alerts-insert", () => ({
  insertAlertEvents: alertsInsertMock.insertAlertEvents,
}));
vi.mock("@/lib/data/admin-shortlist", () => ({
  getActiveShortList: shortlistMock.getActiveShortList,
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
    alertsInsertMock.insertAlertEvents.mockReset();
    alertsInsertMock.insertAlertEvents.mockResolvedValue(undefined);
    serviceRoleMock.createServiceRoleClient.mockReturnValue(
      serviceRoleMock.client as never,
    );
    // live 유니버스 기본값 = 활성 short_list_30 (테스트별 override 가능).
    shortlistMock.getActiveShortList.mockReset();
    shortlistMock.getActiveShortList.mockResolvedValue([
      { ticker: "005930", name: "삼성전자", bucket: "short" },
      { ticker: "000660", name: "SK하이닉스", bucket: "short" },
      { ticker: "035420", name: "NAVER", bucket: "mid" },
    ]);
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
    // 변경 핀: 워치리스트는 활성 short_list_30에서 옴(구 하드코딩이면 호출 0 → fail).
    expect(shortlistMock.getActiveShortList).toHaveBeenCalledTimes(1);
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

  it("creates service-role client once in live Naver mode and reuses it for universe read and write", async () => {
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
    expect(shortlistMock.getActiveShortList).toHaveBeenCalledWith({
      client: serviceRoleMock.client,
    });
    expect(adminNewsMock.getRecentNewsEvents).not.toHaveBeenCalled();
    expect(adminNewsMock.insertNewsEvents).toHaveBeenCalledTimes(1);
    expect(adminNewsMock.insertNewsEvents.mock.calls[0]?.[1]).toEqual({
      client: serviceRoleMock.client,
    });
  });

  // 2026-06-29: live 모드는 활성 short_list_30 유니버스를 쿼리한다 (3종 하드코딩 대체).
  //   M12a/모닝 브리핑이 실제 선정 30종을 평가하려면 news_event가 그 유니버스로 채워져야 한다.
  it("live mode queries the active short_list_30 universe (not a hardcoded watchlist)", async () => {
    process.env.NAVER_CLIENT_ID = "client-id";
    process.env.NAVER_CLIENT_SECRET = "client-secret";
    shortlistMock.getActiveShortList.mockResolvedValue([
      { ticker: "000660", name: "SK하이닉스", bucket: "short" },
      { ticker: "112610", name: "씨에스윈드", bucket: "long" },
    ]);
    naverMock.fetchNaverNews.mockResolvedValue([]);
    const { GET } = await import("../route");

    const res = await GET(
      new NextRequest("http://localhost/api/cron/news-sweep", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );

    expect(res.status).toBe(200);
    expect(shortlistMock.getActiveShortList).toHaveBeenCalledTimes(1);
    expect(naverMock.fetchNaverNews).toHaveBeenCalledTimes(2);
    const queries = naverMock.fetchNaverNews.mock.calls
      .map((c) => (c[0] as { query: string }).query)
      .sort();
    expect(queries).toEqual(["SK하이닉스", "씨에스윈드"]);
    const tickers = naverMock.fetchNaverNews.mock.calls
      .map((c) => (c[0] as { ticker: string }).ticker)
      .sort();
    expect(tickers).toEqual(["000660", "112610"]);
    // 순서 핀: 유니버스 read → fetch (service-role → getActiveShortList → fetchNaverNews).
    expect(
      shortlistMock.getActiveShortList.mock.invocationCallOrder[0],
    ).toBeLessThan(naverMock.fetchNaverNews.mock.invocationCallOrder[0]);
  });

  // 2026-06-29: live 모드 + 빈 유니버스(선정 미시드) → Naver 호출 0 + 200(굶음 graceful) + ops 경고.
  it("live mode with empty universe → no Naver fetch, ok with fetched 0, warns", async () => {
    process.env.NAVER_CLIENT_ID = "client-id";
    process.env.NAVER_CLIENT_SECRET = "client-secret";
    shortlistMock.getActiveShortList.mockResolvedValue([]);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { GET } = await import("../route");

    const res = await GET(
      new NextRequest("http://localhost/api/cron/news-sweep", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );
    const body = await res.json();

    expect(naverMock.fetchNaverNews).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(body.fetched).toBe(0);
    // ops 신호: 키 설정됐는데 유니버스 비어있음 → 구조화 경고.
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("news_sweep_empty_universe"),
    );
    warnSpy.mockRestore();
  });

  // 2026-06-29: 유니버스가 cap(MAX_WATCHLIST_QUERIES=30)보다 크면 Naver 호출은 30으로 제한.
  it("live mode caps Naver fetch at 30 for an oversized universe", async () => {
    process.env.NAVER_CLIENT_ID = "client-id";
    process.env.NAVER_CLIENT_SECRET = "client-secret";
    const universe: NewsSweepShortlistItem[] = Array.from({ length: 40 }, (_, i) => ({
      ticker: String(100000 + i),
      name: `종목${i}`,
      bucket: i < 20 ? "short" : "long",
    }));
    shortlistMock.getActiveShortList.mockResolvedValue(universe);
    naverMock.fetchNaverNews.mockResolvedValue([]);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { GET } = await import("../route");

    const res = await GET(
      new NextRequest("http://localhost/api/cron/news-sweep", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );

    expect(res.status).toBe(200);
    expect(naverMock.fetchNaverNews).toHaveBeenCalledTimes(30);
    // 무음 절단 방지 핀: 유니버스>cap이면 ops 경고(없으면 silent truncation).
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("news_sweep_universe_truncated"),
    );
    warnSpy.mockRestore();
  });

  // 2026-06-29: 실 유니버스 규모(25종)에서 부분 실패 → 502 + 정확한 failedQueries/totalQueries.
  it("live mode partial failure at scale → 502 with accurate failed/total counts", async () => {
    process.env.NAVER_CLIENT_ID = "client-id";
    process.env.NAVER_CLIENT_SECRET = "client-secret";
    const universe: NewsSweepShortlistItem[] = Array.from({ length: 25 }, (_, i) => ({
      ticker: String(200000 + i),
      name: `종목${i}`,
      bucket: "short",
    }));
    shortlistMock.getActiveShortList.mockResolvedValue(universe);
    for (let i = 0; i < 20; i++) {
      naverMock.fetchNaverNews.mockResolvedValueOnce([]);
    }
    for (let i = 0; i < 5; i++) {
      naverMock.fetchNaverNews.mockRejectedValueOnce(new Error("naver fail"));
    }
    const { GET } = await import("../route");

    const res = await GET(
      new NextRequest("http://localhost/api/cron/news-sweep", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.failedQueries).toBe(5);
    expect(body.totalQueries).toBe(25);
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

  // 2026-06-29: live Naver all-fail → 502 early return + insertNewsEvents NOT called.
  //   유니버스 read를 위해 service-role은 fetch 전에 1회 생성됨(구 lazy-after-fetch invariant 갱신).
  it("live-mode Naver all-fail → 502 early + insertNewsEvents NOT called (service-role created once for universe read)", async () => {
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
    // 유니버스 read용 1회 생성(재사용). insert는 early-return으로 미도달.
    expect(serviceRoleMock.createServiceRoleClient).toHaveBeenCalledTimes(1);
    // 변경 핀: fetch 전에 유니버스를 read해야 함(구 하드코딩 코드면 호출 0 → fail).
    expect(shortlistMock.getActiveShortList).toHaveBeenCalledTimes(1);
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

  // Step 2.7b.3: news_critical alert_event INSERT wiring.
  it("criticals → alert_event INSERT via service-role (Step 2.7b.3, omxy R1 HIGH-1)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    // omxy R1 HIGH-1: "삼성 급락"은 info. critical regex 매칭 "실적 쇼크" 사용 (classifier.ts).
    adminNewsMock.getRecentNewsEvents.mockResolvedValue([
      {
        id: "n1",
        ticker: "005930",
        severity: "critical",
        title: "삼성전자 실적 쇼크",
        source: "Naver",
        url: "https://x/1",
        publishedAt: "2026-05-28T00:00:00.000Z",
        fetchedAt: "2026-05-28T00:01:00.000Z",
        classificationReason: "급락",
      },
    ]);
    alertsInsertMock.insertAlertEvents.mockResolvedValue(undefined);
    const { GET } = await import("../route");
    const res = await GET(
      new NextRequest("http://localhost/api/cron/news-sweep", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );
    expect(res.status).toBe(200);
    expect(alertsInsertMock.insertAlertEvents).toHaveBeenCalledTimes(1);
    const [arr, opts] = alertsInsertMock.insertAlertEvents.mock.calls[0];
    expect(arr).toHaveLength(1);
    expect(arr[0].alertType).toBe("news_critical");
    expect(opts).toHaveProperty("client", serviceRoleMock.client);
  });

  it("alert INSERT fail → 502 + dbError, news_event success (omxy R1 MED-1)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    adminNewsMock.getRecentNewsEvents.mockResolvedValue([
      {
        id: "n1",
        ticker: "005930",
        severity: "critical",
        title: "삼성전자 실적 쇼크",
        source: "Naver",
        url: "https://x/1",
        publishedAt: "2026-05-28T00:00:00.000Z",
        fetchedAt: "2026-05-28T00:01:00.000Z",
        classificationReason: "급락",
      },
    ]);
    adminNewsMock.insertNewsEvents.mockResolvedValue(undefined);
    alertsInsertMock.insertAlertEvents.mockRejectedValue(
      new Error("alert_event_insert_failed:23514"),
    );
    const { GET } = await import("../route");
    const res = await GET(
      new NextRequest("http://localhost/api/cron/news-sweep", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.dbError).toBe("alert_event_insert_failed:23514");
  });

  it("news_event fail + alert success → both attempted (skip 0, omxy R1 MED-2 + R2 MED-2)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    adminNewsMock.getRecentNewsEvents.mockResolvedValue([
      {
        id: "n1",
        ticker: "005930",
        severity: "critical",
        title: "삼성전자 실적 쇼크",
        source: "Naver",
        url: "https://x/1",
        publishedAt: "2026-05-28T00:00:00.000Z",
        fetchedAt: "2026-05-28T00:01:00.000Z",
        classificationReason: "급락",
      },
    ]);
    adminNewsMock.insertNewsEvents.mockRejectedValue(
      new Error("news_event_insert_failed:23502"),
    );
    alertsInsertMock.insertAlertEvents.mockResolvedValue(undefined);
    const { GET } = await import("../route");
    const res = await GET(
      new NextRequest("http://localhost/api/cron/news-sweep", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );
    expect(res.status).toBe(502);
    expect(alertsInsertMock.insertAlertEvents).toHaveBeenCalledTimes(1);
    const body = await res.json();
    expect(body.dbError).toBe("news_event_insert_failed:23502"); // 첫 실패 보존
    // omxy R2 MED-2: alert INSERT 성공이므로 alertsEmitted는 실제 alert 수 반영 (0 거짓 보고 차단).
    expect(body.alertsEmitted).toBe(1);
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
