// business-days.test.ts — US-T3.5 단위 테스트
import { describe, it, expect } from 'vitest';
import { addBusinessDays, countBusinessDaysBetween } from '../business-days';
import { KrBusinessDay } from '@/types/kr-business-days';

// ---------------------------------------------------------------------------
// 최소 인라인 픽스처 — 관련 날짜만 정의
// ---------------------------------------------------------------------------

function bd(date: string): KrBusinessDay {
  return { date, isBusinessDay: true, holidayName: null };
}

function hd(date: string, holidayName: string): KrBusinessDay {
  return { date, isBusinessDay: false, holidayName };
}

// 케이스 1·5·6·7용: 2026-04 구간
const APRIL_2026: KrBusinessDay[] = [
  // 주말은 calendar에 없어도 fallback으로 처리됨 (토·일 = false)
  bd('2026-04-13'), // 월
  bd('2026-04-14'), // 화
  bd('2026-04-15'), // 수
  bd('2026-04-16'), // 목
  bd('2026-04-17'), // 금
  // 2026-04-18 Sat, 2026-04-19 Sun — fallback false
  bd('2026-04-20'), // 월
  bd('2026-04-21'), // 화
  bd('2026-04-22'), // 수
  bd('2026-04-23'), // 목
  bd('2026-04-24'), // 금
  // 2026-04-25 Sat, 2026-04-26 Sun — fallback false
  bd('2026-04-27'), // 월
];

// 케이스 2용: 2026-05-04~07 구간 (어린이날 05-05 공휴일)
const MAY_2026_CHILDRENS: KrBusinessDay[] = [
  bd('2026-05-04'),  // 월
  hd('2026-05-05', '어린이날'), // 공휴일
  bd('2026-05-06'),  // 수
  bd('2026-05-07'),  // 목
];

// 케이스 3용: 2026-05-22~26 구간 (석가탄신일 대체 05-25 공휴일)
// 05-23 Sat, 05-24 Sun → fallback false
// 05-25 Mon 석가탄신일 대체 → 공휴일
const MAY_2026_BUDDHA: KrBusinessDay[] = [
  bd('2026-05-22'),  // 금
  // 2026-05-23 Sat — fallback false
  // 2026-05-24 Sun — fallback false (본래 석가탄신일)
  hd('2026-05-25', '석가탄신일 대체공휴일'), // 월 공휴일
  bd('2026-05-26'),  // 화
];

// 케이스 4용: 2026-09 추석 구간
// 09-23 Wed, 09-24~26 추석, 09-26 Sat, 09-27 Sun, 09-28 Mon
const SEP_2026_CHUSEOK: KrBusinessDay[] = [
  bd('2026-09-23'),  // 수
  hd('2026-09-24', '추석'), // 목
  hd('2026-09-25', '추석'), // 금
  // 2026-09-26 Sat — fallback false (추석 연휴 + 토)
  // 2026-09-27 Sun — fallback false
  bd('2026-09-28'),  // 월
];

// ---------------------------------------------------------------------------
// 테스트
// ---------------------------------------------------------------------------

describe('addBusinessDays', () => {
  it('케이스 1 — 주말 skip: 2026-04-24(금) +1 → 2026-04-27(월)', () => {
    const start = new Date('2026-04-24');
    const result = addBusinessDays(start, 1, APRIL_2026);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(3); // 0-indexed April
    expect(result.getDate()).toBe(27);
  });

  it('케이스 2 — 어린이날 skip: 2026-05-04(월) +2 → 2026-05-07(목)', () => {
    const start = new Date('2026-05-04');
    const result = addBusinessDays(start, 2, MAY_2026_CHILDRENS);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(4); // May
    expect(result.getDate()).toBe(7);
  });

  it('케이스 3 — 석가탄신일 대체 skip: 2026-05-22(금) +1 → 2026-05-26(화)', () => {
    const start = new Date('2026-05-22');
    const result = addBusinessDays(start, 1, MAY_2026_BUDDHA);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(4); // May
    expect(result.getDate()).toBe(26);
  });

  it('케이스 4 — 추석 구간 skip: 2026-09-23(수) +1 → 2026-09-28(월)', () => {
    const start = new Date('2026-09-23');
    const result = addBusinessDays(start, 1, SEP_2026_CHUSEOK);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(8); // September
    expect(result.getDate()).toBe(28);
  });

  it('케이스 5 — 일반 평일 연속: 2026-04-13(월) +3 → 2026-04-16(목)', () => {
    const start = new Date('2026-04-13');
    const result = addBusinessDays(start, 3, APRIL_2026);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(3);
    expect(result.getDate()).toBe(16);
  });

  it('케이스 6 — 0일 no-op: 2026-04-13(월) +0 → 2026-04-13(월)', () => {
    const start = new Date('2026-04-13');
    const result = addBusinessDays(start, 0, APRIL_2026);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(3);
    expect(result.getDate()).toBe(13);
  });
});

describe('countBusinessDaysBetween', () => {
  it('케이스 7 — 2026-04-13(월) ~ 2026-04-17(금) = 5영업일', () => {
    const start = new Date('2026-04-13');
    const end = new Date('2026-04-17');
    const count = countBusinessDaysBetween(start, end, APRIL_2026);
    expect(count).toBe(5);
  });
});
