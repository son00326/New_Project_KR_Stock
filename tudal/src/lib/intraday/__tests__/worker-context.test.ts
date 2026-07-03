// worker-context.test.ts — S7c 워커 컨텍스트 조립 (spec 2026-07-03 §3 D-10/D-11/D-12)
//
// universe 합집합 · prefs any-ON 집계 · KRX 20거래일 볼륨 백필 fail-soft ·
// tick 버퍼(latest-per-ticker) · dedup 사전 억제(1분 bucket 정합) — 전부 순수/DI, 실 I/O 0.

import { describe, expect, it, vi } from "vitest";
import {
  aggregateTickerPrefs,
  assembleIntradayWorkerContext,
  createIntradayTickBuffer,
  listRecentCompletedTradingDays,
  suppressDuplicateDetections,
  type AssembleIntradayWorkerContextDeps,
} from "@/lib/intraday/worker-context";
import type { IntradayContext, IntradayTick } from "@/lib/intraday/anomaly-detect";
import type { KrxEodQuote } from "@/lib/data/krx-eod";
import type { KrBusinessDay } from "@/types/kr-business-days";
import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// aggregateTickerPrefs — D-11: row 없음=ON(맵 미포함), any-ON=true, all-OFF=false
// ---------------------------------------------------------------------------

