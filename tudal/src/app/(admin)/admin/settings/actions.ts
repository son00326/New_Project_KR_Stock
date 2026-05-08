"use server";

import {
  MOCK_ADMIN_ID,
  MOCK_ADMIN_SETTINGS,
  MOCK_ADMIN_TICKER_PREFS,
} from "@/lib/data/mock-admin-settings";
import { createClient } from "@/lib/supabase/server";
import type { TickerAlertPref } from "@/types/admin";

const REAL_PERSISTENCE_ERROR = "real_persistence_not_configured";

// ---------------------------------------------------------------------------
// /admin/settings Server Actions (S5b T5b.2)
// ref: ServicePlan-Admin §3.5 R3.5-2·§3.10 R3.10-8~9
//
// mock fixture 전용. S5 실데이터 전환 시 Supabase upsert로 교체.
// 모든 action은 { success, data|error } 규약 (AGENTS.md §G-2).
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
    return isProductionLike() ? null : MOCK_ADMIN_ID;
  } catch {
    return isProductionLike() ? null : MOCK_ADMIN_ID;
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
  if (isProductionLike()) {
    return { success: false, error: REAL_PERSISTENCE_ERROR };
  }

  try {
    // TODO(S5): await supabase.from("admin_settings").upsert({
    //   admin_id: adminId, intraday_mode: enabled, updated_at: new Date().toISOString()
    // });
    MOCK_ADMIN_SETTINGS.intradayMode = enabled;
    MOCK_ADMIN_SETTINGS.updatedAt = new Date().toISOString();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "unknown_error",
    };
  }

  return { success: true, data: { intradayMode: enabled } };
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

  const adminId = await resolveAdminId();
  if (!adminId) {
    return { success: false, error: "auth_unavailable" };
  }
  if (isProductionLike()) {
    return { success: false, error: REAL_PERSISTENCE_ERROR };
  }
  const normalized = ticker.trim();
  if (!normalized) {
    return { success: false, error: "ticker_required" };
  }

  try {
    // TODO(S5): await supabase.from("ticker_alert_pref").upsert({
    //   admin_id: adminId, ticker: normalized, enabled, updated_at: ...
    // }, { onConflict: "admin_id,ticker" });
    const existing = MOCK_ADMIN_TICKER_PREFS.find(
      (p) => p.adminId === adminId && p.ticker === normalized,
    );
    if (existing) {
      existing.enabled = enabled;
      existing.updatedAt = new Date().toISOString();
    } else {
      const row: TickerAlertPref = {
        id: `tp-${Date.now()}`,
        adminId,
        ticker: normalized,
        enabled,
        updatedAt: new Date().toISOString(),
      };
      MOCK_ADMIN_TICKER_PREFS.push(row);
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "unknown_error",
    };
  }

  return { success: true, data: { ticker: normalized, enabled } };
}
