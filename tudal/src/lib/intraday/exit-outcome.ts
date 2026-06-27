import type { AlertEvent } from "@/types/admin";

// ---------------------------------------------------------------------------
// M15 Exit 시그널 T+7 outcome — 순수 로직 (S7c, 2026-06-27)
// ref: ServicePlan-Admin §3.10 R3.10-12 (IM-3 Exit 신뢰도 입력)
//
// Exit 시그널 발송 후 T+7일 경과 → signal-date 종가 대비 T+7 거래일 종가 변화율 적재.
// 가격은 KRX EOD(재조회)로 산출 — alert_event에 price 저장 불필요(무비용·결정론).
// I/O 없음 — 호출부(/api/cron/exit-outcome)가 flag gate + KRX 조회 + RPC UPDATE.
// shadow-first: EXIT_OUTCOME_ENABLED off → 호출부 미실행.
// ---------------------------------------------------------------------------

export const EXIT_OUTCOME_HOLD_DAYS = 7;

const MS_PER_DAY = 24 * 3600 * 1000;

/**
 * outcome 적재가 필요한 exit_signal alert 선별:
 *   - alertType === "exit_signal"
 *   - outcomeAt === null (미적재)
 *   - signalSentAt ≤ now - holdDays (T+7 경과)
 *   - ticker non-null (가격 조회 대상)
 */
export function selectAlertsNeedingOutcome(
  alerts: AlertEvent[],
  now: Date,
  holdDays: number = EXIT_OUTCOME_HOLD_DAYS,
): AlertEvent[] {
  const cutoff = now.getTime() - holdDays * MS_PER_DAY;
  return alerts.filter(
    (a) =>
      a.alertType === "exit_signal" &&
      a.outcomeAt === null &&
      a.ticker !== null &&
      a.ticker.trim().length > 0 &&
      Number.isFinite(new Date(a.signalSentAt).getTime()) &&
      new Date(a.signalSentAt).getTime() <= cutoff,
  );
}

/**
 * T+7 가격 변화율 (percentage points). signalClose/t7Close ≤ 0 → null (fail-soft skip).
 */
export function computeT7PriceChangePct(
  signalClose: number,
  t7Close: number,
): number | null {
  if (!(signalClose > 0) || !(t7Close > 0)) return null;
  return Number((((t7Close - signalClose) / signalClose) * 100).toFixed(3));
}

function isoToKstBasDd(ms: number): string {
  const kst = new Date(ms + 9 * 3600 * 1000);
  return `${kst.getUTCFullYear()}${String(kst.getUTCMonth() + 1).padStart(2, "0")}${String(kst.getUTCDate()).padStart(2, "0")}`;
}

/**
 * signal 발송일(ISO) → KRX EOD 기준일 8자리(YYYYMMDD, KST). 호출부가 영업일 보정 후 조회.
 */
export function signalDateToBasDd(signalSentAt: string): string | null {
  const t = new Date(signalSentAt);
  if (!Number.isFinite(t.getTime())) return null;
  return isoToKstBasDd(t.getTime());
}

/** now → KST 오늘 YYYYMMDD (T+7 상한). */
export function nowKstBasDd(now: Date): string {
  return isoToKstBasDd(now.getTime());
}

/** YYYYMMDD를 deltaDays만큼 이동(음수=과거). 잘못된 형식 → null. */
export function shiftBasDd(basDd: string, deltaDays: number): string | null {
  if (!/^\d{8}$/.test(basDd)) return null;
  const y = Number(basDd.slice(0, 4));
  const m = Number(basDd.slice(4, 6));
  const d = Number(basDd.slice(6, 8));
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (!Number.isFinite(dt.getTime())) return null;
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return `${dt.getUTCFullYear()}${String(dt.getUTCMonth() + 1).padStart(2, "0")}${String(dt.getUTCDate()).padStart(2, "0")}`;
}

/**
 * T+7 목표 기준일 = min(signal + holdDays, now). 휴장 보정은 호출부 walk-back.
 */
export function t7TargetBasDd(
  signalSentAt: string,
  now: Date,
  holdDays: number = EXIT_OUTCOME_HOLD_DAYS,
): string | null {
  const sig = signalDateToBasDd(signalSentAt);
  if (!sig) return null;
  const target = shiftBasDd(sig, holdDays);
  if (!target) return null;
  const cap = nowKstBasDd(now);
  return target > cap ? cap : target;
}

/**
 * basDd부터 과거로 maxBack일 후보 [basDd, -1, ..., -maxBack] — 휴장/주말 walk-back용.
 */
export function candidateBasDdsBackFrom(
  basDd: string | null,
  maxBack: number,
): string[] {
  if (!basDd || !/^\d{8}$/.test(basDd)) return [];
  const out: string[] = [];
  for (let i = 0; i <= maxBack; i++) {
    const c = shiftBasDd(basDd, -i);
    if (c) out.push(c);
  }
  return out;
}
