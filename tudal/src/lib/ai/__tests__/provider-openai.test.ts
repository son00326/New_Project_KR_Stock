import { describe, it, expect, vi, beforeEach } from 'vitest';

// OpenAI SDK (Responses API) mock — no actual network
const mockResponsesCreate = vi.fn();
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(function (this: unknown) {
    return { responses: { create: mockResponsesCreate } };
  }),
}));

import { openaiProvider } from '../openai-provider';

describe('openaiProvider (W0 D28 — Responses API)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = 'sk-openai-test';
  });

  it('id = openai + isAvailable reflects OPENAI_API_KEY', () => {
    expect(openaiProvider.id).toBe('openai');
    expect(openaiProvider.isAvailable()).toBe(true);
    delete process.env.OPENAI_API_KEY;
    expect(openaiProvider.isAvailable()).toBe(false);
  });

  it('responses.create 인자 = instructions/input/max_output_tokens/model', async () => {
    mockResponsesCreate.mockResolvedValue({
      output_text: 'ok',
      usage: { input_tokens: 10, output_tokens: 5, input_tokens_details: { cached_tokens: 0 } },
    });
    await openaiProvider.call({
      model: 'gpt-5.4',
      maxTokens: 2048,
      systemPrompt: '시스템 지시',
      userPrompt: '유저 입력',
    });
    const callArg = mockResponsesCreate.mock.calls[0][0];
    expect(callArg).toEqual({
      model: 'gpt-5.4',
      instructions: '시스템 지시',
      input: '유저 입력',
      max_output_tokens: 2048,
    });
  });

  it('usage 정규화 — input_tokens = 총 - cached, cache_read = cached, cache_creation = 0', async () => {
    mockResponsesCreate.mockResolvedValue({
      output_text: '결과',
      usage: {
        input_tokens: 100, // cached 포함 total (OpenAI 규약)
        output_tokens: 40,
        input_tokens_details: { cached_tokens: 30 },
      },
    });
    const result = await openaiProvider.call({
      model: 'gpt-5.4',
      maxTokens: 2048,
      systemPrompt: 'sys',
      userPrompt: 'user',
    });
    expect(result.usage).toEqual({
      input_tokens: 70, // 100 - 30
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 30,
      output_tokens: 40,
    });
    expect(result.text).toBe('결과');
  });

  it('usage / details undefined → 0 정규화 (no throw)', async () => {
    mockResponsesCreate.mockResolvedValue({
      output_text: 'x',
      usage: undefined,
    });
    const result = await openaiProvider.call({
      model: 'gpt-5.4',
      maxTokens: 2048,
      systemPrompt: 'sys',
      userPrompt: 'user',
    });
    expect(result.usage).toEqual({
      input_tokens: 0,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      output_tokens: 0,
    });
  });

  it('input_tokens_details 부재 → cached 0 처리', async () => {
    mockResponsesCreate.mockResolvedValue({
      output_text: 'x',
      usage: { input_tokens: 80, output_tokens: 10 },
    });
    const result = await openaiProvider.call({
      model: 'gpt-5.4',
      maxTokens: 2048,
      systemPrompt: 'sys',
      userPrompt: 'user',
    });
    expect(result.usage.input_tokens).toBe(80);
    expect(result.usage.cache_read_input_tokens).toBe(0);
  });

  it('output_text 부재 → 빈 문자열', async () => {
    mockResponsesCreate.mockResolvedValue({
      usage: { input_tokens: 10, output_tokens: 5, input_tokens_details: { cached_tokens: 0 } },
    });
    const result = await openaiProvider.call({
      model: 'gpt-5.4',
      maxTokens: 2048,
      systemPrompt: 'sys',
      userPrompt: 'user',
    });
    expect(result.text).toBe('');
  });
});
