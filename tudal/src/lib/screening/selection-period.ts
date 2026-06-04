// W2a — 선정 트랙 period_key + due-gate. 전부 순수 함수(KST=UTC+9 명시 보정).

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export interface KstParts { y: number; m: number; d: number; dow: number; } // dow 0=일..6=토
export function toKstParts(now: Date): KstParts {
  const k = new Date(now.getTime() + KST_OFFSET_MS);
  return { y: k.getUTCFullYear(), m: k.getUTCMonth() + 1, d: k.getUTCDate(), dow: k.getUTCDay() };
}
function pad(n: number): string { return String(n).padStart(2, '0'); }

/** 해당 시각이 속한 KST 주의 월요일 date(YYYY-MM-DD). */
export function kstMondayOf(now: Date): string {
  const k = new Date(now.getTime() + KST_OFFSET_MS);
  const dow = k.getUTCDay();              // 0=일..6=토
  const deltaToMon = dow === 0 ? -6 : 1 - dow; // 월요일까지 보정
  const mon = new Date(k.getTime() + deltaToMon * 86400000);
  return `${mon.getUTCFullYear()}-${pad(mon.getUTCMonth() + 1)}-${pad(mon.getUTCDate())}`;
}

export function currentShortPeriodKey(now: Date): string { return `s:${kstMondayOf(now)}`; }
export function currentMidlongPeriodKey(now: Date): string {
  const { y, m } = toKstParts(now);
  return `m:${y}-${pad(m)}`;
}
export function isShortDue(now: Date): boolean { return toKstParts(now).dow === 1; }   // 월요일
export function isMidlongDue(now: Date): boolean { return toKstParts(now).d === 1; }    // 매월 1일

/** period_key → short_list_30.month 용 YYYY-MM (short는 월요일이 속한 달). */
export function monthYMOfPeriod(periodKey: string): string {
  const body = periodKey.slice(2); // 's:' | 'm:' 제거
  return body.slice(0, 7);         // YYYY-MM-DD → YYYY-MM, YYYY-MM → 그대로
}

// Reserved helper for W2b/incumbent carry and diagnostics that receive only period_key.
// Keep exported even if W2a callers currently pass track explicitly, but do not
// silently coerce malformed keys to midlong.
