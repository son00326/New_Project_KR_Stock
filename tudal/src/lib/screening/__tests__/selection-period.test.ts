import { describe, it, expect } from 'vitest';
import {
  toKstParts, currentShortPeriodKey, currentMidlongPeriodKey,
  isShortDue, isMidlongDue, monthYMOfPeriod,
} from '../selection-period';

describe('selection-period', () => {
  // 2026-06-04는 목요일(KST). 직전 월요일 = 2026-06-01.
  const thu = new Date('2026-06-04T01:00:00Z'); // KST 10:00 목
  const mon = new Date('2026-06-01T01:00:00Z'); // KST 10:00 월 (= 6월 1일)
  const sun = new Date('2026-06-07T15:30:00Z'); // KST 2026-06-08 00:30 월요일 (UTC+9 날짜 넘김)

  it('short period key = 해당 주 KST 월요일 (s: 접두)', () => {
    expect(currentShortPeriodKey(thu)).toBe('s:2026-06-01');
    expect(currentShortPeriodKey(mon)).toBe('s:2026-06-01');
  });
  it('UTC 저녁이 KST 다음날 월요일로 넘어가는 경계', () => {
    expect(currentShortPeriodKey(sun)).toBe('s:2026-06-08');
    expect(isShortDue(sun)).toBe(true);
  });
  it('midlong period key = m:YYYY-MM (KST)', () => {
    expect(currentMidlongPeriodKey(thu)).toBe('m:2026-06');
  });
  it('isShortDue = KST 월요일만 true', () => {
    expect(isShortDue(mon)).toBe(true);
    expect(isShortDue(thu)).toBe(false);
  });
  it('isMidlongDue = KST 매월 1일만 true', () => {
    expect(isMidlongDue(mon)).toBe(true);   // 6/1
    expect(isMidlongDue(thu)).toBe(false);
  });
  it('monthYMOfPeriod: 두 트랙 모두 short_list_30 month(YYYY-MM) 반환', () => {
    expect(monthYMOfPeriod('s:2026-06-01')).toBe('2026-06');
    expect(monthYMOfPeriod('m:2026-06')).toBe('2026-06');
    expect(monthYMOfPeriod('s:2026-06-29')).toBe('2026-06'); // 월말 주 → 해당 월
  });


  // toKstParts는 import 검증 + 직접 단위 확인 (계획 import 라인에 포함).
  it('toKstParts: UTC→KST 보정 (dow/날짜)', () => {
    expect(toKstParts(thu)).toEqual({ y: 2026, m: 6, d: 4, dow: 4 });
    expect(toKstParts(sun)).toEqual({ y: 2026, m: 6, d: 8, dow: 1 });
  });
});
