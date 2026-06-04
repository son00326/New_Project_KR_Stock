// PR3c Task 3 — revise-client test (Opus 4.7 max_tokens 8192 B3 fix).

import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => {
  const create = vi.fn();
  class Anthropic {
    messages = { create };
    constructor() {}
  }
  return { default: Anthropic, __create: create };
});

vi.mock('@/lib/cost/cost-logger', () => ({
  insertCostLog: vi.fn().mockResolvedValue({ id: 'log-1' }),
}));

const baseInput = {
  ticker: '196170',
  month: '2026-06',
  systemPrompt: 'S',
  userPrompt: 'U',
  adminUserId: 'u1',
};

describe('callRevise — Opus 4.8 max_tokens 8192 + cost_log (W0 D28 ④)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  it('REVISE_API_MODEL = "claude-opus-4-8" (registry 파생) + REVISE_MAX_TOKENS = 8192 invariant (W0 D28 ④)', async () => {
    const { REVISE_API_MODEL, REVISE_MAX_TOKENS } = await import('@/lib/ai/revise-client');
    expect(REVISE_API_MODEL).toBe('claude-opus-4-8');
    expect(REVISE_MAX_TOKENS).toBe(8192);
  });

  it('ANTHROPIC_API_KEY 없으면 ai_key_unavailable throw', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { callRevise } = await import('@/lib/ai/revise-client');
    await expect(callRevise(baseInput)).rejects.toThrow('ai_key_unavailable');
  });

  it('happy path — Opus call + cost_log (persona_id=revise, prompt_version=revise-v1)', async () => {
    const sdk = await import('@anthropic-ai/sdk');
    const create = (sdk as unknown as { __create: ReturnType<typeof vi.fn> }).__create;
    create.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"section_0":{},"section_1":{}}' }],
      usage: { input_tokens: 5000, output_tokens: 4000 },
    });
    const { insertCostLog } = await import('@/lib/cost/cost-logger');
    const { callRevise, REVISE_API_MODEL, REVISE_MAX_TOKENS } = await import(
      '@/lib/ai/revise-client'
    );
    const result = await callRevise(baseInput);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ model: REVISE_API_MODEL, max_tokens: REVISE_MAX_TOKENS }),
    );
    expect(insertCostLog).toHaveBeenCalledWith(
      expect.objectContaining({
        ticker: '196170',
        month: '2026-06',
        persona_id: 'revise',
        prompt_version: 'revise-v1',
        called_by: 'u1',
      }),
      { client: undefined },
    );
    expect(result.content).toBe('{"section_0":{},"section_1":{}}');
    expect(result.costKrw).toBeGreaterThan(0);
  });

  it('Anthropic SDK throw → revise_llm_failed throw + structured warn + cost_log 미호출', async () => {
    const sdk = await import('@anthropic-ai/sdk');
    const create = (sdk as unknown as { __create: ReturnType<typeof vi.fn> }).__create;
    create.mockRejectedValueOnce(new Error('5xx_server_error'));
    const { insertCostLog } = await import('@/lib/cost/cost-logger');
    const { callRevise } = await import('@/lib/ai/revise-client');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(callRevise(baseInput)).rejects.toThrow('revise_llm_failed');
    expect(warnSpy).toHaveBeenCalled();
    expect(insertCostLog).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
