// PR3c Task 2 — critic-client test (PR3b full-report-client.test.ts 패턴 follow).
// SoT = plan v6, omxy R6 CONVERGED.
// W0 (65차 D28 ⑤): critic = GPT mid (gpt-5.4) 교차 / GPT 키 부재 시 fallback.
//   Option A(2026-07-01 USER): critic fallback = Claude Haiku → **GLM 5.2(z-ai/glm-5.2, openrouter)**.
//   CI(OPENAI_API_KEY unset) 기본 = GLM fallback. env 분기 테스트 유지.

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// W0: critic GPT 경로(Responses API) + GLM fallback 경로(Chat Completions API) 검증용 openai SDK mock.
//   openai-provider = client.responses.create / openrouter-provider = client.chat.completions.create.
vi.mock('openai', () => {
  const responsesCreate = vi.fn();
  const chatCreate = vi.fn();
  class OpenAI {
    responses = { create: responsesCreate };
    chat = { completions: { create: chatCreate } };
    constructor() {}
  }
  return { default: OpenAI, __responsesCreate: responsesCreate, __chatCreate: chatCreate };
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

// OpenRouter(GLM) Chat Completions 응답 shape 헬퍼.
function glmChatResponse(
  text: string,
  promptTokens = 800,
  completionTokens = 400,
) {
  return {
    choices: [{ message: { content: text }, finish_reason: 'stop' as const }],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      prompt_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 },
    },
  };
}

async function getChatCreate() {
  const oa = await import('openai');
  return (oa as unknown as { __chatCreate: ReturnType<typeof vi.fn> }).__chatCreate;
}

