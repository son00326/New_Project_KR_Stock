"use server";

import { isHardcapBlocked } from "@/lib/cost/aggregate";
import { MOCK_ADMIN_COST_LOG } from "@/lib/data/mock-admin-cost-log";
import { MOCK_ADMIN_REGEN_COUNTERS } from "@/lib/data/mock-admin-regen-counters";
import { MANUAL_REGEN_CAP } from "@/lib/performance/regen-cap";

// ---------------------------------------------------------------------------
// regenerateReport — 수동 재생성 요청 (S4 M9 cap 가드 + S6 M17 hardcap 활성)
// ---------------------------------------------------------------------------
// S6 M17 활성: 월 40만원 hardcap 도달 시 재생성 차단 (S4 stub → 실 활성화).
// 실 Supabase 전환 시:
//   const { data } = await supabase.from("cost_log").select("cost_krw").eq("month", monthStart);
//   if (sum(data) >= 400000) return { success: false, error: "cost_hardcap_40man" };

export async function regenerateReport(input: {
  ticker: string;
  month: string;
}): Promise<
  | { success: true; data: { manualCount: number; manualRemaining: number } }
  | { success: false; error: string }
> {
  const { ticker, month } = input;

  // S6 M17: 40만 hardcap 검사 (mock cost_log 사용, 실 Supabase는 TODO)
  if (isHardcapBlocked(MOCK_ADMIN_COST_LOG, month)) {
    return { success: false, error: "cost_hardcap_40man" };
  }

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
