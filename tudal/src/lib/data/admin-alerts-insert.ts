// PR1 B2+B8 fix (omxy R1+R2) — scheduler_fail alert helper.
// DI 패턴 (supabase: SupabaseClient를 인자로 받음) — service-role import 금지.
// B8 (omxy R2): 0010 schema alert_event 9 컬럼 (snake_case) 정합 매핑.
import {
  buildSchedulerFailAlert,
  type BatchRunOutcome,
} from '@/lib/scheduler/monthly-batch';
import type { SupabaseClient } from '@supabase/supabase-js';

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
