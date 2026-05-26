import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => {
  const create = vi.fn();
  class Anthropic {
    messages = { create };
    constructor() {}
  }
  return { default: Anthropic, __create: create };
});

vi.mock('@/lib/cost/cost-logger', () => ({
  insertCostLog: vi.fn().mockResolvedValue({ id: 'log-1' }),
}));

describe('callFullReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  it('ANTHROPIC_API_KEY 없으면 ai_key_unavailable throw', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { callFullReport } = await import('@/lib/ai/full-report-client');
    await expect(
      callFullReport({
        ticker: '196170',
        month: '2026-06',
        systemPrompt: 'S',
        userPrompt: 'U',
        adminUserId: 'u1',
      }),
    ).rejects.toThrow('ai_key_unavailable');
  });

  it('Anthropic SDK 호출 + cost_log insert + content/usage/costKrw 반환', async () => {
    const sdk = await import('@anthropic-ai/sdk');
    const create = (sdk as unknown as { __create: ReturnType<typeof vi.fn> }).__create;
    create.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"section_0":{}}' }],
      usage: { input_tokens: 1500, output_tokens: 4500 },
    });
    const { insertCostLog } = await import('@/lib/cost/cost-logger');
    const { callFullReport } = await import('@/lib/ai/full-report-client');
    const result = await callFullReport({
      ticker: '196170',
      month: '2026-06',
      systemPrompt: 'S',
      userPrompt: 'U',
      adminUserId: 'u1',
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-opus-4-7', max_tokens: 8192 }),
    );
    expect(result.content).toBe('{"section_0":{}}');
    expect(result.usage.input_tokens).toBe(1500);
    expect(result.usage.output_tokens).toBe(4500);
    expect(result.costKrw).toBeGreaterThan(0);
    expect(insertCostLog).toHaveBeenCalledWith(
      expect.objectContaining({
        ticker: '196170',
        month: '2026-06',
        persona_id: 'full_report_writer',
        prompt_version: 'v1',
        called_by: 'u1',
      }),
      { client: undefined },
    );
  });

  // P0 #4 fix: ai_call_failed가 아닌 full_report_llm_failed throw (format-error 매핑 정합).
  it('Anthropic SDK throw 시 full_report_llm_failed throw (insertCostLog 미호출)', async () => {
    const sdk = await import('@anthropic-ai/sdk');
    const create = (sdk as unknown as { __create: ReturnType<typeof vi.fn> }).__create;
    create.mockRejectedValueOnce(new Error('429 rate limit'));
    const { insertCostLog } = await import('@/lib/cost/cost-logger');
    const { callFullReport } = await import('@/lib/ai/full-report-client');
    await expect(
      callFullReport({
        ticker: '196170',
        month: '2026-06',
        systemPrompt: 'S',
        userPrompt: 'U',
        adminUserId: 'u1',
      }),
    ).rejects.toThrow('full_report_llm_failed');
    expect(insertCostLog).not.toHaveBeenCalled();
  });
});
