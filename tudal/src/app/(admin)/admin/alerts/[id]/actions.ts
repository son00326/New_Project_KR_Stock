"use server";

import { getAlertEventById } from "@/lib/data/admin-alerts";
import { createClient } from "@/lib/supabase/server";
import type { ExitDecision } from "@/types/admin";

const REAL_PERSISTENCE_ERROR = "real_persistence_not_configured";

// ---------------------------------------------------------------------------
// /admin/alerts/[id] Exit 결정 기록 Server Action (S5b T5b.3)
// ref: ServicePlan-Admin §3.10 R3.10-14
//
// 어드민이 "매도 전량 / 분할매도 / 홀딩" 중 하나 선택 + 메모 입력 → 이력에 저장.
//
// Mock cleanup Step 2.1 (58차):
//   - MOCK_ADMIN_ALERTS in-memory mutation 제거 (dev에서 "성공" 응답이 새 요청에서
//     reset되며 거짓 성공을 보이던 mock 패턴).
//   - alert_event 실 SELECT로 존재성·alertType·이미 결정됨 검증.
//   - 실 persistence는 모든 환경에서 real_persistence_not_configured (boundary).
//     S5b 후속 PR에서 update_alert_event_decision RPC + cost_log 정합으로 교체 예정.
// ---------------------------------------------------------------------------

const ALLOWED_DECISIONS: readonly ExitDecision[] = [
  "sell_all",
  "partial_sell",
  "hold",
];

async function resolveAdminId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

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

  if (!(await resolveAdminId())) {
    return { success: false, error: "auth_unavailable" };
  }

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

  // S5b real persistence (update_alert_event_decision RPC) 미연결 — boundary.
  // 어떤 환경에서도 가짜 성공 응답 금지 (Mock cleanup Step 1.3 lesson).
  return { success: false, error: REAL_PERSISTENCE_ERROR };
}
