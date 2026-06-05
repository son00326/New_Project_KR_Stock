// A (R31 합의) — portfolio/calendar.ts 순수 캘린더 불변식 전수 검증 (test-only, money-path 게이팅 입력).
//   buildYear2026Calendar() 결과(MOCK_KR_BUSINESS_DAYS_2026) + loadKrBusinessDays.
import { describe, it, expect } from "vitest";
import {
  MOCK_KR_BUSINESS_DAYS_2026,
  loadKrBusinessDays,
} from "../calendar";

const cal = MOCK_KR_BUSINESS_DAYS_2026;
const byDate = new Map(cal.map((d) => [d.date, d]));
// 요일/일자 산술은 UTC 고정 — 실행 TZ(DST 포함)에 무관하게 결정적(달력일자=고정 속성).
//   (local Date.getTime() 차는 DST일 23/25h라 86400000ms 불변식이 깨짐 → UTC 사용.)
const dow = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
const utcMs = (date: string) => new Date(`${date}T00:00:00Z`).getTime();

describe("MOCK_KR_BUSINESS_DAYS_2026 — 구조 불변식", () => {
  it("2026 전체 365일(비윤년) 연속·오름차순·중복 없음", () => {
    expect(cal).toHaveLength(365);
    expect(cal[0].date).toBe("2026-01-01");
    expect(cal[cal.length - 1].date).toBe("2026-12-31");
    expect(new Set(cal.map((d) => d.date)).size).toBe(365);
    for (let i = 1; i < cal.length; i++) {
      expect(utcMs(cal[i].date) - utcMs(cal[i - 1].date)).toBe(86_400_000); // UTC +1일
    }
  });

  it("모든 행: date=YYYY-MM-DD · isBusinessDay boolean · holidayName string|null", () => {
    for (const d of cal) {
      expect(d.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof d.isBusinessDay).toBe("boolean");
      expect(d.holidayName === null || typeof d.holidayName === "string").toBe(true);
    }
  });
});

describe("영업일/주말/공휴일 불변식", () => {
  it("주말(토·일)은 항상 isBusinessDay=false", () => {
    for (const d of cal) {
      const wd = dow(d.date);
      if (wd === 0 || wd === 6) expect(d.isBusinessDay).toBe(false);
    }
  });

  it("isBusinessDay=true 이면 평일이고 holidayName=null (역: 영업일에 공휴일/주말 없음)", () => {
    for (const d of cal) {
      if (d.isBusinessDay) {
        const wd = dow(d.date);
        expect(wd).not.toBe(0);
        expect(wd).not.toBe(6);
        expect(d.holidayName).toBeNull();
      }
    }
  });

  it("평일 공휴일 → isBusinessDay=false + holidayName 부여 (신정 2026-01-01 목)", () => {
    const newYear = byDate.get("2026-01-01")!;
    expect(dow("2026-01-01")).toBe(4); // 목요일(평일)
    expect(newYear.isBusinessDay).toBe(false);
    expect(newYear.holidayName).toBe("신정");
  });

  it("평일 일반 → isBusinessDay=true + holidayName=null (2026-01-02 금)", () => {
    const d = byDate.get("2026-01-02")!;
    expect(dow("2026-01-02")).toBe(5); // 금요일
    expect(d.isBusinessDay).toBe(true);
    expect(d.holidayName).toBeNull();
  });

  it("토요일+공휴일(2026-09-26 추석 연휴) → isBusinessDay=false + holidayName 유지(주말 우선)", () => {
    const d = byDate.get("2026-09-26")!;
    expect(dow("2026-09-26")).toBe(6); // 토요일
    expect(d.isBusinessDay).toBe(false);
    expect(d.holidayName).toBe("추석 연휴");
  });

  it("공휴일 맵 16종 전수 일치 + 그 외 날짜는 holidayName=null (R32: exact 고정, 누락/추가 회귀 탐지)", () => {
    // 0004 §4 2026 블록과 100% 동기화 — money-path 게이팅 입력이라 정확히 박제(범위 아님).
    const HOLIDAYS_2026: Record<string, string> = {
      "2026-01-01": "신정",
      "2026-02-16": "설날 연휴",
      "2026-02-17": "설날",
      "2026-02-18": "설날 연휴",
      "2026-03-02": "대체공휴일(삼일절)",
      "2026-05-05": "어린이날",
      "2026-05-25": "대체공휴일(석가탄신일)",
      "2026-06-03": "제9회 전국동시지방선거",
      "2026-08-17": "대체공휴일(광복절)",
      "2026-09-24": "추석 연휴",
      "2026-09-25": "추석",
      "2026-09-26": "추석 연휴", // 토요일 — holidayName 부여되나 isBusinessDay=false(주말)
      "2026-10-05": "대체공휴일(개천절)",
      "2026-10-09": "한글날",
      "2026-12-25": "크리스마스",
      "2026-12-31": "연말 휴장",
    };
    // (1) 16종 각 날짜 이름 정확 일치 (누락/오타 회귀 탐지)
    for (const [date, name] of Object.entries(HOLIDAYS_2026)) {
      expect(byDate.get(date)?.holidayName).toBe(name);
    }
    // (2) holidayName 보유 날짜 집합 = 정확히 16종 (추가/유령 공휴일 회귀 탐지)
    const named = cal.filter((d) => d.holidayName !== null).map((d) => d.date).sort();
    expect(named).toEqual(Object.keys(HOLIDAYS_2026).sort());
  });

  it("영업일 수 정확히 246 (R32: exact 고정 — 365 − 주말 104 − 평일공휴일 15)", () => {
    expect(cal.filter((d) => d.isBusinessDay).length).toBe(246);
  });
});

describe("loadKrBusinessDays", () => {
  it("인자 무관 MOCK_KR_BUSINESS_DAYS_2026 반환(현 단계 mock)", async () => {
    const a = await loadKrBusinessDays(new Date("2026-01-01"), new Date("2026-12-31"));
    const b = await loadKrBusinessDays(new Date("2020-01-01"), new Date("2020-01-02"));
    expect(a).toBe(MOCK_KR_BUSINESS_DAYS_2026);
    expect(b).toBe(MOCK_KR_BUSINESS_DAYS_2026);
  });
});
