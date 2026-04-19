import type { NewsCandidate } from "@/lib/news/classifier";

// ---------------------------------------------------------------------------
// 네이버 뉴스 검색 API 어댑터 (BL-13 A, S5a T5a.3)
// ref: https://developers.naver.com/docs/serviceapi/search/news/news.md
//
// API 제약:
//   - 일 25,000회 쿼터. 30종 × 15분 주기 = 2,880회 가정 → 여유.
//   - display 최대 100. 단일 쿼터 요청당 최근 순 정렬(sort=date).
//   - 요청 헤더: X-Naver-Client-Id · X-Naver-Client-Secret
//
// MOCK 모드: NAVER_CLIENT_ID 미설정 시 빈 배열 반환 (unit test는 주입 fixture 사용).
// ---------------------------------------------------------------------------

const NAVER_NEWS_ENDPOINT = "https://openapi.naver.com/v1/search/news.json";

interface NaverNewsItem {
  title: string;
  originallink: string;
  link: string;
  description: string;
  pubDate: string;
}

interface NaverNewsResponse {
  items: NaverNewsItem[];
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function resolveSource(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host;
  } catch {
    return "unknown";
  }
}

export interface FetchNaverNewsOptions {
  query: string;
  ticker?: string | null; // 매핑용 (ticker ↔ query name)
  display?: number; // 1~100
  start?: number;
  sort?: "date" | "sim";
  fetchImpl?: typeof fetch; // 테스트 주입용
}

export async function fetchNaverNews(
  opts: FetchNaverNewsOptions,
): Promise<NewsCandidate[]> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.warn(
      "[naver-api] NAVER_CLIENT_ID/SECRET 미설정 — mock-mode 빈 배열 반환.",
    );
    return [];
  }

  const url = new URL(NAVER_NEWS_ENDPOINT);
  url.searchParams.set("query", opts.query);
  url.searchParams.set("display", String(opts.display ?? 20));
  url.searchParams.set("start", String(opts.start ?? 1));
  url.searchParams.set("sort", opts.sort ?? "date");

  const fetchFn = opts.fetchImpl ?? fetch;
  const res = await fetchFn(url.toString(), {
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
    },
  });

  if (!res.ok) {
    throw new Error(`naver news HTTP ${res.status}`);
  }

  const json = (await res.json()) as NaverNewsResponse;
  return json.items.map((item) => ({
    ticker: opts.ticker ?? null,
    title: stripHtml(item.title),
    source: resolveSource(item.originallink || item.link),
    url: item.originallink || item.link,
    publishedAt: new Date(item.pubDate).toISOString(),
  }));
}
