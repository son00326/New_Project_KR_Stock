// PR4 Task 1 Step 1.1.8 — caller DI seam invariant test for callCritic (B2 fix omxy R1).
// 2 tests: options.client propagation / default { client: undefined }.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => {
  const create = vi.fn();
  class Anthropic {
    messages = { create };
    constructor() {}
  }
  return { default: Anthropic, __create: create };
});

vi.mock('@/lib/cost/cost-logger', () => ({
  insertCostLog: vi.fn().mockResolvedValue(undefined),
}));

describe('callCritic — caller DI seam (PR4 Task 1 Step 1.1.8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  const baseInput = {
    ticker: '005930',
    month: '2026-06',
    systemPrompt: 'S',
    userPrompt: 'U',
    adminUserId: 'u1',
  };

  // Valid critic JSON (6 axes × verdict/reason)
  const validCriticJson = JSON.stringify({
    factuality: { verdict: 'PASS', reason: 'ok' },
    logic: { verdict: 'PASS', reason: 'ok' },
    completeness: { verdict: 'PASS', reason: 'ok' },
    structure: { verdict: 'PASS', reason: 'ok' },
    bias: { verdict: 'PASS', reason: 'ok' },
    reader_level: { verdict: 'PASS', reason: 'ok' },
  });

  it('propagates options.client to insertCostLog 2nd arg', async () => {
    const sdk = await import('@anthropic-ai/sdk');
    const create = (sdk as unknown as { __create: ReturnType<typeof vi.fn> }).__create;
    create.mockResolvedValueOnce({
      content: [{ type: 'text', text: validCriticJson }],
      usage: { input_tokens: 1, output_tokens: 1 },
    });
    const { insertCostLog } = await import('@/lib/cost/cost-logger');
    const { callCritic } = await import('@/lib/ai/critic-client');
    const fakeClient = { tag: 'fake-critic' } as never;
    await callCritic(baseInput, { client: fakeClient });
    expect(insertCostLog).toHaveBeenCalledWith(
      expect.any(Object),
      { client: fakeClient },
    );
  });

  it('passes { client: undefined } to insertCostLog when options omitted', async () => {
    const sdk = await import('@anthropic-ai/sdk');
    const create = (sdk as unknown as { __create: ReturnType<typeof vi.fn> }).__create;
    create.mockResolvedValueOnce({
      content: [{ type: 'text', text: validCriticJson }],
      usage: { input_tokens: 1, output_tokens: 1 },
    });
    const { insertCostLog } = await import('@/lib/cost/cost-logger');
    const { callCritic } = await import('@/lib/ai/critic-client');
    await callCritic(baseInput);
    expect(insertCostLog).toHaveBeenCalledWith(
      expect.any(Object),
      { client: undefined },
    );
  });
});