describe("aggregateTickerPrefs", () => {
  it("row 없는 ticker는 맵에 없음 (downstream default ON)", () => {
    const map = aggregateTickerPrefs([]);
    expect(map.size).toBe(0);
  });

  it("어느 한 어드민이라도 ON → true / 전원 OFF → false", () => {
    const map = aggregateTickerPrefs([
      { ticker: "005930", enabled: false },
      { ticker: "005930", enabled: true },
      { ticker: "005930", enabled: false },
      { ticker: "000660", enabled: false },
      { ticker: "000660", enabled: false },
      { ticker: "035720", enabled: true },
    ]);
    expect(map.get("005930")).toBe(true);
    expect(map.get("000660")).toBe(false);
    expect(map.get("035720")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// listRecentCompletedTradingDays — 종가 확정(18시 KST cutoff) 거래일 최근 N개
// ---------------------------------------------------------------------------

const CAL: KrBusinessDay[] = [
  { date: "2026-06-29", isBusinessDay: true, holidayName: null },
  { date: "2026-06-30", isBusinessDay: true, holidayName: null },
  { date: "2026-07-01", isBusinessDay: true, holidayName: null },
  { date: "2026-07-02", isBusinessDay: true, holidayName: null },
  { date: "2026-07-03", isBusinessDay: true, holidayName: null },
  { date: "2026-07-04", isBusinessDay: false, holidayName: null },
];

function kst(dateTime: string): Date {
  return new Date(`${dateTime}+09:00`);
}

describe("listRecentCompletedTradingDays", () => {
  it("영업일 장중(09:30 KST) → 당일 제외, 직전 거래일부터 N개 (asc YYYYMMDD)", () => {
    const days = listRecentCompletedTradingDays(kst("2026-07-03T09:30:00"), CAL, 3);
    expect(days).toEqual(["20260630", "20260701", "20260702"]);
  });

  it("18시 KST 이후 → 당일 포함", () => {
    const days = listRecentCompletedTradingDays(kst("2026-07-03T18:30:00"), CAL, 2);
    expect(days).toEqual(["20260702", "20260703"]);
  });

  it("후보 부족 시 있는 만큼만", () => {
    const days = listRecentCompletedTradingDays(kst("2026-07-03T09:30:00"), CAL, 20);
    expect(days).toEqual(["20260629", "20260630", "20260701", "20260702"]);
  });

  it("빈 캘린더 → []", () => {
    expect(listRecentCompletedTradingDays(kst("2026-07-03T09:30:00"), [], 5)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// tick 버퍼 — latest per ticker
// ---------------------------------------------------------------------------

function tick(overrides: Partial<IntradayTick> = {}): IntradayTick {
  return {
    ticker: "005930",
    lastPrice: 71_900,
    timestamp: "2026-07-03T00:30:15.000Z",
    sessionVolume: 100,
    ...overrides,
  };
}

describe("createIntradayTickBuffer", () => {
  it("같은 ticker는 최신 tick만 유지, drain 후 비움", () => {
    const buf = createIntradayTickBuffer();
    buf.push(tick({ lastPrice: 100 }));
    buf.push(tick({ lastPrice: 200 }));
    buf.push(tick({ ticker: "000660", lastPrice: 300 }));
    expect(buf.size()).toBe(2);
    const drained = buf.drain();
    expect(drained).toHaveLength(2);
    expect(drained.find((t) => t.ticker === "005930")?.lastPrice).toBe(200);
    expect(buf.size()).toBe(0);
    expect(buf.drain()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// suppressDuplicateDetections — DB dedup_key(1분 bucket)와 동일 키로 사전 억제
// (alert_event append-only + telegram이 같은 분 내 flush 3회에 중복 발송되는 것 방지)
// ---------------------------------------------------------------------------

describe("suppressDuplicateDetections", () => {
  const ctx: IntradayContext = { referencePrice: 100_000, avg20dVolume: 1_000 };
  const contexts = new Map([["005930", ctx]]);
  const prefs = new Map<string, boolean>();

  it("감지 tick 최초 1회 통과 + dedupKey 기록, 같은 분 재감지는 drop", () => {
    const spike = tick({ lastPrice: 106_000, sessionVolume: 0 }); // +6% price_spike
    const seen = new Set<string>();
    const first = suppressDuplicateDetections([spike], { contexts, prefs }, seen);
    expect(first.ticks).toHaveLength(1);
    expect(first.newDedupKeys).toHaveLength(1);
    expect(first.newDedupKeys[0]).toMatch(/^005930:price_spike:/);

    first.newDedupKeys.forEach((k) => seen.add(k));
    const second = suppressDuplicateDetections([spike], { contexts, prefs }, seen);
    expect(second.ticks).toHaveLength(0);
    expect(second.newDedupKeys).toHaveLength(0);
  });

  it("다른 분 bucket이면 다시 통과", () => {
    const seen = new Set<string>();
    const spike1 = tick({ lastPrice: 106_000, timestamp: "2026-07-03T00:30:15.000Z" });
    const r1 = suppressDuplicateDetections([spike1], { contexts, prefs }, seen);
    r1.newDedupKeys.forEach((k) => seen.add(k));
    const spike2 = tick({ lastPrice: 106_000, timestamp: "2026-07-03T00:31:05.000Z" });
    const r2 = suppressDuplicateDetections([spike2], { contexts, prefs }, seen);
    expect(r2.ticks).toHaveLength(1);
  });

  it("무감지 tick은 그대로 통과 (키 미생성)", () => {
    const clean = tick({ lastPrice: 101_000, sessionVolume: 0 }); // +1%
    const r = suppressDuplicateDetections([clean], { contexts, prefs }, new Set());
    expect(r.ticks).toHaveLength(1);
    expect(r.newDedupKeys).toHaveLength(0);
  });

  it("ctx 부재/pref OFF tick은 통과 (monitor의 skip 카운트가 SoT)", () => {
    const noCtx = tick({ ticker: "999999", lastPrice: 1_000_000 });
    const offPrefs = new Map([["005930", false]]);
    const spike = tick({ lastPrice: 106_000 });
    const r = suppressDuplicateDetections(
      [noCtx, spike],
      { contexts, prefs: offPrefs },
      new Set(),
    );
    expect(r.ticks).toHaveLength(2);
    expect(r.newDedupKeys).toHaveLength(0);
  });

  it("같은 batch 내 동일 ticker 중복 감지도 1회만", () => {
    const spike = tick({ lastPrice: 106_000 });
    const r = suppressDuplicateDetections(
      [spike, { ...spike }],
      { contexts, prefs },
      new Set(),
    );
    expect(r.ticks).toHaveLength(1);
    expect(r.newDedupKeys).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// assembleIntradayWorkerContext — DI 조립 (실 I/O 0)
// ---------------------------------------------------------------------------

type QuoteFetch = NonNullable<AssembleIntradayWorkerContextDeps["fetchQuoteMapImpl"]>;

function quoteFetchFromDayTable(
  table: Record<string, Record<string, KrxEodQuote>>,
  markets: Record<string, "KOSPI" | "KOSDAQ"> = {},
): QuoteFetch {
  return vi.fn(async (opts: { basDd: string; market: "KOSPI" | "KOSDAQ" }) => {
    const day = table[opts.basDd];
    if (!day) throw new Error(`krx_eod_fetch_failed:500`);
    const map = new Map<string, KrxEodQuote>();
    for (const [t, quote] of Object.entries(day)) {
      const market = markets[t] ?? "KOSPI";
      if (market === opts.market) map.set(t, quote);
    }
    return map;
  });
}

function makeDeps(
  overrides: Partial<AssembleIntradayWorkerContextDeps> = {},
): AssembleIntradayWorkerContextDeps {
  return {
    client: {} as SupabaseClient,
    krxAuthKey: "krx-key",
    now: kst("2026-07-03T09:05:00"),
    volumeLookbackDays: 2,
    getHoldingsImpl: vi.fn(async () => [
      { ticker: "005930" },
      { ticker: null }, // 현금 행 방어
    ]),
    getShortListImpl: vi.fn(async () => [
      { ticker: "005930" }, // 보유와 중복 — 합집합 1회
      { ticker: "000660" },
    ]),
    getPrefsImpl: vi.fn(async () => [
      { ticker: "000660", enabled: false },
      { ticker: "000660", enabled: true },
    ]),
    loadBusinessDaysImpl: vi.fn(async () => CAL),
    fetchQuoteMapImpl: quoteFetchFromDayTable({
      "20260701": {
        "005930": { close: 70_000, volume: 1_000 },
        "000660": { close: 170_000, volume: 500 },
      },
      "20260702": {
        "005930": { close: 71_900, volume: 3_000 },
        "000660": { close: 180_000, volume: 700 },
      },
    }),
    log: vi.fn(),
    ...overrides,
  };
}

describe("assembleIntradayWorkerContext", () => {
  it("universe = holdings ∪ shortlist (중복/null 제거) + prefs any-ON 집계", async () => {
    const deps = makeDeps();
    const ctx = await assembleIntradayWorkerContext(deps);
    expect(ctx.tickers).toEqual(["005930", "000660"]);
    expect(ctx.prefs.get("000660")).toBe(true); // any-ON
    expect(ctx.prefs.has("005930")).toBe(false); // row 없음 → default ON (미포함)
  });

  it("referencePrice = 최신 완료 거래일 종가, avg20dVolume = lookback 평균", async () => {
    const ctx = await assembleIntradayWorkerContext(makeDeps());
    expect(ctx.contexts.get("005930")).toEqual({
      referencePrice: 71_900,
      avg20dVolume: 2_000, // (1000+3000)/2
    });
    expect(ctx.contexts.get("000660")).toEqual({
      referencePrice: 180_000,
      avg20dVolume: 600,
    });
  });

  it("KRX 키 부재 → contexts 빈 Map (universe/prefs는 유지, 경고 로그)", async () => {
    const fetchSpy = vi.fn();
    const ctx = await assembleIntradayWorkerContext(
      makeDeps({ krxAuthKey: undefined, fetchQuoteMapImpl: fetchSpy as unknown as QuoteFetch }),
    );
    expect(ctx.tickers).toEqual(["005930", "000660"]);
    expect(ctx.contexts.size).toBe(0);
    expect(ctx.warnings.some((w) => w.includes("krx_auth_key_missing"))).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("일부 거래일 fetch 실패 → 해당 일 skip, 나머지로 평균 (fail-soft)", async () => {
    const ctx = await assembleIntradayWorkerContext(
      makeDeps({
        fetchQuoteMapImpl: quoteFetchFromDayTable({
          // 20260701 없음 → throw → skip
          "20260702": { "005930": { close: 71_900, volume: 3_000 } },
        }),
      }),
    );
    expect(ctx.contexts.get("005930")).toEqual({
      referencePrice: 71_900,
      avg20dVolume: 3_000,
    });
    expect(ctx.warnings.some((w) => w.includes("krx_day_failed:20260701"))).toBe(true);
  });

  it("volume null만 있는 ticker → avg20dVolume 0 (가격 트리거만 유지)", async () => {
    const ctx = await assembleIntradayWorkerContext(
      makeDeps({
        fetchQuoteMapImpl: quoteFetchFromDayTable({
          "20260701": { "005930": { close: 70_000, volume: null } },
          "20260702": { "005930": { close: 71_900, volume: null } },
        }),
      }),
    );
    expect(ctx.contexts.get("005930")).toEqual({
      referencePrice: 71_900,
      avg20dVolume: 0,
    });
    expect(ctx.contexts.has("000660")).toBe(false); // 종가 자체가 없으면 ctx 미생성
  });

  it("최신일에 종가 없는 ticker → 그 이전 성공일 종가로 fallback", async () => {
    const ctx = await assembleIntradayWorkerContext(
      makeDeps({
        fetchQuoteMapImpl: quoteFetchFromDayTable({
          "20260701": { "005930": { close: 70_000, volume: 1_000 } },
          "20260702": { "000660": { close: 180_000, volume: 700 } },
        }),
      }),
    );
    expect(ctx.contexts.get("005930")?.referencePrice).toBe(70_000);
    expect(ctx.contexts.get("000660")?.referencePrice).toBe(180_000);
  });

  it("universe 빈 경우 → 조기 반환 (KRX 호출 0)", async () => {
    const fetchSpy = vi.fn();
    const ctx = await assembleIntradayWorkerContext(
      makeDeps({
        getHoldingsImpl: vi.fn(async () => []),
        getShortListImpl: vi.fn(async () => []),
        fetchQuoteMapImpl: fetchSpy as unknown as QuoteFetch,
      }),
    );
    expect(ctx.tickers).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("universe > 41 → KIS WS 등록 상한으로 잘라내고 경고 (보유 우선 보존)", async () => {
    const holdings = Array.from({ length: 5 }, (_, i) => ({
      ticker: String(100000 + i),
    }));
    const shortlist = Array.from({ length: 40 }, (_, i) => ({
      ticker: String(200000 + i),
    }));
    const ctx = await assembleIntradayWorkerContext(
      makeDeps({
        getHoldingsImpl: vi.fn(async () => holdings),
        getShortListImpl: vi.fn(async () => shortlist),
        krxAuthKey: undefined, // KRX 백필 생략 — cap 로직만 검증
      }),
    );
    expect(ctx.tickers).toHaveLength(41);
    expect(ctx.tickers.slice(0, 5)).toEqual(holdings.map((h) => h.ticker));
    expect(ctx.warnings.some((w) => w.includes("subscription_cap"))).toBe(true);
  });

  it("캘린더 로드 실패 → 평일 fallback으로 거래일 산출 (fail-soft)", async () => {
    const ctx = await assembleIntradayWorkerContext(
      makeDeps({
        loadBusinessDaysImpl: vi.fn(async () => {
          throw new Error("calendar_unavailable");
        }),
        fetchQuoteMapImpl: quoteFetchFromDayTable({
          // 2026-07-03(금) 09:05 KST 기준 직전 평일 2일 = 07-01(수)·07-02(목)
          "20260701": { "005930": { close: 70_000, volume: 1_000 } },
          "20260702": { "005930": { close: 71_900, volume: 3_000 } },
        }),
      }),
    );
    expect(ctx.warnings.some((w) => w.includes("calendar_load_failed"))).toBe(true);
    expect(ctx.contexts.get("005930")?.referencePrice).toBe(71_900);
  });
});
