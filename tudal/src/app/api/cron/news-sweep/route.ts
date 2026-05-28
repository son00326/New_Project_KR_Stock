import { NextResponse, type NextRequest } from "next/server";
import { getRecentNewsEvents } from "@/lib/data/admin-news";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { NewsCandidate } from "@/lib/news/classifier";
import {
  classifyNews,
  dedupeByUrl,
  toNewsEvent,
} from "@/lib/news/classifier";
import { fetchNaverNews } from "@/lib/news/naver-api";
import { scrapeSources } from "@/lib/news/scraper";
import type { AlertEvent } from "@/types/admin";

// Vercel Cron daily 00:00 UTC (vercel.json schedule `0 0 * * *`). ServicePlan-Admin §3.10 R3.10-1~3.
// 네이버 뉴스 API 1차 + 스크래핑 2차(stub) → classifier → dedupe → Critical만 AlertEvent 발행.
// Step 2.7b.1 (2026-05-28): mock-mode fallback에서 admin-news.getRecentNewsEvents() 호출 시
// createServiceRoleClient() 주입 → cron context RLS using(is_admin()) 우회 (admin cookie 없음).
// W-news-cron-service-role-read 완전 해소. PR #48 silent-health 선례 정합.
// INSERT path (classifier output → news_event INSERT)는 Step 2.7b.2 별도 scope.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PR1 monthly-batch MF4 / PR #48 silent-health 정합: service-role cron은 CRON_SECRET
// 누락 시 production-like 환경 4-way fail-closed.
function isProductionLikeForAuth(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.VERCEL_ENV === "preview" ||
    process.env.NEXT_PUBLIC_APP_ENV === "production"
  );
}

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return !isProductionLikeForAuth();
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function isProductionLike(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.NEXT_PUBLIC_APP_ENV === "production"
  );
}

// Short List 30 기준 쿼리 세트 (실데이터 전환 시 src/lib/data/mock-admin-shortlist에서 ticker+name 조인)
const WATCHLIST_QUERIES: Array<{ ticker: string; query: string }> = [
  { ticker: "005930", query: "삼성전자" },
  { ticker: "000660", query: "SK하이닉스" },
  { ticker: "035420", query: "NAVER" },
];

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // mock-mode: non-production에서만 Naver 키 둘 다 없음 → fetch 생략, fixture 노출.
  // production-like 환경의 미설정/부분 설정은 운영 오설정으로 보고 실패 처리한다.
  const hasNaverClientId = Boolean(process.env.NAVER_CLIENT_ID);
  const hasNaverClientSecret = Boolean(process.env.NAVER_CLIENT_SECRET);
  if (hasNaverClientId !== hasNaverClientSecret || (!hasNaverClientId && isProductionLike())) {
    return NextResponse.json(
      {
        ok: false,
        mockMode: false,
        error: "NAVER_CLIENT_ID and NAVER_CLIENT_SECRET must be configured together",
      },
      { status: 500 },
    );
  }

  const naverOn = hasNaverClientId && hasNaverClientSecret;
  let candidates: NewsCandidate[] = [];

  if (naverOn) {
    const results = await Promise.allSettled(
      WATCHLIST_QUERIES.map((w) =>
        fetchNaverNews({ query: w.query, ticker: w.ticker, display: 20 }),
      ),
    );
    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          mockMode: false,
          error:
            failures.length === results.length
              ? "all Naver news queries failed"
              : "partial Naver news queries failed",
          failedQueries: failures.length,
          totalQueries: results.length,
        },
        { status: 502 },
      );
    }
    const batches = results
      .filter((r): r is PromiseFulfilledResult<NewsCandidate[]> => r.status === "fulfilled")
      .map((r) => r.value);
    const scraped = await scrapeSources([]);
    candidates = dedupeByUrl([...batches.flat(), ...scraped]);
  } else {
    // dev/mock 모드 (non-production + NAVER 키 미설정):
    // Step 2.7b.1 (2026-05-28) — service-role client 주입 (W-news-cron-service-role-read
    // 완전 해소). cron context에는 admin cookie 없어 session client는 RLS silent-0.
    // Step 2.6 (실 news_event SELECT 전환) 위에 wiring 완료.
    const recent = await getRecentNewsEvents({
      client: createServiceRoleClient(),
      limit: 50,
    });
    candidates = recent.map((n) => ({
      ticker: n.ticker,
      title: n.title,
      source: n.source,
      url: n.url,
      publishedAt: n.publishedAt,
    }));
  }

  const classified = candidates.map((c, i) => {
    const cls = classifyNews(c.title);
    return toNewsEvent(c, `sweep-${Date.now()}-${i}`, cls);
  });

  const criticals = classified.filter((n) => n.severity === "critical");
  const alerts: Array<Omit<AlertEvent, "id" | "isRead">> = criticals.map((n) => ({
    alertType: "news_critical",
    ticker: n.ticker,
    severity: "critical",
    triggerReason: `${n.title} — ${n.classificationReason ?? ""} (${n.source})`,
    signalSentAt: n.fetchedAt,
    outcomeAt: null,
    t7PriceChange: null,
    decisionRecorded: null,
    decisionMemo: null,
  }));

  return NextResponse.json({
    ok: true,
    mockMode: !naverOn,
    fetched: candidates.length,
    classified: {
      critical: criticals.length,
      warning: classified.filter((n) => n.severity === "warning").length,
      info: classified.filter((n) => n.severity === "info").length,
    },
    alertsEmitted: alerts.length,
  });
}
