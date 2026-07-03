import type { SupabaseClient } from "@supabase/supabase-js";
import type { KrBusinessDay } from "@/types/kr-business-days";
import type {
  IntradayContext,
  IntradayTick,
} from "@/lib/intraday/anomaly-detect";
import {
  buildDedupKey,
  detectIntradayAnomaly,
  isTickerEnabledForIntraday,
} from "@/lib/intraday/anomaly-detect";
import type { IntradayMonitorInput } from "@/lib/intraday/monitor";
import { getCurrentHoldings } from "@/lib/data/admin-snapshots";
import { getActiveShortList } from "@/lib/data/admin-shortlist";
import { getAllTickerAlertPrefs } from "@/lib/data/admin-ticker-prefs";
import { fetchEodQuoteMap, type KrxFetchImpl } from "@/lib/data/krx-eod";
import { loadKrBusinessDays } from "@/lib/portfolio/calendar";

// ---------------------------------------------------------------------------
// S7c intraday 연속 WS 워커 — 컨텍스트 조립 (2026-07-04)
// spec: 2026-07-03-prelaunch-netnew-3-builds.md §3 D-10/D-11/D-12
//
// - universe = getCurrentHoldings ∪ getActiveShortList ({client} DI — exit-signal 패턴).
// - referencePrice = 최신 완료 거래일 종가 / avg20dVolume = 직전 20거래일 KRX EOD
//   백필 평균 (일당 KOSPI+KOSDAQ 2콜 — 기동 시 1회). KRX 키 부재/일부 실패는
//   fail-soft: 해당 ticker는 ctx 미생성 → monitor가 skip / volume 부재는 avg 0 →
//   거래량 트리거만 비활성 (anomaly-detect computeVolumeRatio fail-soft와 정합).
// - prefs 집계(D-11): row 없음 = ON(맵 미포함 → isTickerEnabledForIntraday default),
//   어느 한 어드민이라도 ON = enabled (공용 텔레그램 채팅 1개 전제).
// - suppressDuplicateDetections: DB dedup_key(ticker·trigger·1분 bucket)와 동일 키로
//   flush 전 사전 억제 — intraday_anomaly_event는 UNIQUE가 흡수하지만 alert_event
//   (append-only)·telegram은 흡수 장치가 없어 같은 분 내 재발송을 여기서 차단.
// ---------------------------------------------------------------------------

const TICKER_RE = /^\d{6}$/;
export const DEFAULT_VOLUME_LOOKBACK_DAYS = 20;
/** KIS WS 연결당 실시간 등록 상한 (보유+active 30 수용 범위 — 초과분은 잘라내고 경고). */
export const KIS_WS_MAX_SUBSCRIPTIONS = 41;

// ---------------------------------------------------------------------------
// prefs 집계 (순수)
// ---------------------------------------------------------------------------

/**
 * 전 어드민 ticker_alert_pref rows → ticker별 enabled 집계.
 * row 없는 ticker는 맵에 넣지 않음(→ downstream default ON). any-ON = true.
 */
export function aggregateTickerPrefs(
  rows: ReadonlyArray<{ ticker: string; enabled: boolean }>,
): Map<string, boolean> {
  const map = new Map<string, boolean>();
  for (const row of rows) {
    map.set(row.ticker, (map.get(row.ticker) ?? false) || row.enabled);
  }
  return map;
}

// ---------------------------------------------------------------------------
// 완료 거래일 목록 (순수) — krx-eod resolveLatestCompletedTradingDay cutoff 의미 정합
// ---------------------------------------------------------------------------

const KST_OFFSET_MS = 9 * 3600 * 1000;

function kstDateAndHour(now: Date): { date: string; hour: number } {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  return { date: kst.toISOString().slice(0, 10), hour: kst.getUTCHours() };
}

function previousIsoDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * 종가 확정된(장마감 cutoff 18시 KST 반영) 최근 거래일 count개 — asc YYYYMMDD.
 * 장중(09:00–15:30 KST) 호출 시 항상 당일 제외 → 전일 종가가 referencePrice가 된다.
 */
export function listRecentCompletedTradingDays(
  now: Date,
  days: ReadonlyArray<KrBusinessDay>,
  count: number,
  opts: { closeReadyHourKst?: number } = {},
): string[] {
  const { date: todayKst, hour } = kstDateAndHour(now);
  const closeReadyHourKst = opts.closeReadyHourKst ?? 18;
  const todayIsBusinessDay = days.some(
    (d) => d.date === todayKst && d.isBusinessDay,
  );
  const cutoffDate =
    todayIsBusinessDay && hour < closeReadyHourKst
      ? previousIsoDate(todayKst)
      : todayKst;
  return days
    .filter((d) => d.isBusinessDay && d.date <= cutoffDate)
    .map((d) => d.date)
    .sort((a, b) => a.localeCompare(b))
    .slice(-Math.max(0, count))
    .map((d) => d.replace(/-/g, ""));
}

/** 캘린더 로드 실패 시 평일-only fallback 캘린더 (fail-soft). */
export function buildNaiveWeekdayCalendar(from: Date, to: Date): KrBusinessDay[] {
  const out: KrBusinessDay[] = [];
  const cursor = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
  const end = new Date(
    Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()),
  );
  while (cursor <= end) {
    const dow = cursor.getUTCDay();
    out.push({
      date: cursor.toISOString().slice(0, 10),
      isBusinessDay: dow !== 0 && dow !== 6,
      holidayName: null,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

// ---------------------------------------------------------------------------
// tick 버퍼 (순수) — flush 주기 내 같은 ticker는 최신 tick만 유지
// ---------------------------------------------------------------------------

export interface IntradayTickBuffer {
  push(tick: IntradayTick): void;
  /** 현재 버퍼를 비우고 반환 (ticker당 최신 1건). */
  drain(): IntradayTick[];
  size(): number;
}

export function createIntradayTickBuffer(): IntradayTickBuffer {
  let latest = new Map<string, IntradayTick>();
  return {
    push(tick) {
      latest.set(tick.ticker, tick);
    },
    drain() {
      const out = [...latest.values()];
      latest = new Map();
      return out;
    },
    size() {
      return latest.size;
    },
  };
}

// ---------------------------------------------------------------------------
// dedup 사전 억제 (순수)
// ---------------------------------------------------------------------------

/**
 * flush 전 사전 억제: 감지가 예상되는 tick 중 이미 발송한 dedup_key(1분 bucket)와
 * 겹치는 tick을 제거. 무감지/ctx 부재/pref OFF tick은 그대로 통과 — 그 분류는
 * runIntradayMonitorPass(monitor 순수부)가 SoT. 반환된 newDedupKeys는 caller가
 * pass 성공 후 seen set에 merge (실패 시 다음 flush에서 재시도 — telegram best-effort).
 */
export function suppressDuplicateDetections(
  ticks: ReadonlyArray<IntradayTick>,
  input: Pick<IntradayMonitorInput, "contexts" | "prefs" | "customThresholds">,
  seenDedupKeys: ReadonlySet<string>,
): { ticks: IntradayTick[]; newDedupKeys: string[] } {
  const out: IntradayTick[] = [];
  const newKeys: string[] = [];
  const batchKeys = new Set<string>();
  for (const tick of ticks) {
    if (!isTickerEnabledForIntraday(tick.ticker, input.prefs)) {
      out.push(tick); // monitor가 skip 집계
      continue;
    }
    const ctx = input.contexts.get(tick.ticker);
    if (!ctx) {
      out.push(tick); // monitor가 skip 집계
      continue;
    }
    const override = input.customThresholds?.get(tick.ticker);
    const detection = detectIntradayAnomaly(tick, ctx, {
      priceChange: override?.priceChange,
      volumeMultiplier: override?.volumeMultiplier,
    });
    if (!detection) {
      out.push(tick);
      continue;
    }
    const key = buildDedupKey(tick.ticker, detection.triggerType, tick.timestamp);
    if (seenDedupKeys.has(key) || batchKeys.has(key)) continue; // 이미 발송된 분 bucket
    batchKeys.add(key);
    newKeys.push(key);
    out.push(tick);
  }
  return { ticks: out, newDedupKeys: newKeys };
}

// ---------------------------------------------------------------------------
// 컨텍스트 조립
// ---------------------------------------------------------------------------

export interface AssembleIntradayWorkerContextDeps {
  client: SupabaseClient;
  /** KRX_OPENAPI_KEY — 부재 시 contexts 빈 Map (모든 tick skip, 경고). */
  krxAuthKey?: string;
  now?: Date;
  volumeLookbackDays?: number;
  // --- DI seams (기본값 = 실 구현) ---
  getHoldingsImpl?: (opts: {
    client: SupabaseClient;
  }) => Promise<ReadonlyArray<{ ticker: string | null }>>;
  getShortListImpl?: (opts: {
    client: SupabaseClient;
  }) => Promise<ReadonlyArray<{ ticker: string }>>;
  getPrefsImpl?: (opts: {
    client: SupabaseClient;
  }) => Promise<ReadonlyArray<{ ticker: string; enabled: boolean }>>;
  loadBusinessDaysImpl?: (from: Date, to: Date) => Promise<KrBusinessDay[]>;
  fetchQuoteMapImpl?: typeof fetchEodQuoteMap;
  fetchImpl?: KrxFetchImpl;
  sleepImpl?: (ms: number) => Promise<void>;
  log?: (message: string) => void;
}

export interface IntradayWorkerContext {
  /** 구독 대상 (보유 우선 순서, KIS_WS_MAX_SUBSCRIPTIONS 상한). */
  tickers: string[];
  contexts: Map<string, IntradayContext>;
  prefs: Map<string, boolean>;
  warnings: string[];
}

export async function assembleIntradayWorkerContext(
  deps: AssembleIntradayWorkerContextDeps,
): Promise<IntradayWorkerContext> {
  const now = deps.now ?? new Date();
  const lookback = deps.volumeLookbackDays ?? DEFAULT_VOLUME_LOOKBACK_DAYS;
  const getHoldingsImpl = deps.getHoldingsImpl ?? getCurrentHoldings;
  const getShortListImpl = deps.getShortListImpl ?? getActiveShortList;
  const getPrefsImpl = deps.getPrefsImpl ?? getAllTickerAlertPrefs;
  const loadBusinessDaysImpl = deps.loadBusinessDaysImpl ?? loadKrBusinessDays;
  const fetchQuoteMapImpl = deps.fetchQuoteMapImpl ?? fetchEodQuoteMap;
  const log = deps.log ?? ((m: string) => console.log(m));
  const warnings: string[] = [];
  const warn = (message: string) => {
    warnings.push(message);
    log(`[intraday-context] ${message}`);
  };

  // 1) universe = 보유 ∪ active Short List (보유 우선 순서 — 구독 상한 시 보유 보호).
  const [holdings, shortlist] = await Promise.all([
    getHoldingsImpl({ client: deps.client }),
    getShortListImpl({ client: deps.client }),
  ]);
  const universe: string[] = [];
  const seen = new Set<string>();
  for (const t of [
    ...holdings.map((h) => h.ticker),
    ...shortlist.map((s) => s.ticker),
  ]) {
    if (!t || !TICKER_RE.test(t) || seen.has(t)) continue;
    seen.add(t);
    universe.push(t);
  }
  let tickers = universe;
  if (tickers.length > KIS_WS_MAX_SUBSCRIPTIONS) {
    warn(
      `subscription_cap:${tickers.length}>${KIS_WS_MAX_SUBSCRIPTIONS} — 초과분 제외(보유 우선)`,
    );
    tickers = tickers.slice(0, KIS_WS_MAX_SUBSCRIPTIONS);
  }

  // 2) prefs 집계 (any-ON).
  const prefRows = await getPrefsImpl({ client: deps.client });
  const prefs = aggregateTickerPrefs(prefRows);

  if (tickers.length === 0) {
    return { tickers, contexts: new Map(), prefs, warnings };
  }

  // 3) KRX EOD 컨텍스트 — 키 부재는 fail-soft (universe/prefs는 유지).
  const authKey = deps.krxAuthKey?.trim();
  if (!authKey) {
    warn("krx_auth_key_missing — referencePrice/avg20dVolume 없음, 전 tick skip 예정");
    return { tickers, contexts: new Map(), prefs, warnings };
  }

  // 4) 최근 완료 거래일 (캘린더 실패 → 평일 fallback).
  const from = new Date(now.getTime() - 90 * 24 * 3600 * 1000);
  let calendar: KrBusinessDay[];
  try {
    calendar = await loadBusinessDaysImpl(from, now);
    if (calendar.length === 0) throw new Error("calendar_empty");
  } catch (err) {
    warn(
      `calendar_load_failed:${err instanceof Error ? err.message : String(err)} — 평일 fallback`,
    );
    calendar = buildNaiveWeekdayCalendar(from, now);
  }
  const tradingDays = listRecentCompletedTradingDays(now, calendar, lookback);
  if (tradingDays.length === 0) {
    warn("trading_days_empty — 컨텍스트 미생성");
    return { tickers, contexts: new Map(), prefs, warnings };
  }

  // 5) 일당 KOSPI+KOSDAQ 2콜 백필 (기동 시 1회). 실패 일자는 skip fail-soft.
  const dayQuotes: Array<{ day: string; map: Map<string, { close: number; volume: number | null }> }> = [];
  for (const day of tradingDays) {
    try {
      const [kospi, kosdaq] = await Promise.all([
        fetchQuoteMapImpl({
          basDd: day,
          market: "KOSPI",
          authKey,
          fetchImpl: deps.fetchImpl,
          sleepImpl: deps.sleepImpl,
        }),
        fetchQuoteMapImpl({
          basDd: day,
          market: "KOSDAQ",
          authKey,
          fetchImpl: deps.fetchImpl,
          sleepImpl: deps.sleepImpl,
        }),
      ]);
      dayQuotes.push({ day, map: new Map([...kospi, ...kosdaq]) });
    } catch (err) {
      warn(
        `krx_day_failed:${day}:${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  if (dayQuotes.length === 0) {
    warn("krx_all_days_failed — 컨텍스트 미생성");
    return { tickers, contexts: new Map(), prefs, warnings };
  }

  // 6) ticker별 ctx: referencePrice = 최신 성공일 종가(desc 첫 발견), volume = 평균.
  const contexts = new Map<string, IntradayContext>();
  const desc = [...dayQuotes].reverse();
  for (const ticker of tickers) {
    let referencePrice: number | null = null;
    for (const { map } of desc) {
      const quote = map.get(ticker);
      if (quote && quote.close > 0) {
        referencePrice = quote.close;
        break;
      }
    }
    if (referencePrice === null) continue; // 종가 부재 → ctx 미생성 (monitor skip)
    const volumes = dayQuotes
      .map(({ map }) => map.get(ticker)?.volume)
      .filter((v): v is number => v != null && v >= 0);
    const avg20dVolume =
      volumes.length > 0
        ? volumes.reduce((a, b) => a + b, 0) / volumes.length
        : 0; // 거래량 트리거만 비활성
    contexts.set(ticker, { referencePrice, avg20dVolume });
  }

  return { tickers, contexts, prefs, warnings };
}
