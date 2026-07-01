// W3b-1 (D1/D2) — portfolio-proposal-client: callPortfolioProposal(Opus) + PortfolioProposalSchema 파서.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const providerCall = vi.fn();
const resolveRoleMock = vi.fn();
// 항목1 — resolveRole만 stub, isRoleProviderAvailable 등 나머지는 실제 유지(env 기반 게이트 판정 보존).
vi.mock('@/lib/ai/model-registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai/model-registry')>();
  return {
    ...actual,
    resolveRole: (role: string) => resolveRoleMock(role),
    resolveRoleCandidates: (role: string) => {
      const resolved = resolveRoleMock(role);
      const candidates = Array.isArray(resolved) ? resolved : [resolved];
      return candidates.filter((candidate) => candidate.provider.isAvailable());
    },
  };
});
vi.mock('@/lib/cost/cost-logger', () => ({
  insertCostLog: vi.fn(),
}));

import { insertCostLog } from '@/lib/cost/cost-logger';
import {
  callPortfolioProposal,
  parsePortfolioProposal,
  renderPortfolioShortlistSummary,
  PORTFOLIO_PROPOSAL_USER_PROMPT,
} from '../portfolio-proposal-client';

const validProposal = JSON.stringify({
  positions: [
    { ticker: '005930', weight: 0.4, timeframe: 'long' },
    { ticker: '000660', weight: 0.35, timeframe: 'mid' },
  ],
  cashWeight: 0.25,
  rationale_kr: '반도체 비중 집중 + 현금 25% 방어',
});

function stubResolved(model = 'claude-opus-4-8', providerId: 'anthropic' | 'openai' | 'openrouter' = 'anthropic') {
  const pricingKey =
    providerId === 'openrouter' && model.startsWith('openai/')
      ? model
      : providerId === 'openrouter'
        ? 'glm-5.2'
        : model;
  return {
    role: 'portfolio',
    provider: {
      id: providerId,
      isAvailable: () =>
        providerId === 'openai'
          ? !!process.env.OPENAI_API_KEY
          : providerId === 'openrouter'
            ? !!process.env.OPENROUTER_API_KEY
            : !!process.env.ANTHROPIC_API_KEY,
      call: providerCall,
    },
    model,
    pricingKey,
    maxTokens: 4096,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = 'sk-test';
  process.env.OPENROUTER_API_KEY = 'openrouter-test-key';
  providerCall.mockResolvedValue({
    text: validProposal,
    usage: {
      input_tokens: 200,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      output_tokens: 100,
    },
  });
  resolveRoleMock.mockReturnValue(stubResolved('z-ai/glm-5.2', 'openrouter'));
});

describe('PortfolioProposalSchema / parsePortfolioProposal', () => {
  it('정상 proposal: weight sum+cash≈1 + distinct + cash∈[0,0.30]', () => {
    const p = parsePortfolioProposal(validProposal);
    expect(p.positions).toHaveLength(2);
    expect(p.cashWeight).toBe(0.25);
  });

  it('펜스/노이즈 JSON 추출', () => {
    const p = parsePortfolioProposal('제안:\n```json\n' + validProposal + '\n```\n끝');
    expect(p.positions[0].ticker).toBe('005930');
  });

  it('rationale 200자 초과 → graceful truncate', () => {
    const long = JSON.stringify({
      positions: [{ ticker: '005930', weight: 0.8, timeframe: 'long' }],
      cashWeight: 0.2,
      rationale_kr: '가'.repeat(300),
    });
    expect(parsePortfolioProposal(long).rationale_kr.length).toBe(200);
  });

  it('weight sum+cash ≠ 1 → portfolio_proposal_parse_failed', () => {
    const bad = JSON.stringify({
      positions: [{ ticker: '005930', weight: 0.5, timeframe: 'long' }],
      cashWeight: 0.1, // sum 0.6
      rationale_kr: 'x',
    });
    expect(() => parsePortfolioProposal(bad)).toThrow(/portfolio_proposal_parse_failed/);
  });

  it('cashWeight > 0.30 → fail (cash cap)', () => {
    const bad = JSON.stringify({
      positions: [{ ticker: '005930', weight: 0.6, timeframe: 'long' }],
      cashWeight: 0.4,
      rationale_kr: 'x',
    });
    expect(() => parsePortfolioProposal(bad)).toThrow(/portfolio_proposal_parse_failed/);
  });

  it('positions 0개(현금100%) → fail (current cash cap — product 변경은 ESCALATE)', () => {
    const bad = JSON.stringify({ positions: [], cashWeight: 1, rationale_kr: 'all cash' });
    expect(() => parsePortfolioProposal(bad)).toThrow(/portfolio_proposal_parse_failed/);
  });

  it('duplicate ticker → fail', () => {
    const bad = JSON.stringify({
      positions: [
        { ticker: '005930', weight: 0.4, timeframe: 'long' },
        { ticker: '005930', weight: 0.4, timeframe: 'mid' },
      ],
      cashWeight: 0.2,
      rationale_kr: 'x',
    });
    expect(() => parsePortfolioProposal(bad)).toThrow(/portfolio_proposal_parse_failed/);
  });

  it('weight ≤ 0 / ticker 비6자리 / timeframe enum 위반 → fail', () => {
    for (const bad of [
      { positions: [{ ticker: '005930', weight: 0, timeframe: 'long' }], cashWeight: 1, rationale_kr: 'x' },
      { positions: [{ ticker: 'BADCD', weight: 1, timeframe: 'long' }], cashWeight: 0, rationale_kr: 'x' },
      { positions: [{ ticker: '005930', weight: 1, timeframe: 'weekly' }], cashWeight: 0, rationale_kr: 'x' },
    ]) {
      expect(() => parsePortfolioProposal(JSON.stringify(bad))).toThrow(/portfolio_proposal_parse_failed/);
    }
  });

  it('JSON 없음 → portfolio_proposal_parse_failed', () => {
    expect(() => parsePortfolioProposal('제안 불가')).toThrow(/portfolio_proposal_parse_failed/);
  });
});

