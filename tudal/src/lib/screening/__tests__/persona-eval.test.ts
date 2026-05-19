import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runMonthlyPersonaEval } from '../persona-eval';

vi.mock('@/lib/ai/anthropic-client', () => ({
  callPersona: vi.fn(),
}));
vi.mock('@/lib/data/admin-batch-runs', () => ({
  acquireBatchLock: vi.fn(),
  releaseBatchLock: vi.fn(),
}));
vi.mock('@/lib/cost/cost-logger', () => ({
  preflightHardcap: vi.fn(),
}));

import { callPersona } from '@/lib/ai/anthropic-client';
import { acquireBatchLock, releaseBatchLock } from '@/lib/data/admin-batch-runs';
import { preflightHardcap } from '@/lib/cost/cost-logger';

describe('persona-eval (Q6 + Design R4)', () => {
  const tickers = Array.from({ length: 30 }, (_, i) => String(i).padStart(6, '0'));
  const baseInput = {
    month: '2026-05',
    tickers,
    adminUserId: 'admin-uuid',
    fetchFinancials: vi.fn().mockResolvedValue('stub-financials'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (acquireBatchLock as any).mockResolvedValue({ acquired: true });
    (releaseBatchLock as any).mockResolvedValue(undefined);
    (preflightHardcap as any).mockResolvedValue({ currentTotal: 0, reservation: 0, remaining: 400000 });
    (callPersona as any).mockResolvedValue({
      content: '{"vote":"BUY","one_line":"강함","argument_excerpt":"근거"}',
      usage: { input_tokens: 100, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 50 },
      costKrw: 100,
      promptCacheEnabled: false,
    });
  });

  it('persona-major call order (11 outer × 30 inner)', async () => {
    await runMonthlyPersonaEval(baseInput);
    expect(callPersona).toHaveBeenCalledTimes(11 * 30);
    // 첫 30 호출 모두 같은 persona
    const calls = (callPersona as any).mock.calls;
    const firstBlockPersonas = calls.slice(0, 30).map((c: any[]) => c[0].personaId);
    expect(new Set(firstBlockPersonas).size).toBe(1);
  });

  it('warm-first: ticker[0] resolves before ticker[1..29] start (deferred mock)', async () => {
    let warmResolved = false;
    let fanoutStartedBeforeWarmResolve = false;

    (callPersona as any).mockImplementation(async (input: any) => {
      if (input.ticker === '000000') {
        await new Promise((r) => setTimeout(r, 50));
        warmResolved = true;
      } else if (!warmResolved) {
        fanoutStartedBeforeWarmResolve = true;
      }
      return {
        content: '{"vote":"BUY","one_line":"x","argument_excerpt":"x"}',
        usage: { input_tokens: 100, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 50 },
        costKrw: 100,
        promptCacheEnabled: false,
      };
    });

    await runMonthlyPersonaEval({ ...baseInput, tickers: tickers.slice(0, 5) });
    expect(fanoutStartedBeforeWarmResolve).toBe(false);
  });

  it('lock acquisition first call succeeds; second concurrent throws batch_already_running', async () => {
    (acquireBatchLock as any)
      .mockResolvedValueOnce({ acquired: true })
      .mockRejectedValueOnce(new Error('batch_already_running'));

    const first = runMonthlyPersonaEval(baseInput);
    const second = runMonthlyPersonaEval(baseInput);
    await expect(Promise.all([first, second])).rejects.toThrow('batch_already_running');
    // drain dangling first promise so it does not bleed callPersona calls into next test
    await first.catch(() => {});
  });

  it('preflight upper-bound × 30 throws cost_hardcap_40man → no callPersona', async () => {
    (preflightHardcap as any).mockRejectedValueOnce(new Error('cost_hardcap_40man'));
    await expect(runMonthlyPersonaEval(baseInput)).rejects.toThrow('cost_hardcap_40man');
    expect(callPersona).not.toHaveBeenCalled();
    // lock release with status='failed'
    expect(releaseBatchLock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', errorCode: 'cost_hardcap_40man' })
    );
  });

  it('tier1Available=false propagates when callPersona throws ai_key_unavailable', async () => {
    (callPersona as any).mockRejectedValue(new Error('ai_key_unavailable'));
    const result = await runMonthlyPersonaEval(baseInput);
    expect(result.tier1AvailableByTicker[tickers[0]]).toBe(false);
  });

  it('fan-out partial failure preserves per-ticker ⚪ assignment (Plan R2 BLOCKER 2)', async () => {
    // tickers[5]만 ai_call_failed, 나머지는 happy
    (callPersona as any).mockImplementation(async (input: any) => {
      if (input.ticker === tickers[5]) throw new Error('ai_call_failed');
      return {
        content: '{"vote":"BUY","one_line":"x","argument_excerpt":"x"}',
        usage: { input_tokens: 100, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 50 },
        costKrw: 100,
        promptCacheEnabled: false,
      };
    });
    const result = await runMonthlyPersonaEval(baseInput);
    expect(result.tier1AvailableByTicker[tickers[5]]).toBe(false);
    expect(result.tier1AvailableByTicker[tickers[0]]).toBe(true);
    expect(result.tier1AvailableByTicker[tickers[10]]).toBe(true);
  });

  it('try/finally lock release with status=failed on unexpected error', async () => {
    (callPersona as any).mockRejectedValue(new Error('unexpected'));
    await expect(runMonthlyPersonaEval(baseInput)).rejects.toBeDefined();
    expect(releaseBatchLock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' })
    );
  });
});
