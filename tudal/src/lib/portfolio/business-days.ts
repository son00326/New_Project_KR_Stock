// business-days.ts — 한국 영업일 순수 함수 (S3 US-T3.5)
// Supabase·Next.js·fetch 호출 없음. 순수 함수 전용.

import { KrBusinessDay } from '@/types/kr-business-days';

/**
 * 로컬 타임존 기준으로 YYYY-MM-DD 문자열 반환.
 * KST 기준으로 날짜 키를 생성해 calendar Map과 매칭.
 */
export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * calendar 배열로부터 날짜 키 → isBusinessDay Map을 구축.
 */
function buildCalendarMap(calendar: KrBusinessDay[]): Map<string, boolean> {
  const map = new Map<string, boolean>();
  for (const entry of calendar) {
    map.set(entry.date, entry.isBusinessDay);
  }
  return map;
}

/**
 * 날짜가 영업일인지 판단.
 * - calendar Map에 있으면 그 값을 사용.
 * - 없으면 fallback: 토·일은 false, 평일은 true.
 */
function isBusinessDay(date: Date, calMap: Map<string, boolean>): boolean {
  const key = formatDateKey(date);
  if (calMap.has(key)) {
    return calMap.get(key)!;
  }
  // fallback: 0=Sun, 6=Sat
  const dow = date.getDay();
  return dow !== 0 && dow !== 6;
}

/**
 * start 이후 영업일 `days`개를 건너뛴 Date를 반환.
 * - days > 0: 순방향
 * - days < 0: 역방향
 * - days === 0: start 그대로 반환
 * start 자신은 카운트에 포함하지 않음 (다음 영업일부터 카운트).
 */
export function addBusinessDays(
  start: Date,
  days: number,
  calendar: KrBusinessDay[]
): Date {
  if (days === 0) {
    return new Date(start);
  }

  const calMap = buildCalendarMap(calendar);
  const step = days > 0 ? 1 : -1;
  let remaining = Math.abs(days);

  const current = new Date(start);

  while (remaining > 0) {
    current.setDate(current.getDate() + step);
    if (isBusinessDay(current, calMap)) {
      remaining--;
    }
  }

  return new Date(current);
}

/**
 * start부터 end(inclusive)까지 영업일 수를 반환.
 * start > end인 경우 0을 반환.
 */
export function countBusinessDaysBetween(
  start: Date,
  end: Date,
  calendar: KrBusinessDay[]
): number {
  const calMap = buildCalendarMap(calendar);

  const startTime = new Date(start);
  startTime.setHours(0, 0, 0, 0);
  const endTime = new Date(end);
  endTime.setHours(0, 0, 0, 0);

  if (startTime > endTime) {
    return 0;
  }

  let count = 0;
  const current = new Date(startTime);

  while (current <= endTime) {
    if (isBusinessDay(current, calMap)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}
