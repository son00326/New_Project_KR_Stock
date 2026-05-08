"use server";

import { isHardcapBlocked } from "@/lib/cost/aggregate";
import { MOCK_ADMIN_COST_LOG } from "@/lib/data/mock-admin-cost-log";
import { MOCK_ADMIN_REGEN_COUNTERS } from "@/lib/data/mock-admin-regen-counters";
import { MOCK_ADMIN_REPORTS } from "@/lib/data/mock-admin-report";
import { MANUAL_REGEN_CAP } from "@/lib/performance/regen-cap";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// regenerateReport — 수동 재생성 요청 (S4 M9 cap 가드 + S6 M17 hardcap 활성)
// ---------------------------------------------------------------------------
// S6 M17 활성: 월 40만원 hardcap 도달 시 재생성 차단 (S4 stub → 실 활성화).
// 실 Supabase 전환 시:
//   const { data } = await supabase.from("cost_log").select("cost_krw").eq("month", monthStart);
//   if (sum(data) >= 400000) return { success: false, error: "cost_hardcap_40man" };

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])-01$/;
const TICKER_RE = /^\d{6}$/;
const REAL_PERSISTENCE_ERROR = "real_persistence_not_configured";

function isProductionLike(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.NEXT_PUBLIC_APP_ENV === "production"
  );
}

async function resolveAdminId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id) return user.id;
    return isProductionLike() ? null : "admin-001";
  } catch {
    return isProductionLike() ? null : "admin-001";
  }
}

export async function regenerateReport(input: {
  ticker: string;
  month: string;
}): Promise<
  | { success: true; data: { manualCount: number; manualRemaining: number } }
  | { success: false; error: string }
> {
  if (!input || typeof input !== "object") {
    return { success: false, error: "invalid_input" };
  }
  const { ticker, month } = input;
  if (typeof ticker !== "string" || typeof month !== "string") {
    return { success: false, error: "invalid_input" };
  }
  const normalizedTicker = ticker.trim();
  if (!MONTH_RE.test(month)) {
    return { success: false, error: "invalid_month" };
  }
  if (!normalizedTicker) {
    return { success: false, error: "ticker_required" };
  }
  if (!TICKER_RE.test(normalizedTicker)) {
    return { success: false, error: "invalid_ticker" };
  }
  const reportExists = MOCK_ADMIN_REPORTS.some(
    (report) => report.ticker === normalizedTicker && report.month === month,
  );
  if (!reportExists) {
    return { success: false, error: "report_not_found" };
  }
  if (!(await resolveAdminId())) {
    return { success: false, error: "auth_unavailable" };
  }
  if (isProductionLike()) {
    return { success: false, error: REAL_PERSISTENCE_ERROR };
  }

  // S6 M17: 40만 hardcap 검사 (mock cost_log 사용, 실 Supabase는 TODO)
  if (isHardcapBlocked(MOCK_ADMIN_COST_LOG, month)) {
    return { success: false, error: "cost_hardcap_40man" };
  }

  // mock lookup (실 Supabase SELECT는 S5 이후)
  let counter = MOCK_ADMIN_REGEN_COUNTERS.find(
    (c) => c.ticker === normalizedTicker && c.month === month,
  );

  if (!counter) {
    // 카운터 없음 → 이번 달 첫 요청, 신규 항목 생성
    const [year, mon] = month.split("-").map(Number);
    const nextMonth = mon === 12 ? 1 : mon + 1;
    const nextYear = mon === 12 ? year + 1 : year;
    const resetAt = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00+09:00`;

    counter = {
      id: `regen-${Date.now()}`,
      ticker: normalizedTicker,
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
