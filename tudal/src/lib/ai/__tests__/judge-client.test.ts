// W1b (D2) — judge-client: callJudge(Opus)/callDualJudge(GPT↔Opus) + JudgeVerdict 파서.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const providerCall = vi.fn();
const resolveRoleMock = vi.fn();
vi.mock('@/lib/ai/model-registry', () => ({
  resolveRole: (role: string) => resolveRoleMock(role),
}));
vi.mock('@/lib/cost/cost-logger', () => ({
  insertCostLog: vi.fn(),
}));

import { insertCostLog } from '@/lib/cost/cost-logger';
import {
  callJudge,
  callDualJudge,
  parseJudgeVerdict,
  JUDGE_USER_PROMPT,
} from '../judge-client';

const validVerdict = JSON.stringify({
  scores: { short: 72, mid: 60, long: 55 },
  winning_timeframe: 'short',
  rationale_kr: '단기 모멘텀 논거가 가장 견고',
  conviction: 70,
});

function stubResolved(model: string, providerId: 'anthropic' | 'openai') {
  return {
    role: 'debate_judge',
    provider: { id: providerId, isAvailable: () => true, call: providerCall },
    model,
    pricingKey: model,
    maxTokens: 2048,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = 'sk-test';
  providerCall.mockResolvedValue({
    text: validVerdict,
    usage: {
      input_tokens: 100,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      output_tokens: 50,
    },
  });
  resolveRoleMock.mockImplementation((role: string) =>
    role === 'dual_judge_gpt'
      ? stubResolved('gpt-5.5', 'openai')
      : stubResolved('claude-opus-4-8', 'anthropic'),
  );
});

describe('parseJudgeVerdict', () => {
  it('펜스/노이즈 JSON 추출 + 검증 통과', () => {
    const fenced = '판정:\n```json\n' + validVerdict + '\n```';
    const v = parseJudgeVerdict(fenced);
    expect(v.scores.short).toBe(72);
    expect(v.winning_timeframe).toBe('short');
  });
  it('rationale 120자 초과 → graceful truncate', () => {
    const long = JSON.stringify({
      scores: { short: 10, mid: 10, long: 10 },
      winning_timeframe: 'mid',
      rationale_kr: '가'.repeat(200),
      conviction: 30,
    });
    expect(parseJudgeVerdict(long).rationale_kr.length).toBe(120);
  });
  it('scores 범위 위반(101)/enum 위반 → judge_verdict_parse_failed throw', () => {
    const bad = JSON.stringify({
      scores: { short: 101, mid: 10, long: 10 },
      winning_timeframe: 'mid',
      rationale_kr: 'x',
      conviction: 30,
    });
    expect(() => parseJudgeVerdict(bad)).toThrow(/judge_verdict_parse_failed/);
    expect(() => parseJudgeVerdict('JSON 없음')).toThrow(/judge_verdict_parse_failed/);
  });
  it('balanced braces malformed JSON → invalid_json suffix 보존', () => {
    expect(() => parseJudgeVerdict('```json\n{"scores": }\n```')).toThrow(
      'judge_verdict_parse_failed:invalid_json',
    );
  });
});

describe('callJudge / callDualJudge', () => {
  const baseInput = {
    ticker: '005930',
    month: '2026-06',
    track: 'short' as const,
    panelSummary: '- 워렌 버핏: 단70/중60/장50 — 해자',
    reflectionContext: '[재점검] 직전 논거',
    adminUserId: 'admin-uuid',
  };

  it('callJudge: resolveRole(debate_judge) provider 호출 + 프롬프트에 패널요약/컨텍스트 주입 + cost_log(persona_id=debate-judge, model 실모델)', async () => {
    const v = await callJudge(baseInput);
    expect(v.scores.short).toBe(72);
    expect(resolveRoleMock).toHaveBeenCalledWith('debate_judge');
    const callArg = providerCall.mock.calls[0][0] as {
      model: string;
      userPrompt: string;
    };
    expect(callArg.model).toBe('claude-opus-4-8');
    expect(callArg.userPrompt).toContain('005930');
    expect(callArg.userPrompt).toContain('트랙: short');
    expect(callArg.userPrompt).toContain('워렌 버핏');
    expect(callArg.userPrompt).toContain('[재점검] 직전 논거');
    expect(callArg.userPrompt).not.toContain('{{');
    expect(insertCostLog).toHaveBeenCalledWith(
      expect.objectContaining({
        persona_id: 'debate-judge',
        prompt_version: 'judge@v1',
        model: 'claude-opus-4-8',
        month: '2026-06',
        ticker: '005930',
        called_by: 'admin-uuid',
      }),
      expect.anything(),
    );
  });

  it('callDualJudge: resolveRole(dual_judge_gpt) + persona_id=dual-judge', async () => {
    await callDualJudge(baseInput);
    expect(resolveRoleMock).toHaveBeenCalledWith('dual_judge_gpt');
    expect(insertCostLog).toHaveBeenCalledWith(
      expect.objectContaining({ persona_id: 'dual-judge', model: 'gpt-5.5' }),
      expect.anything(),
    );
  });

  it('ANTHROPIC_API_KEY 부재 → ai_key_unavailable (D28 A 불변)', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(callJudge(baseInput)).rejects.toThrow('ai_key_unavailable');
    expect(providerCall).not.toHaveBeenCalled();
  });

  it('transient(429) → ai_call_failed:transient:429 / 4xx → ai_call_failed (W1a classifier 동일)', async () => {
    providerCall.mockRejectedValueOnce(Object.assign(new Error('rate'), { status: 429 }));
    await expect(callJudge(baseInput)).rejects.toThrow('ai_call_failed:transient:429');
    providerCall.mockRejectedValueOnce(Object.assign(new Error('invalid_request'), { status: 400 }));
    await expect(callJudge(baseInput)).rejects.toThrow(/^ai_call_failed$/);
  });

  it('JUDGE_USER_PROMPT placeholder 4종 존재', () => {
    for (const ph of ['{{TICKER}}', '{{TRACK}}', '{{REFLECTION_CONTEXT}}', '{{PEER_ARGUMENTS}}']) {
      expect(JUDGE_USER_PROMPT).toContain(ph);
    }
  });
});
