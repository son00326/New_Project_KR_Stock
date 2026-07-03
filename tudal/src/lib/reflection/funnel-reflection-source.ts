// G1 Funnel Reflection 입력 로더 (D-3/D-4) — 직전 완료 월 tier0 150 + factor exposure +
//   실현 수익률을 FunnelReflectionInput으로 조립. cron route(funnel-reflection)가 소비.
//
// - period(D-3): getPriorFinalizedCycle(track=midlong) 앵커 재사용 → 'm:YYYY-MM' → 'YYYY-MM'
//   (0047 period_key CHECK 준수). 주간(YYYY-Wnn)은 후속 scaffold 범위 밖.
// - candidates: tier0_candidates_150 해당 월 전 bucket 직접 SELECT(+ticker dedupe 2차 방어).
//   getTier0Candidates를 쓰지 않는 이유 = (a) factor_ranks(0050) 미조회 (b) full-payload
//   strict assert(sector canonical/rank 계약)가 과거 월 legacy rows에서 throw 가능 — 회고
//   로더는 fail-soft가 계약. 0050 미적용 환경의 42703은 factor_ranks 없이 재조회.
// - factorExposures(D-1): 전 행 factor_ranks 유효(champion factor 전부 포함) 시 per-factor,
//   아니면 월 전체를 tier0_score 단일 pseudo-factor로 fallback(meta.exposureSource 명시 —
//   혼합 기저는 순위상관을 오염시키므로 all-or-nothing).
// - realizedReturns(D-4): 대상 월 첫 거래일 종가 → min(월 말 거래일, 최신 완료 거래일) 종가.
//   KRX EOD 무비용(fetchEodPrices DI). 키 부재/창 미형성 → 빈 Map(표본부족 rationale fail-soft).
// - 전부 {client}/deps DI + fail-soft(어떤 실패도 throw 대신 input:null + meta.reason).
// 자동 적용 영구 금지 — 본 로더는 read-only(제안 insert는 route의 별도 DI). 예측 아님.
// SoT: docs/superpowers/specs/2026-07-03-prelaunch-netnew-3-builds.md §2.

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  FunnelCandidate,
  FunnelReflectionInput,
} from "@/lib/reflection/funnel-reflection";
import {
  FUNNEL_CHAMPION_CONFIG,
  TIER0_SCORE_PSEUDO_CONFIG,
  TIER0_SCORE_PSEUDO_FACTOR,
} from "@/lib/reflection/funnel-champion-config";
import { getPriorFinalizedCycle } from "@/lib/data/admin-reflection";
import { resolveLatestCompletedTradingDay } from "@/lib/data/krx-eod";

export type FunnelExposureSource = "factor_ranks" | "tier0_score_fallback";

export interface FunnelCandidateDbRow {
  ticker: string;
  // PostgREST는 numeric을 string으로 반환할 수 있다 (admin-tier0-candidates numOrNull 패턴).
  tier0_score: string | number | null;
  factor_ranks?: unknown;
}

export interface FunnelReturnWindow {
  entryBasDd: string; // YYYYMMDD — 대상 월 첫 거래일
  exitBasDd: string; // YYYYMMDD — min(월 말 거래일, 최신 완료 거래일)
}

export interface LoadFunnelReflectionDeps {
  client: SupabaseClient;
  now?: Date;
  loadBusinessDays: (
    from: Date,
    to: Date,
  ) => Promise<ReadonlyArray<{ date: string; isBusinessDay: boolean }>>;
  /** tickers의 basDd KRX EOD 종가 병합 Map. null = KRX 키 부재(fail-soft 빈 realizedReturns). */
  fetchEodPrices:
    | ((tickers: readonly string[], basDd: string) => Promise<Map<string, number>>)
    | null;
}

export interface LoadedFunnelReflectionInput {
  input: FunnelReflectionInput | null;
  meta: {
    reason?: string;
    month?: string;
    exposureSource?: FunnelExposureSource;
    candidateCount?: number;
    returnWindow?: FunnelReturnWindow | null;
  };
}

