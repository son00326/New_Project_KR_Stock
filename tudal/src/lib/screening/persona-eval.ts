import { callPersona, type CallPersonaResult } from '@/lib/ai/anthropic-client';
import { CORE_11_PERSONAS } from '@/lib/ai/prompts/personas';
import { acquireBatchLock, releaseBatchLock } from '@/lib/data/admin-batch-runs';
import { preflightHardcap } from '@/lib/cost/cost-logger';
import {
  type CanonicalSector,
  SECTOR_PERSONA_COUNT,
  resolveSlotTemplate,
} from '@/lib/screening/canonical-sectors';
// TIER2_CALLS_PER_TICKER (25 = Core 11 + Sector 14) cost guard 상수는 canonical-sectors.ts에서 export.
// chair = Core 11 마지막 위원 (별도 추가 X — 본 PR scope 박제, OOS lift는 별도 PR).

export interface RunMonthlyPersonaEvalInput {
  month: string;
  tickers: string[];
  adminUserId: string;
  fetchFinancials: (ticker: string) => Promise<string>;
}

export interface PersonaEvalResult {
  byTicker: Record<string, CallPersonaResult[]>; // persona-major collected
  tier1AvailableByTicker: Record<string, boolean>;
  totalCalls: number;
}

export async function runMonthlyPersonaEval(
  input: RunMonthlyPersonaEvalInput
): Promise<PersonaEvalResult> {
  await acquireBatchLock(input.month);

  let callCountDone = 0;
  const byTicker: Record<string, CallPersonaResult[]> = {};
  const tier1Available: Record<string, boolean> = {};
  for (const t of input.tickers) {
    byTicker[t] = [];
    tier1Available[t] = true;
  }

  try {
    // preflight: 30 ticker × 11 persona = 330 reservations
    await preflightHardcap({
      month: input.month,
      callCount: input.tickers.length * CORE_11_PERSONAS.length,
    });

    // persona-major loop (11 outer sequential)
    for (const persona of CORE_11_PERSONAS) {
      const [warmTicker, ...rest] = input.tickers;
      if (!warmTicker) continue;

      const financials = await input.fetchFinancials(warmTicker);
      try {
        const warmResult = await callPersona({
          personaId: persona.id,
          ticker: warmTicker,
          financials,
          reflectionContext: '', // 첫달은 빈 문자열
          adminUserId: input.adminUserId,
        });
        byTicker[warmTicker].push(warmResult);
        callCountDone++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown';
        if (msg === 'ai_key_unavailable' || msg === 'ai_call_failed' || msg === 'ai_billing_exhausted') {
          tier1Available[warmTicker] = false;
        } else {
          throw err; // fatal
        }
      }

      // fan-out 29 tickers — Plan R2 BLOCKER 2: ticker 보존
      type FanoutItem =
        | { ticker: string; ok: true; result: CallPersonaResult }
        | { ticker: string; ok: false; error: unknown };
      const fanoutResults: FanoutItem[] = await Promise.all(
        rest.map(async (ticker): Promise<FanoutItem> => {
          try {
            const f = await input.fetchFinancials(ticker);
            const result = await callPersona({
              personaId: persona.id,
              ticker,
              financials: f,
              reflectionContext: '',
              adminUserId: input.adminUserId,
            });
            return { ticker, ok: true, result };
          } catch (err) {
            return { ticker, ok: false, error: err };
          }
        })
      );

      for (const item of fanoutResults) {
        if (item.ok) {
          byTicker[item.ticker].push(item.result);
          callCountDone++;
        } else {
          const msg = item.error instanceof Error ? item.error.message : 'unknown';
          if (['ai_key_unavailable', 'ai_call_failed', 'ai_billing_exhausted'].includes(msg)) {
            tier1Available[item.ticker] = false; // ⚪ 대상 명시 (BLOCKER 2 해소)
          } else {
            throw item.error;
          }
        }
      }
    }

    await releaseBatchLock({
      month: input.month,
      status: 'succeeded',
      callCountDone,
    });

    return {
      byTicker,
      tier1AvailableByTicker: tier1Available,
      totalCalls: callCountDone,
    };
  } catch (err) {
    const errorCode = err instanceof Error ? err.message : 'unknown';
    await releaseBatchLock({
      month: input.month,
      status: 'failed',
      callCountDone,
      errorCode,
    });
    throw err;
  }
}

// Tier 2 implementation (52차 D21) — Sector Board 14 personas per-ticker orchestration.
// SoT = ServicePlan-Admin §1A.5 D21 + ReportFramework §7.2/§7.3 v2.5 + 마이그 0019.
// omxy R1~R3 CONVERGED + 4 acceptance details (R3 acc#4: degraded semantics — RPC 호출 자체 skip).
//
// 본 함수는 per-ticker callable scaffold. caller wiring (cron/admin action 통합)은 별도 PR (R1 #7 OOS).
// production sector persona prompts (@/lib/ai/prompts/personas SECTOR_*) 는 후속 PR에서 정의.
// 본 PR 시점에는 mock fixture로만 동작 (mock-admin-committee-personas.ts 14×14 stub).

