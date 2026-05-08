"use server";

import { MOCK_ADMIN_ALERTS } from "@/lib/data/mock-admin-alerts";
import { createClient } from "@/lib/supabase/server";
import type { ExitDecision } from "@/types/admin";

const REAL_PERSISTENCE_ERROR = "real_persistence_not_configured";

// ---------------------------------------------------------------------------
// /admin/alerts/[id] Exit 결정 기록 Server Action (S5b T5b.3)
// ref: ServicePlan-Admin §3.10 R3.10-14
//
// 어드민이 "매도 전량 / 분할매도 / 홀딩" 중 하나 선택 + 메모 입력 → 이력에 저장.
// mock fixture 전용. S5 실데이터 전환 시 alert_event UPDATE로 교체.
// ---------------------------------------------------------------------------

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

const ALLOWED_DECISIONS: readonly ExitDecision[] = [
  "sell_all",
  "partial_sell",
  "hold",
];

export async function recordExitDecision(input: {
  alertId: string;
  decision: ExitDecision;
  memo: string;
}): Promise<
  | { success: true; data: { decisionRecorded: ExitDecision } }
  | { success: false; error: string }
> {
  if (!input || typeof input !== "object") {
    return { success: false, error: "invalid_input" };
  }
  const { alertId, decision } = input;
  if (typeof input.memo !== "string") {
    return { success: false, error: "invalid_memo" };
  }
  const memo = input.memo.trim();
  if (!(await resolveAdminId())) {
    return { success: false, error: "auth_unavailable" };
  }
  if (isProductionLike()) {
    return { success: false, error: REAL_PERSISTENCE_ERROR };
  }

  if (!ALLOWED_DECISIONS.includes(decision)) {
    return { success: false, error: "invalid_decision" };
  }

  const alert = MOCK_ADMIN_ALERTS.find((a) => a.id === alertId);
  if (!alert) {
    return { success: false, error: "alert_not_found" };
  }
  if (alert.alertType !== "exit_signal") {
    return { success: false, error: "not_exit_signal" };
  }
  if (alert.decisionRecorded) {
    return { success: false, error: "already_decided" };
  }

  try {
    // TODO(S5): await supabase.rpc("record_alert_exit_decision", {
    //   p_alert_id: alertId,
    //   p_decision: decision,
    //   p_memo: memo,
    // });
    alert.decisionRecorded = decision;
    alert.decisionMemo = memo || null;
    alert.isRead = true;
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "unknown_error",
    };
  }

  return { success: true, data: { decisionRecorded: decision } };
}
