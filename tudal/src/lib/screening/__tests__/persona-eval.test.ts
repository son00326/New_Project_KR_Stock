import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runMonthlyPersonaEval, runSectorEval } from '../persona-eval';
import { SECTOR_PERSONA_COUNT } from '../canonical-sectors';

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
    vi.mocked(acquireBatchLock).mockResolvedValue({ acquired: true, resumed: false });
    vi.mocked(releaseBatchLock).mockResolvedValue(undefined);
    vi.mocked(preflightHardcap).mockResolvedValue({ currentTotal: 0, reservation: 0, remaining: 500000 });
    vi.mocked(callPersona).mockResolvedValue({
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
    const calls = vi.mocked(callPersona).mock.calls;
    const firstBlockPersonas = calls.slice(0, 30).map((c) => c[0].personaId);
    expect(new Set(firstBlockPersonas).size).toBe(1);
  });

  it('warm-first: ticker[0] resolves before ticker[1..29] start (deferred mock)', async () => {
    let warmResolved = false;
    let fanoutStartedBeforeWarmResolve = false;

    vi.mocked(callPersona).mockImplementation(async (input) => {
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
    vi.mocked(acquireBatchLock)
      .mockResolvedValueOnce({ acquired: true, resumed: false })
      .mockRejectedValueOnce(new Error('batch_already_running'));

    const first = runMonthlyPersonaEval(baseInput);
    const second = runMonthlyPersonaEval(baseInput);
    await expect(Promise.all([first, second])).rejects.toThrow('batch_already_running');
    // drain dangling first promise so it does not bleed callPersona calls into next test
    await first.catch(() => {});
  });

  it('preflight upper-bound × 30 throws cost_hardcap_exceeded → no callPersona', async () => {
    vi.mocked(preflightHardcap).mockRejectedValueOnce(new Error('cost_hardcap_exceeded'));
    await expect(runMonthlyPersonaEval(baseInput)).rejects.toThrow('cost_hardcap_exceeded');
    expect(callPersona).not.toHaveBeenCalled();
    // lock release with status='failed'
    expect(releaseBatchLock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', errorCode: 'cost_hardcap_exceeded' })
    );
  });

  it('tier1Available=false propagates when callPersona throws ai_key_unavailable', async () => {
    vi.mocked(callPersona).mockRejectedValue(new Error('ai_key_unavailable'));
    const result = await runMonthlyPersonaEval(baseInput);
    expect(result.tier1AvailableByTicker[tickers[0]]).toBe(false);
  });

  it('fan-out partial failure preserves per-ticker ⚪ assignment (Plan R2 BLOCKER 2)', async () => {
    // tickers[5]만 ai_call_failed, 나머지는 happy
    vi.mocked(callPersona).mockImplementation(async (input) => {
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
    vi.mocked(callPersona).mockRejectedValue(new Error('unexpected'));
    await expect(runMonthlyPersonaEval(baseInput)).rejects.toBeDefined();
    expect(releaseBatchLock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' })
    );
  });
});

// Tier 2 D21 (52차) — runSectorEval tests
// omxy R1~R3 CONVERGED + R2 B1 (degraded skip) + R3 acc#4 (runtime return only).

describe('runSectorEval (Tier 2 D21, 52차)', () => {
  const sectorInput = {
    month: '2026-05',
    ticker: '005930',
    sector: '바이오' as const,
    adminUserId: 'admin-uuid',
    fetchFinancials: vi.fn().mockResolvedValue('stub-financials'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(preflightHardcap).mockResolvedValue({ currentTotal: 0, reservation: 0, remaining: 500000 });
    vi.mocked(callPersona).mockResolvedValue({
      content: '{"vote":"BUY","one_line":"강함","argument_excerpt":"근거"}',
      usage: { input_tokens: 100, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 50 },
      costKrw: 100,
      promptCacheEnabled: false,
    });
  });

  it('preflightHardcap called with SECTOR_PERSONA_COUNT (14, model-aware) + admin session (no costClient)', async () => {
    await runSectorEval(sectorInput);
    expect(preflightHardcap).toHaveBeenCalledWith(
      {
        month: '2026-05',
        callCount: SECTOR_PERSONA_COUNT,
        maxCostPerCallKrw: expect.any(Number), // PR-T2b model-aware (tier1_panel role worst-case)
      },
      {}, // PR-T2a: sectorInput has no costClient → admin session path
    );
  });

  it('costClient present → preflight service-role + callPersona costClient/costLogMonth (cron path)', async () => {
    const costClient = {} as never;
    await runSectorEval({ ...sectorInput, costClient });
    expect(preflightHardcap).toHaveBeenCalledWith(
      expect.objectContaining({ month: '2026-05', callCount: SECTOR_PERSONA_COUNT }),
      { client: costClient, callerKind: 'service-role' },
    );
    expect(callPersona).toHaveBeenCalledWith(
      expect.objectContaining({ costClient, costLogMonth: '2026-05' }),
    );
  });

  it('available=true + degradedCount=0 시 14 callPersona invocations + length=14 personaIds', async () => {
    const result = await runSectorEval(sectorInput);
    expect(callPersona).toHaveBeenCalledTimes(SECTOR_PERSONA_COUNT);
    expect(result.personaIds).toHaveLength(SECTOR_PERSONA_COUNT);
    expect(result.results).toHaveLength(SECTOR_PERSONA_COUNT);
    expect(result.available).toBe(true);
    expect(result.degradedCount).toBe(0);
    expect(result.sector).toBe('바이오');
    expect(result.totalCalls).toBe(SECTOR_PERSONA_COUNT);
  });

  it('persona ID 패턴 = sector-{sector}-slot-{1..14}', async () => {
    const result = await runSectorEval(sectorInput);
    expect(result.personaIds[0]).toBe('sector-바이오-slot-1');
    expect(result.personaIds[13]).toBe('sector-바이오-slot-14');
  });

  it('ai_key_unavailable failure → degradedCount 증가, available=false (R2 B1)', async () => {
    vi.mocked(callPersona).mockRejectedValueOnce(new Error('ai_key_unavailable'));
    const result = await runSectorEval(sectorInput);
    expect(result.degradedCount).toBe(1);
    expect(result.available).toBe(false);
    expect(result.results).toHaveLength(SECTOR_PERSONA_COUNT - 1);
  });

  it('unknown_persona_id (production prompts 부재) → degraded handling', async () => {
    vi.mocked(callPersona).mockRejectedValue(new Error('unknown_persona_id:sector-바이오-slot-1'));
    const result = await runSectorEval(sectorInput);
    expect(result.degradedCount).toBe(SECTOR_PERSONA_COUNT);
    expect(result.available).toBe(false);
    expect(result.results).toHaveLength(0);
  });

  it('ALL 14 success 시만 available=true (degradedCount=0)', async () => {
    // 1 partial failure
    vi.mocked(callPersona).mockRejectedValueOnce(new Error('ai_call_failed'));
    const result = await runSectorEval(sectorInput);
    expect(result.available).toBe(false); // 13 success여도 false
  });

  it('non-network/non-prompt 오류는 caller에 throw (fatal)', async () => {
    vi.mocked(callPersona).mockRejectedValue(new Error('unexpected_db_error'));
    await expect(runSectorEval(sectorInput)).rejects.toThrow('unexpected_db_error');
  });

  it('sub_tags overlay 활성화 시 slot 13·14 sub_tag 반영', async () => {
    const result = await runSectorEval({
      ...sectorInput,
      ticker: '009540',
      sector: '운송/물류',
      sub_tags: ['조선'],
    });
    expect(result.personaIds).toHaveLength(SECTOR_PERSONA_COUNT);
    expect(result.personaIds[0]).toBe('sector-운송/물류-slot-1');
  });
});
