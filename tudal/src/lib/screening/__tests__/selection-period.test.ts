import { describe, it, expect } from 'vitest';
import {
  toKstParts, currentShortPeriodKey, currentMidlongPeriodKey, monthYMOfPeriod,
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
  });
  // B-SEL-CRON — period-scoped due-gate: window 내 어떤 날이든 같은 period key로 수렴
  //   (월요일 단발 due 폐기 — route는 이 매핑으로 미finalize period를 매일 이어간다).
  it('period-scoped: 같은 주 모든 요일이 동일 short period key로 매핑', () => {
    const tue = new Date('2026-06-02T01:00:00Z'); // KST 화
    const sat = new Date('2026-06-06T01:00:00Z'); // KST 토
    const sunSameWeek = new Date('2026-06-07T01:00:00Z'); // KST 일 (주의 마지막 날)
    expect(currentShortPeriodKey(tue)).toBe('s:2026-06-01');
    expect(currentShortPeriodKey(sat)).toBe('s:2026-06-01');
    expect(currentShortPeriodKey(sunSameWeek)).toBe('s:2026-06-01');
  });
  it('midlong period key = m:YYYY-MM (KST) — 월 내 모든 날 동일', () => {
    expect(currentMidlongPeriodKey(thu)).toBe('m:2026-06');
    expect(currentMidlongPeriodKey(new Date('2026-06-29T01:00:00Z'))).toBe('m:2026-06');
  });
  it('monthYMOfPeriod: 두 트랙 모두 short_list_30 month(YYYY-MM) 반환', () => {
    expect(monthYMOfPeriod('s:2026-06-01')).toBe('2026-06');
    expect(monthYMOfPeriod('m:2026-06')).toBe('2026-06');
    expect(monthYMOfPeriod('s:2026-06-29')).toBe('2026-06'); // 월말 주 → 해당 월
  });

  it('월/연 경계: short는 KST 월요일 월, midlong은 KST 현재 월을 사용', () => {
    const julyFirstKst = new Date('2026-06-30T15:30:00Z');
    expect(currentShortPeriodKey(julyFirstKst)).toBe('s:2026-06-29');
    expect(monthYMOfPeriod(currentShortPeriodKey(julyFirstKst))).toBe('2026-06');
    expect(currentMidlongPeriodKey(julyFirstKst)).toBe('m:2026-07');
    expect(monthYMOfPeriod(currentMidlongPeriodKey(julyFirstKst))).toBe('2026-07');

    const newYearKst = new Date('2025-12-31T15:30:00Z');
    expect(currentShortPeriodKey(newYearKst)).toBe('s:2025-12-29');
    expect(monthYMOfPeriod(currentShortPeriodKey(newYearKst))).toBe('2025-12');
    expect(currentMidlongPeriodKey(newYearKst)).toBe('m:2026-01');
    expect(monthYMOfPeriod(currentMidlongPeriodKey(newYearKst))).toBe('2026-01');
  });


  // toKstParts는 import 검증 + 직접 단위 확인 (계획 import 라인에 포함).
  it('toKstParts: UTC→KST 보정 (dow/날짜)', () => {
    expect(toKstParts(thu)).toEqual({ y: 2026, m: 6, d: 4, dow: 4 });
    expect(toKstParts(sun)).toEqual({ y: 2026, m: 6, d: 8, dow: 1 });
  });
});
