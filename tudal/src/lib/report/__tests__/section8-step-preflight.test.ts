import { describe, expect, it, vi, beforeEach } from 'vitest';

const callPersonaMock = vi.fn();
const preflightHardcapMock = vi.fn();
const fetchFinancialsSummaryMock = vi.fn();
const commitTickerReportCronMock = vi.fn();
const getRoleWorstCaseMaxCostPerCallKrwMock = vi.fn();

vi.mock('@/lib/ai/anthropic-client', () => ({
  callPersona: (...args: unknown[]) => callPersonaMock(...args),
}));

vi.mock('@/lib/cost/cost-logger', () => ({
  preflightHardcap: (...args: unknown[]) => preflightHardcapMock(...args),
}));

vi.mock('@/lib/data/dart-financials', () => ({
  fetchFinancialsSummary: (...args: unknown[]) => fetchFinancialsSummaryMock(...args),
}));

vi.mock('@/lib/report/writer', () => ({
  commitTickerReportCron: (...args: unknown[]) => commitTickerReportCronMock(...args),
}));

vi.mock('@/lib/ai/model-registry', () => ({
  getRoleWorstCaseMaxCostPerCallKrw: (...args: unknown[]) =>
    getRoleWorstCaseMaxCostPerCallKrwMock(...args),
}));

import { CORE_11_PERSONAS } from '@/lib/ai/prompts/personas';
import { commitSection8Step } from '../section8-step';

describe('commitSection8Step B7 preflight reservation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRoleWorstCaseMaxCostPerCallKrwMock.mockReturnValue(123);
    preflightHardcapMock.mockResolvedValue({ currentTotal: 0, reservation: 0, remaining: 500000 });
    fetchFinancialsSummaryMock.mockResolvedValue('financials');
    callPersonaMock.mockResolvedValue({
      content: JSON.stringify({ vote: 'HOLD', one_line: '중립', argument_excerpt: '근거' }),
      usage: {
        input_tokens: 1,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        output_tokens: 1,
      },
      costKrw: 1,
      promptCacheEnabled: false,
    });
    commitTickerReportCronMock.mockResolvedValue({ reportId: 'report-1', votesInserted: 11 });
  });

  it('uses tier1_panel worst-case line with service-role cost path', async () => {
    const client = { rpc: vi.fn(), from: vi.fn() } as never;

    const result = await commitSection8Step({
      ticker: '005930',
      month: '2026-05',
      badge: '🟢',
      adminUserId: '39202d8b-1042-48a6-8da0-df14a52fabea',
      client,
    });

    expect(result.status).toBe('committed');
    expect(getRoleWorstCaseMaxCostPerCallKrwMock).toHaveBeenCalledWith('tier1_panel');
    expect(preflightHardcapMock).toHaveBeenCalledWith(
      {
        month: '2026-05',
        lines: [{ callCount: CORE_11_PERSONAS.length, maxCostPerCallKrw: 123 }],
      },
      { client, callerKind: 'service-role' },
    );
    expect(callPersonaMock).toHaveBeenCalledTimes(CORE_11_PERSONAS.length);
  });
});
