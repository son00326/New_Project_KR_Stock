import type { MacroIndicator } from "@/types/macro";
// ⚠️ 가드레일: 이 어댑터는 src/lib/macro/ 내부 파일이지만, MACRO_IMPORT_RE는 src/ 전체를
//   walk하므로 '@/lib/macro/*' 경로로 import 하면 자기 자신이 외부 importer로 잡힌다.
//   → context/verdict-builder 타입·함수는 반드시 상대경로(./)로 import 한다(regex 미매치).
import type { MacroContextSource } from "./context";
import { buildVerdictFromIndicators } from "./verdict-builder";

// ---------------------------------------------------------------------------
// G4 fred-adapter — 실 FRED REST 어댑터. 산출물은 "문자열 컨텍스트" source(Tier0 factor 아님).
// SoT: docs/superpowers/specs/2026-06-26-g4-macro-news-ai-context-layer-design.md
//
// 패턴 = krx-eod.ts(FetchResult 추상화 + fetchImpl DI + key-never-logged + backoff)
//   + AbortController timeout(krx/naver 둘 다 없음). throws는 어댑터 내부에 머물고,
//   source.ts 경계의 try/catch가 흡수해 consumer엔 ""만 도달한다(naver-api.ts의
//   throw-on-!ok를 source 경계로 verbatim 복제하지 않는다).
// api_key는 로그/에러/thrown 메시지에 절대 미포함(status + seriesId만).
// ---------------------------------------------------------------------------

const FRED_OBSERVATIONS = "https://api.stlouisfed.org/fred/series/observations";
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 4;
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_OBSERVATION_WINDOW = 7;
const CPI_OBSERVATION_WINDOW = 20;
const MIN_VALID_INDICATOR_COUNT = 6;
const DEFAULT_SERIES_BUDGET_MS = 9000;

export interface FredFetchResult {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}
export type FredFetchImpl = (url: string) => Promise<FredFetchResult>;
export interface FredObservation {
  date: string;
  value: string;
}

type FredSeriesResult = {
  readonly seriesId: string;
  readonly observations: FredObservation[] | null;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function defaultFetchImpl(timeoutMs: number): FredFetchImpl {
  return async (url: string) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const r = await fetch(url, { signal: controller.signal });
      return { ok: r.ok, status: r.status, json: () => r.json() };
    } finally {
      clearTimeout(timer);
    }
  };
}

/**
 * 1 series fetch → newest-window observations(desc). key = opts.apiKey ?? process.env.FRED_API_KEY.
 * 4xx 즉시 throw(키 문제 노출 — 값 미포함). 429/5xx/네트워크 → backoff 재시도(MAX_RETRIES).
 * 에러 메시지 = `fred_fetch_failed:${status}:${seriesId}` (api_key/URL 미포함).
 */
export async function fetchFredSeries(opts: {
  seriesId: string;
  limit?: number;
  apiKey?: string;
  fetchImpl?: FredFetchImpl;
  sleepImpl?: (ms: number) => Promise<void>;
  timeoutMs?: number;
}): Promise<FredObservation[]> {
  const apiKey = (opts.apiKey ?? process.env.FRED_API_KEY ?? "").trim();
  if (!apiKey) throw new Error("fred_api_key_missing");
  const fetchImpl = opts.fetchImpl ?? defaultFetchImpl(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const sleep =
    opts.sleepImpl ?? ((ms) => new Promise<void>((res) => setTimeout(res, ms)));
  const params = new URLSearchParams({
    series_id: opts.seriesId,
    api_key: apiKey,
    file_type: "json",
    sort_order: "desc",
    limit: String(opts.limit ?? 2),
  });
  const url = `${FRED_OBSERVATIONS}?${params.toString()}`;
  let lastStatus = 0;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    let res: FredFetchResult;
    try {
      res = await fetchImpl(url);
    } catch {
      // 네트워크/타임아웃(Abort) → backoff 재시도.
      if (attempt < MAX_RETRIES - 1) await sleep(1500 * 2 ** attempt);
      continue;
    }
    if (res.status === 200) {
      const payload = await res.json();
      if (!isRecord(payload)) {
        throw new Error(`fred_fetch_failed:payload_invalid:${opts.seriesId}`);
      }
      const rows = payload["observations"];
      if (!Array.isArray(rows)) {
        throw new Error(`fred_fetch_failed:payload_invalid:${opts.seriesId}`);
      }
      const out: FredObservation[] = [];
      for (const row of rows) {
        if (!isRecord(row)) continue;
        const date = String(row["date"] ?? "");
        const value = String(row["value"] ?? "");
        if (date) out.push({ date, value });
      }
      return out;
    }
    lastStatus = res.status;
    if (!RETRYABLE.has(res.status)) {
      // 4xx 등 비재시도 → 즉시 throw(api_key 미포함).
      throw new Error(`fred_fetch_failed:${res.status}:${opts.seriesId}`);
    }
    if (attempt < MAX_RETRIES - 1) await sleep(1500 * 2 ** attempt);
  }
  throw new Error(
    `fred_fetch_failed:retries_exhausted:${lastStatus}:${opts.seriesId}`,
  );
}