describe('callCritic — GPT mid / GLM fallback + cost_log + zod 6축 (W0 D28 ⑤ · Option A)', () => {
  const savedOpenAiKey = process.env.OPENAI_API_KEY;
  const savedOpenRouterKey = process.env.OPENROUTER_API_KEY;
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-key';
    // 기본(default) = GPT off → GLM fallback (Option A · CI 정합). 개별 env-branch 테스트가 override.
    delete process.env.OPENAI_API_KEY;
    process.env.OPENROUTER_API_KEY = 'test-or-key';
  });
  afterEach(() => {
    if (savedOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = savedOpenAiKey;
    if (savedOpenRouterKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = savedOpenRouterKey;
  });

  it('CRITIC_MAX_TOKENS = 2048 invariant + CRITIC_API_MODEL은 registry critic 역할 파생', async () => {
    const { CRITIC_API_MODEL, CRITIC_MAX_TOKENS } = await import('@/lib/ai/critic-client');
    expect(CRITIC_MAX_TOKENS).toBe(2048);
    // 모듈 로드 시점 기본값 — gpt-5.4(GPT 가용) 또는 z-ai/glm-5.2(Option A fallback) 중 하나.
    expect(['gpt-5.4', 'z-ai/glm-5.2']).toContain(CRITIC_API_MODEL);
  });

  it('GPT 키 부재 → GLM fallback 경로 (openrouter Chat Completions model=z-ai/glm-5.2)', async () => {
    const chatCreate = await getChatCreate();
    chatCreate.mockResolvedValueOnce(glmChatResponse(JSON.stringify(happyVerdict)));
    const { insertCostLog } = await import('@/lib/cost/cost-logger');
    const { callCritic } = await import('@/lib/ai/critic-client');
    const result = await callCritic(baseInput);
    expect(chatCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'z-ai/glm-5.2', max_tokens: 2048 }),
    );
    expect(result.verdict.factuality.verdict).toBe('PASS');
    // cost_log.model = provider가 기록하는 실 model (critic-client: resolved.model = 'z-ai/glm-5.2').
    expect(insertCostLog).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'z-ai/glm-5.2' }),
      { client: undefined },
    );
  });

  it('GPT 키 보유 → openai Responses API 경로 (model=gpt-5.4, cost_log model=gpt-5.4)', async () => {
    process.env.OPENAI_API_KEY = 'sk-openai-test';
    const oa = await import('openai');
    const responsesCreate = (oa as unknown as { __responsesCreate: ReturnType<typeof vi.fn> }).__responsesCreate;
    responsesCreate.mockResolvedValueOnce({
      output_text: JSON.stringify(happyVerdict),
      usage: { input_tokens: 800, output_tokens: 400, input_tokens_details: { cached_tokens: 0 } },
    });
    const { insertCostLog } = await import('@/lib/cost/cost-logger');
    const { callCritic } = await import('@/lib/ai/critic-client');
    const result = await callCritic(baseInput);
    expect(responsesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-5.4', max_output_tokens: 2048 }),
    );
    expect(result.verdict.logic.verdict).toBe('WARN');
    expect(insertCostLog).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-5.4', persona_id: 'critic' }),
      { client: undefined },
    );
  });

  it('critic provider 전부 부재(OPENAI+OPENROUTER) → ai_key_unavailable throw (ANTHROPIC 유무 무관)', async () => {
    // Option A — critic은 ANTHROPIC 비의존(GPT primary / GLM fallback). critic이 쓸 수 있는
    //   provider 키를 전부 제거해야 gate false. ANTHROPIC은 유무 무관(설정된 상태로 검증).
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    const { callCritic } = await import('@/lib/ai/critic-client');
    await expect(callCritic(baseInput)).rejects.toThrow('ai_key_unavailable');
  });

  it('happy path (GPT off=GLM) — parse + cost_log (persona_id=critic, prompt_version=critic-v1)', async () => {
    const chatCreate = await getChatCreate();
    chatCreate.mockResolvedValueOnce(glmChatResponse(JSON.stringify(happyVerdict)));
    const { insertCostLog } = await import('@/lib/cost/cost-logger');
    const { callCritic, CRITIC_MAX_TOKENS } = await import('@/lib/ai/critic-client');
    const result = await callCritic(baseInput);
    expect(result.verdict.factuality.verdict).toBe('PASS');
    expect(result.verdict.reader_level.verdict).toBe('PASS');
    expect(chatCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'z-ai/glm-5.2', max_tokens: CRITIC_MAX_TOKENS }),
    );
    expect(insertCostLog).toHaveBeenCalledWith(
      expect.objectContaining({
        ticker: '196170',
        month: '2026-06',
        persona_id: 'critic',
        prompt_version: 'critic-v1',
        model: 'z-ai/glm-5.2',
        called_by: 'u1',
      }),
      { client: undefined },
    );
    expect(result.costKrw).toBeGreaterThan(0);
  });

  it('GLM provider throw → critic_llm_failed throw + structured warn + cost_log 미호출', async () => {
    const chatCreate = await getChatCreate();
    chatCreate.mockRejectedValueOnce(new Error('rate_limit_429'));
    const { insertCostLog } = await import('@/lib/cost/cost-logger');
    const { callCritic } = await import('@/lib/ai/critic-client');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(callCritic(baseInput)).rejects.toThrow('critic_llm_failed');
    expect(warnSpy).toHaveBeenCalled();
    expect(insertCostLog).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('critic_parse_failed:no_json_object on non-JSON LLM output', async () => {
    const chatCreate = await getChatCreate();
    chatCreate.mockResolvedValueOnce(glmChatResponse('just plain text no JSON', 800, 100));
    const { callCritic } = await import('@/lib/ai/critic-client');
    await expect(callCritic(baseInput)).rejects.toThrow('critic_parse_failed:no_json_object');
  });

  it('critic_validation_failed when verdict enum invalid', async () => {
    const chatCreate = await getChatCreate();
    const invalid = { ...happyVerdict, logic: { verdict: 'MAYBE', reason: 'bad' } };
    chatCreate.mockResolvedValueOnce(glmChatResponse(JSON.stringify(invalid), 800, 200));
    const { callCritic } = await import('@/lib/ai/critic-client');
    await expect(callCritic(baseInput)).rejects.toThrow(/critic_validation_failed/);
  });

  it('B7 boundary — reason 500자 PASS', async () => {
    const chatCreate = await getChatCreate();
    const v500 = { ...happyVerdict, factuality: { verdict: 'PASS', reason: 'a'.repeat(500) } };
    chatCreate.mockResolvedValueOnce(glmChatResponse(JSON.stringify(v500), 800, 200));
    const { callCritic } = await import('@/lib/ai/critic-client');
    const r = await callCritic(baseInput);
    expect(r.verdict.factuality.reason.length).toBe(500);
  });

  it('B7 boundary — reason 501자 FAIL', async () => {
    const chatCreate = await getChatCreate();
    const v501 = { ...happyVerdict, factuality: { verdict: 'PASS', reason: 'a'.repeat(501) } };
    chatCreate.mockResolvedValueOnce(glmChatResponse(JSON.stringify(v501), 800, 200));
    const { callCritic } = await import('@/lib/ai/critic-client');
    await expect(callCritic(baseInput)).rejects.toThrow(/critic_validation_failed/);
  });

  it('zod missing axis (bias 누락) — critic_validation_failed', async () => {
    const chatCreate = await getChatCreate();
    const missing: Record<string, unknown> = { ...happyVerdict };
    delete missing.bias;
    chatCreate.mockResolvedValueOnce(glmChatResponse(JSON.stringify(missing), 800, 200));
    const { callCritic } = await import('@/lib/ai/critic-client');
    await expect(callCritic(baseInput)).rejects.toThrow(/critic_validation_failed/);
  });
});
