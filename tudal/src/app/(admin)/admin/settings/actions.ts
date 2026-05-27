"use server";

import { createClient } from "@/lib/supabase/server";

const REAL_PERSISTENCE_ERROR = "real_persistence_not_configured";

// ---------------------------------------------------------------------------
// /admin/settings Server Actions (58차 Mock cleanup Step 2.2)
// ref: ServicePlan-Admin §3.5 R3.5-2·§3.10 R3.10-8~9
//
// WRITE 경로 (setIntradayMode + setTickerAlertEnabled)는 Step 2.1
// recordExitDecision + Step 1.3 lesson "가짜 성공 응답 금지" 정합으로
// 모든 환경 `real_persistence_not_configured` boundary 반환. S5b real
// persistence RPC (upsert_admin_settings_self / upsert_ticker_alert_pref_self)
// 연결 시 교체. READ 경로는 src/lib/data/admin-settings.ts +
// src/lib/data/admin-ticker-prefs.ts helper로 분리.
//
// 모든 action은 { success, data|error } 규약 (AGENTS.md §G-2).
// ---------------------------------------------------------------------------

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

// 모니터링 모드 ON/OFF 저장 (M13 gate)
export async function setIntradayMode(
  enabled: boolean,
): Promise<
  | { success: true; data: { intradayMode: boolean } }
  | { success: false; error: string }
> {
  if (typeof enabled !== "boolean") {
    return { success: false, error: "invalid_intraday_mode" };
  }

  if (!(await resolveAdminId())) {
    return { success: false, error: "auth_unavailable" };
  }
  return { success: false, error: REAL_PERSISTENCE_ERROR };
}

// M14 종목 토글 저장 (upsert)
export async function setTickerAlertEnabled(
  ticker: string,
  enabled: boolean,
): Promise<
  | { success: true; data: { ticker: string; enabled: boolean } }
  | { success: false; error: string }
> {
  if (typeof enabled !== "boolean") {
    return { success: false, error: "invalid_ticker_alert_enabled" };
  }
  if (typeof ticker !== "string") {
    return { success: false, error: "invalid_ticker" };
  }

  if (!(await resolveAdminId())) {
    return { success: false, error: "auth_unavailable" };
  }
  const normalized = ticker.trim();
  if (!normalized) {
    return { success: false, error: "ticker_required" };
  }

  return { success: false, error: REAL_PERSISTENCE_ERROR };
}