export interface RunSectorEvalInput {
  month: string;
  ticker: string;
  sector: CanonicalSector;
  sub_tags?: readonly string[];
  adminUserId: string;
  fetchFinancials: (ticker: string) => Promise<string>;
}

export interface SectorEvalResult {
  ticker: string;
  sector: CanonicalSector;
  personaIds: string[];                    // length SECTOR_PERSONA_COUNT (14), slot 1~14 순서
  results: CallPersonaResult[];            // 성공 call results (length 0~14)
  available: boolean;                      // ALL 14 성공 시만 true (R2 B1 degraded semantic)
  degradedCount: number;                   // 실패 call count (0~14)
  totalCalls: number;                      // 성공 call count
}

/**
 * Sector Board 14 personas per-ticker eval.
 *
 * caller 책임 (omxy R2 B1 + R3 acc#4 박제):
 *   - 본 함수 호출 전 Core 11 (runMonthlyPersonaEval)이 ticker 성공 처리되어 있어야 함 (Core가 stock_reports row 생성)
 *   - available=false 시 commitSectorReport 호출 금지 (DB 오염 0)
 *   - tier2AvailableByTicker 영속 표시는 OOS — 본 함수 반환값만 사용
 *
 * sector persona ID 패턴: `sector-{sector}-slot-{slotIndex 1~14}`
 * production prompts (@/lib/ai/prompts/personas)에 sector 196 stub 정의 미존재 시 callPersona가
 * `unknown_persona_id:...` throw → 본 함수가 degradedCount++로 처리.
 */
export async function runSectorEval(input: RunSectorEvalInput): Promise<SectorEvalResult> {
  // R3 acc#3 cost guard: preflight 14 calls (TIER2_CALLS_PER_TICKER에서 Core 11 부분은 caller가 별도 계산)
  await preflightHardcap({
    month: input.month,
    callCount: SECTOR_PERSONA_COUNT,
  });

  const slotTemplate = resolveSlotTemplate(input.sector, input.sub_tags ?? []);
  // 53차+: slot 13/14에서 sub_tag 매칭된 경우만 personaId에 sub_tag encode (dynamic resolution).
  // Pattern (기존 52차 박제와 backwards-compat — slot 1~12 + slot 13/14 no-match 그대로):
  //   slot 1~12 + slot 13/14 (no sub_tag match): `sector-${sector}-slot-${idx}` (= backup)
  //   slot 13~14 (sub_tag matched): `sector-${sector}-slot-${idx}-subtag-${subTag}`
  const personaIds = slotTemplate.map((slot) => {
    const base = `sector-${input.sector}-slot-${slot.slot_index}`;
    if (slot.slot_type === "sub_tag_overlay" && slot.sub_tag !== undefined) {
      return `${base}-subtag-${slot.sub_tag}`;
    }
    return base;
  });

  const financials = await input.fetchFinancials(input.ticker);

  // Parallel 14 calls — R1 #1 cost spike 750/month 분산
  type FanoutItem =
    | { ok: true; result: CallPersonaResult }
    | { ok: false; error: unknown };

  const fanoutResults: FanoutItem[] = await Promise.all(
    personaIds.map(async (personaId): Promise<FanoutItem> => {
      try {
        const result = await callPersona({
          personaId,
          ticker: input.ticker,
          financials,
          reflectionContext: '',
          adminUserId: input.adminUserId,
        });
        return { ok: true, result };
      } catch (err) {
        return { ok: false, error: err };
      }
    }),
  );

  const results: CallPersonaResult[] = [];
  let degradedCount = 0;
  for (const item of fanoutResults) {
    if (item.ok) {
      results.push(item.result);
    } else {
      const msg = item.error instanceof Error ? item.error.message : 'unknown';
      // ai_key_unavailable / ai_call_failed / ai_billing_exhausted / unknown_persona_id (production prompts 부재)
      // 모두 degraded로 처리. fatal은 throw.
      if (
        msg === 'ai_key_unavailable' ||
        msg === 'ai_call_failed' ||
        msg === 'ai_billing_exhausted' ||
        msg.startsWith('unknown_persona_id:')
      ) {
        degradedCount++;
      } else {
        throw item.error; // fatal — non-network/non-prompt 오류는 caller에 전파
      }
    }
  }

  const available = degradedCount === 0 && results.length === SECTOR_PERSONA_COUNT;

  return {
    ticker: input.ticker,
    sector: input.sector,
    personaIds,
    results,
    available,
    degradedCount,
    totalCalls: results.length,
  };
}
