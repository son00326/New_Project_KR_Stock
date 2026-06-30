import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRecentNewsEvents, insertNewsEvents } from "@/lib/data/admin-news";
import { insertAlertEvents } from "@/lib/data/admin-alerts-insert";
import { getActiveShortList } from "@/lib/data/admin-shortlist";
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
// 2026-06-29: live 워치리스트 = 활성 short_list_30(getActiveShortList) — 구 3종 하드코딩 대체.
//   news_event를 실 선정 유니버스로 채우는 "수집 단계" 정합(M12a/모닝 브리핑의 전제조건).
//   ※ M12a의 뉴스 read 윈도 per-ticker 유니버스 커버리지: resolved (getRecentNewsEventsForUniverse) —
//     briefing-integration이 [...listTracks.keys()] 전체에 대해 종목별 .limit(perTickerLimit) 윈도로 읽어
//     hot 종목이 quiet 종목 슬롯을 잠식하던 tail starvation 해소.
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

// 2026-06-29: 워치리스트 = 활성 short_list_30 (M12a/모닝 브리핑이 평가하는 그 선정 종목).
//   구 3종 하드코딩(삼성전자/SK하이닉스/NAVER)은 실 선정 유니버스와 무관해 29/30 종목 뉴스 굶음 →
//   getActiveShortList(service-role)로 ticker+name 조인. Naver 일 25,000 쿼터 대비 방어 cap(설계상 ≤30).
const MAX_WATCHLIST_QUERIES = 30;

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

  // service-role client는 분기별 1회 생성 후 재사용.
  //   live: 워치리스트(short_list_30) read를 위해 fetch 전에 생성 → INSERT에서 재사용.
  //   mock: READ fallback 직전 생성 → INSERT에서 재사용.
  let serviceRoleClient: SupabaseClient | null = null;
  const naverOn = hasNaverClientId && hasNaverClientSecret;
  let candidates: NewsCandidate[] = [];

  if (naverOn) {
    // 실 유니버스 = 활성 short_list_30. cron context는 service-role read(RLS using(is_admin) 우회).
    // 이 client는 아래 INSERT에서 재사용(1회 생성 invariant 유지).
    serviceRoleClient = createServiceRoleClient();
    const shortlist = await getActiveShortList({ client: serviceRoleClient });
    if (shortlist.length > MAX_WATCHLIST_QUERIES) {
      // 무음 절단 방지: 유니버스가 cap을 넘으면 ops 로그로 표면화(M12a/exit-signal은 uncapped 소비 → tail starvation 경보).
      console.warn(
        JSON.stringify({
          event: "news_sweep_universe_truncated",
          universe: shortlist.length,
          cap: MAX_WATCHLIST_QUERIES,
        }),
      );
    }
    const watchlist = shortlist
      .map((s) => ({ ticker: s.ticker, query: s.name }))
      .slice(0, MAX_WATCHLIST_QUERIES);
    if (watchlist.length === 0) {
      // 키는 설정됐으나 선정 유니버스가 비어있음(미시드/리셋) — 굶음 graceful + ops 신호.
      console.warn(JSON.stringify({ event: "news_sweep_empty_universe" }));
    }
    const results = await Promise.allSettled(
      watchlist.map((w) =>
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
    // Step 2.7b.1 (2026-05-28) — service-role client 주입.
    // Step 2.7b.2 (2026-05-28) — lazy create: mock branch는 READ fallback 직전 1회 생성,
    // 이후 WRITE에서 동일 인스턴스 재사용.
    serviceRoleClient = createServiceRoleClient();
    const recent = await getRecentNewsEvents({
      client: serviceRoleClient,
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

  // Step 2.7b.2: classified news_event batch upsert via service-role.
  // ON CONFLICT (url) DO NOTHING (plan §0 D2). 양 분기 모두 위에서 client를 생성하므로 여기선 non-null;
  // null 가드는 방어용(미래 분기 추가 대비).
  if (serviceRoleClient === null) {
    serviceRoleClient = createServiceRoleClient();
  }
  let dbError: string | null = null;
  try {
    await insertNewsEvents(classified, { client: serviceRoleClient });
  } catch (err) {
    dbError ??= err instanceof Error ? err.message : "news_event_insert_failed:unknown";
  }

  // Step 2.7b.3: news_critical alert_event INSERT. independent best-effort (plan §0 D6):
  // news_event 실패와 무관하게 시도. dbError ??= (첫 실패 보존). alerts 빈 배열 시 short-circuit.
  // alertInsertOk: response alertsEmitted가 dbError(news_event)와 무관하게 실제 alert 성공 반영
  // (omxy R2 MED-2 — news_event fail + alert success 시 alertsEmitted 0 거짓 보고 차단).
  let alertInsertOk = false;
  try {
    await insertAlertEvents(alerts, { client: serviceRoleClient });
    alertInsertOk = true;
  } catch (err) {
    dbError ??= err instanceof Error ? err.message : "alert_event_insert_failed:unknown";
  }

  return NextResponse.json(
    {
      ok: !dbError,
      mockMode: !naverOn,
      fetched: candidates.length,
      classified: {
        critical: criticals.length,
        warning: classified.filter((n) => n.severity === "warning").length,
        info: classified.filter((n) => n.severity === "info").length,
      },
      alertsEmitted: alertInsertOk ? alerts.length : 0,
      dbError,
    },
    { status: dbError ? 502 : 200 },
  );
}
