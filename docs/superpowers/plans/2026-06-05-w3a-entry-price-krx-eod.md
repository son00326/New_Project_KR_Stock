# W3a — entry_price 실배선 (KRX EOD 종가) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 포트폴리오 Accept 시 항상 `entry_price_unavailable`로 막히던 `resolveRealEntryPrice()` stub을 **KRX 공식 Open API EOD 종가 소스**로 배선해, 실 종가로 `portfolio_snapshot` entry_price를 채운다. 이로써 Accept/Reject가 작동하고 W2b incumbent thesis context의 실현 성과(`entry_price>0` graceful)가 활성화된다. **AI 키 불필요**(KRX 데이터 키 — AI 키와 별개).

**Architecture:** W3를 **W3a(entry_price, AI-key-free, 이 계획)** / W3b(portfolio_proposal AI 자율 판단, Opus, USER-gated 후속)로 분할(W2a/W2b·W1a/W1b 전례). KRX EOD 종가 fetcher를 신규 `src/lib/data/krx-eod.ts`에 DI-seam으로 구현(`scripts/krx_openapi.py` 계약 1:1 포팅 — gateway/AUTH_KEY/stk·ksq_bydd_trd/OutBlock_1/ISU_CD/TDD_CLSPRC). `buildInitialSnapshots`를 async batch lookup으로 전환. **이중 게이트로 behavior-neutral 머지**: `PORTFOLIO_REAL_ENTRY_PRICE_ENABLED!=='true'` 또는 `KRX_OPENAPI_KEY` 부재 → 기존처럼 null 반환 → `entry_price_unavailable`(현 동작 무변경). USER가 flag+key 둘 다 설정 시에만 실 종가 활성.

**Tech Stack:** Next.js 16 (server action) · Vitest · KRX 공식 Open API(REST, TS fetch — S1 종가 소스, HANDOFF ADR D-10).

**SoT:** HANDOFF ⭐ 65차 W3(:57-59) "entry_price 실배선(actions.ts 항상 null TODO 해소 — KRX/EOD)" + `scripts/krx_openapi.py`(KRX 계약 reference) + ADR D-10(KRX 공식 Open API).

---

## 범위 (W3a) vs 분리 (W3b)

**W3a (이 계획):**
1. KRX EOD 종가 fetcher `src/lib/data/krx-eod.ts` — `fetchEodCloseMap`(market별 daily 전종목 1콜 → Map<6자리 ticker, 종가>) + `resolveEntryPricesKrw`(tickers → Map, 최신 거래일 기준).
2. `buildInitialSnapshots` async batch 전환 — 30 ticker entry_price를 1회 fetch(KOSPI+KOSDAQ 2콜)로 lookup. 누락 ticker 1개라도 있으면 **전체 accept 거부**(`entry_price_unavailable` — 부분 snapshot 금지, 기존 안전성 유지).
3. **이중 게이트**(flag + key) — behavior-neutral 머지.
4. 연결 테스트 — accept→EOD source DI→snapshot 실 entryPrice 영속 + KRX OutBlock_1 fixture parse + flag/key 부재 graceful.

**W3b (후속, 명시 DEFER):** portfolio_proposal(편입/개수/단·중·장 분배/비중/현금 0~30%) AI 자율 판단(Opus, `portfolio` role). 실 AI·USER 게이트.

**W3a 범위 밖:** currentPrice 실시간(S7c KIS WS) · realized return 계산 배치(별도) · KRX_OPENAPI_KEY production 설정/flag 토글(USER 게이트).

## 핵심 설계 결정

