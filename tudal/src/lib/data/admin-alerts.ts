// admin-alerts.ts — alert_event 테이블 SELECT helper (58차 Mock cleanup Step 2.1)
//
// MOCK_ADMIN_ALERTS는 `/admin/alerts`, `/admin/alerts/[id]`, exit-decision actions에서
// 어드민에게 "현재 발생한 알림"이라고 거짓 표시하던 fixture. 실 운영에서는 cron
// (silent-health, news-sweep, monthly-batch) + S5b exit/intraday detector + briefing
// pipeline이 alert_event 테이블에 INSERT한다. 본 helper는 그 row들의 SELECT 경로.
//
// 0 rows = empty state (현재 production alert_event row 부재 → "알림 없음" 렌더).
//
// SoT: 0001_rls_sketch.sql §6 alert_event + 0010_alert_event_rls_hardening.sql
//      (12 alert_type enum + signal_sent_at desc index + admin SELECT RLS).

import { createClient } from "@/lib/supabase/server";
import type { AlertEvent, AlertType, ExitDecision, Severity } from "@/types/admin";

export interface AlertEventDbRow {
  id: string;
  alert_type: string;
  ticker: string | null;
  severity: string;
  trigger_reason: string;
  signal_sent_at: string;
  outcome_at: string | null;
  t7_price_change: number | string | null;
  decision_recorded: string | null;
  decision_memo: string | null;
  is_read: boolean;
}

const ALERT_TYPE_SET: ReadonlySet<AlertType> = new Set<AlertType>([
  "exit_signal",
  "news_critical",
  "news_warning",
  "price_anomaly",
  "intraday_anomaly",
  "briefing",
  "briefing_failed",
  "scheduler_fail",
  "gating_auto_relief",
  "cost_warning",
  "cost_hardcap",
  "heartbeat_missing",
]);

const SEVERITY_SET: ReadonlySet<Severity> = new Set<Severity>([
  "critical",
  "warning",
  "info",
]);

const DECISION_SET: ReadonlySet<ExitDecision> = new Set<ExitDecision>([
  "sell_all",
  "partial_sell",
  "hold",
]);

/**
 * snake_case alert_event row → camelCase AlertEvent.
 *
 * - alert_type / severity / decision_recorded enum 검증 (DB check constraint 정합).
 *   알 수 없는 값이면 throw — caller가 catch + alert_lookup_failed 매핑.
 * - t7_price_change는 numeric → number 변환 (Supabase numeric은 string으로도 옴).
 * - is_read는 boolean 강제 (defensive — DB default false).
 */
export function transformAlertEventRow(row: AlertEventDbRow): AlertEvent {
  if (!ALERT_TYPE_SET.has(row.alert_type as AlertType)) {
    throw new Error(`alert_event_invalid_alert_type:${row.alert_type}`);
  }
  if (!SEVERITY_SET.has(row.severity as Severity)) {
    throw new Error(`alert_event_invalid_severity:${row.severity}`);
  }
  let decisionRecorded: ExitDecision | null = null;
  if (row.decision_recorded !== null) {
    if (!DECISION_SET.has(row.decision_recorded as ExitDecision)) {
      throw new Error(
        `alert_event_invalid_decision:${row.decision_recorded}`,
      );
    }
    decisionRecorded = row.decision_recorded as ExitDecision;
  }
  let t7: number | null = null;
  if (row.t7_price_change !== null && row.t7_price_change !== undefined) {
    const n =
      typeof row.t7_price_change === "string"
        ? Number(row.t7_price_change)
        : row.t7_price_change;
    t7 = Number.isFinite(n) ? n : null;
  }
  return {
    id: row.id,
    alertType: row.alert_type as AlertType,
    ticker: row.ticker,
    severity: row.severity as Severity,
    triggerReason: row.trigger_reason,
    signalSentAt: row.signal_sent_at,
    outcomeAt: row.outcome_at,
    t7PriceChange: t7,
    decisionRecorded,
    decisionMemo: row.decision_memo,
    isRead: Boolean(row.is_read),
  };
}

const ALERT_SELECT_COLUMNS =
  "id, alert_type, ticker, severity, trigger_reason, signal_sent_at, outcome_at, t7_price_change, decision_recorded, decision_memo, is_read";

/**
 * 최근 alert_event 목록 반환 (signal_sent_at desc).
 *
 * - 0 rows → empty array (UI에서 "알림 없음" 렌더).
 * - SELECT 실패 → throw (caller catch + 한국어 매핑).
 */
export async function getRecentAlertEvents(
  options: { limit?: number } = {},
): Promise<AlertEvent[]> {
  const supabase = await createClient();
  let query = supabase
    .from("alert_event")
    .select(ALERT_SELECT_COLUMNS)
    .order("signal_sent_at", { ascending: false });
  if (typeof options.limit === "number" && options.limit > 0) {
    query = query.limit(options.limit);
  }
  const { data, error } = await query;
  if (error) {
    throw new Error(`alert_event_select_failed:${error.code ?? "unknown"}`);
  }
  return (data ?? []).map((r) => transformAlertEventRow(r as AlertEventDbRow));
}

/**
 * 단일 alert_event row 조회. 부재 시 null (UI notFound 처리).
 *
 * - PGRST116 (no rows) → null
 * - 다른 error → throw
 */
export async function getAlertEventById(id: string): Promise<AlertEvent | null> {
  if (!id) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("alert_event")
    .select(ALERT_SELECT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw new Error(`alert_event_lookup_failed:${error.code ?? "unknown"}`);
  }
  if (!data) return null;
  return transformAlertEventRow(data as AlertEventDbRow);
}
