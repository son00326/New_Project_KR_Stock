"use server";

import { isHardcapBlocked } from "@/lib/cost/aggregate";
import { reportExistsForMonth } from "@/lib/data/admin-reports";
import { incrementManualRegenCount } from "@/lib/data/admin-regen-counters";
import { getActiveShortList } from "@/lib/data/admin-shortlist";
import { MOCK_ADMIN_COST_LOG } from "@/lib/data/mock-admin-cost-log";
import { MANUAL_REGEN_CAP } from "@/lib/performance/regen-cap";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// regenerateReport — 수동 재생성 요청 (S4 M9 cap + S6 M17 hardcap + PR4 Step 2.3 orchestrate wire)
// ---------------------------------------------------------------------------
// T7e.5: regen_counter는 Supabase 실 I/O. 동시 클릭 race는 데이터 레이어가
// CAS + DB CHECK(manual_count <= 2)로 차단한다.
// cost_log 합계는 아직 mock(MOCK_ADMIN_COST_LOG) — 실 SELECT는 S7a/T7a 범위.
//
// PR4 Task 2 Step 2.3 (caller DI seam — orchestrate wire):
//   - createClient 1회 호출 (auth + orchestrate DI 공유)
//   - getActiveShortList({month})에서 name/sector 추출 (short_list_30 SoT, 마이그 0012)
//   - orchestrateFullReport(payload, { client, callerKind: 'admin' }) — Step 1.2 trigger 패턴 정합
//   - month 변환: YYYY-MM-DD (regen-cap) → YYYY-MM (orchestrate)
//   - return shape +reportId (breaking change vs PR3c 박제)
//   - counter increment BEFORE orchestrate (실패 시 재시도 폭증 차단)

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])-01$/;
const TICKER_RE = /^\d{6}$/;

function isProductionLike(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.NEXT_PUBLIC_APP_ENV === "production"
  );
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
  | {
      success: true;
      data: { manualCount: number; manualRemaining: number; reportId: string };
    }
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

  // PR4 Step 2.3: createClient 1회 — auth + orchestrate DI 공유 (caller-flow 단일).
  const supabase = await createClient();
  let adminUserId: string | null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    adminUserId = user?.id ?? (isProductionLike() ? null : "admin-001");
  } catch {
    adminUserId = isProductionLike() ? null : "admin-001";
  }
  if (!adminUserId) {
    return { success: false, error: "auth_unavailable" };
  }

  // S6 M17 — 월 40만원 hardcap (cost_log 합계 mock 기반, 실 SELECT는 S7a/T7a).
  if (isHardcapBlocked(MOCK_ADMIN_COST_LOG, month)) {
    return { success: false, error: "cost_hardcap_40man" };
  }

  // PR4 Step 2.3: name/sector SoT = short_list_30 (마이그 0012, 마이그 0건 유지).
  // counter increment BEFORE — shortlist fail-fast (cheap) → counter 보존.
  let shortlistItem: { name: string; sector: string } | undefined;
  try {
    const items = await getActiveShortList({ month });
    const match = items.find((item) => item.ticker === normalizedTicker);
    if (match) {
      shortlistItem = { name: match.name, sector: match.sector };
    }
  } catch {
    return { success: false, error: "shortlist_lookup_failed" };
  }
  if (!shortlistItem) {
    return { success: false, error: "shortlist_item_not_found" };
  }

  // T7e.5 — regen_counter Supabase 실 I/O. CAS + DB CHECK가 race를 차단.
  // PR4 Step 2.3: counter increment BEFORE orchestrate — 실패 시에도 재시도 폭증 차단.
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

  // PR4 Step 2.3: orchestrateFullReport (quality path, Kevin v3.1 target) — Step 1.2/2.2 trigger 패턴 정합.
  // Dynamic import — orchestrator module heavy (PR3c 본체) lazy load.
  // month YYYY-MM-DD (regen-cap) → YYYY-MM (orchestrate FullReportUserPromptInput).
  const orchestrateMonth = month.slice(0, 7);
  try {
    const { orchestrateFullReport } = await import(
      "@/lib/report/full-report-orchestrator"
    );
    const orchestrateResult = await orchestrateFullReport(
      {
        ticker: normalizedTicker,
        name: shortlistItem.name,
        sector: shortlistItem.sector,
        month: orchestrateMonth,
        // Step 1.2 trigger 패턴 동일 — prompt-valid stub. enriched input은 후속 Tier 1·Tier 2 결과 활용.
        tier1Verdict: "HOLD",
        consensusBadge: "🟡",
        financialsSummary: "근거 부족",
        technicalsSummary: "근거 부족",
        macroSummary: "근거 부족",
        sectorReference: "근거 부족",
        adminUserId,
      },
      {
        client: supabase,
        callerKind: "admin",
      },
    );

    return {
      success: true,
      data: {
        manualCount: result.manualCount,
        manualRemaining: MANUAL_REGEN_CAP - result.manualCount,
        reportId: orchestrateResult.reportId,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "orchestrate_full_report_failed",
    };
  }
}
