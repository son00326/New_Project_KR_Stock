import { describe, it, expect, vi, beforeEach } from 'vitest';
import { commitTickerReport, commitBadgeOnly } from '../writer';
import type { CallPersonaResult } from '@/lib/ai/anthropic-client';

const mockRpc = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve({ rpc: mockRpc })),
}));

const happyPersonaResult: CallPersonaResult = {
  content: '{"vote":"BUY","one_line":"강함","argument_excerpt":"근거 200자 이내"}',
  usage: { input_tokens: 100, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 50 },
  costKrw: 100,
  promptCacheEnabled: false,
};

describe('writer (Q3 + Design R4)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('section_8 jsonb generated with Part A=[] (B 범위)', async () => {
    mockRpc.mockResolvedValue({ data: { success: true, report_id: 'rpt-1' }, error: null });
    const personaResults = Array.from({ length: 11 }, () => happyPersonaResult);
    await commitTickerReport({
      month: '2026-05',
      ticker: '005930',
      personaResults,
      personaIds: ['warren-buffett', 'stanley-druckenmiller', 'cathie-wood', 'peter-lynch', 'charlie-munger', 'phil-fisher', 'rakesh-jhunjhunwala', 'mohnish-pabrai', 'michael-burry', 'nassim-taleb', 'chair'],
      badge: '🟢',
    });
    const rpcArg = mockRpc.mock.calls[0][1];
    expect(rpcArg.p_section_8.partA).toEqual([]);
    expect(rpcArg.p_section_8.partD).toHaveLength(11);
  });

  it('commit_persona_eval RPC invoked with correct payload including p_consensus_badge', async () => {
    mockRpc.mockResolvedValue({ data: { success: true, report_id: 'rpt-1' }, error: null });
    const personaResults = Array.from({ length: 11 }, () => happyPersonaResult);
    await commitTickerReport({
      month: '2026-05',
      ticker: '005930',
      personaResults,
      personaIds: ['warren-buffett', 'stanley-druckenmiller', 'cathie-wood', 'peter-lynch', 'charlie-munger', 'phil-fisher', 'rakesh-jhunjhunwala', 'mohnish-pabrai', 'michael-burry', 'nassim-taleb', 'chair'],
      badge: '🔵',
    });
    expect(mockRpc).toHaveBeenCalledWith('commit_persona_eval', expect.objectContaining({
      p_month: '2026-05',
      p_ticker: '005930',
      p_consensus_badge: '🔵',
    }));
  });

  it('RPC error throws commit_persona_eval_failed', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'auth_unavailable', code: 'P0001' } });
    const personaResults = Array.from({ length: 11 }, () => happyPersonaResult);
    await expect(commitTickerReport({
      month: '2026-05',
      ticker: '005930',
      personaResults,
      personaIds: ['warren-buffett', 'stanley-druckenmiller', 'cathie-wood', 'peter-lynch', 'charlie-munger', 'phil-fisher', 'rakesh-jhunjhunwala', 'mohnish-pabrai', 'michael-burry', 'nassim-taleb', 'chair'],
      badge: '🟣',
    })).rejects.toThrow('commit_persona_eval_failed');
  });

  it('commitBadgeOnly invokes commit_badge_only RPC with ⚪ (Plan R3 BLOCKER 7)', async () => {
    mockRpc.mockResolvedValue({ data: { success: true }, error: null });
    await commitBadgeOnly({ month: '2026-05', ticker: '005930' });
    expect(mockRpc).toHaveBeenCalledWith('commit_badge_only', {
      p_month: '2026-05',
      p_ticker: '005930',
      p_consensus_badge: '⚪',
    });
  });
});
