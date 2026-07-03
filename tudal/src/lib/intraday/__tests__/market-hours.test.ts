// market-hours.test.ts — S7c 워커 런타임 정책 (spec 2026-07-03 §3 D-12)
//
// KST 09:00–15:30 평일 + KRX 휴장 게이트. 캘린더 부재 시 평일 fallback (fail-soft).

import { describe, expect, it } from "vitest";
import {
  evaluateMarketHours,
  KRX_MARKET_CLOSE_MINUTES,
  KRX_MARKET_OPEN_MINUTES,
} from "@/lib/intraday/market-hours";
import type { KrBusinessDay } from "@/types/kr-business-days";

// 2026-07-03 = 금요일(영업일), 2026-07-04/05 = 주말, 2026-07-06 = 월요일(영업일),
// 2026-07-17 = 제헌절(금요일 휴장).
const DAYS: KrBusinessDay[] = [
  { date: "2026-07-03", isBusinessDay: true, holidayName: null },
  { date: "2026-07-04", isBusinessDay: false, holidayName: null },
  { date: "2026-07-05", isBusinessDay: false, holidayName: null },
  { date: "2026-07-06", isBusinessDay: true, holidayName: null },
  { date: "2026-07-16", isBusinessDay: true, holidayName: null },
  { date: "2026-07-17", isBusinessDay: false, holidayName: "제헌절" },
  { date: "2026-07-20", isBusinessDay: true, holidayName: null },
];

/** KST 시각 → UTC Date (KST = UTC+9). */
function kst(dateTime: string): Date {
  return new Date(`${dateTime}+09:00`);
}

describe("evaluateMarketHours (KST 경계)", () => {
  it("영업일 09:00 정각 → open", () => {
    const s = evaluateMarketHours(kst("2026-07-03T09:00:00"), DAYS);
    expect(s.open).toBe(true);
    expect(s.reason).toBe("open");
  });

  it("영업일 08:59:59 → before_open (다음 개장 = 당일 09:00)", () => {
    const s = evaluateMarketHours(kst("2026-07-03T08:59:59"), DAYS);
    expect(s.open).toBe(false);
    expect(s.reason).toBe("before_open");
    expect(s.msUntilNextTransition).toBe(1_000);
  });

  it("영업일 15:29:59 → open (마감까지 1s)", () => {
    const s = evaluateMarketHours(kst("2026-07-03T15:29:59"), DAYS);
    expect(s.open).toBe(true);
    expect(s.msUntilNextTransition).toBe(1_000);
  });

  it("영업일 15:30 정각 → after_close", () => {
    const s = evaluateMarketHours(kst("2026-07-03T15:30:00"), DAYS);
    expect(s.open).toBe(false);
    expect(s.reason).toBe("after_close");
  });

  it("금요일 장마감 후 → 다음 개장 = 월요일 09:00 (주말 스킵)", () => {
    const s = evaluateMarketHours(kst("2026-07-03T16:00:00"), DAYS);
    expect(s.open).toBe(false);
    // 금 16:00 → 월 09:00 = 65시간
    expect(s.msUntilNextTransition).toBe(65 * 3600 * 1000);
  });

  it("주말 → weekend + 다음 개장 월요일", () => {
    const s = evaluateMarketHours(kst("2026-07-04T11:00:00"), DAYS);
    expect(s.open).toBe(false);
    expect(s.reason).toBe("weekend");
    expect(s.msUntilNextTransition).toBe(46 * 3600 * 1000); // 토 11:00 → 월 09:00
  });

  it("평일 공휴일(제헌절) → holiday + 다음 영업일 개장", () => {
    const s = evaluateMarketHours(kst("2026-07-17T10:00:00"), DAYS);
    expect(s.open).toBe(false);
    expect(s.reason).toBe("holiday");
    // 금(휴장) 10:00 → 월 07-20 09:00 = 71시간
    expect(s.msUntilNextTransition).toBe(71 * 3600 * 1000);
  });

  it("캘린더 빈 배열 → 평일 fallback (fail-soft)", () => {
    const open = evaluateMarketHours(kst("2026-07-03T10:00:00"), []);
    expect(open.open).toBe(true);
    const weekend = evaluateMarketHours(kst("2026-07-04T10:00:00"), []);
    expect(weekend.open).toBe(false);
    expect(weekend.reason).toBe("weekend");
  });

  it("캘린더에 없는 날짜 → 평일 fallback (부분 캘린더 fail-soft)", () => {
    // 2026-08-03 = 월요일, DAYS 범위 밖 → 평일로 간주 open.
    const s = evaluateMarketHours(kst("2026-08-03T10:00:00"), DAYS);
    expect(s.open).toBe(true);
  });

  it("msUntilNextTransition은 항상 양수", () => {
    for (const t of [
      "2026-07-03T09:00:00",
      "2026-07-03T15:29:59",
      "2026-07-03T23:59:59",
      "2026-07-05T00:00:00",
    ]) {
      expect(
        evaluateMarketHours(kst(t), DAYS).msUntilNextTransition,
      ).toBeGreaterThan(0);
    }
  });

  it("상수 pin: 09:00–15:30", () => {
    expect(KRX_MARKET_OPEN_MINUTES).toBe(9 * 60);
    expect(KRX_MARKET_CLOSE_MINUTES).toBe(15 * 60 + 30);
  });
});
