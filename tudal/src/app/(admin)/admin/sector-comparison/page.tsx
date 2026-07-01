import { createClient } from "@/lib/supabase/server";
import { getActiveShortList } from "@/lib/data/admin-shortlist";
import {
  getShadowArmTop,
  monthToPeriodKey,
  type ShadowArmRow,
} from "@/lib/data/admin-sector-comparison";
import { resolveEntryPricesKrw } from "@/lib/data/krx-eod";
import { computeRealizedReturns, type RealizedReturnSummary } from "@/lib/screening/shortlist-returns";
import {
  candidateBasDdsBackFrom,
  nowKstBasDd,
  signalDateToBasDd,
} from "@/lib/intraday/exit-outcome";
import { resolveShortlistGeneratedAt } from "@/lib/portfolio/shortlist-gate";
import type { ShortListItem } from "@/types/admin";

// B-1 섹터 추천 비교 메뉴 (출시 전 read-only deliverable).
// production B++ 30(short_list_30, Tier-1 AI) vs Track-2 sector-soft-tilt top-30(결정론) + 각 실현 수익률.
// 가드: hard-gate live 영구 금지(soft only) · 검증 전 production 자동 교체 없음 · Track-2 30 = AI 선정 아님.
// shadow-first: 0039/0046 미적용·shadow run 부재 → Track-2 빈 상태(production 30은 항상 표시).
// SoT: docs/superpowers/specs/2026-06-28-sector-comparison-menu.md

export const dynamic = "force-dynamic";

const MAX_BACK_DAYS = 5; // 휴장/주말/장중-pre-close walk-back 상한

