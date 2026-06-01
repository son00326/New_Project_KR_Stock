import { describe, it, expect, vi, beforeEach } from 'vitest';
import { callPersona } from '../anthropic-client';

// Anthropic SDK call shape mock (no actual network)
const mockMessagesCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function (this: unknown) {
    return { messages: { create: mockMessagesCreate } };
  }),
}));

vi.mock('@/lib/cost/cost-logger', () => ({
  insertCostLog: vi.fn(),
}));

import { insertCostLog } from '@/lib/cost/cost-logger';

describe('anthropic-client (Q6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'sk-test';
  });

  const happyResponse = {
    content: [{ type: 'text', text: '{"vote":"BUY","one_line":"강함","argument_excerpt":"근거"}' }],
    usage: { input_tokens: 100, output_tokens: 50 },
  };

  it('flag-off cache_control absent in payload', async () => {
    process.env.AI_PROMPT_CACHE_ENABLED = 'false';
    mockMessagesCreate.mockResolvedValue(happyResponse);
    await callPersona({
      personaId: 'warren-buffett',
      ticker: '005930',
      financials: 'stub',
      reflectionContext: '',
      adminUserId: 'admin-uuid',
    });
    const callArg = mockMessagesCreate.mock.calls[0][0];
    expect(JSON.stringify(callArg)).not.toContain('cache_control');
  });

  it('flag-on cache_control breakpoint present', async () => {
    process.env.AI_PROMPT_CACHE_ENABLED = 'true';
    mockMessagesCreate.mockResolvedValue({
      ...happyResponse,
      usage: { input_tokens: 50, cache_creation_input_tokens: 50, cache_read_input_tokens: 0, output_tokens: 50 },
    });
    await callPersona({
      personaId: 'warren-buffett',
      ticker: '005930',
      financials: 'stub',
      reflectionContext: '',
      adminUserId: 'admin-uuid',
    });
    const callArg = mockMessagesCreate.mock.calls[0][0];
    expect(JSON.stringify(callArg)).toContain('cache_control');
  });

  it('returns usage + costKrw + promptCacheEnabled', async () => {
    process.env.AI_PROMPT_CACHE_ENABLED = 'false';
    mockMessagesCreate.mockResolvedValue(happyResponse);
    const result = await callPersona({
      personaId: 'warren-buffett',
      ticker: '005930',
      financials: 'stub',
      reflectionContext: '',
      adminUserId: 'admin-uuid',
    });
    expect(result.usage.input_tokens).toBe(100);
    expect(result.usage.output_tokens).toBe(50);
    expect(result.costKrw).toBeGreaterThan(0);
    expect(result.promptCacheEnabled).toBe(false);
  });

  it('invokes cost-logger after successful call', async () => {
    process.env.AI_PROMPT_CACHE_ENABLED = 'false';
    mockMessagesCreate.mockResolvedValue(happyResponse);
    await callPersona({
      personaId: 'warren-buffett',
      ticker: '005930',
      financials: 'stub',
      reflectionContext: '',
      adminUserId: 'admin-uuid',
    });
    expect(insertCostLog).toHaveBeenCalledTimes(1);
  });

  // PR-G — cost_log client DI seam. cron path는 service-role client 주입 → insertCostLog 2nd arg로 전파.
  it('threads costClient to insertCostLog 2nd arg (cron service-role path)', async () => {
    process.env.AI_PROMPT_CACHE_ENABLED = 'false';
    mockMessagesCreate.mockResolvedValue(happyResponse);
    const fakeClient = { __serviceRole: true } as never;
    await callPersona({
      personaId: 'warren-buffett',
      ticker: '005930',
      financials: 'stub',
      reflectionContext: '',
      adminUserId: '00000000-0000-4000-8000-000000000000',
      costClient: fakeClient,
    });
    expect(insertCostLog).toHaveBeenCalledWith(
      expect.objectContaining({ called_by: '00000000-0000-4000-8000-000000000000' }),
      { client: fakeClient },
    );
  });

  // admin path (costClient 미지정) → insertCostLog 2nd arg = { client: undefined } → session createClient fallback.
  it('passes { client: undefined } to insertCostLog when costClient omitted (admin session path)', async () => {
    process.env.AI_PROMPT_CACHE_ENABLED = 'false';
    mockMessagesCreate.mockResolvedValue(happyResponse);
    await callPersona({
      personaId: 'warren-buffett',
      ticker: '005930',
      financials: 'stub',
      reflectionContext: '',
      adminUserId: 'admin-uuid',
    });
    expect(insertCostLog).toHaveBeenCalledWith(
      expect.objectContaining({ called_by: 'admin-uuid' }),
      { client: undefined },
    );
  });

  it('Anthropic API error → throws ai_call_failed (한국어 매핑은 format-error)', async () => {
    mockMessagesCreate.mockRejectedValue(new Error('API timeout'));
    await expect(callPersona({
      personaId: 'warren-buffett',
      ticker: '005930',
      financials: 'stub',
      reflectionContext: '',
      adminUserId: 'admin-uuid',
    })).rejects.toThrow('ai_call_failed');
    // cost-logger는 호출 안 됨 (Anthropic 호출 실패)
    expect(insertCostLog).not.toHaveBeenCalled();
  });

  it('missing ANTHROPIC_API_KEY → throws ai_key_unavailable', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(callPersona({
      personaId: 'warren-buffett',
      ticker: '005930',
      financials: 'stub',
      reflectionContext: '',
      adminUserId: 'admin-uuid',
    })).rejects.toThrow('ai_key_unavailable');
  });
});
