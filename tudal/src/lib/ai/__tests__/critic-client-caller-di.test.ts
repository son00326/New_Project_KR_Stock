// PR4 Task 1 Step 1.1.8 — caller DI seam invariant test for callCritic (B2 fix omxy R1).
// 2 tests: options.client propagation / default { client: undefined }.
// Option A(2026-07-01): critic = GPT primary / GLM fallback. GPT off → GLM(openrouter Chat Completions).
import { describe, it, expect, vi, beforeEach } from 'vitest';

// GLM fallback 경로 = openrouter-provider → client.chat.completions.create.
vi.mock('openai', () => {
  const chatCreate = vi.fn();
  class OpenAI {
    chat = { completions: { create: chatCreate } };
    constructor() {}
  }
  return { default: OpenAI, __chatCreate: chatCreate };
});

vi.mock('@/lib/cost/cost-logger', () => ({
  insertCostLog: vi.fn().mockResolvedValue(undefined),
}));

describe('callCritic — caller DI seam (PR4 Task 1 Step 1.1.8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Option A: GPT off → GLM fallback 가용 (openrouter).
    delete process.env.OPENAI_API_KEY;
    process.env.OPENROUTER_API_KEY = 'test-or-key';
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

  function glmChatResponse(text: string) {
    return {
      choices: [{ message: { content: text }, finish_reason: 'stop' as const }],
      usage: {
        prompt_tokens: 1,
        completion_tokens: 1,
        prompt_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 },
      },
    };
  }

  async function getChatCreate() {
    const oa = await import('openai');
    return (oa as unknown as { __chatCreate: ReturnType<typeof vi.fn> }).__chatCreate;
  }

  it('propagates options.client to insertCostLog 2nd arg', async () => {
    const chatCreate = await getChatCreate();
    chatCreate.mockResolvedValueOnce(glmChatResponse(validCriticJson));
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
    const chatCreate = await getChatCreate();
    chatCreate.mockResolvedValueOnce(glmChatResponse(validCriticJson));
    const { insertCostLog } = await import('@/lib/cost/cost-logger');
    const { callCritic } = await import('@/lib/ai/critic-client');
    await callCritic(baseInput);
    expect(insertCostLog).toHaveBeenCalledWith(
      expect.any(Object),
      { client: undefined },
    );
  });
});
