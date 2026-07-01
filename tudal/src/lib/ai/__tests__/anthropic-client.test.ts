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

  // W1a (D2) — per-call modelBinding override (D28 ① mix slot)
  it('modelBinding 지정 시 해당 provider/model로 호출 + cost_log.model=per-slot 모델', async () => {
    const stubCall = vi.fn(async () => ({
      text: '{"vote":"BUY"}',
      usage: {
        input_tokens: 100,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        output_tokens: 50,
      },
    }));
    const binding = {
      role: 'tier1_panel' as const,
      provider: { id: 'openrouter' as const, isAvailable: () => true, call: stubCall },
      model: 'openai/gpt-5.4',
      pricingKey: 'openai/gpt-5.4',
      maxTokens: 1024,
    };
    await callPersona({
      personaId: 'warren-buffett',
      ticker: '005930',
      financials: 'stub',
      reflectionContext: '',
      adminUserId: 'admin-uuid',
      modelBinding: binding,
    });
    expect(stubCall).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'openai/gpt-5.4', maxTokens: 1024 }),
    );
    expect(mockMessagesCreate).not.toHaveBeenCalled(); // 기존 SDK 경로 미사용
    expect(insertCostLog).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'openai/gpt-5.4' }),
      expect.anything(),
    );
  });

  // W1a (D9) — transient retry classifier
  it('provider 429 status → ai_call_failed:transient:429 throw', async () => {
    const err = Object.assign(new Error('rate limited'), { status: 429 });
    mockMessagesCreate.mockRejectedValue(err);
    await expect(callPersona({
      personaId: 'warren-buffett',
      ticker: '005930',
      financials: 'stub',
      reflectionContext: '',
      adminUserId: 'admin-uuid',
    })).rejects.toThrow('ai_call_failed:transient:429');
  });

  it('provider 5xx/네트워크 hint → ai_call_failed:transient:* / 4xx invalid_request → ai_call_failed (suffix 없음)', async () => {
    const e529 = Object.assign(new Error('overloaded_error'), { status: 529 });
    mockMessagesCreate.mockRejectedValueOnce(e529);
    await expect(callPersona({
      personaId: 'warren-buffett',
      ticker: '005930',
      financials: 'stub',
      reflectionContext: '',
      adminUserId: 'admin-uuid',
    })).rejects.toThrow('ai_call_failed:transient:529');

    const e400 = Object.assign(new Error('invalid_request_error: bad prompt'), { status: 400 });
    mockMessagesCreate.mockRejectedValueOnce(e400);
    await expect(callPersona({
      personaId: 'warren-buffett',
      ticker: '005930',
      financials: 'stub',
      reflectionContext: '',
      adminUserId: 'admin-uuid',
    })).rejects.toThrow(/^ai_call_failed$/);
  });

  it('provider numeric 529 message without status → ai_call_failed:transient:network throw', async () => {
    mockMessagesCreate.mockRejectedValue(new Error('provider 529'));
    await expect(callPersona({
      personaId: 'warren-buffett',
      ticker: '005930',
      financials: 'stub',
      reflectionContext: '',
      adminUserId: 'admin-uuid',
    })).rejects.toThrow('ai_call_failed:transient:network');
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