function fmtPct(n: number | null): string {
  if (n === null) return "—";
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function formatPeriodLabel(periodKey: string | null): string {
  if (!periodKey) return "—";
  const monthly = periodKey.match(/^(\d{4})-(\d{2})$/);
  if (!monthly) return "최근 기준 후보";
  return `${monthly[1]}년 ${Number(monthly[2])}월 후보`;
}

function pctColor(n: number | null): string {
  if (n === null) return "text-market-neutral";
  return n < 0
    ? "text-market-down"
    : n > 0
      ? "text-market-up"
      : "text-market-neutral";
}

// anchor부터 과거로 walk-back하며 첫 "거래일(가격 존재)" 종가 Map 반환 — 휴장/주말/pre-close 보정.
// per-basDd 캐시 공유(union tickers 1회 fetch) → production/shadow 양 set 재조회 방지.
async function resolveCloseMapWalkBack(
  anchorBasDd: string | null,
  tickers: string[],
  authKey: string,
  cache: Map<string, Map<string, number>>,
): Promise<Map<string, number>> {
  for (const basDd of candidateBasDdsBackFrom(anchorBasDd, MAX_BACK_DAYS)) {
    let map = cache.get(basDd);
    if (!map) {
      try {
        map = await resolveEntryPricesKrw(tickers, { authKey, basDd });
      } catch {
        map = new Map();
      }
      cache.set(basDd, map);
    }
    if (map.size > 0) return map; // 가격 존재 = 거래일 → 채택.
  }
  return new Map();
}

function ListCard({
  title,
  subtitle,
  rows,
  otherTickers,
  summary,
}: {
  title: string;
  subtitle: string;
  rows: Array<{ ticker: string; name: string; sector: string; bucket: string; rank?: number }>;
  otherTickers: Set<string>;
  summary: RealizedReturnSummary | null;
}) {
  const retByTicker = new Map(
    (summary?.perTicker ?? []).map((p) => [p.ticker, p.returnPct]),
  );
  return (
    <section className="rounded-2xl border bg-card p-4 shadow-toss-sm">
      <header className="mb-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
        <p className="mt-1 text-xs">
          평균 실현 수익률:{" "}
          <strong className={`tabular-nums ${pctColor(summary?.avgReturnPct ?? null)}`}>
            {fmtPct(summary?.avgReturnPct ?? null)}
          </strong>
          {summary && (
            <span className="text-muted-foreground">
              {" "}
              · 중앙값 <span className={pctColor(summary.medianReturnPct)}>{fmtPct(summary.medianReturnPct)}</span> · {summary.pricedCount}종 산입
              {summary.missingCount > 0 && ` · ${summary.missingCount}종 가격 누락`}
            </span>
          )}
        </p>
      </header>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">아직 준비 중입니다.</p>
      ) : (
        <ol className="space-y-1 text-xs">
          {rows.map((r) => {
            const onlyHere = !otherTickers.has(r.ticker);
            const ret = retByTicker.get(r.ticker) ?? null;
            return (
              <li
                key={`${r.ticker}-${r.bucket}-${r.rank ?? ""}`}
                className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1 ${onlyHere ? "bg-warning/10" : ""}`}
              >
                <span className="truncate">
                  <span className="text-muted-foreground tabular-nums">{r.ticker}</span>{" "}
                  {r.name} <span className="text-muted-foreground">· {r.sector}</span>
                  {onlyHere && <span className="ml-1 text-warning">·고유</span>}
                </span>
                <span className={`tabular-nums ${pctColor(ret)}`}>{fmtPct(ret)}</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export default async function SectorComparisonPage() {
  const supabase = await createClient();
  const { data: isAdmin, error: adminErr } = await supabase.rpc("is_admin");
  const adminVerified = !(adminErr || !isAdmin);

  let production: ShortListItem[] = [];
  let productionLoadError = false;
  try {
    production = await getActiveShortList({ client: supabase });
  } catch {
    productionLoadError = true;
  }
  const month = production[0]?.month ?? null;
  const periodKey = month ? monthToPeriodKey(month) : null;
  let shadow: ShadowArmRow[] = [];
  let shadowLoadError = false;
  if (periodKey) {
    try {
      shadow = await getShadowArmTop("sector-soft-tilt", periodKey, {
        client: supabase,
        limitPerBucket: 10,
      });
    } catch {
      shadowLoadError = true;
    }
  }

  const prodTickers = production.map((p) => p.ticker);
  const shadowTickers = shadow.map((s) => s.ticker);
  const prodSet = new Set(prodTickers);
  const shadowSet = new Set(shadowTickers);

  // 실현 수익률 — KRX 키 있을 때만(USER 게이트). entry=선정 기준일 / current=최신 거래일(walk-back).
  // union tickers 1회 fetch(공유 캐시) → entry/current Map 해석 후 양 set 동일 기준 비교(apples-to-apples).
  const now = new Date();
  const authKey = process.env.KRX_OPENAPI_KEY?.trim();
  let prodReturns: RealizedReturnSummary | null = null;
  let shadowReturns: RealizedReturnSummary | null = null;
  const allTickers = Array.from(new Set([...prodTickers, ...shadowTickers]));
  const shortlistGeneratedAt = resolveShortlistGeneratedAt(production);
  if (authKey && allTickers.length > 0 && shortlistGeneratedAt) {
    const cache = new Map<string, Map<string, number>>();
    const entryAnchor = signalDateToBasDd(shortlistGeneratedAt.toISOString());
    const currentAnchor = nowKstBasDd(now);
    const [entryMap, currentMap] = await Promise.all([
      resolveCloseMapWalkBack(entryAnchor, allTickers, authKey, cache),
      resolveCloseMapWalkBack(currentAnchor, allTickers, authKey, cache),
    ]);
    prodReturns = computeRealizedReturns(prodTickers, entryMap, currentMap);
    shadowReturns =
      shadowTickers.length > 0
        ? computeRealizedReturns(shadowTickers, entryMap, currentMap)
        : null;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">종목 선정 방식 비교 (실험)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          AI 추천 30과 섹터 가중 후보 30의 결과를 비교하는 참고 실험입니다.
        </p>
        <p className="mt-2 rounded-2xl border border-info/30 bg-info/10 px-3 py-2 text-xs text-info shadow-toss-sm">
          참고용 실험 화면입니다 — 두 방식의 결과를 나란히 살펴보기 위한 비교이며,
          실제 추천/운영에 자동으로 반영되지 않습니다.
        </p>
        {!adminVerified && (
          <p
            role="status"
            className="mt-2 rounded-2xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs font-medium text-warning shadow-toss-sm"
          >
            ⚠ 권한 미확인 — 관리자 계정 등록을 확인해 주세요. 빈 데이터는 권한
            확인 실패 때문일 수 있습니다.
          </p>
        )}
      </header>

      {(productionLoadError || shadowLoadError) && (
        <p className="rounded-2xl border bg-muted/30 px-3 py-2 text-xs text-muted-foreground shadow-toss-sm">
          일부 데이터를 불러오지 못해 가능한 목록만 표시합니다. 잠시 후 다시
          시도해 주세요.
        </p>
      )}

      {shadow.length === 0 && (
        <p className="rounded-2xl border bg-muted/30 px-6 py-8 text-center text-sm text-muted-foreground shadow-toss-sm">
          아직 비교 데이터가 없습니다 — 섹터 가중 후보가 준비되면 AI 추천 30과
          나란히 비교됩니다. (AI 추천 30은 항상 표시됩니다.)
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <ListCard
          title="AI 추천 30"
          subtitle={month ? `${month.slice(0, 7)} 추천` : "선정 부재"}
          rows={production.map((p) => ({
            ticker: p.ticker,
            name: p.name,
            sector: p.sector,
            bucket: p.bucket,
            rank: p.rank,
          }))}
          otherTickers={shadowSet}
          summary={prodReturns}
        />
        <ListCard
          title="섹터 가중 후보 30 (자동 계산)"
          subtitle={formatPeriodLabel(periodKey)}
          rows={shadow.map((s) => ({
            ticker: s.ticker,
            name: s.name ?? s.ticker,
            sector: s.sector,
            bucket: s.bucket,
            rank: s.rank,
          }))}
          otherTickers={prodSet}
          summary={shadowReturns}
        />
      </div>

      <footer className="text-xs text-muted-foreground">
        ※ 노란 배경 = 한쪽에만 있는 종목입니다 (두 방식이 서로 다르게 고른 종목).
        실현 수익률은 시세 데이터가 연결된 경우에만 표시됩니다(미연결 =
        &quot;—&quot;).
      </footer>
    </div>
  );
}
