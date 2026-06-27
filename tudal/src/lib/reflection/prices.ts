// PR-K Reflection — KRX EOD 가격 해소(무비용·DI). entry(사이클 finalize 거래일) + current(now 거래일)
//   2개 날짜 종가 1배치씩. fail-soft: 키 부재/날짜 해소 실패/invalid finalizedAt → EMPTY(빈 Map·null dates).
//   resolveLatestCompletedTradingDay(pure)는 직접 import, IO(loadBusinessDays/fetchEodPrices)는 DI.
// SoT: docs/superpowers/specs/2026-06-27-reflection-prk-build.md §4.

import { resolveLatestCompletedTradingDay } from "@/lib/data/krx-eod";
import type { ResolvedReflectionPrices } from "@/lib/reflection/orchestrator";

export interface ResolveReflectionPricesDeps {
  now: Date;
  loadBusinessDays: (
    from: Date,
    to: Date,
  ) => Promise<ReadonlyArray<{ date: string; isBusinessDay: boolean }>>;
  /** tickers의 basDd 거래일 KRX EOD 종가 Map(authKey 클로저). */
  fetchEodPrices: (
    tickers: readonly string[],
    basDd: string,
  ) => Promise<Map<string, number>>;
}

const EMPTY: ResolvedReflectionPrices = {
  entryPrices: new Map(),
  currentPrices: new Map(),
  entryDate: null,
  currentDate: null,
};

export async function resolveReflectionPrices(
  input: { tickers: readonly string[]; finalizedAt: string },
  deps: ResolveReflectionPricesDeps,
): Promise<ResolvedReflectionPrices> {
  const finalizedDate = new Date(input.finalizedAt);
  if (Number.isNaN(finalizedDate.getTime())) return EMPTY;

  // finalize 14일 전 ~ now까지 영업일 — entry/current 양쪽 lookback 커버.
  const businessDays = await deps.loadBusinessDays(
    new Date(finalizedDate.getTime() - 14 * 86_400_000),
    deps.now,
  );
  const entryDate = resolveLatestCompletedTradingDay(finalizedDate, businessDays);
  const currentDate = resolveLatestCompletedTradingDay(deps.now, businessDays);
  if (!entryDate || !currentDate) return EMPTY;

  const [entryPrices, currentPrices] = await Promise.all([
    deps.fetchEodPrices([...input.tickers], entryDate),
    deps.fetchEodPrices([...input.tickers], currentDate),
  ]);
  return { entryPrices, currentPrices, entryDate, currentDate };
}
