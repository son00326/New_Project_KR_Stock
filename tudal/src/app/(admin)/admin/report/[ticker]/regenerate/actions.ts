"use server";

import { MOCK_ADMIN_REGEN_COUNTERS } from "@/lib/data/mock-admin-regen-counters";
import { MANUAL_REGEN_CAP } from "@/lib/performance/regen-cap";

// ---------------------------------------------------------------------------
// regenerateReport — 수동 재생성 요청 (S4 M9 cap 가드)
// ---------------------------------------------------------------------------
// cost_log stub (R5 완화): S6 M17에서 SELECT SUM(cost_krw) FROM cost_log WHERE month=? 후
// 400000 비교 활성화. S4 현재는 주석 스텁만.
// TODO(S6 M17): const monthly_cost_krw = await supabase.from("cost_log").select("cost_krw").eq("month", month);
//               if (monthly_cost_krw_sum >= 400000) return { success: false, error: "hardcap_40man" };

export async function regenerateReport(input: {
  ticker: string;
  month: string;
}): Promise<
  | { success: true; data: { manualCount: number; manualRemaining: number } }
  | { success: false; error: string }
> {
  const { ticker, month } = input;

  // mock lookup (실 Supabase SELECT는 S5 이후)
  let counter = MOCK_ADMIN_REGEN_COUNTERS.find(
    (c) => c.ticker === ticker && c.month === month,
  );

  if (!counter) {
    // 카운터 없음 → 이번 달 첫 요청, 신규 항목 생성
    const [year, mon] = month.split("-").map(Number);
    const nextMonth = mon === 12 ? 1 : mon + 1;
    const nextYear = mon === 12 ? year + 1 : year;
    const resetAt = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00+09:00`;

    counter = {
      id: `regen-${Date.now()}`,
      ticker,
      month,
      autoCount: 0,
      manualCount: 0,
      resetAt,
    };
    // TODO(S5): await supabase.from("regen_counter").insert(counter);
    MOCK_ADMIN_REGEN_COUNTERS.push(counter);
  }

  if (counter.manualCount >= MANUAL_REGEN_CAP) {
    return { success: false, error: "manual_cap_exhausted" };
  }

  // mock mutation (실 Supabase UPDATE는 TODO(S5))
  counter.manualCount += 1;

  return {
    success: true,
    data: {
      manualCount: counter.manualCount,
      manualRemaining: MANUAL_REGEN_CAP - counter.manualCount,
    },
  };
}