/** 'm:YYYY-MM' → 'YYYY-MM' (0047 CHECK 포맷). 그 외 포맷 → null(fail-soft). */
export function mapPriorPeriodKeyToMonth(periodKey: string): string | null {
  const m = /^m:(\d{4}-(0[1-9]|1[0-2]))$/.exec(periodKey);
  return m ? m[1] : null;
}

/**
 * D-4 실현수익 창: 대상 월 첫 거래일 → min(월 말 거래일, 최신 완료 거래일).
 * 거래일 2개 미만(창 미형성)·calendar stale(fail-closed null) → null.
 */
export function resolveMonthReturnWindow(
  month: string, // YYYY-MM
  now: Date,
  businessDays: ReadonlyArray<{ date: string; isBusinessDay: boolean }>,
): FunnelReturnWindow | null {
  const monthDays = businessDays
    .filter((d) => d.isBusinessDay && d.date.startsWith(`${month}-`))
    .map((d) => d.date.replace(/-/g, ""))
    .sort();
  if (monthDays.length === 0) return null;
  const entryBasDd = monthDays[0];
  const monthEnd = monthDays[monthDays.length - 1];
  const latestCompleted = resolveLatestCompletedTradingDay(now, businessDays);
  if (!latestCompleted) return null;
  const exitBasDd = monthEnd <= latestCompleted ? monthEnd : latestCompleted;
  // 동일/역전 날짜 = 수익률 창 미형성(전 종목 0% → 무의미 제안이 period UNIQUE를 선점) → null.
  if (exitBasDd <= entryBasDd) return null;
  return { entryBasDd, exitBasDd };
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function numOrNull(v: string | number | null): number | null {
  if (v === null) return null;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

/** factor_ranks jsonb → 유한값 record. champion factor(trend/size) 결손 시 null(fallback 유도). */
function parseFactorRanks(raw: unknown): Record<string, number> | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (isFiniteNumber(v)) out[k] = v;
  }
  const hasAllChampionFactors = Object.keys(FUNNEL_CHAMPION_CONFIG).every(
    (f) => f in out,
  );
  return hasAllChampionFactors ? out : null;
}

/**
 * DB rows → FunnelCandidate[] + exposure 기저 판정 (순수).
 * 전 행(dedupe 후) factor_ranks 유효 → per-factor. 한 행이라도 결손 → 월 전체 pseudo-factor
 * fallback(혼합 기저 금지 — 결손 행 exposure=0 오염 방지).
 */
export function buildFunnelCandidates(rows: ReadonlyArray<FunnelCandidateDbRow>): {
  candidates: FunnelCandidate[];
  exposureSource: FunnelExposureSource;
} {
  const seen = new Set<string>();
  const deduped: FunnelCandidateDbRow[] = [];
  for (const r of rows) {
    if (typeof r.ticker !== "string" || r.ticker === "" || seen.has(r.ticker)) continue;
    seen.add(r.ticker);
    deduped.push(r);
  }

  const parsed = deduped.map((r) => parseFactorRanks(r.factor_ranks));
  const allHaveRanks = deduped.length > 0 && parsed.every((p) => p !== null);
  if (allHaveRanks) {
    return {
      exposureSource: "factor_ranks",
      candidates: deduped.map((r, i) => ({
        ticker: r.ticker,
        factorExposures: parsed[i] as Record<string, number>,
      })),
    };
  }

  const candidates: FunnelCandidate[] = [];
  for (const r of deduped) {
    const score = numOrNull(r.tier0_score);
    if (score === null) continue; // 비수치 score 행은 제외(fail-soft)
    candidates.push({
      ticker: r.ticker,
      factorExposures: { [TIER0_SCORE_PSEUDO_FACTOR]: score },
    });
  }
  return { exposureSource: "tier0_score_fallback", candidates };
}

/** entry/exit 종가 → 실현 수익률(percentage points). 어느 한쪽 결측/entry≤0 → 해당 ticker 제외. */
export function computeRealizedReturns(
  tickers: readonly string[],
  entryPrices: ReadonlyMap<string, number>,
  exitPrices: ReadonlyMap<string, number>,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const t of tickers) {
    const entry = entryPrices.get(t);
    const exit = exitPrices.get(t);
    if (entry == null || exit == null) continue;
    if (!Number.isFinite(entry) || !Number.isFinite(exit) || entry <= 0) continue;
    out.set(t, Number((((exit - entry) / entry) * 100).toFixed(4)));
  }
  return out;
}

