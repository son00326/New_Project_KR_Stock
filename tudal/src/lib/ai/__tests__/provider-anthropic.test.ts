import { describe, it, expect, vi, beforeEach } from 'vitest';

// Anthropic SDK call shape mock (no actual network)
const mockMessagesCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function (this: unknown) {
    return { messages: { create: mockMessagesCreate } };
  }),
}));

import { anthropicProvider } from '../anthropic-provider';

describe('anthropicProvider (W0 D28)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'sk-test';
  });

  const baseResponse = {
    content: [{ type: 'text', text: '안녕' }],
    usage: { input_tokens: 100, output_tokens: 50 },
  };

  it('id = anthropic + isAvailable reflects ANTHROPIC_API_KEY', () => {
    expect(anthropicProvider.id).toBe('anthropic');
    expect(anthropicProvider.isAvailable()).toBe(true);
    delete process.env.ANTHROPIC_API_KEY;
    expect(anthropicProvider.isAvailable()).toBe(false);
  });

  it('enablePromptCache true → system block에 cache_control 존재', async () => {
    mockMessagesCreate.mockResolvedValue(baseResponse);
    await anthropicProvider.call({
      model: 'claude-opus-4-7',
      maxTokens: 1024,
      systemPrompt: 'sys',
      userPrompt: 'user',
      enablePromptCache: true,
    });
    const callArg = mockMessagesCreate.mock.calls[0][0];
    expect(JSON.stringify(callArg)).toContain('cache_control');
    expect(callArg.model).toBe('claude-opus-4-7');
    expect(callArg.max_tokens).toBe(1024);
  });

  it('enablePromptCache false/미지정 → cache_control 부재', async () => {
    mockMessagesCreate.mockResolvedValue(baseResponse);
    await anthropicProvider.call({
      model: 'claude-opus-4-7',
      maxTokens: 1024,
      systemPrompt: 'sys',
      userPrompt: 'user',
    });
    const callArg = mockMessagesCreate.mock.calls[0][0];
    expect(JSON.stringify(callArg)).not.toContain('cache_control');
  });

  it('usage 정규화 — 4필드 + cache 토큰 보존', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'x' }],
      usage: {
        input_tokens: 50,
        cache_creation_input_tokens: 30,
        cache_read_input_tokens: 20,
        output_tokens: 40,
      },
    });
    const result = await anthropicProvider.call({
      model: 'claude-opus-4-7',
      maxTokens: 1024,
      systemPrompt: 'sys',
      userPrompt: 'user',
    });
    expect(result.usage).toEqual({
      input_tokens: 50,
      cache_creation_input_tokens: 30,
      cache_read_input_tokens: 20,
      output_tokens: 40,
    });
  });

  it('usage cache 필드 부재 → 0 정규화', async () => {
    mockMessagesCreate.mockResolvedValue(baseResponse);
    const result = await anthropicProvider.call({
      model: 'claude-opus-4-7',
      maxTokens: 1024,
      systemPrompt: 'sys',
      userPrompt: 'user',
    });
    expect(result.usage).toEqual({
      input_tokens: 100,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      output_tokens: 50,
    });
  });

  it('text block join (다중 text block 연결, non-text 제외)', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [
        { type: 'text', text: '가' },
        { type: 'tool_use', name: 'noop' },
        { type: 'text', text: '나' },
      ],
      usage: { input_tokens: 1, output_tokens: 1 },
    });
    const result = await anthropicProvider.call({
      model: 'claude-opus-4-7',
      maxTokens: 1024,
      systemPrompt: 'sys',
      userPrompt: 'user',
    });
    expect(result.text).toBe('가나');
  });
});
