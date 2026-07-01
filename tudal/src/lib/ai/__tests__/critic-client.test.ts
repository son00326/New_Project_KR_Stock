// PR3c Task 2 — critic-client test (PR3b full-report-client.test.ts 패턴 follow).
// SoT = plan v6, omxy R6 CONVERGED.
// W0 (65차 D28 ⑤): critic = GPT mid 교차.
//   항목1 후속(2026-07-01 USER): critic preferred = **OpenRouter 경유 실제 GPT(openai/gpt-5.4)** /
//     fallback = Claude Haiku(claude-haiku-4-5-20251001, anthropic). 구 direct-OpenAI(Responses API) 폐기.
//   기본 test env = OPENROUTER 有 → openrouter Chat Completions(openai/gpt-5.4). env 분기 테스트 유지.

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// critic 실 경로 = openrouter-provider(client.chat.completions.create = __chatCreate). GPT/GLM 모두 동형 shape.
//   client.responses.create(=__responsesCreate)는 폐기된 direct-OpenAI 경로 — CF3에서 "미호출" 검증용으로만 참조.
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

// OpenRouter Chat Completions 응답 shape 헬퍼(GPT/GLM slug 공통).
function chatResponse(
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

describe('callCritic — GPT mid (OpenRouter 경유) + Claude fallback + cost_log + zod 6축 (W0 D28 ⑤ · 항목1 후속)', () => {
  const savedOpenAiKey = process.env.OPENAI_API_KEY;
  const savedOpenRouterKey = process.env.OPENROUTER_API_KEY;
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-key';
    // 기본(default) = OPENROUTER 有 → critic preferred = openrouter openai/gpt-5.4. 개별 env-branch 테스트가 override.
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
    // 모듈 로드 시점 기본값 — openai/gpt-5.4(OPENROUTER 有=preferred) 또는
    //   claude-haiku-4-5-20251001(OPENROUTER 부재=anthropic fallback) 중 하나. test env(OPENROUTER 有)=openai/gpt-5.4.
    expect(['openai/gpt-5.4', 'claude-haiku-4-5-20251001']).toContain(CRITIC_API_MODEL);
  });

  it('critic 기본 경로 (OPENROUTER 有) → openrouter Chat Completions model=openai/gpt-5.4', async () => {
    const chatCreate = await getChatCreate();
    chatCreate.mockResolvedValueOnce(chatResponse(JSON.stringify(happyVerdict)));
    const { insertCostLog } = await import('@/lib/cost/cost-logger');
    const { callCritic } = await import('@/lib/ai/critic-client');
    const result = await callCritic(baseInput);
    expect(chatCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'openai/gpt-5.4', max_tokens: 2048 }),
    );
    expect(result.verdict.factuality.verdict).toBe('PASS');
    // cost_log.model = provider가 기록하는 실 model (critic-client: resolved.model = 'openai/gpt-5.4').
    expect(insertCostLog).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'openai/gpt-5.4' }),
      { client: undefined },
    );
  });

  it('OPENAI 키 보유라도 critic은 OpenRouter 경유 (direct-OpenAI Responses API 폐기 — model=openai/gpt-5.4)', async () => {
    // 항목1 후속: OPENAI_API_KEY가 있어도 critic preferred=openrouter → chat.completions 경유.
    //   구 direct-OpenAI Responses API(responses.create)는 미사용(폐기) — 호출되지 않아야.
    process.env.OPENAI_API_KEY = 'sk-openai-test';
    const oa = await import('openai');
    const responsesCreate = (oa as unknown as { __responsesCreate: ReturnType<typeof vi.fn> }).__responsesCreate;
    const chatCreate = await getChatCreate();
    chatCreate.mockResolvedValueOnce(chatResponse(JSON.stringify(happyVerdict)));
    const { insertCostLog } = await import('@/lib/cost/cost-logger');
    const { callCritic } = await import('@/lib/ai/critic-client');
    const result = await callCritic(baseInput);
    expect(responsesCreate).not.toHaveBeenCalled();
    expect(chatCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'openai/gpt-5.4', max_tokens: 2048 }),
    );
    expect(result.verdict.logic.verdict).toBe('WARN');
    expect(insertCostLog).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'openai/gpt-5.4', persona_id: 'critic' }),
      { client: undefined },
    );
  });

  it('critic provider 전부 부재(OPENROUTER+ANTHROPIC+OPENAI) → ai_key_unavailable throw', async () => {
    // 항목1 후속 — critic = openrouter(preferred, GPT 경유) + anthropic(fallback, Claude Haiku).
    //   두 provider 키가 모두 있으면 게이트 통과 → 실 호출 시도. ai_key_unavailable를 강제하려면
    //   OPENROUTER + ANTHROPIC(+OPENAI) 전부 제거해야 한다 (하나라도 남으면 critic_llm_failed로 감).
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const { callCritic } = await import('@/lib/ai/critic-client');
    await expect(callCritic(baseInput)).rejects.toThrow('ai_key_unavailable');
  });

  it('happy path (기본 OPENROUTER=GPT 경유) — parse + cost_log (persona_id=critic, prompt_version=critic-v1)', async () => {
    const chatCreate = await getChatCreate();
    chatCreate.mockResolvedValueOnce(chatResponse(JSON.stringify(happyVerdict)));
    const { insertCostLog } = await import('@/lib/cost/cost-logger');
    const { callCritic, CRITIC_MAX_TOKENS } = await import('@/lib/ai/critic-client');
    const result = await callCritic(baseInput);
    expect(result.verdict.factuality.verdict).toBe('PASS');
    expect(result.verdict.reader_level.verdict).toBe('PASS');
    expect(chatCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'openai/gpt-5.4', max_tokens: CRITIC_MAX_TOKENS }),
    );
    expect(insertCostLog).toHaveBeenCalledWith(
      expect.objectContaining({
        ticker: '196170',
        month: '2026-06',
        persona_id: 'critic',
        prompt_version: 'critic-v1',
        model: 'openai/gpt-5.4',
        called_by: 'u1',
      }),
      { client: undefined },
    );
    expect(result.costKrw).toBeGreaterThan(0);
  });

  it('OpenRouter provider throw → critic_llm_failed throw + structured warn + cost_log 미호출', async () => {
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
    chatCreate.mockResolvedValueOnce(chatResponse('just plain text no JSON', 800, 100));
    const { callCritic } = await import('@/lib/ai/critic-client');
    await expect(callCritic(baseInput)).rejects.toThrow('critic_parse_failed:no_json_object');
  });

  it('critic_validation_failed when verdict enum invalid', async () => {
    const chatCreate = await getChatCreate();
    const invalid = { ...happyVerdict, logic: { verdict: 'MAYBE', reason: 'bad' } };
    chatCreate.mockResolvedValueOnce(chatResponse(JSON.stringify(invalid), 800, 200));
    const { callCritic } = await import('@/lib/ai/critic-client');
    await expect(callCritic(baseInput)).rejects.toThrow(/critic_validation_failed/);
  });

  it('B7 boundary — reason 500자 PASS', async () => {
    const chatCreate = await getChatCreate();
    const v500 = { ...happyVerdict, factuality: { verdict: 'PASS', reason: 'a'.repeat(500) } };
    chatCreate.mockResolvedValueOnce(chatResponse(JSON.stringify(v500), 800, 200));
    const { callCritic } = await import('@/lib/ai/critic-client');
    const r = await callCritic(baseInput);
    expect(r.verdict.factuality.reason.length).toBe(500);
  });

  it('B7 boundary — reason 501자 FAIL', async () => {
    const chatCreate = await getChatCreate();
    const v501 = { ...happyVerdict, factuality: { verdict: 'PASS', reason: 'a'.repeat(501) } };
    chatCreate.mockResolvedValueOnce(chatResponse(JSON.stringify(v501), 800, 200));
    const { callCritic } = await import('@/lib/ai/critic-client');
    await expect(callCritic(baseInput)).rejects.toThrow(/critic_validation_failed/);
  });

  it('zod missing axis (bias 누락) — critic_validation_failed', async () => {
    const chatCreate = await getChatCreate();
    const missing: Record<string, unknown> = { ...happyVerdict };
    delete missing.bias;
    chatCreate.mockResolvedValueOnce(chatResponse(JSON.stringify(missing), 800, 200));
    const { callCritic } = await import('@/lib/ai/critic-client');
    await expect(callCritic(baseInput)).rejects.toThrow(/critic_validation_failed/);
  });
});