/** tier0_candidates_150 해당 월 전 bucket SELECT. 0050 미적용(42703) → factor_ranks 없이 재조회. */
async function selectCandidateRows(
  client: SupabaseClient,
  month: string,
): Promise<FunnelCandidateDbRow[]> {
  const monthDate = `${month}-01`;
  const withRanks = await client
    .from("tier0_candidates_150")
    .select("ticker, tier0_score, factor_ranks")
    .eq("month", monthDate);
  if (!withRanks.error) {
    return (withRanks.data ?? []) as FunnelCandidateDbRow[];
  }
  if (withRanks.error.code !== "42703") {
    throw new Error(
      `funnel_source_query_failed:${withRanks.error.code ?? "unknown"}`,
    );
  }
  const fallback = await client
    .from("tier0_candidates_150")
    .select("ticker, tier0_score")
    .eq("month", monthDate);
  if (fallback.error) {
    throw new Error(
      `funnel_source_query_failed:${fallback.error.code ?? "unknown"}`,
    );
  }
  return (fallback.data ?? []) as FunnelCandidateDbRow[];
}

/**
 * FunnelReflectionInput 조립 (fail-soft — 어떤 실패도 throw 대신 input:null + meta.reason).
 * 소비자: /api/cron/funnel-reflection → runFunnelReflectionJob(insert 제안만, 자동 적용 0).
 */
export async function loadFunnelReflectionInput(
  deps: LoadFunnelReflectionDeps,
): Promise<LoadedFunnelReflectionInput> {
  try {
    const now = deps.now ?? new Date();

    const prior = await getPriorFinalizedCycle({
      track: "midlong",
      now,
      client: deps.client,
    });
    if (!prior) {
      return { input: null, meta: { reason: "no_finalized_midlong_cycle" } };
    }
    const month = mapPriorPeriodKeyToMonth(prior.periodKey);
    if (!month) {
      return {
        input: null,
        meta: { reason: `unmapped_period_key:${prior.periodKey}` },
      };
    }

    const rows = await selectCandidateRows(deps.client, month);
    if (rows.length === 0) {
      return { input: null, meta: { reason: "no_tier0_candidates", month } };
    }
    const { candidates, exposureSource } = buildFunnelCandidates(rows);
    if (candidates.length === 0) {
      return { input: null, meta: { reason: "no_usable_candidates", month } };
    }

    // 실현 수익률 — KRX 키 부재(fetchEodPrices null)/창 미형성 → 빈 Map(표본부족 fail-soft).
    let realizedReturns = new Map<string, number>();
    let returnWindow: FunnelReturnWindow | null = null;
    if (deps.fetchEodPrices) {
      const monthStart = new Date(`${month}-01T00:00:00Z`);
      const businessDays = await deps.loadBusinessDays(monthStart, now);
      returnWindow = resolveMonthReturnWindow(month, now, businessDays);
      if (returnWindow) {
        const tickers = candidates.map((c) => c.ticker);
        const [entryPrices, exitPrices] = await Promise.all([
          deps.fetchEodPrices(tickers, returnWindow.entryBasDd),
          deps.fetchEodPrices(tickers, returnWindow.exitBasDd),
        ]);
        realizedReturns = computeRealizedReturns(tickers, entryPrices, exitPrices);
      }
    }

    return {
      input: {
        periodKey: month,
        championConfig:
          exposureSource === "factor_ranks"
            ? { ...FUNNEL_CHAMPION_CONFIG }
            : { ...TIER0_SCORE_PSEUDO_CONFIG },
        candidates,
        realizedReturns,
      },
      meta: {
        month,
        exposureSource,
        candidateCount: candidates.length,
        returnWindow,
      },
    };
  } catch (err) {
    return {
      input: null,
      meta: {
        reason: `loader_failed:${err instanceof Error ? err.message : String(err)}`,
      },
    };
  }
}
