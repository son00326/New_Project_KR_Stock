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
      // R3 HIGH-1 + R4 MEDIUM + R5 MEDIUM partial fix — deterministic ordering snapshot.
      // Primary: `called_at` ASC. Secondary: `id` ASC (tiebreak — 동일 called_at 마이크로초
      // 충돌 시 안정).
      //
      // ⚠️ HONESTY (R5 MEDIUM 박제 — 과증명 차단):
      //   "concurrent insert safety / row-limit 무관 total invariant"는 본 fix가 100% 보장
      //   못함. called_at DEFAULT now()는 application-level monotonic 가정에만 의존:
      //   - insertCostLog의 CostLogRow interface에 `called_at` 필드 부재 → TS callers는
      //     called_at을 명시 못함 → DB default(now())로 가는 path만 보장.
      //   - 그러나 schema에 `CHECK (called_at >= ...)` 부재 → direct SQL / future code /
      //     manual admin INSERT가 backdated called_at으로 우회 가능.
      //   - PostgreSQL now()도 transaction start time이라 parallel insert / NTP step /
      //     동일 microsecond에 정확한 commit-order sequence는 아님.
      //   잔여 risk = 월 1000+ rows 시 backdated/parallel INSERT가 기존 page boundary 앞에
      //   들어올 경우 page 간 row skip/duplicate (hardcap undercount fail-open).
      //
      //   현재 production reality (cost_log=0 + 월 ~150 rows 추정 + 어드민 3인 manual click
      //   동시성 거의 0)에서는 실현 가능성 매우 낮음. 완전 차단 = SECURITY DEFINER RPC
      //   (server-side SUM, transaction snapshot 안 + is_admin guard 안) 또는 schema
      //   CHECK 마이그레이션. defer = HANDOFF §9.5 W-cost-log-pagination-snapshot.
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
