// PR3c Task 2 — critic-client test (PR3b full-report-client.test.ts 패턴 follow).
// SoT = plan v6, omxy R6 CONVERGED.
// W0 (65차 D28 ⑤): critic = GPT mid (gpt-5.4) 교차 / GPT 키 부재 시 Haiku fallback (auto-detect).
//   CI(OPENAI_API_KEY unset) 기본 = Haiku. env 분기 테스트 추가.

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => {
  const create = vi.fn();
  class Anthropic {
    messages = { create };
    constructor() {}
  }
  return { default: Anthropic, __create: create };
});

// W0: critic GPT 경로 검증용 openai SDK mock (Responses API).
vi.mock('openai', () => {
  const responsesCreate = vi.fn();
  class OpenAI {
    responses = { create: responsesCreate };
    constructor() {}
  }
  return { default: OpenAI, __responsesCreate: responsesCreate };
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

describe('callCritic — GPT mid / Haiku fallback + cost_log + zod 6축 (W0 D28 ⑤)', () => {
  const savedOpenAiKey = process.env.OPENAI_API_KEY;
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-key';
    // 기본(default) = GPT off → Haiku fallback (CI 정합). 개별 env-branch 테스트가 override.
    delete process.env.OPENAI_API_KEY;
  });
  afterEach(() => {
    if (savedOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = savedOpenAiKey;
  });

  it('CRITIC_MAX_TOKENS = 2048 invariant + CRITIC_API_MODEL은 registry critic 역할 파생', async () => {
    const { CRITIC_API_MODEL, CRITIC_MAX_TOKENS } = await import('@/lib/ai/critic-client');
    expect(CRITIC_MAX_TOKENS).toBe(2048);
    // 모듈 로드 시점 기본값 — gpt-5.4(GPT 가용) 또는 claude-haiku-4-5-20251001(fallback) 중 하나.
    expect(['gpt-5.4', 'claude-haiku-4-5-20251001']).toContain(CRITIC_API_MODEL);
  });

  it('GPT 키 부재 → Haiku fallback 경로 (anthropic SDK model=claude-haiku-4-5-20251001)', async () => {
    const sdk = await import('@anthropic-ai/sdk');
    const create = (sdk as unknown as { __create: ReturnType<typeof vi.fn> }).__create;
    create.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(happyVerdict) }],
      usage: { input_tokens: 800, output_tokens: 400 },
    });
    const { insertCostLog } = await import('@/lib/cost/cost-logger');
    const { callCritic } = await import('@/lib/ai/critic-client');
    const result = await callCritic(baseInput);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-haiku-4-5-20251001', max_tokens: 2048 }),
    );
    expect(result.verdict.factuality.verdict).toBe('PASS');
    expect(insertCostLog).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-haiku-4-5-20251001' }),
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

  it('ANTHROPIC_API_KEY 없으면 ai_key_unavailable throw', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { callCritic } = await import('@/lib/ai/critic-client');
    await expect(callCritic(baseInput)).rejects.toThrow('ai_key_unavailable');
  });

  it('happy path (GPT off=Haiku) — parse + cost_log (persona_id=critic, prompt_version=critic-v1)', async () => {
    const sdk = await import('@anthropic-ai/sdk');
    const create = (sdk as unknown as { __create: ReturnType<typeof vi.fn> }).__create;
    create.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(happyVerdict) }],
      usage: { input_tokens: 800, output_tokens: 400 },
    });
    const { insertCostLog } = await import('@/lib/cost/cost-logger');
    const { callCritic, CRITIC_MAX_TOKENS } = await import('@/lib/ai/critic-client');
    const result = await callCritic(baseInput);
    expect(result.verdict.factuality.verdict).toBe('PASS');
    expect(result.verdict.reader_level.verdict).toBe('PASS');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-haiku-4-5-20251001', max_tokens: CRITIC_MAX_TOKENS }),
    );
    expect(insertCostLog).toHaveBeenCalledWith(
      expect.objectContaining({
        ticker: '196170',
        month: '2026-06',
        persona_id: 'critic',
        prompt_version: 'critic-v1',
        model: 'claude-haiku-4-5-20251001',
        called_by: 'u1',
      }),
      { client: undefined },
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
