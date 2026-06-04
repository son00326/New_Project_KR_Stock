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
//
// STEP-2 (cost_log fail-open hardening): getMonthlyTotal 경로 분기.
//   - callerKind 'session' (default): admin JWT session client → get_cost_log_monthly_total_admin
//     RPC-first (server-side SUM + not is_admin() raise = fail-closed). RLS using(is_admin())의
//     non-admin silent-0 fail-open(undercount → hardcap 무력화) 차단.
//   - callerKind 'service-role': service_role client(cron/worker) → 직접 paginated SELECT 유지.
//     service_role은 RLS bypass라 전 row 가시(undercount 없음) + admin-only RPC의 admin_required
//     raise 회피. ★ worker 무회귀의 핵심 — service-role 경로는 RPC를 절대 호출하지 않는다.
export interface CostHelperOptions {
  client?: SupabaseClient;
  callerKind?: 'session' | 'service-role';
}

function isEnabled(): boolean {
  return process.env.AI_COST_LOG_REAL_INSERT_ENABLED === 'true';
}

// PR-B2 (B7/D-8, ADR 2026-05-31): admin real-AI 진입점 fail-closed guard용 공개 helper.
// flag off면 insertCostLog noop → getMonthlyTotal=0 → preflightHardcap fail-open(50만원 hardcap 무력화 = 무제한 burn).
// admin report paths(triggerFullReport / regenerateReport)는 실 AI spend 전 본 helper로 차단.
// Legacy triggerMonthlyPersonaEvalAction은 UI caller 0 + D-1 deprecate 예정이라 PR-B2 코드 가드 OOS.
export function isCostLoggingEnabled(): boolean {
  return isEnabled();
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

// STEP-2: pre-migration fallback 전용 sentinel (다른 error와 구분).
class MissingCostRpcError extends Error {
  constructor() {
    super('cost_log_rpc_missing');
    this.name = 'MissingCostRpcError';
  }
}

interface CostRpcError {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
}

// STEP-2: missing-function(pre-migration) fallback 판정 — 0030 apply 전 무회귀 전용.
//   PGRST202 = PostgREST schema-cache target RPC not found.
//   42883(undefined_function)는 광범위하므로 target RPC명이 error payload에 있을 때만 허용
//   (내부 dependency undefined_function → 직접 SELECT fallback = fail-open 재노출 차단).
//   ★ admin_required / auth_unavailable / permission(42501) / RLS / 기타 DB error는 fallback 금지
//     (fail-closed throw — undercount 우회 차단). omxy 합의.
function isMissingFunctionError(error: CostRpcError): boolean {
  if (error.code === 'PGRST202') return true;
  if (error.code !== '42883') return false;
  const payload = [error.message, error.details, error.hint].filter(Boolean).join('\n');
  return payload.includes('get_cost_log_monthly_total_admin');
}

// STEP-2: SESSION 경로 server-side SUM RPC (admin-only, 마이그 0030).
//   non-admin은 RPC가 admin_required raise → throw 전파(fail-closed). RLS silent-0 fail-open 차단.
//   transaction snapshot SUM = pagination undercount 제거(W-cost-log-pagination-snapshot).
async function getMonthlyTotalViaRpc(
  supabase: SupabaseClient,
  month: string,
): Promise<number> {
  const { data, error } = await supabase.rpc('get_cost_log_monthly_total_admin', {
    p_month: month,
  });
  if (error) {
    if (isMissingFunctionError(error)) {
      // pre-migration only — caller에게 fallback 신호 (직접 SELECT로 무회귀).
      throw new MissingCostRpcError();
    }
    // admin_required / permission / RLS / 기타 — fail-closed.
    throw new Error(`cost_log_select_failed:${error.code ?? 'unknown'}`);
  }
  const value = Number(data);
  if (!Number.isFinite(value)) {
    throw new Error(`cost_log_select_failed:non_finite_cost_krw`);
  }
  if (value < 0) {
    throw new Error(`cost_log_select_failed:negative_cost_krw`);
  }
  return value;
}

export async function getMonthlyTotal(
  month: string,
  options: CostHelperOptions = {},
): Promise<number> {
  const callerKind = options.callerKind ?? 'session';
  if (callerKind !== 'session' && callerKind !== 'service-role') {
    throw new Error('cost_log_caller_kind_invalid');
  }
  const supabase = options.client ?? (await createClient());
  // STEP-2 fork: session(default) = RPC-first(fail-closed) / service-role = 직접 SELECT(RLS bypass).
  if (callerKind === 'session') {
    try {
      return await getMonthlyTotalViaRpc(supabase, month);
    } catch (err) {
      if (!(err instanceof MissingCostRpcError)) {
        throw err; // admin_required / DB error / guard violation = fail-closed 전파.
      }
      // pre-migration(0030 미적용)만 직접 SELECT로 폴백 — 무회귀.
    }
  }
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

// W0 (65차 D28 ③) model-aware reservation: 역할별 (콜수 × 해당 모델 단가) 합산.
// 단일 모델(균일 단가)은 callCount/maxCostPerCallKrw legacy 경로, 다모델 mix는 lines[].
export interface ReservationLine {
  callCount: number;
  maxCostPerCallKrw: number;
}

export async function preflightHardcap(
  opts: {
    month: string;
    /**
     * 단일 라인 (기존 호환). Per-call reservation override (KRW). Defaults to
     * MAX_COST_PER_CALL_KRW (persona call calibration: 1500 input + 2000 output).
     * PR3b full-report writer는 FULL_REPORT_MAX_COST_PER_CALL_KRW을 명시 주입.
     */
    callCount?: number;
    maxCostPerCallKrw?: number;
    /** W0 D28 ③ — 역할별 (콜수 × 해당 모델 단가) 합산 reservation. */
    lines?: ReservationLine[];
  },
  options: CostHelperOptions = {},
): Promise<{ currentTotal: number; reservation: number; remaining: number }> {
  // fail-open 차단 (omxy R1 HIGH fix): lines/callCount 둘 다 부재, lines: [], 음수/비유한 값
  // 전부 reservation 0/오염으로 hardcap 무력화 가능 → 명시 throw.
  if (!opts.lines && opts.callCount == null) {
    throw new Error('preflight_reservation_missing');
  }
  if (opts.lines) {
    if (opts.lines.length === 0) throw new Error('preflight_reservation_missing');
    for (const l of opts.lines) {
      // 신규 lines 경로는 legacy 호환 부담 없음 (omxy R2): 0도 fail-open 벡터 → 양수 강제.
      if (
        !Number.isFinite(l.callCount) || l.callCount <= 0 ||
        !Number.isFinite(l.maxCostPerCallKrw) || l.maxCostPerCallKrw <= 0
      ) {
        throw new Error('preflight_reservation_invalid');
      }
    }
  } else if (
    // 단일(legacy) 경로: callCount=0 + default maxCost = 무해 no-op 호환 허용 (omxy R2 합의).
    // 단 callCount>0이면 명시된 maxCostPerCallKrw는 반드시 >0.
    !Number.isFinite(opts.callCount!) || opts.callCount! < 0 ||
    (opts.maxCostPerCallKrw != null &&
      (!Number.isFinite(opts.maxCostPerCallKrw) ||
        (opts.callCount! > 0 ? opts.maxCostPerCallKrw <= 0 : opts.maxCostPerCallKrw < 0)))
  ) {
    throw new Error('preflight_reservation_invalid');
  }
  const currentTotal = await getMonthlyTotal(opts.month, options);
  const reservation = opts.lines
    ? opts.lines.reduce((s, l) => s + l.callCount * l.maxCostPerCallKrw, 0)
    : (opts.callCount ?? 0) * (opts.maxCostPerCallKrw ?? MAX_COST_PER_CALL_KRW);
  if (currentTotal + reservation > HARDCAP_KRW) {
    throw new Error('cost_hardcap_exceeded'); // 구 cost_hardcap_40man — 65차 50만 + cap-agnostic rename
  }
  return {
    currentTotal,
    reservation,
    remaining: HARDCAP_KRW - currentTotal - reservation,
  };
}
