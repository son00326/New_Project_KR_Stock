// PR3c Task 2 — critic-client (Haiku 4.5) test (PR3b full-report-client.test.ts 패턴 follow).
// SoT = plan v6, omxy R6 CONVERGED.

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

const happyVerdict = {
  factuality: { verdict: 'PASS', reason: '수치와 날짜가 일관됩니다' },
  logic: { verdict: 'WARN', reason: '논거 일부 중복' },
  completeness: { verdict: 'PASS', reason: 'peer 3사 포함' },
  structure: { verdict: 'PASS', reason: '9 키 모두' },
  bias: { verdict: 'PASS', reason: '낙관 / 비관 균형' },
  reader_level: { verdict: 'PASS', reason: '비유 적절' },
};

const baseInput = {
  ticker: '196170',
  month: '2026-06',
  systemPrompt: 'S',
  userPrompt: 'U',
  adminUserId: 'u1',
};

describe('callCritic — Haiku 4.5 + cost_log + zod 6축', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  it('CRITIC_API_MODEL = "claude-haiku-4-5-20251001" + CRITIC_MAX_TOKENS = 2048 invariant', async () => {
    const { CRITIC_API_MODEL, CRITIC_MAX_TOKENS } = await import('@/lib/ai/critic-client');
    expect(CRITIC_API_MODEL).toBe('claude-haiku-4-5-20251001');
    expect(CRITIC_MAX_TOKENS).toBe(2048);
  });

  it('ANTHROPIC_API_KEY 없으면 ai_key_unavailable throw', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { callCritic } = await import('@/lib/ai/critic-client');
    await expect(callCritic(baseInput)).rejects.toThrow('ai_key_unavailable');
  });

  it('happy path — Haiku call + parse + cost_log (persona_id=critic, prompt_version=critic-v1)', async () => {
    const sdk = await import('@anthropic-ai/sdk');
    const create = (sdk as unknown as { __create: ReturnType<typeof vi.fn> }).__create;
    create.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(happyVerdict) }],
      usage: { input_tokens: 800, output_tokens: 400 },
    });
    const { insertCostLog } = await import('@/lib/cost/cost-logger');
    const { callCritic, CRITIC_API_MODEL, CRITIC_MAX_TOKENS } = await import(
      '@/lib/ai/critic-client'
    );
    const result = await callCritic(baseInput);
    expect(result.verdict.factuality.verdict).toBe('PASS');
    expect(result.verdict.reader_level.verdict).toBe('PASS');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ model: CRITIC_API_MODEL, max_tokens: CRITIC_MAX_TOKENS }),
    );
    expect(insertCostLog).toHaveBeenCalledWith(
      expect.objectContaining({
        ticker: '196170',
        month: '2026-06',
        persona_id: 'critic',
        prompt_version: 'critic-v1',
        model: CRITIC_API_MODEL,
        called_by: 'u1',
      }),
    );
    expect(result.costKrw).toBeGreaterThan(0);
  });

  it('Anthropic SDK throw → critic_llm_failed throw + structured warn + cost_log 미호출', async () => {
    const sdk = await import('@anthropic-ai/sdk');
    const create = (sdk as unknown as { __create: ReturnType<typeof vi.fn> }).__create;
    create.mockRejectedValueOnce(new Error('rate_limit_429'));
    const { insertCostLog } = await import('@/lib/cost/cost-logger');
    const { callCritic } = await import('@/lib/ai/critic-client');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(callCritic(baseInput)).rejects.toThrow('critic_llm_failed');
    expect(warnSpy).toHaveBeenCalled();
    expect(insertCostLog).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('critic_parse_failed:no_json_object on non-JSON LLM output', async () => {
    const sdk = await import('@anthropic-ai/sdk');
    const create = (sdk as unknown as { __create: ReturnType<typeof vi.fn> }).__create;
    create.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'just plain text no JSON' }],
      usage: { input_tokens: 800, output_tokens: 100 },
    });
    const { callCritic } = await import('@/lib/ai/critic-client');
    await expect(callCritic(baseInput)).rejects.toThrow('critic_parse_failed:no_json_object');
  });

  it('critic_validation_failed when verdict enum invalid', async () => {
    const sdk = await import('@anthropic-ai/sdk');
    const create = (sdk as unknown as { __create: ReturnType<typeof vi.fn> }).__create;
    const invalid = { ...happyVerdict, logic: { verdict: 'MAYBE', reason: 'bad' } };
    create.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(invalid) }],
      usage: { input_tokens: 800, output_tokens: 200 },
    });
    const { callCritic } = await import('@/lib/ai/critic-client');
    await expect(callCritic(baseInput)).rejects.toThrow(/critic_validation_failed/);
  });

  it('B7 boundary — reason 500자 PASS', async () => {
    const sdk = await import('@anthropic-ai/sdk');
    const create = (sdk as unknown as { __create: ReturnType<typeof vi.fn> }).__create;
    const v500 = { ...happyVerdict, factuality: { verdict: 'PASS', reason: 'a'.repeat(500) } };
    create.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(v500) }],
      usage: { input_tokens: 800, output_tokens: 200 },
    });
    const { callCritic } = await import('@/lib/ai/critic-client');
    const r = await callCritic(baseInput);
    expect(r.verdict.factuality.reason.length).toBe(500);
  });

  it('B7 boundary — reason 501자 FAIL', async () => {
    const sdk = await import('@anthropic-ai/sdk');
    const create = (sdk as unknown as { __create: ReturnType<typeof vi.fn> }).__create;
    const v501 = { ...happyVerdict, factuality: { verdict: 'PASS', reason: 'a'.repeat(501) } };
    create.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(v501) }],
      usage: { input_tokens: 800, output_tokens: 200 },
    });
    const { callCritic } = await import('@/lib/ai/critic-client');
    await expect(callCritic(baseInput)).rejects.toThrow(/critic_validation_failed/);
  });

  it('zod missing axis (bias 누락) — critic_validation_failed', async () => {
    const sdk = await import('@anthropic-ai/sdk');
    const create = (sdk as unknown as { __create: ReturnType<typeof vi.fn> }).__create;
    const missing: Record<string, unknown> = { ...happyVerdict };
    delete missing.bias;
    create.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(missing) }],
      usage: { input_tokens: 800, output_tokens: 200 },
    });
    const { callCritic } = await import('@/lib/ai/critic-client');
    await expect(callCritic(baseInput)).rejects.toThrow(/critic_validation_failed/);
  });
});
