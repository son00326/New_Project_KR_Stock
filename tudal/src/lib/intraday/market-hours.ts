import type { KrBusinessDay } from "@/types/kr-business-days";

// ---------------------------------------------------------------------------
// KRX 장중 시간 게이트 (S7c intraday 연속 WS 워커, 2026-07-04)
// spec: 2026-07-03-prelaunch-netnew-3-builds.md §3 D-12
//
// KST 09:00–15:30 평일 + KRX 휴장일(kr_business_days) 게이트 — 순수 로직.
// 캘린더 부재/범위 밖 날짜는 평일 fallback (fail-soft — 워커가 휴장일에 떠 있어도
// KRX EOD/KIS 데이터가 비어 무해, 반대로 영업일에 잠들면 감지 자체가 죽으므로
// 캘린더 실패는 open 쪽으로 관대하게 처리).
// ---------------------------------------------------------------------------

export const KRX_MARKET_OPEN_MINUTES = 9 * 60; // 09:00 KST
export const KRX_MARKET_CLOSE_MINUTES = 15 * 60 + 30; // 15:30 KST

const KST_OFFSET_MS = 9 * 3600 * 1000;
const DAY_MS = 24 * 3600 * 1000;
const MAX_SCAN_DAYS = 30;
/** 다음 개장을 30일 내 못 찾을 때(캘린더 이상) 보수적 재확인 간격. */
const FALLBACK_RECHECK_MS = 6 * 3600 * 1000;

export type MarketClosedReason =
  | "before_open"
  | "after_close"
  | "weekend"
  | "holiday";

export interface MarketHoursState {
  open: boolean;
  reason: "open" | MarketClosedReason;
  /** open이면 마감(15:30 KST)까지, closed면 다음 개장(09:00 KST)까지 ms. 항상 > 0. */
  msUntilNextTransition: number;
}

interface KstParts {
  date: string; // YYYY-MM-DD (KST)
  msOfDay: number; // KST 자정 기준 경과 ms
  dayOfWeek: number; // 0=일 … 6=토 (KST)
}

function toKstParts(now: Date): KstParts {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  return {
    date: kst.toISOString().slice(0, 10),
    msOfDay:
      kst.getUTCHours() * 3600_000 +
      kst.getUTCMinutes() * 60_000 +
      kst.getUTCSeconds() * 1_000 +
      kst.getUTCMilliseconds(),
    dayOfWeek: kst.getUTCDay(),
  };
}

function addDaysIso(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayOfWeekOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** 캘린더 우선, 미포함 날짜는 평일 여부로 fallback (fail-soft). */
function isTradingDay(
  date: string,
  byDate: ReadonlyMap<string, KrBusinessDay>,
): boolean {
  const entry = byDate.get(date);
  if (entry) return entry.isBusinessDay;
  const dow = dayOfWeekOf(date);
  return dow !== 0 && dow !== 6;
}

/**
 * 현재 KST 시각의 장중 여부 + 다음 전이까지 ms.
 * days = kr_business_days (loadKrBusinessDays) — 빈 배열 허용(평일 fallback).
 */
export function evaluateMarketHours(
  now: Date,
  days: ReadonlyArray<KrBusinessDay>,
): MarketHoursState {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const kst = toKstParts(now);
  const openMs = KRX_MARKET_OPEN_MINUTES * 60_000;
  const closeMs = KRX_MARKET_CLOSE_MINUTES * 60_000;
  const todayTrading = isTradingDay(kst.date, byDate);

  if (todayTrading && kst.msOfDay >= openMs && kst.msOfDay < closeMs) {
    return {
      open: true,
      reason: "open",
      msUntilNextTransition: closeMs - kst.msOfDay,
    };
  }

  // closed — 사유 판정.
  let reason: MarketClosedReason;
  if (!todayTrading) {
    reason = kst.dayOfWeek === 0 || kst.dayOfWeek === 6 ? "weekend" : "holiday";
  } else {
    reason = kst.msOfDay < openMs ? "before_open" : "after_close";
  }

  // 다음 개장 탐색: 오늘 개장 전이면 오늘 09:00, 아니면 다음 거래일 09:00.
  if (todayTrading && kst.msOfDay < openMs) {
    return { open: false, reason, msUntilNextTransition: openMs - kst.msOfDay };
  }
  for (let i = 1; i <= MAX_SCAN_DAYS; i++) {
    const candidate = addDaysIso(kst.date, i);
    if (isTradingDay(candidate, byDate)) {
      const msUntil = i * DAY_MS - kst.msOfDay + openMs;
      return { open: false, reason, msUntilNextTransition: msUntil };
    }
  }
  // 30일 내 거래일 부재(캘린더 이상) → 보수적 재확인 간격.
  return { open: false, reason, msUntilNextTransition: FALLBACK_RECHECK_MS };
}