// FRED series_id → MacroIndicator 메타 + signal 규칙. signal은 DESCRIPTIVE state-classification(예측 아님).
interface SeriesSpec {
  id: string;
  name: string;
  nameKo: string;
  category: MacroIndicator["category"];
  unit: string;
  limit: number;
  // (value, prev, change, changePercent, yoyChange?) → signal. yoyChange는 CPI 전용.
  signal: (m: {
    value: number;
    prev: number;
    change: number;
    changePercent: number;
    yoyChange: number | null;
  }) => MacroIndicator["signal"];
  describe: (m: {
    value: number;
    change: number;
    changePercent: number;
    yoyChange: number | null;
  }) => string;
}

const f = (n: number) => Number(n.toFixed(3));

// 9 FRED series. DROPPED(FRED 미제공/MVP 제외): fear-greed(CNN)·put-call(CBOE)·
//   kr-cpi/bok-rate(FRED 한국 갱신 지연)·us-2y(T10Y2Y로 대체)·us-ppi/us-gdp/gold(MVP 제외).
const SERIES_SPECS: Record<string, SeriesSpec> = {
  VIXCLS: {
    id: "vix",
    name: "VIX",
    nameKo: "변동성 지수",
    category: "sentiment",
    unit: "",
    limit: 2,
    signal: ({ value }) => (value >= 20 ? "bearish" : value <= 15 ? "bullish" : "neutral"),
    describe: ({ value }) =>
      `VIX ${f(value)}(${value >= 20 ? ">=20 시장 불안" : value <= 15 ? "<=15 안정" : "15~20 중립"}).`,
  },
  DGS10: {
    id: "us-10y",
    name: "US 10Y Treasury",
    nameKo: "미국 10년물 국채 수익률",
    category: "rates",
    unit: "%",
    limit: 2,
    signal: ({ change }) =>
      change < -0.02 ? "bullish" : change > 0.02 ? "bearish" : "neutral",
    describe: ({ value, change }) =>
      `미국 10년물 ${f(value)}%(전일대비 ${f(change)}%p).`,
  },
  T10Y2Y: {
    id: "yield-curve-10y2y",
    name: "10Y-2Y Spread",
    nameKo: "장단기 금리차(10Y-2Y)",
    category: "rates",
    unit: "%p",
    limit: 2,
    signal: ({ value, change }) =>
      value < 0 ? "bearish" : change > 0 ? "bullish" : "neutral",
    describe: ({ value, change }) =>
      `10Y-2Y 스프레드 ${f(value)}%p(${value < 0 ? "역전" : "정상"}, 전일대비 ${f(change)}%p).`,
  },
  FEDFUNDS: {
    id: "fed-rate",
    name: "Fed Funds Rate",
    nameKo: "미국 기준금리",
    category: "rates",
    unit: "%",
    limit: 2,
    signal: ({ change }) => (change < 0 ? "bullish" : change > 0 ? "bearish" : "neutral"),
    describe: ({ value, change }) =>
      `미국 기준금리 ${f(value)}%(전월대비 ${f(change)}%p).`,
  },
  UNRATE: {
    id: "us-unemployment",
    name: "US Unemployment",
    nameKo: "미국 실업률",
    category: "economic",
    unit: "%",
    limit: 2,
    signal: ({ change }) =>
      change >= 0.2 ? "bearish" : change <= -0.2 ? "bullish" : "neutral",
    describe: ({ value, change }) =>
      `미국 실업률 ${f(value)}%(전월대비 ${f(change)}%p).`,
  },
  CPIAUCSL: {
    id: "us-cpi",
    name: "US CPI (YoY)",
    nameKo: "미국 소비자물가 (전년비)",
    category: "economic",
    unit: "%",
    limit: 14,
    signal: ({ yoyChange }) =>
      yoyChange === null
        ? "neutral"
        : yoyChange < 0
          ? "bullish"
          : yoyChange > 0.2
            ? "bearish"
            : "neutral",
    describe: ({ value, yoyChange }) =>
      `미국 CPI(전년비) ${f(value)}%${yoyChange === null ? "" : `(전월 YoY대비 ${f(yoyChange)}%p)`}.`,
  },
  DTWEXBGS: {
    id: "dxy",
    name: "Broad Dollar Index",
    nameKo: "달러 인덱스(Broad)",
    category: "fx",
    unit: "",
    limit: 2,
    signal: ({ change, changePercent }) =>
      Math.abs(changePercent) < 0.3 ? "neutral" : change < 0 ? "bullish" : "bearish",
    describe: ({ value, changePercent }) =>
      `Broad 달러지수 ${f(value)}(전일대비 ${f(changePercent)}%).`,
  },
  DEXKOUS: {
    id: "usd-krw",
    name: "USD/KRW",
    nameKo: "원/달러 환율",
    category: "fx",
    unit: "원",
    limit: 2,
    signal: ({ change, changePercent }) =>
      Math.abs(changePercent) < 0.3 ? "neutral" : change < 0 ? "bullish" : "bearish",
    describe: ({ value, changePercent }) =>
      `원/달러 ${f(value)}원(전일대비 ${f(changePercent)}%).`,
  },
  DCOILWTICO: {
    id: "wti-crude",
    name: "WTI Crude Oil",
    nameKo: "WTI 원유",
    category: "commodities",
    unit: "$/배럴",
    limit: 2,
    signal: ({ change, changePercent }) =>
      Math.abs(changePercent) < 1.0 ? "neutral" : change < 0 ? "bullish" : "bearish",
    describe: ({ value, changePercent }) =>
      `WTI 원유 ${f(value)}$/배럴(전일대비 ${f(changePercent)}%).`,
  },
};

