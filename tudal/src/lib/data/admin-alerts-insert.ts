// alert_event INSERT helpers.
// - recordSchedulerFailAlert: DI-only (input.supabase) — scheduler_fail 전용, 변경 0 (PR1 B2+B8).
// - insertAlertEvents (60차 Step 2.7b.3): options.client? seam + createClient fallback — cron
//   통합 batch INSERT (현 발행 source: heartbeat_missing / news_critical).
//   ※ briefing_failed = 72차/D10 이메일/Resend 제거로 morning-briefing 미발행(enum·DB CHECK·alerts UI 라벨은 보존).
//   service-role.ts B17 boundary "허용 DI seam" 목록 정합 (plan §0 D7).
// B8 (omxy R2): 0010 schema alert_event 9 컬럼 (snake_case) 정합 매핑.
import {
  buildSchedulerFailAlert,
  type BatchRunOutcome,
} from '@/lib/scheduler/monthly-batch';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import type { AlertEvent, AlertType, Severity } from '@/types/admin';

export interface RecordSchedulerFailInput {
  supabase: SupabaseClient;
  outcome: BatchRunOutcome;
}

export async function recordSchedulerFailAlert(
  input: RecordSchedulerFailInput,
): Promise<void> {
  // buildSchedulerFailAlert는 Omit<AlertEvent, 'id'|'isRead'> camelCase 반환:
  //   { alertType, ticker, severity, triggerReason, signalSentAt, outcomeAt, t7PriceChange, decisionRecorded, decisionMemo }
  // 0010 schema는 snake_case → 매핑 박제.
  const payload = buildSchedulerFailAlert(input.outcome);
  const { error } = await input.supabase.from('alert_event').insert({
    alert_type: payload.alertType,
    ticker: payload.ticker,
    severity: payload.severity,
    trigger_reason: payload.triggerReason,
    signal_sent_at: payload.signalSentAt,
    outcome_at: payload.outcomeAt,
    t7_price_change: payload.t7PriceChange,
    decision_recorded: payload.decisionRecorded,
    decision_memo: payload.decisionMemo,
  });
  if (error) {
    throw new Error(
      `scheduler_fail_alert_insert_failed:${error.code ?? 'unknown'}`,
    );
  }
}

// 60차 Mock cleanup Step 2.7b.3: 3-source cron alert_event 통합 INSERT helper.
// silent-health (heartbeat_missing) + news-sweep (news_critical) + morning-briefing (briefing_failed).
// append-only audit (alert_event UNIQUE 없음 — plan §0 D1). dedup은 W-alert-event-dedup defer.
// service-role client 주입 시 RLS using(is_admin()) 우회.

// 0010 alert_event_alert_type_check 12종 1:1 (plan §0 D3 + omxy R1 MED-4 export + exact invariant).
export const ALERT_TYPE_SET: ReadonlySet<AlertType> = new Set<AlertType>([
  'exit_signal',
  'news_critical',
  'news_warning',
  'price_anomaly',
  'intraday_anomaly',
  'briefing',
  'briefing_failed',
  'scheduler_fail',
  'gating_auto_relief',
  'cost_warning',
  'cost_hardcap',
  'heartbeat_missing',
]);

// 0010 alert_event severity CHECK (critical/warning/info) 1:1 (omxy R1 MED-5).
const SEVERITY_SET: ReadonlySet<Severity> = new Set<Severity>([
  'critical',
  'warning',
  'info',
]);

export async function insertAlertEvents(
  events: Array<Omit<AlertEvent, 'id' | 'isRead'>>,
  options: { client?: SupabaseClient } = {},
): Promise<void> {
  if (events.length === 0) return;
  for (const e of events) {
    if (!ALERT_TYPE_SET.has(e.alertType)) {
      throw new Error(`alert_event_invalid_type:${e.alertType}`);
    }
    if (!SEVERITY_SET.has(e.severity)) {
      throw new Error(`alert_event_invalid_severity:${e.severity}`);
    }
  }
  const supabase = options.client ?? (await createClient());
  const rows = events.map((e) => ({
    alert_type: e.alertType,
    ticker: e.ticker,
    severity: e.severity,
    trigger_reason: e.triggerReason,
    signal_sent_at: e.signalSentAt,
    outcome_at: e.outcomeAt,
    t7_price_change: e.t7PriceChange,
    decision_recorded: e.decisionRecorded,
    decision_memo: e.decisionMemo,
  }));
  const { error } = await supabase.from('alert_event').insert(rows);
  if (error) {
    throw new Error(`alert_event_insert_failed:${error.code ?? 'unknown'}`);
  }
}
