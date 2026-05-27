// tudal/src/lib/cost/cost-logger.ts
import type { SupabaseClient } from '@supabase/supabase-js';
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

// PR4 Task 1 Step 1.1 (B2 fix omxy R1): caller DI seam — 모든 cost helper에 options 2nd arg.
// Reference 패턴: tudal/src/lib/data/admin-shortlist-persist.ts:39-43.
export interface CostHelperOptions {
  client?: SupabaseClient;
}

function isEnabled(): boolean {
  return process.env.AI_COST_LOG_REAL_INSERT_ENABLED === 'true';
}

export async function insertCostLog(
  row: CostLogRow,
  options: CostHelperOptions = {},
): Promise<void> {
  if (!isEnabled()) return; // noop

  const supabase = options.client ?? (await createClient());
  const { error } = await supabase.from('cost_log').insert(row);
  if (error) {
    throw new Error(`cost_log_insert_failed:${error.code ?? 'unknown'}`);
  }
}

// 58차 Mock cleanup Step 2.3 omxy R1 HIGH-1 + R2 HIGH-1 fix — pagination loop.
// Supabase 프로젝트에서 PostgREST aggregate (`cost_krw.sum()`)은 disabled
// (PGRST123 "Use of aggregate functions is not allowed" — live verified 2026-05-28).
// 기존 single-page `.select('cost_krw')`은 Supabase row limit (default 1000)에 의해
// truncate되어 monthly cost > 1000 rows 시 undercount → hardcap fail-open risk
// (Step 2.3가 regenerate hardcap을 production gate로 격상하면서 신규 도입).
// pagination loop는 row limit 무관 — page 마지막 (size < PAGE_SIZE) 도달까지 누적.
// non-finite guard (R2 MEDIUM-2)는 PostgREST shape drift / cost_krw 비정상 값에서
// NaN >= HARDCAP_KRW = false (silent fail-open) 차단.
const COST_LOG_PAGE_SIZE = 1000;

export async function getMonthlyTotal(
  month: string,
  options: CostHelperOptions = {},
): Promise<number> {
  const supabase = options.client ?? (await createClient());
  let total = 0;
  let offset = 0;
  // 무한 loop 차단: PAGE_SIZE 미만 page 도달 시 break.
  // worst case (cost_log 10k rows/month) = 10 round trips → 운영 빈도 (수동 재생성 ≤ 2/month/ticker)
  // 대비 비용 미미. 일반 (수백 rows) = 1 trip.
  for (;;) {
    const { data, error } = await supabase
      .from('cost_log')
      .select('cost_krw')
      .eq('month', month)
      // R3 HIGH-1 + R4 MEDIUM fix — concurrent-safe deterministic order.
      // Primary: `called_at` ASC (NOT NULL DEFAULT now() — monotonic). 새 INSERT는 항상
      // 기존 행 뒤에 정렬되어 offset pagination의 page boundary 이동/duplicate 차단.
      // Secondary: `id` ASC (uuid PK, tiebreak — 동일 called_at 마이크로초 충돌 시 안정).
      // cost_log은 INSERT-only (UPDATE/DELETE 코드 부재) → monotonic ordering 정합.
      // R3 fix(`.order('id')` 단일)는 random UUID라 concurrent INSERT가 기존 행 앞으로
      // 정렬되어 row duplicate risk 있었음 (R4 catch).
      .order('called_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + COST_LOG_PAGE_SIZE - 1);

    if (error) {
      throw new Error(`cost_log_select_failed:${error.code ?? 'unknown'}`);
    }
    if (!data || data.length === 0) break;

    for (const row of data) {
      const value = Number(row.cost_krw);
      if (!Number.isFinite(value)) {
        // R2 MEDIUM-2 fix — shape drift / locale string / NaN coerce 차단.
        throw new Error(`cost_log_select_failed:non_finite_cost_krw`);
      }
      if (value < 0) {
        // R3 MEDIUM-1 fix — 0017 schema에 `cost_krw >= 0` CHECK 부재 → bad row가 monthly
        // total을 낮춰 hardcap 우회시킬 financial integrity risk. app-level fail-closed
        // guard로 차단 (schema CHECK 추가는 별도 migration 트랙).
        throw new Error(`cost_log_select_failed:negative_cost_krw`);
      }
      total += value;
    }
    if (data.length < COST_LOG_PAGE_SIZE) break;
    offset += COST_LOG_PAGE_SIZE;
  }
  return total;
}

export async function preflightHardcap(
  opts: {
    month: string;
    callCount: number;
    /**
     * Per-call reservation override (KRW). Defaults to MAX_COST_PER_CALL_KRW
     * (persona call calibration: 1500 input + 2000 output). PR3b full-report
     * writer는 FULL_REPORT_MAX_COST_PER_CALL_KRW (3000 input + 6000 output)을
     * 명시적으로 주입 — 3-track C1 fix.
     */
    maxCostPerCallKrw?: number;
  },
  options: CostHelperOptions = {},
): Promise<{ currentTotal: number; reservation: number; remaining: number }> {
  const currentTotal = await getMonthlyTotal(opts.month, options);
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