// 9 series 순서 박제(병렬 fetch + asOf 산출용).
export const FRED_SERIES_IDS: readonly string[] = Object.keys(SERIES_SPECS);

function parseNum(v: string): number | null {
  const s = v.trim();
  if (s === "" || s === ".") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function latestNumericObservations(
  obs: readonly FredObservation[],
  needed: number,
): FredObservation[] | null {
  const out: FredObservation[] = [];
  for (const row of obs) {
    if (parseNum(row.value) === null) continue;
    out.push(row);
    if (out.length === needed) return out;
  }
  return null;
}

// "YYYY-MM-DD" 두 날짜의 월 간격(later - earlier). 음수/NaN(malformed) 가능.
function monthsApart(laterDate: string, earlierDate: string): number {
  const [ly, lm] = laterDate.split("-").map(Number);
  const [ey, em] = earlierDate.split("-").map(Number);
  return (ly - ey) * 12 + (lm - em);
}

function observationLimitForSeries(seriesId: string): number {
  const base = SERIES_SPECS[seriesId].limit;
  if (seriesId === "CPIAUCSL") {
    return Math.max(base, CPI_OBSERVATION_WINDOW);
  }
  return Math.max(base, DEFAULT_OBSERVATION_WINDOW);
}

async function nullOnTimeout<T>(
  task: Promise<T>,
  timeoutMs: number,
): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  try {
    return await Promise.race([task, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * FRED observations(desc) → MacroIndicator + signal.
 * 최신치가 "."이면 window 안의 최신 non-dot 관측치로 건너뛰고, non-dot 부족 시 null(series drop).
 * CPIAUCSL은 latest numeric 14개로 YoY 및 prev YoY 산출 → value=YoY%.
 */
export function toMacroIndicator(
  seriesId: string,
  obs: readonly FredObservation[],
): MacroIndicator | null {
  const spec = SERIES_SPECS[seriesId];
  if (!spec) return null;
  if (seriesId === "CPIAUCSL") {
    const numeric = latestNumericObservations(obs, 14);
    if (numeric === null) return null;
    const latest = numeric[0];
    const previous = numeric[1];
    const yearAgo = numeric[12];
    const previousYearAgo = numeric[13];
    if (!latest || !previous || !yearAgo || !previousYearAgo) return null;
    // YoY는 12개월 간격 불변식에 의존. skip-dot로 numeric[12]가 13+개월 전이 되면 YoY가 조용히
    //   왜곡됨 → 날짜 간격이 정확히 12개월이 아니면 null(fail-closed; 해당 series drop → degrade).
    if (
      monthsApart(latest.date, yearAgo.date) !== 12 ||
      monthsApart(previous.date, previousYearAgo.date) !== 12
    ) {
      return null;
    }
    const i0 = parseNum(latest.value);
    const i1 = parseNum(previous.value);
    const i12 = parseNum(yearAgo.value);
    const i13 = parseNum(previousYearAgo.value);
    if (i0 === null || i12 === null || i1 === null || i13 === null || i12 === 0 || i13 === 0) {
      return null;
    }
    const yoyNow = (i0 / i12 - 1) * 100;
    const yoyPrev = (i1 / i13 - 1) * 100;
    const yoyChange = yoyNow - yoyPrev;
    return {
      id: spec.id,
      name: spec.name,
      nameKo: spec.nameKo,
      category: spec.category,
      value: f(yoyNow),
      previousValue: f(yoyPrev),
      change: f(yoyChange),
      changePercent: yoyPrev !== 0 ? f((yoyChange / Math.abs(yoyPrev)) * 100) : 0,
      unit: spec.unit,
      updatedAt: `${latest.date}T00:00:00Z`,
      signal: spec.signal({
        value: yoyNow,
        prev: yoyPrev,
        change: yoyChange,
        changePercent: 0,
        yoyChange,
      }),
      description: spec.describe({ value: yoyNow, change: yoyChange, changePercent: 0, yoyChange }),
    };
  }
  const numeric = latestNumericObservations(obs, 2);
  if (numeric === null) return null;
  const latest = numeric[0];
  const previous = numeric[1];
  if (!latest || !previous) return null;
  const value = parseNum(latest.value);
  const prev = parseNum(previous.value);
  if (value === null || prev === null) return null;
  const change = value - prev;
  const changePercent = prev !== 0 ? (change / Math.abs(prev)) * 100 : 0;
  return {
    id: spec.id,
    name: spec.name,
    nameKo: spec.nameKo,
    category: spec.category,
    value: f(value),
    previousValue: f(prev),
    change: f(change),
    changePercent: f(changePercent),
    unit: spec.unit,
    updatedAt: `${latest.date}T00:00:00Z`,
    signal: spec.signal({ value, prev, change, changePercent, yoyChange: null }),
    description: spec.describe({ value, change, changePercent, yoyChange: null }),
  };
}

/**
 * 9 series parallel(Promise.all; 9 « 120 req/min FRED IP limit) → MacroContextSource | null.
 * 1~3개 series fetch/drop은 degrade(휴일 "."/일시 실패로 전체 블랙아웃 금지).
 * 유효 지표가 너무 적으면 null(too-sparse full fail-safe).
 *   - asOf = 유효 관측치 중 최신 날짜를 Z-qualified UTC로 → verdict.updatedAt.
 *   - verdict = buildVerdictFromIndicators(결정론 합성).
 */
export async function buildFredMacroSource(opts?: {
  apiKey?: string;
  fetchImpl?: FredFetchImpl;
  sleepImpl?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  perSeriesTimeoutMs?: number;
}): Promise<MacroContextSource | null> {
  const apiKey = (opts?.apiKey ?? process.env.FRED_API_KEY ?? "").trim();
  if (!apiKey) return null;

  // per-series budget: 각 series를 개별 budget으로 race → 느린/hung series는 그 series만 drop(null)
  //   되고 나머지는 degrade로 유지된다. (구 aggregate budget은 단일 느린 series가 전체 source를 null로
  //   만들어 degrade를 사실상 무력화 — 단일 retry(>=1.5s backoff)만으로도 5s aggregate budget 초과.)
  const budgetMs = opts?.perSeriesTimeoutMs ?? DEFAULT_SERIES_BUDGET_MS;
  const useBudget = Number.isFinite(budgetMs) && budgetMs > 0;
  const settled = await Promise.allSettled(
    FRED_SERIES_IDS.map(async (sid): Promise<FredSeriesResult> => {
      const task = fetchFredSeries({
        seriesId: sid,
        limit: observationLimitForSeries(sid),
        apiKey,
        fetchImpl: opts?.fetchImpl,
        sleepImpl: opts?.sleepImpl,
        timeoutMs: opts?.timeoutMs,
      });
      const observations = useBudget ? await nullOnTimeout(task, budgetMs) : await task;
      return { seriesId: sid, observations };
    }),
  );

  const indicators: MacroIndicator[] = [];
  for (const result of settled) {
    if (result.status === "rejected") continue; // fetch reject(4xx/retry 소진) → drop
    const { seriesId, observations } = result.value;
    if (observations === null) continue; // per-series budget timeout → drop(degrade)
    const ind = toMacroIndicator(seriesId, observations);
    if (ind === null) continue; // value '.'/관측치 부족/CPI 간격 위반 → drop(degrade)
    indicators.push(ind);
  }
  if (indicators.length < MIN_VALID_INDICATOR_COUNT) return null;

  // asOf SoT = 유효 지표 중 최신 updatedAt(이미 Z-qualified).
  let asOf = indicators[0].updatedAt;
  let asOfMs = Date.parse(asOf);
  for (const ind of indicators) {
    const ms = Date.parse(ind.updatedAt);
    if (Number.isFinite(ms) && (!Number.isFinite(asOfMs) || ms > asOfMs)) {
      asOf = ind.updatedAt;
      asOfMs = ms;
    }
  }

  const verdict = buildVerdictFromIndicators(indicators, asOf, FRED_SERIES_IDS.length);
  return { indicators, verdict, source: "fred" };
}
