// admin-settings.ts — admin_settings 테이블 SELECT helper (58차 Mock cleanup Step 2.2)
//
// MOCK_ADMIN_SETTINGS는 `/admin/settings` (READ) + `/admin/settings/actions.ts`의
// setIntradayMode (WRITE)에서 어드민에게 "현재 모니터링 모드"라고 거짓 표시·변이하던 fixture.
// 본 helper는 admin 본인 1 row SELECT 경로 (RLS "admin_settings self" 자동 의존).
//
// 0 rows = 어드민이 아직 모드를 토글한 적 없음 → caller에서 default (intradayMode=false) 적용.
//
// WRITE 경로 (setIntradayMode)는 Step 2.1 recordExitDecision + Step 1.3 lesson
// "가짜 성공 응답 금지" 정합으로 모든 환경 `real_persistence_not_configured` boundary —
// S5b real persistence RPC (upsert_admin_settings_self) 연결 시 교체.
//
// SoT: 0007_s5b_notifications.sql §1 admin_settings + RLS "admin_settings self"
//      (admin_id PK + intraday_mode boolean default false + RLS = admin_id=auth.uid() AND is_admin()).

import { createClient } from "@/lib/supabase/server";
import type { AdminSettings } from "@/types/admin";

export interface AdminSettingsDbRow {
  admin_id: string;
  intraday_mode: boolean;
  updated_at: string;
}

/**
 * snake_case admin_settings row → camelCase AdminSettings.
 *
 * - intraday_mode는 boolean 강제 (DB schema not null + default false).
 * - admin_id, updated_at은 string passthrough.
 */
export function transformAdminSettingsRow(row: AdminSettingsDbRow): AdminSettings {
  if (typeof row.intraday_mode !== "boolean") {
    throw new Error(`admin_settings_invalid_intraday_mode:${row.intraday_mode}`);
  }
  return {
    adminId: row.admin_id,
    intradayMode: row.intraday_mode,
    updatedAt: row.updated_at,
  };
}

/**
 * 현재 인증된 어드민의 admin_settings 1 row SELECT.
 *
 * - RLS "admin_settings self" 자동 의존 (admin_id = auth.uid() AND is_admin()).
 *   인증 안 됨 OR is_admin=false 시 0 rows.
 * - 0 rows (PGRST116 no rows returned) = 어드민이 모드 토글한 적 없음 → null 반환.
 *   caller에서 default (intradayMode=false) 적용.
 * - 그 외 DB 오류는 throw — caller가 catch + format-error 매핑.
 */
export async function getCurrentAdminSettings(): Promise<AdminSettings | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admin_settings")
    .select("admin_id, intraday_mode, updated_at")
    .maybeSingle();

  if (error) {
    throw new Error(`admin_settings_select_failed:${error.message}`);
  }
  if (!data) return null;
  return transformAdminSettingsRow(data as AdminSettingsDbRow);
}