describe('renderPortfolioShortlistSummary', () => {
  it('종목 요약 1줄씩 + 필드 truncate', () => {
    const out = renderPortfolioShortlistSummary([
      {
        ticker: '005930',
        name: '삼성전자',
        consensusBadge: '🟢',
        aiScore: 78.2,
        winningTimeframe: 'long',
        conviction: 71,
      },
      {
        ticker: '000660',
        name: 'SK하이닉스',
        consensusBadge: '🔵',
        aiScore: 65,
        winningTimeframe: 'mid',
        conviction: 60,
      },
    ]);
    const lines = out.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('005930');
    expect(lines[0]).toContain('삼성전자');
    expect(lines[0]).toContain('🟢');
  });
});

describe('callPortfolioProposal', () => {
  const baseInput = {
    month: '2026-06',
    shortlistSummary: '- 005930 삼성전자: 🟢 AI78.2 장기 확신71',
    adminUserId: 'admin-uuid',
  };

  it('resolveRole(portfolio)=GLM primary + 프롬프트 주입 + cost_log(persona_id=portfolio-proposal, prompt_version portfolio@v1)', async () => {
    const p = await callPortfolioProposal(baseInput);
    expect(p.positions).toHaveLength(2);
    expect(resolveRoleMock).toHaveBeenCalledWith('portfolio');
    const callArg = providerCall.mock.calls[0][0] as {
      model: string;
      userPrompt: string;
      responseFormat?: string;
    };
    expect(callArg.model).toBe('z-ai/glm-5.2');
    expect(callArg.responseFormat).toBe('json_object');
    expect(callArg.userPrompt).toContain('2026-06');
    expect(callArg.userPrompt).toContain('삼성전자');
    expect(callArg.userPrompt).not.toContain('{{');
    expect(insertCostLog).toHaveBeenCalledWith(
      expect.objectContaining({
        persona_id: 'portfolio-proposal',
        prompt_version: 'portfolio@v1',
        model: 'z-ai/glm-5.2',
        month: '2026-06',
        ticker: '000000',
        called_by: 'admin-uuid',
      }),
      expect.anything(),
    );
  });

  it('OPENROUTER+ANTHROPIC 모두 부재 → ai_key_unavailable (provider 미호출)', async () => {
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    await expect(callPortfolioProposal(baseInput)).rejects.toThrow('ai_key_unavailable');
    expect(providerCall).not.toHaveBeenCalled();
  });

  it('R19 LOW — month 비 YYYY-MM → invalid_month (provider 미호출, 재사용 brittle 방어)', async () => {
    for (const month of ['2026-6', '2026-06-01', '2026-13', 'bad']) {
      await expect(
        callPortfolioProposal({ ...baseInput, month }),
      ).rejects.toThrow('invalid_month');
    }
    expect(providerCall).not.toHaveBeenCalled();
  });

  it('transient(429) → ai_call_failed:transient:429 / 4xx → ai_call_failed', async () => {
    providerCall.mockRejectedValueOnce(Object.assign(new Error('rate'), { status: 429 }));
    await expect(callPortfolioProposal(baseInput)).rejects.toThrow('ai_call_failed:transient:429');
    providerCall.mockRejectedValueOnce(Object.assign(new Error('bad'), { status: 400 }));
    await expect(callPortfolioProposal(baseInput)).rejects.toThrow(/^ai_call_failed$/);
  });

  it('OpenRouter provider 호출 실패 때만 Claude fallback을 사용한다', async () => {
    process.env.OPENROUTER_API_KEY = 'openrouter-test-key';
    resolveRoleMock.mockReturnValue([
      stubResolved('z-ai/glm-5.2', 'openrouter'),
      stubResolved('claude-opus-4-8', 'anthropic'),
    ]);
    providerCall
      .mockRejectedValueOnce(Object.assign(new Error('rate'), { status: 429 }))
      .mockResolvedValueOnce({
        text: validProposal,
        usage: {
          input_tokens: 200,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
          output_tokens: 100,
        },
      });

    const result = await callPortfolioProposal(baseInput);

    expect(result.positions).toHaveLength(2);
    expect(providerCall).toHaveBeenCalledTimes(2);
    expect(insertCostLog).toHaveBeenCalledTimes(1);
    expect(insertCostLog).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-opus-4-8' }),
      expect.anything(),
    );
  });

  it('OpenRouter 응답 파싱 실패 뒤에는 추가 provider를 호출하지 않는다', async () => {
    process.env.OPENROUTER_API_KEY = 'openrouter-test-key';
    resolveRoleMock.mockReturnValue([
      stubResolved('z-ai/glm-5.2', 'openrouter'),
      stubResolved('claude-opus-4-8', 'anthropic'),
    ]);
    providerCall.mockResolvedValueOnce({
      text: '제안 불가',
      usage: {
        input_tokens: 200,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        output_tokens: 100,
      },
    });

    await expect(callPortfolioProposal(baseInput)).rejects.toThrow(
      /portfolio_proposal_parse_failed/,
    );

    expect(providerCall).toHaveBeenCalledTimes(1);
    expect(insertCostLog).toHaveBeenCalledTimes(1);
  });

  it('PORTFOLIO_PROPOSAL_USER_PROMPT placeholder 2종', () => {
    for (const ph of ['{{MONTH}}', '{{SHORTLIST}}']) {
      expect(PORTFOLIO_PROPOSAL_USER_PROMPT).toContain(ph);
    }
  });
});