- **D1 KRX 계약 = python 1:1 포팅.** gateway `https://data-dbg.krx.co.kr/svc/apis/`, header `{ AUTH_KEY: KRX_OPENAPI_KEY }`, endpoints `sto/stk_bydd_trd`(KOSPI)·`sto/ksq_bydd_trd`(KOSDAQ), param `basDd=YYYYMMDD`. 응답 `OutBlock_1: Array<{ ISU_CD(6자리), ISU_NM, TDD_CLSPRC(콤마 종가) }>`. 빈 `OutBlock_1` = 휴장/미갱신(정상 — 빈 Map). 4xx 즉시 throw(키 문제 노출), 429/5xx backoff 재시도(MAX_RETRIES 4). `_to_float` 동형 파서(콤마 제거, '-'/''/'N/A'→null). **AUTH_KEY 값은 로그/에러에 절대 미출력.**
- **D2 fetch DI-seam.** `fetchEodCloseMap(opts: { basDd, market, fetchImpl?, authKey })` — `fetchImpl` 미지정 시 global `fetch`. 테스트는 mock fetchImpl 주입(외부 호출 0, cost 무관). authKey 미지정 시 `KRX_OPENAPI_KEY` env → 부재면 `krx_auth_key_missing` throw(caller가 게이트로 사전 차단하므로 정상 경로 미도달).
- **D3 거래일 해석.** entry_price = **가장 최근 완료 거래일** 종가. `resolveLatestTradingDay(now, businessDays)` — calendar.ts `loadKrBusinessDays`/`MOCK_KR_BUSINESS_DAYS_2026`에서 `now` 이하 최신 `isBusinessDay` 날짜. (장중 당일은 종가 미확정이라 "오늘이 거래일이어도 직전 거래일 사용" 보수 옵션은 W3a 범위 밖 — 일배치 Accept 가정, 최신 거래일 사용. KRX가 미갱신이면 빈 Map→entry_price_unavailable로 안전 fallback.) 주말/공휴일 walk-back.
- **D4 이중 게이트(behavior-neutral).** `resolveRealEntryPrice` 제거 → `resolveEntryPricesKrw(tickers, deps)` 도입. accept 경로 진입 전 게이트: `process.env.PORTFOLIO_REAL_ENTRY_PRICE_ENABLED !== 'true'` → 즉시 `entry_price_unavailable`(현 동작 1:1). flag on이어도 `KRX_OPENAPI_KEY` 부재 → 동일. **둘 다 충족 시에만** 실 fetch. ∴ 머지 후 production 동작 무변경(USER가 flag+key 설정해야 활성). KRX_OPENAPI_KEY가 이미 prod에 있어도 flag 없으면 비활성.
- **D5 batch + 누락 fail-closed.** 30 ticker를 KOSPI+KOSDAQ 2콜로 한 번에 fetch → merged Map. ticker별 lookup, **하나라도 누락(또는 종가 ≤0) → 전체 accept 거부**(`entry_price_unavailable`). 부분 snapshot 절대 금지(money-path 안전 — 기존 "synthetic price 금지" 주석 정신 유지). 집계행(ticker=null)은 기존대로 entryPrice 0.
- **D6 server action 계약 보존.** `acceptShortList`는 `{success,error}` 계약 유지. `buildInitialSnapshots`가 async가 되므로 await. KRX fetch 실패(throw)는 catch → `entry_price_unavailable`(money-path는 throw가 accept 트랜잭션 시작 전에 차단되도록 snapshot build를 RPC 前에 유지 — 기존 구조 그대로). RPC·atomic·gate 무변경.

## File Structure

**신규:**
- `tudal/src/lib/data/krx-eod.ts` — `fetchEodCloseMap` + `resolveEntryPricesKrw` + `resolveLatestTradingDay` + `parseKrxClose`(콤마 파서).
- `tudal/src/lib/data/__tests__/krx-eod.test.ts`

**수정:**
- `tudal/src/app/(admin)/admin/portfolio/actions.ts` — `resolveRealEntryPrice` 제거 → `buildInitialSnapshots` async + 이중 게이트 + batch lookup. accept 호출부 await.
- `tudal/src/app/(admin)/admin/portfolio/__tests__/*.ts` — accept 테스트에 게이트/EOD DI 반영(기존 entry_price_unavailable 테스트는 flag-off 경로로 무회귀).
- `tudal/.env.example` — `PORTFOLIO_REAL_ENTRY_PRICE_ENABLED`(default off) 문서화.

**무변경(DoD diff):** 마이그 전부 · `admin-approvals.ts`(RPC persist) · `admin-snapshots.ts`(타입) · reader · calendar.ts(loadKrBusinessDays 재사용).

---

## Task 0: 착수 가드
- [ ] Step 1: branch `feat/w3a-entry-price` + main 게이트 1792+2skip 기준 분기 확인.
- [ ] Step 2: 현 accept 동작 baseline 확인 — `resolveRealEntryPrice()` null → `entry_price_unavailable` 테스트 존재 확인(무회귀 기준선).

## Task 1: krx-eod.ts — parser + fetcher + 거래일 (TDD)

**Files:** Create `src/lib/data/krx-eod.ts` + test

