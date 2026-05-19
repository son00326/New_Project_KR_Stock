import { callPersona, type CallPersonaResult } from '@/lib/ai/anthropic-client';
import { CORE_11_PERSONAS } from '@/lib/ai/prompts/personas';
import { acquireBatchLock, releaseBatchLock } from '@/lib/data/admin-batch-runs';
import { preflightHardcap } from '@/lib/cost/cost-logger';

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
