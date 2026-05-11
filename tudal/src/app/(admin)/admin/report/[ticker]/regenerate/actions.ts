"use server";

import { isHardcapBlocked } from "@/lib/cost/aggregate";
import { reportExistsForMonth } from "@/lib/data/admin-reports";
import { incrementManualRegenCount } from "@/lib/data/admin-regen-counters";
import { MOCK_ADMIN_COST_LOG } from "@/lib/data/mock-admin-cost-log";
import { MANUAL_REGEN_CAP } from "@/lib/performance/regen-cap";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// regenerateReport — 수동 재생성 요청 (S4 M9 cap + S6 M17 hardcap)
// ---------------------------------------------------------------------------
// T7e.5: regen_counter는 Supabase 실 I/O. 동시 클릭 race는 데이터 레이어가
// CAS + DB CHECK(manual_count <= 2)로 차단한다.
// cost_log 합계는 아직 mock(MOCK_ADMIN_COST_LOG) — 실 SELECT는 S7a/T7a 범위.

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])-01$/;
const TICKER_RE = /^\d{6}$/;

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

function classifyIncrementError(message: string): string {
  if (message.includes("lookup")) return "regen_counter_lookup_failed";
  if (message.includes("conflict")) return "regen_counter_write_conflict";
  return "regen_counter_write_failed";
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

  // T7e.3 — stock_reports 존재성 실 SELECT (Supabase). 키 미시드 상태에서는
  // 항상 false → "report_not_found" 반환 (S7a/T7e.8 시드 전 일관 동작).
  let exists: boolean;
  try {
    exists = await reportExistsForMonth(normalizedTicker, month);
  } catch {
    return { success: false, error: "report_lookup_failed" };
  }
  if (!exists) {
    return { success: false, error: "report_not_found" };
  }

  if (!(await resolveAdminId())) {
    return { success: false, error: "auth_unavailable" };
  }

  // S6 M17 — 월 40만원 hardcap (cost_log 합계 mock 기반, 실 SELECT는 S7a/T7a).
  if (isHardcapBlocked(MOCK_ADMIN_COST_LOG, month)) {
    return { success: false, error: "cost_hardcap_40man" };
  }

  // T7e.5 — regen_counter Supabase 실 I/O. CAS + DB CHECK가 race를 차단.
  let result: Awaited<ReturnType<typeof incrementManualRegenCount>>;
  try {
    result = await incrementManualRegenCount(normalizedTicker, month);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: classifyIncrementError(message) };
  }

  if (!result.ok) {
    return { success: false, error: "manual_cap_exhausted" };
  }

  return {
    success: true,
    data: {
      manualCount: result.manualCount,
      manualRemaining: MANUAL_REGEN_CAP - result.manualCount,
    },
  };
}
