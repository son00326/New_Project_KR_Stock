// W3a — KRX 공식 Open API EOD 종가 (scripts/krx_openapi.py 계약 1:1 포팅). AI 키 불필요(KRX 데이터 키).
//   AUTH_KEY 값은 로그/에러에 절대 미출력. fetch는 DI-seam(fetchImpl) — 테스트는 외부 호출 0.
const KRX_GATEWAY = 'https://data-dbg.krx.co.kr/svc/apis/';
const EP = { KOSPI: 'sto/stk_bydd_trd', KOSDAQ: 'sto/ksq_bydd_trd' } as const;
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 4;

export type KrxMarket = 'KOSPI' | 'KOSDAQ';
export interface KrxFetchResult {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}
export type KrxFetchImpl = (
  url: string,
  init: { headers: Record<string, string> },
) => Promise<KrxFetchResult>;

/** KRX 문자열 종가(콤마 포함) → positive number. '-'/''/'N/A'/null/≤0 → null. */
export function parseKrxClose(v: unknown): number | null {
  if (v == null) return null;
  const s = String(v).trim().replace(/,/g, '');
  if (s === '' || s === '-' || s.toUpperCase() === 'N/A') return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

/** KRX 문자열 누적거래량(ACC_TRDVOL, 콤마 포함) → non-negative number. invalid/음수 → null.
 *  0 허용(거래정지일) — parseKrxClose(>0 강제)와 구분되는 additive 파서 (S7c 워커, 2026-07-04). */
export function parseKrxVolume(v: unknown): number | null {
  if (v == null) return null;
  const s = String(v).trim().replace(/,/g, '');
  if (s === '' || s === '-' || s.toUpperCase() === 'N/A') return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

interface EodFetchOpts {
  basDd: string;
  market: KrxMarket;
  authKey: string;
  fetchImpl?: KrxFetchImpl;
  sleepImpl?: (ms: number) => Promise<void>;
}

// fetchEodCloseMap/fetchEodQuoteMap 공용 fetch+retry+payload 검증 (동작·오류 문자열 불변 추출).
async function fetchEodOutBlockRows(
  opts: EodFetchOpts,
): Promise<Record<string, unknown>[]> {
  const authKey = opts.authKey.trim();
  if (!authKey) throw new Error('krx_auth_key_missing');
  const fetchImpl =
    opts.fetchImpl ??
    (async (url, init) => {
      const r = await fetch(url, init);
      return { ok: r.ok, status: r.status, json: () => r.json() };
    });
  const sleep = opts.sleepImpl ?? ((ms) => new Promise<void>((res) => setTimeout(res, ms)));
  const url = `${KRX_GATEWAY}${EP[opts.market]}?basDd=${opts.basDd}`;
  let lastStatus = 0;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    let res: KrxFetchResult;
    try {
      res = await fetchImpl(url, { headers: { AUTH_KEY: authKey } });
    } catch {
      // 네트워크/타임아웃 등 일시 오류 → backoff 재시도.
      if (attempt < MAX_RETRIES - 1) await sleep(1500 * 2 ** attempt);
      continue;
    }
    if (res.status === 200) {
      const payload = await res.json();
      if (!isRecord(payload)) {
        throw new Error('krx_eod_payload_invalid:root');
      }
      const rows = payload["OutBlock_1"] ?? [];
      if (!Array.isArray(rows)) throw new Error('krx_eod_payload_invalid:OutBlock_1');
      for (const row of rows) {
        if (!isRecord(row)) throw new Error('krx_eod_payload_invalid:OutBlock_1_row');
      }
      return rows as Record<string, unknown>[];
    }
    lastStatus = res.status;
    if (!RETRYABLE.has(res.status)) {
      throw new Error(`krx_eod_fetch_failed:${res.status}`); // authKey 미포함
    }
    if (attempt < MAX_RETRIES - 1) await sleep(1500 * 2 ** attempt);
  }
  throw new Error(`krx_eod_fetch_failed:retries_exhausted:${lastStatus}`);
}

/**
 * 시장별 daily 전종목 1콜 → Map<6자리 ISU_CD, 종가>.
 * 빈/누락 OutBlock_1 = 휴장/미갱신(정상 — 빈 Map). 비-list/비-object payload = throw.
 * 4xx 즉시 throw(키 문제 노출 — 값 미포함). 429/5xx backoff 재시도(MAX_RETRIES).
 */
export async function fetchEodCloseMap(opts: {
  basDd: string;
  market: KrxMarket;
  authKey: string;
  fetchImpl?: KrxFetchImpl;
  sleepImpl?: (ms: number) => Promise<void>;
}): Promise<Map<string, number>> {
  const rows = await fetchEodOutBlockRows(opts);
  const map = new Map<string, number>();
  for (const row of rows) {
    const code = String(row["ISU_CD"] ?? '').trim();
    const close = parseKrxClose(row["TDD_CLSPRC"]);
    if (/^\d{6}$/.test(code) && close !== null) map.set(code, close);
  }
  return map;
}

export interface KrxEodQuote {
  close: number;
  /** 누적거래량. 파싱 불가 시 null(가격 컨텍스트는 유지 — 거래량 트리거만 비활성). */
  volume: number | null;
}

/**
 * 시장별 daily 전종목 1콜 → Map<6자리 ISU_CD, {close, volume}> (S7c 워커 컨텍스트용 additive).
 * 종가 invalid 행은 제외(fetchEodCloseMap과 동일 기준), 거래량 invalid는 volume:null 보존.
 * fetch/재시도/오류 의미는 fetchEodCloseMap과 동일 (공용 fetchEodOutBlockRows).
 */
export async function fetchEodQuoteMap(opts: {
  basDd: string;
  market: KrxMarket;
  authKey: string;
  fetchImpl?: KrxFetchImpl;
  sleepImpl?: (ms: number) => Promise<void>;
}): Promise<Map<string, KrxEodQuote>> {
  const rows = await fetchEodOutBlockRows(opts);
  const map = new Map<string, KrxEodQuote>();
  for (const row of rows) {
    const code = String(row["ISU_CD"] ?? '').trim();
    const close = parseKrxClose(row["TDD_CLSPRC"]);
    if (!/^\d{6}$/.test(code) || close === null) continue;
    map.set(code, { close, volume: parseKrxVolume(row["ACC_TRDVOL"]) });
  }
  return map;
}

function kstDateAndHour(now: Date): { date: string; hour: number } {
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  return { date: kst.toISOString().slice(0, 10), hour: kst.getUTCHours() };
}

function dayDiff(a: string, b: string): number {
  return Math.floor((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

function previousIsoDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * 가장 최근 **완료** 거래일(YYYYMMDD). KST 장마감 cutoff 전이면 당일 제외(종가 미확정 방지),
 * cutoff 후이면 당일 허용. 후보가 maxLookbackDays 밖이면 null — calendar stale(연도경계 등)
 * 시 직전 연도 종가로 stale accept되는 경계 버그를 fail-closed 처리.
 */
export function resolveLatestCompletedTradingDay(
  now: Date,
  days: ReadonlyArray<{ date: string; isBusinessDay: boolean }>,
  opts: { closeReadyHourKst?: number; maxLookbackDays?: number } = {},
): string | null {
  const { date: todayKst, hour } = kstDateAndHour(now);
  const closeReadyHourKst = opts.closeReadyHourKst ?? 18;
  const maxLookbackDays = opts.maxLookbackDays ?? 14;
  const todayIsBusinessDay = days.some((d) => d.date === todayKst && d.isBusinessDay);
  const cutoffDate =
    todayIsBusinessDay && hour < closeReadyHourKst ? previousIsoDate(todayKst) : todayKst;
  const candidates = days
    .filter((d) => d.isBusinessDay && d.date <= cutoffDate)
    .sort((a, b) => a.date.localeCompare(b.date));
  const last = candidates[candidates.length - 1];
  if (!last || dayDiff(last.date, todayKst) > maxLookbackDays) return null;
  return last.date.replace(/-/g, '');
}

/**
 * 30 ticker entry_price = 최신 완료 거래일 KOSPI+KOSDAQ 병합 종가.
 * 누락(한쪽에도 없음)은 caller가 fail-closed로 처리 — 여기선 lookup만.
 */
export async function resolveEntryPricesKrw(
  tickers: readonly string[],
  deps: {
    authKey: string;
    basDd: string;
    fetchImpl?: KrxFetchImpl;
    sleepImpl?: (ms: number) => Promise<void>;
  },
): Promise<Map<string, number>> {
  const [kospi, kosdaq] = await Promise.all([
    fetchEodCloseMap({ ...deps, market: 'KOSPI' }),
    fetchEodCloseMap({ ...deps, market: 'KOSDAQ' }),
  ]);
  const merged = new Map<string, number>([...kospi, ...kosdaq]);
  const out = new Map<string, number>();
  for (const t of tickers) {
    const p = merged.get(t);
    if (p != null) out.set(t, p);
  }
  return out;
}
