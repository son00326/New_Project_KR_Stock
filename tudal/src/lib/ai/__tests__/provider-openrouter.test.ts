import { describe, it, expect, vi, beforeEach } from 'vitest';

// openai SDK (Chat Completions API) mock — OpenRouter는 OpenAI 호환. baseURL override 확인용으로 생성자 캡처.
const mockChatCompletionsCreate = vi.fn();
const openaiCtor = vi.fn();
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(function (this: unknown, opts: unknown) {
    openaiCtor(opts);
    return { chat: { completions: { create: mockChatCompletionsCreate } } };
  }),
}));

import { openrouterProvider } from '../openrouter-provider';

describe('openrouterProvider (항목1 — GLM/GPT, OpenRouter Chat Completions)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENROUTER_API_KEY = 'openrouter-test-key';
    delete process.env.OPENAI_API_KEY;
  });

  it('id = openrouter + isAvailable reflects OPENROUTER_API_KEY (fail-closed 키 부재 시 false)', () => {
    expect(openrouterProvider.id).toBe('openrouter');
    expect(openrouterProvider.isAvailable()).toBe(true);
    delete process.env.OPENROUTER_API_KEY;
    expect(openrouterProvider.isAvailable()).toBe(false);
  });

  it('baseURL=openrouter.ai/api/v1 + key는 env에서만 (하드코딩 금지)', async () => {
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: 'ok' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    });
    await openrouterProvider.call({
      model: 'z-ai/glm-5.2',
      maxTokens: 2048,
      systemPrompt: 'sys',
      userPrompt: 'user',
    });
    expect(openaiCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'openrouter-test-key',
        baseURL: 'https://openrouter.ai/api/v1',
      }),
    );
  });

  it('OPENROUTER_API_KEY 부재 시 OPENAI_API_KEY로 대체하지 않고 즉시 차단', async () => {
    delete process.env.OPENROUTER_API_KEY;
    process.env.OPENAI_API_KEY = 'sk-openai-leak-test';
    await expect(
      openrouterProvider.call({
        model: 'z-ai/glm-5.2',
        maxTokens: 2048,
        systemPrompt: 'sys',
        userPrompt: 'user',
      }),
    ).rejects.toThrow('ai_key_unavailable');
    expect(openaiCtor).not.toHaveBeenCalled();
    expect(mockChatCompletionsCreate).not.toHaveBeenCalled();
  });

  it('chat.completions.create 인자 = model/max_tokens/messages(system+user)', async () => {
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: '결과' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    });
    await openrouterProvider.call({
      model: 'z-ai/glm-5.2',
      maxTokens: 1024,
      systemPrompt: '시스템 지시',
      userPrompt: '유저 입력',
    });
    expect(mockChatCompletionsCreate).toHaveBeenCalledWith({
      model: 'z-ai/glm-5.2',
      max_tokens: 1024,
      reasoning_effort: 'high',
      response_format: undefined,
      messages: [
        { role: 'system', content: '시스템 지시' },
        { role: 'user', content: '유저 입력' },
      ],
    });
  });

  it('responseFormat=json_object 요청 시 OpenRouter JSON 모드 사용', async () => {
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: '{"ok":true}' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    });
    await openrouterProvider.call({
      model: 'z-ai/glm-5.2',
      maxTokens: 1024,
      systemPrompt: '시스템 지시',
      userPrompt: 'JSON으로 답',
      responseFormat: 'json_object',
    });
    expect(mockChatCompletionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        response_format: { type: 'json_object' },
      }),
    );
  });

  it('usage 정규화 — input=prompt_tokens-cached-cache_write / cache_read=cached / cache_creation=cache_write / output=completion', async () => {
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: '텍스트' } }],
      usage: {
        prompt_tokens: 100, // cached 포함 total (OpenAI 규약)
        completion_tokens: 540,
        prompt_tokens_details: { cached_tokens: 30, cache_write_tokens: 12 },
        completion_tokens_details: { reasoning_tokens: 500 },
      },
    });
    const result = await openrouterProvider.call({
      model: 'z-ai/glm-5.2',
      maxTokens: 2048,
      systemPrompt: 'sys',
      userPrompt: 'user',
    });
    expect(result.usage).toEqual({
      input_tokens: 58,
      cache_creation_input_tokens: 12,
      cache_read_input_tokens: 30,
      output_tokens: 540,
    });
    expect(result.text).toBe('텍스트');
  });

  it('cache_write_tokens 부재 → cache_creation 0', async () => {
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: 'x' } }],
      usage: { prompt_tokens: 80, completion_tokens: 10, prompt_tokens_details: { cached_tokens: 0 } },
    });
    const result = await openrouterProvider.call({
      model: 'z-ai/glm-5.2',
      maxTokens: 2048,
      systemPrompt: 'sys',
      userPrompt: 'user',
    });
    expect(result.usage.input_tokens).toBe(80);
    expect(result.usage.cache_creation_input_tokens).toBe(0);
    expect(result.usage.cache_read_input_tokens).toBe(0);
  });

  it('usage undefined → 비용 누락 방지를 위해 실패', async () => {
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: 'x' } }],
      usage: undefined,
    });
    await expect(
      openrouterProvider.call({
        model: 'z-ai/glm-5.2',
        maxTokens: 2048,
        systemPrompt: 'sys',
        userPrompt: 'user',
      }),
    ).rejects.toThrow('openrouter_usage_missing:usage');
  });

  it('finish_reason=length → 잘린 응답을 성공으로 처리하지 않음', async () => {
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ finish_reason: 'length', message: { content: null } }],
      usage: { prompt_tokens: 10, completion_tokens: 1024 },
    });
    await expect(
      openrouterProvider.call({
        model: 'z-ai/glm-5.2',
        maxTokens: 1024,
        systemPrompt: 'sys',
        userPrompt: 'user',
      }),
    ).rejects.toThrow('ai_call_failed:transient:length');
  });

  it('content 부재(reasoning-only 등) → 빈 문자열', async () => {
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    });
    const result = await openrouterProvider.call({
      model: 'z-ai/glm-5.2',
      maxTokens: 2048,
      systemPrompt: 'sys',
      userPrompt: 'user',
    });
    expect(result.text).toBe('');
  });

  it('choices 빈 배열 → 빈 문자열 (no throw)', async () => {
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    });
    const result = await openrouterProvider.call({
      model: 'z-ai/glm-5.2',
      maxTokens: 2048,
      systemPrompt: 'sys',
      userPrompt: 'user',
    });
    expect(result.text).toBe('');
  });
});
