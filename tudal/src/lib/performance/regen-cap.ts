// regen-cap.ts — 재생성 cap 가드 순수 로직 (S4 M9)
// 출처: ServicePlan-Admin.md §1A M9 재생성 cap (auto ≤ 1 / manual ≤ 2)
// 실 Supabase READ는 S5 이후. 현재는 mock 배열로 동작.

import type { RegenCounter } from "@/types/admin";

export const MANUAL_REGEN_CAP = 2;
export const AUTO_REGEN_CAP = 1;

/** counters 배열에서 ticker+month가 일치하는 항목을 반환. 없으면 null. */
export function findRegenCounter(
  counters: RegenCounter[],
  ticker: string,
  month: string,
): RegenCounter | null {
  return counters.find((c) => c.ticker === ticker && c.month === month) ?? null;
}

/** 이번 달 수동 재생성 잔여 횟수 (counter가 null이면 MANUAL_REGEN_CAP 그대로). */
export function manualRemaining(counter: RegenCounter | null): number {
  if (counter === null) return MANUAL_REGEN_CAP;
  return MANUAL_REGEN_CAP - counter.manualCount;
}

/** 수동 재생성 허용 여부 (잔여 > 0). */
export function isManualRegenAllowed(counter: RegenCounter | null): boolean {
  return manualRemaining(counter) > 0;
}
