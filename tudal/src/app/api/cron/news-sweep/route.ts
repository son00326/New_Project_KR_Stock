import { NextResponse, type NextRequest } from "next/server";
import { MOCK_ADMIN_NEWS } from "@/lib/data/mock-admin-news";
import type { NewsCandidate } from "@/lib/news/classifier";
import {
  classifyNews,
  dedupeByUrl,
  toNewsEvent,
} from "@/lib/news/classifier";
import { fetchNaverNews } from "@/lib/news/naver-api";
import { scrapeSources } from "@/lib/news/scraper";
import type { AlertEvent } from "@/types/admin";

// Vercel Cron 15분 주기. ServicePlan-Admin §3.10 R3.10-1~3.
// 네이버 뉴스 API 1차 + 스크래핑 2차(stub) → classifier → dedupe → Critical만 AlertEvent 발행.
// mock-mode(NAVER 키 미설정): MOCK_ADMIN_NEWS를 결과로 노출.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
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

  // mock-mode: Naver 키 없음 → fetch 생략, fixture 노출
  const naverOn = Boolean(process.env.NAVER_CLIENT_ID);
  let candidates: NewsCandidate[] = [];

  if (naverOn) {
    const batches = await Promise.all(
      WATCHLIST_QUERIES.map((w) =>
        fetchNaverNews({ query: w.query, ticker: w.ticker, display: 20 }).catch(
          () => [] as NewsCandidate[],
        ),
      ),
    );
    const scraped = await scrapeSources([]);
    candidates = dedupeByUrl([...batches.flat(), ...scraped]);
  } else {
    // dev/mock 모드: fixture 타이틀만 재분류해 흐름 검증
    candidates = MOCK_ADMIN_NEWS.map((n) => ({
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
