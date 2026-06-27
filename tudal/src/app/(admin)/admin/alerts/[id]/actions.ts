"use server";

import { getAlertEventById } from "@/lib/data/admin-alerts";
import { createClient } from "@/lib/supabase/server";
import type { ExitDecision } from "@/types/admin";

// ---------------------------------------------------------------------------
// /admin/alerts/[id] Exit 결정 기록 Server Action (S5b T5b.3 · S7c 실배선)
// ref: ServicePlan-Admin §3.10 R3.10-14
//
// 어드민이 "매도 전량 / 분할매도 / 홀딩" 중 하나 선택 + 메모 입력 → 이력에 저장.
//
// S7c (2026-06-27): real_persistence boundary 해소 — 0010 SECURITY DEFINER RPC
//   record_alert_exit_decision(p_alert_id, p_decision, p_memo)로 영속.
//   RPC가 admin 게이트 + decision enum + (exit_signal ∧ 미결정) 조건을 권위적으로 검증·UPDATE.
//   action 사전검증(존재/alertType/미결정)은 친절한 에러 UX용이며, 최종 권위는 RPC.
// ---------------------------------------------------------------------------

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
  if (!ALLOWED_DECISIONS.includes(decision)) {
    return { success: false, error: "invalid_decision" };
  }
  if (typeof alertId !== "string" || !alertId.trim()) {
    return { success: false, error: "invalid_input" };
  }

  let supabase;
  let user;
  try {
    supabase = await createClient();
    ({
      data: { user },
    } = await supabase.auth.getUser());
  } catch {
    return { success: false, error: "auth_unavailable" };
  }
  if (!user) {
    return { success: false, error: "auth_unavailable" };
  }

  // 친절 에러 UX용 사전검증 (최종 권위는 RPC).
  let alert;
  try {
    alert = await getAlertEventById(alertId);
  } catch {
    return { success: false, error: "alert_lookup_failed" };
  }
  if (!alert) {
    return { success: false, error: "alert_not_found" };
  }
  if (alert.alertType !== "exit_signal") {
    return { success: false, error: "not_exit_signal" };
  }
  if (alert.decisionRecorded) {
    return { success: false, error: "already_decided" };
  }

  // 0010 RPC — admin 게이트 + (exit_signal ∧ 미결정) UPDATE + is_read=true.
  const { error } = await supabase.rpc("record_alert_exit_decision", {
    p_alert_id: alertId,
    p_decision: decision,
    p_memo: input.memo,
  });
  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("admin_required")) {
      return { success: false, error: "auth_unavailable" };
    }
    if (msg.includes("invalid_decision")) {
      return { success: false, error: "invalid_decision" };
    }
    // 사전검증 통과 후 not_found = check↔RPC 사이 동시 결정(race).
    if (msg.includes("alert_not_found_or_already_decided")) {
      return { success: false, error: "already_decided" };
    }
    return { success: false, error: "exit_decision_write_failed" };
  }

  return { success: true, data: { decisionRecorded: decision } };
}