- [ ] **Step 1: 실패 테스트**
```typescript
import { parseKrxClose, fetchEodCloseMap, resolveLatestTradingDay } from '../krx-eod';

it('parseKrxClose: 콤마 종가 → number / "-"·""·"N/A"·null → null', () => {
  expect(parseKrxClose('71,200')).toBe(71200);
  expect(parseKrxClose('1500')).toBe(1500);
  for (const v of ['-', '', 'N/A', null, '0']) {
    const r = parseKrxClose(v);
    expect(r === null || r === 0).toBe(true);
  }
});

it('fetchEodCloseMap: OutBlock_1 → Map<6자리 ISU_CD, 종가>, 빈 블록=빈 Map, AUTH_KEY 헤더 주입', async () => {
  const calls: Array<{ url: string; headers: Record<string,string>; }> = [];
  const fetchImpl = async (url: string, init: { headers: Record<string,string> }) => {
    calls.push({ url, headers: init.headers });
    return { ok: true, status: 200, json: async () => ({ OutBlock_1: [
      { ISU_CD: '005930', ISU_NM: '삼성전자', TDD_CLSPRC: '71,200' },
      { ISU_CD: '000660', ISU_NM: 'SK하이닉스', TDD_CLSPRC: '180,000' },
    ] }) };
  };
  const m = await fetchEodCloseMap({ basDd: '20260605', market: 'KOSPI', fetchImpl, authKey: 'k' });
  expect(m.get('005930')).toBe(71200);
  expect(calls[0].headers.AUTH_KEY).toBe('k');
  expect(calls[0].url).toContain('stk_bydd_trd');
  expect(calls[0].url).toContain('basDd=20260605');
  // 빈 블록
  const empty = await fetchEodCloseMap({ basDd: '20260606', market: 'KOSPI',
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ OutBlock_1: [] }) }), authKey: 'k' });
  expect(empty.size).toBe(0);
});

it('fetchEodCloseMap: 4xx 즉시 throw(키 미노출) / 429 backoff 후 성공', async () => {
  await expect(fetchEodCloseMap({ basDd: '20260605', market: 'KOSPI',
    fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({}) }), authKey: 'secret' }))
    .rejects.toThrow(/krx_eod_fetch_failed/);
  let n = 0;
  const m = await fetchEodCloseMap({ basDd: '20260605', market: 'KOSDAQ', sleepImpl: async () => {},
    fetchImpl: async () => (++n < 2 ? { ok: false, status: 429, json: async () => ({}) }
      : { ok: true, status: 200, json: async () => ({ OutBlock_1: [{ ISU_CD: '035720', TDD_CLSPRC: '50,000' }] }) }),
    authKey: 'k' });
  expect(m.get('035720')).toBe(50000);
});

it('throw 메시지에 authKey 비노출', async () => {
  try {
    await fetchEodCloseMap({ basDd: '20260605', market: 'KOSPI',
      fetchImpl: async () => ({ ok: false, status: 403, json: async () => ({}) }), authKey: 'SUPERSECRET' });
  } catch (e) { expect(String(e)).not.toContain('SUPERSECRET'); }
});

it('resolveLatestTradingDay: now 이하 최신 영업일 YYYYMMDD (주말 walk-back)', () => {
  const days = [
    { date: '2026-06-04', isBusinessDay: true, holidayName: null },
    { date: '2026-06-05', isBusinessDay: true, holidayName: null },
    { date: '2026-06-06', isBusinessDay: false, holidayName: '현충일' },
    { date: '2026-06-07', isBusinessDay: false, holidayName: null },
  ];
  expect(resolveLatestTradingDay(new Date('2026-06-07T05:00:00Z'), days)).toBe('20260605');
  expect(resolveLatestTradingDay(new Date('2026-06-05T05:00:00Z'), days)).toBe('20260605');
});
```
- [ ] **Step 2: 실패 확인.**
- [ ] **Step 3: 구현** — `krx-eod.ts`:
```typescript
// W3a — KRX 공식 Open API EOD 종가 (scripts/krx_openapi.py 계약 1:1 포팅). AI 키 불필요(KRX 데이터 키).
//   AUTH_KEY 값은 로그/에러에 절대 미출력.
const KRX_GATEWAY = 'https://data-dbg.krx.co.kr/svc/apis/';
const EP = { KOSPI: 'sto/stk_bydd_trd', KOSDAQ: 'sto/ksq_bydd_trd' } as const;
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 4;
export type KrxMarket = 'KOSPI' | 'KOSDAQ';
export interface KrxFetchResult { ok: boolean; status: number; json: () => Promise<unknown>; }
export type KrxFetchImpl = (url: string, init: { headers: Record<string, string> }) => Promise<KrxFetchResult>;

export function parseKrxClose(v: unknown): number | null {
  if (v == null) return null;
  const s = String(v).trim().replace(/,/g, '');
  if (s === '' || s === '-' || s === 'N/A') return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function fetchEodCloseMap(opts: {
  basDd: string; market: KrxMarket; authKey: string;
  fetchImpl?: KrxFetchImpl; sleepImpl?: (ms: number) => Promise<void>;
}): Promise<Map<string, number>> {
  const fetchImpl = opts.fetchImpl ?? (async (url, init) => {
    const r = await fetch(url, init); return { ok: r.ok, status: r.status, json: () => r.json() };
  });
  const sleep = opts.sleepImpl ?? ((ms) => new Promise((res) => setTimeout(res, ms)));
  const url = `${KRX_GATEWAY}${EP[opts.market]}?basDd=${opts.basDd}`;
  let lastStatus = 0;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    let res: KrxFetchResult;
    try { res = await fetchImpl(url, { headers: { AUTH_KEY: opts.authKey } }); }
    catch { if (attempt < MAX_RETRIES - 1) await sleep(1500 * 2 ** attempt); continue; }
    if (res.status === 200) {
      const payload = await res.json();
      const rows = (payload as { OutBlock_1?: unknown }).OutBlock_1;
      const map = new Map<string, number>();
      if (Array.isArray(rows)) {
        for (const row of rows as Array<Record<string, unknown>>) {
          const code = String(row.ISU_CD ?? '').trim();
          const close = parseKrxClose(row.TDD_CLSPRC);
          if (/^\d{6}$/.test(code) && close !== null) map.set(code, close);
        }
      }
      return map;
    }
    lastStatus = res.status;
    if (!RETRYABLE.has(res.status)) {
      throw new Error(`krx_eod_fetch_failed:${res.status}`); // authKey 미포함
    }
    if (attempt < MAX_RETRIES - 1) await sleep(1500 * 2 ** attempt);
  }
  throw new Error(`krx_eod_fetch_failed:retries_exhausted:${lastStatus}`);
}

export function resolveLatestTradingDay(now: Date, days: ReadonlyArray<{ date: string; isBusinessDay: boolean }>): string | null {
  const todayKst = new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const candidates = days.filter((d) => d.isBusinessDay && d.date <= todayKst).sort((a, b) => a.date.localeCompare(b.date));
  const last = candidates[candidates.length - 1];
  return last ? last.date.replace(/-/g, '') : null;
}

/** 30 ticker entry_price = 최신 거래일 KOSPI+KOSDAQ 병합 종가. 누락은 caller가 fail-closed. */
export async function resolveEntryPricesKrw(
  tickers: readonly string[],
  deps: { authKey: string; basDd: string; fetchImpl?: KrxFetchImpl; sleepImpl?: (ms: number) => Promise<void> },
): Promise<Map<string, number>> {
  const [kospi, kosdaq] = await Promise.all([
    fetchEodCloseMap({ ...deps, market: 'KOSPI' }),
    fetchEodCloseMap({ ...deps, market: 'KOSDAQ' }),
  ]);
  const merged = new Map<string, number>([...kospi, ...kosdaq]);
  const out = new Map<string, number>();
  for (const t of tickers) { const p = merged.get(t); if (p != null) out.set(t, p); }
  return out;
}
```
- [ ] **Step 4: 통과 확인.**
- [ ] **Step 5: commit** `feat(w3a): krx-eod — EOD 종가 fetcher(python 계약 포팅) + 거래일 해석 + 콤마 파서 (D1/D2/D3, TDD)`

