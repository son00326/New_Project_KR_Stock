// tudal/src/lib/cost/cost-logger.ts
import { createClient } from '@/lib/supabase/server';
import { HARDCAP_KRW, MAX_COST_PER_CALL_KRW } from './pricing';

export interface CostLogRow {
  month: string;
  ticker: string;
  persona_id: string;
  prompt_version: string;
  model: string;
  input_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  output_tokens: number;
  cost_krw: number;
  prompt_cache_enabled: boolean;
  called_by: string;
}

function isEnabled(): boolean {
  return process.env.AI_COST_LOG_REAL_INSERT_ENABLED === 'true';
}

export async function insertCostLog(row: CostLogRow): Promise<void> {
  if (!isEnabled()) return; // noop

  const supabase = await createClient();
  const { error } = await supabase.from('cost_log').insert(row);
  if (error) {
    throw new Error(`cost_log_insert_failed:${error.code ?? 'unknown'}`);
  }
}

export async function getMonthlyTotal(month: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('cost_log')
    .select('cost_krw')
    .eq('month', month);

  if (error) {
    throw new Error(`cost_log_select_failed:${error.code ?? 'unknown'}`);
  }
  return (data ?? []).reduce((sum, row) => sum + Number(row.cost_krw), 0);
}

export async function preflightHardcap(opts: {
  month: string;
  callCount: number;
  /**
   * Per-call reservation override (KRW). Defaults to MAX_COST_PER_CALL_KRW
   * (persona call calibration: 1500 input + 2000 output). PR3b full-report
   * writer는 FULL_REPORT_MAX_COST_PER_CALL_KRW (3000 input + 6000 output)을
   * 명시적으로 주입 — 3-track C1 fix.
   */
  maxCostPerCallKrw?: number;
}): Promise<{ currentTotal: number; reservation: number; remaining: number }> {
  const currentTotal = await getMonthlyTotal(opts.month);
  const perCallKrw = opts.maxCostPerCallKrw ?? MAX_COST_PER_CALL_KRW;
  const reservation = opts.callCount * perCallKrw;
  if (currentTotal + reservation > HARDCAP_KRW) {
    throw new Error('cost_hardcap_40man');
  }
  return {
    currentTotal,
    reservation,
    remaining: HARDCAP_KRW - currentTotal - reservation,
  };
}
