"use server";

import { MOCK_ADMIN_ALERTS } from "@/lib/data/mock-admin-alerts";
import { createClient } from "@/lib/supabase/server";
import type { ExitDecision } from "@/types/admin";

// ---------------------------------------------------------------------------
// /admin/alerts/[id] Exit 결정 기록 Server Action (S5b T5b.3)
// ref: ServicePlan-Admin §3.10 R3.10-14
//
// 어드민이 "매도 전량 / 분할매도 / 홀딩" 중 하나 선택 + 메모 입력 → 이력에 저장.
// mock fixture 전용. S5 실데이터 전환 시 alert_event UPDATE로 교체.
// ---------------------------------------------------------------------------

async function resolveAdminId(): Promise<string> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? "admin-001";
  } catch {
    return "admin-001";
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
  const { alertId, decision } = input;
  const memo = input.memo.trim();
  await resolveAdminId();

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
    // TODO(S5): await supabase.from("alert_event").update({
    //   decision_recorded: decision, decision_memo: memo, is_read: true
    // }).eq("id", alertId);
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