## Task 2: buildInitialSnapshots 배선 + 이중 게이트 (TDD)

**Files:** Modify `actions.ts` + accept 테스트

- [ ] **Step 1: 실패 테스트**
```typescript
it('flag off → entry_price_unavailable (무회귀, KRX 미호출)', ...);  // PORTFOLIO_REAL_ENTRY_PRICE_ENABLED 미설정
it('flag on + KRX_OPENAPI_KEY 부재 → entry_price_unavailable', ...);
it('flag on + key + EOD 전 ticker 종가 → snapshot entryPrice 실값 영속', ...);  // DI fetchImpl mock
it('flag on + key + 1 ticker 누락 → 전체 entry_price_unavailable (부분 snapshot 금지)', ...);
it('KRX fetch throw → entry_price_unavailable (accept 트랜잭션 미시작)', ...);
```
- [ ] **Step 2: 실패 확인.**
- [ ] **Step 3: 구현** — `resolveRealEntryPrice` 제거. `buildInitialSnapshots` async:
```typescript
async function buildInitialSnapshots(input): Promise<{success:true;snapshots}|{success:false;error:'entry_price_unavailable'}> {
  if (process.env.PORTFOLIO_REAL_ENTRY_PRICE_ENABLED !== 'true') return { success: false, error: 'entry_price_unavailable' };
  const authKey = process.env.KRX_OPENAPI_KEY;
  if (!authKey) return { success: false, error: 'entry_price_unavailable' };
  let priceMap: Map<string, number>;
  try {
    const days = await loadKrBusinessDays(/* range */);
    const basDd = resolveLatestTradingDay(new Date(), days);
    if (!basDd) return { success: false, error: 'entry_price_unavailable' };
    priceMap = await (input.resolveEntryPrices ?? resolveEntryPricesKrw)(
      input.shortlist.map((s) => s.ticker), { authKey, basDd });
  } catch { return { success: false, error: 'entry_price_unavailable' }; }
  const snapshots = [];
  for (const item of input.shortlist) {
    const entryPrice = priceMap.get(item.ticker);
    if (entryPrice == null || entryPrice <= 0) return { success: false, error: 'entry_price_unavailable' };
    snapshots.push({ ...기존 shape, entryPrice, currentPrice: entryPrice });
  }
  snapshots.push({ ...집계행 ticker=null entryPrice 0 });
  return { success: true, snapshots };
}
```
`input`에 optional `resolveEntryPrices` DI seam 추가(테스트 mock 주입). acceptShortList 호출부 `await buildInitialSnapshots(...)`.
- [ ] **Step 4: 통과 확인** — 기존 accept 테스트(flag-off로 무회귀) + 신규 5건.
- [ ] **Step 5: commit** `feat(w3a): buildInitialSnapshots KRX EOD 배선 + flag/key 이중 게이트(behavior-neutral) + batch 누락 fail-closed (D4/D5/D6, TDD)`

