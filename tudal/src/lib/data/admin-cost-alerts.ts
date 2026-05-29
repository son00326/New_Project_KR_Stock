// PR5 — cost alert emitter (cost_warning / cost_hardcap).
// plan §3.5 / §4.2 C4. alert_event enum CLOSED 12종 — cost_warning/cost_hardcap만 사용 (enum 밖 신규 type 금지, R1 MEDIUM-2/§3.5).
// insertAlertEvents(admin-alerts-insert.ts:73) DI 패턴 재사용. cron service-role client 주입.
import type { SupabaseClient } from '@supabase/supabase-js';
import { insertAlertEvents } from './admin-alerts-insert';
import { COST_WARNING_THRESHOLD_KRW, HARDCAP_KRW } from '@/lib/cost/pricing';

export interface CostAlertContext {
  month: string;
  currentTotalKrw: number;
  projectedKrw: number; // 이번 batch 예상 추가 비용
}

/**
 * cost 임계 도달 시 alert_event INSERT.
 *   - hardcap(critical): currentTotal + projected > HARDCAP_KRW
 *   - warning(warning):  currentTotal + projected >= COST_WARNING_THRESHOLD_KRW (hardcap 미만)
 *   - 임계 미만이면 0건.
 */
export async function emitCostAlert(
  ctx: CostAlertContext,
  options: { client?: SupabaseClient } = {},
): Promise<void> {
  const total = ctx.currentTotalKrw + ctx.projectedKrw;
  const nowIso = new Date().toISOString();

  let alertType: 'cost_hardcap' | 'cost_warning' | null = null;
  let severity: 'critical' | 'warning' | null = null;
  if (total > HARDCAP_KRW) {
    alertType = 'cost_hardcap';
    severity = 'critical';
  } else if (total >= COST_WARNING_THRESHOLD_KRW) {
    alertType = 'cost_warning';
    severity = 'warning';
  }
  if (alertType === null || severity === null) return;

  await insertAlertEvents(
    [
      {
        alertType,
        ticker: null,
        severity,
        triggerReason: `cron monthly-batch ${ctx.month}: 현재 ₩${Math.round(
          ctx.currentTotalKrw,
        )} + 예상 ₩${Math.round(ctx.projectedKrw)} = ₩${Math.round(total)} (hardcap ₩${HARDCAP_KRW})`,
        signalSentAt: nowIso,
        outcomeAt: null,
        t7PriceChange: null,
        decisionRecorded: null,
        decisionMemo: null,
      },
    ],
    options,
  );
}
