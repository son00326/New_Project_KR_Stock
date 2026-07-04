// admin-ticker-prefs.ts — ticker_alert_pref 테이블 SELECT helper (58차 Mock cleanup Step 2.2)
//
// MOCK_ADMIN_TICKER_PREFS는 `/admin/settings` (READ initialTickerMap) + actions.ts
// `setTickerAlertEnabled` (WRITE upsert)에서 어드민에게 "현재 종목 토글 상태"라고
// 거짓 표시·변이하던 fixture. 본 helper는 admin 본인 row들의 SELECT 경로
// (RLS "ticker_alert_pref self" 자동 의존).
//
// 0 rows = 어드민이 아직 종목 토글을 설정한 적 없음 → caller에서 default (enabled=true) 적용.
//   (마이그 0007 §2 주석: "Short List 30 상의 종목만 row 생성(없으면 default enabled=true로 간주)")
//
// WRITE 경로 (setTickerAlertEnabled)는 Step 2.1 recordExitDecision + Step 1.3 lesson
// "가짜 성공 응답 금지" 정합으로 모든 환경 `real_persistence_not_configured` boundary —
// S5b real persistence RPC (upsert_ticker_alert_pref_self) 연결 시 교체.
//
// SoT: 0007_s5b_notifications.sql §2 ticker_alert_pref + RLS "ticker_alert_pref self"
//      + unique index (admin_id, ticker) + admin_idx (admin_id).

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { TickerAlertPref } from "@/types/admin";

export interface TickerAlertPrefDbRow {
  id: string;
  admin_id: string;
  ticker: string;
  enabled: boolean;
  updated_at: string;
}

const TICKER_RE = /^\d{6}$/;
const PREFS_LIMIT = 200; // append 보호 — Short List 30 + 여유분 30 + 과거 누적까지 충분

/**
 * snake_case ticker_alert_pref row → camelCase TickerAlertPref.
 *
 * - ticker는 6-digit Korean 종목코드 검증.
 * - enabled boolean 강제.
 * - id, admin_id, updated_at은 string passthrough.
 */
export function transformTickerAlertPrefRow(
  row: TickerAlertPrefDbRow,
): TickerAlertPref {
  if (typeof row.enabled !== "boolean") {
    throw new Error(`ticker_alert_pref_invalid_enabled:${row.enabled}`);
  }
  if (typeof row.ticker !== "string" || !TICKER_RE.test(row.ticker)) {
    throw new Error(`ticker_alert_pref_invalid_ticker:${row.ticker}`);
  }
  return {
    id: row.id,
    adminId: row.admin_id,
    ticker: row.ticker,
    enabled: row.enabled,
    updatedAt: row.updated_at,
  };
}

/**
 * 현재 인증된 어드민의 ticker_alert_pref 전체 row SELECT.
 *
 * - RLS "ticker_alert_pref self" 자동 의존 (admin_id = auth.uid() AND is_admin()).
 * - updated_at desc 정렬, limit 200 (append 누적 보호).
 * - 0 rows = []. caller에서 ticker별 default (enabled=true) 처리.
 */
export async function getCurrentTickerAlertPrefs(): Promise<TickerAlertPref[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ticker_alert_pref")
    .select("id, admin_id, ticker, enabled, updated_at")
    .order("updated_at", { ascending: false })
    .limit(PREFS_LIMIT);

  if (error) {
    throw new Error(`ticker_alert_pref_select_failed:${error.message}`);
  }
  if (!data) return [];
  return (data as TickerAlertPrefDbRow[]).map(transformTickerAlertPrefRow);
}

// 어드민 3명 × PREFS_LIMIT 200 여유분 — 전 어드민 row 커버.
// cap 무음절단 금지: limit 도달 시 아래에서 구조화 warn (OFF pref 절단 → default-ON 오승격 위험).
const ALL_PREFS_LIMIT = 600;

/**
 * 전 어드민의 ticker_alert_pref row SELECT — S7c intraday 워커 전용 seam (2026-07-04).
 *
 * - `{client}` 필수 주입: service-role client여야 RLS "ticker_alert_pref self"를 우회해
 *   모든 어드민 row를 읽는다 (session client 주입 시 self rows만 — caller 책임).
 * - 집계 규칙(어느 한 어드민이라도 ON이거나 row 없음 = enabled)은 순수 함수
 *   `aggregateTickerPrefs`(lib/intraday/worker-context.ts)가 담당 — 본 함수는 SELECT만.
 */
export async function getAllTickerAlertPrefs(options: {
  client: SupabaseClient;
}): Promise<TickerAlertPref[]> {
  const { data, error } = await options.client
    .from("ticker_alert_pref")
    .select("id, admin_id, ticker, enabled, updated_at")
    .order("updated_at", { ascending: false })
    .limit(ALL_PREFS_LIMIT);

  if (error) {
    throw new Error(`ticker_alert_pref_select_failed:${error.message}`);
  }
  if (!data) return [];
  if (data.length >= ALL_PREFS_LIMIT) {
    console.warn(
      JSON.stringify({
        event: "ticker_alert_prefs_truncated",
        limit: ALL_PREFS_LIMIT,
        hint: "OFF pref 절단 시 default-ON 오승격 위험 — ALL_PREFS_LIMIT 상향 필요",
      }),
    );
  }
  return (data as TickerAlertPrefDbRow[]).map(transformTickerAlertPrefRow);
}