## Task 3: .env.example + 통합 게이트 + DoD
- [ ] Step 1: `.env.example`에 `PORTFOLIO_REAL_ENTRY_PRICE_ENABLED=false` + 주석(KRX_OPENAPI_KEY 동반 필요, money-path 게이트).
- [ ] Step 2: build+lint+test:ci+tsc ALL GREEN.
- [ ] Step 3: 무변경 확인 — `git diff --stat main -- tudal/supabase/migrations tudal/src/lib/data/admin-approvals.ts tudal/src/lib/data/admin-snapshots.ts` → 0.
- [ ] Step 4: grep 가드 — `grep -rn "resolveRealEntryPrice" src` → 0(제거 확인).

## Self-Review 체크
1. **Spec coverage:** entry_price 실배선(Task 1,2) / KRX EOD(Task 1) / Accept 작동 + W2b 실현성과 활성(게이트 on 시) / W3b AI 자율 = 분리 명시.
2. **Placeholder scan:** Task 1/2 실코드.
3. **Type consistency:** `KrxMarket`/`KrxFetchImpl`/Map<string,number> 일관. NewPortfolioSnapshot shape 무변경(entryPrice/currentPrice만 실값).
4. **무회귀:** flag-off=현 동작 1:1(entry_price_unavailable) / accept atomic·RPC·gate 무변경 / 집계행 무변경.

## 검증 게이트 (DoD)
- ALL GREEN + 무변경 diff 0 + resolveRealEntryPrice grep 0.
- 연결 테스트: accept→EOD DI→snapshot 실 entryPrice 영속(Task 2) + KRX OutBlock_1 parse(Task 1) + flag/key 부재 graceful(Task 2).
- behavior-neutral: flag-off 머지 = production 무변경(USER가 flag+key 설정해야 활성). 실 KRX 호출 = USER 게이트.

## Execution Handoff
§2.0a + 사용자 명시: plan ①Claude→②omxy 검토→③omxy direct-edit→④Claude 검증 → impl 동일 → 배선 교차감사(Claude Workflow + omxy blind) → docs-sync(omxy 검증).
