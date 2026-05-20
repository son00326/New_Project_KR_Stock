import { describe, it, expect, vi, beforeEach } from 'vitest';
import { commitTickerReport, commitBadgeOnly, commitSectorReport } from '../writer';
import type { CallPersonaResult } from '@/lib/ai/anthropic-client';
import { SECTOR_PERSONA_COUNT } from '@/lib/screening/canonical-sectors';

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

// Tier 2 D21 (52차) — commitSectorReport tests
// omxy R1~R3 CONVERGED + 4 acceptance details. partA partial success는 caller 책임 (degraded skip).

describe('commitSectorReport (Tier 2 D21, 52차)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('length=14 sector persona results 호출 시 commit_sector_personas RPC 호출', async () => {
    mockRpc.mockResolvedValue({
      data: { success: true, report_id: 'rpt-1', sector: '바이오', votes_inserted: 14 },
      error: null,
    });
    const sectorResults = Array.from({ length: SECTOR_PERSONA_COUNT }, () => happyPersonaResult);
    const sectorIds = Array.from({ length: SECTOR_PERSONA_COUNT }, (_, i) => `sector-바이오-slot-${i + 1}`);
    const result = await commitSectorReport({
      month: '2026-05',
      ticker: '005930',
      sector: '바이오',
      sectorPersonaResults: sectorResults,
      sectorPersonaIds: sectorIds,
    });
    expect(mockRpc).toHaveBeenCalledWith('commit_sector_personas', expect.objectContaining({
      p_month: '2026-05',
      p_ticker: '005930',
      p_sector: '바이오',
    }));
    expect(result.reportId).toBe('rpt-1');
    expect(result.votesInserted).toBe(14);
  });

  it('p_part_a length=14 (D21 박제)', async () => {
    mockRpc.mockResolvedValue({
      data: { success: true, report_id: 'rpt-2', sector: 'IT/SW', votes_inserted: 14 },
      error: null,
    });
    const sectorResults = Array.from({ length: SECTOR_PERSONA_COUNT }, () => happyPersonaResult);
    const sectorIds = Array.from({ length: SECTOR_PERSONA_COUNT }, (_, i) => `sector-IT/SW-slot-${i + 1}`);
    await commitSectorReport({
      month: '2026-05',
      ticker: '035420',
      sector: 'IT/SW',
      sectorPersonaResults: sectorResults,
      sectorPersonaIds: sectorIds,
    });
    const rpcArg = mockRpc.mock.calls[0][1];
    expect(rpcArg.p_part_a).toHaveLength(14);
    expect(rpcArg.p_votes).toHaveLength(14);
  });

  it('p_sector_aggregate exact keys {buy,hold,sell} (R3 acc#1)', async () => {
    mockRpc.mockResolvedValue({
      data: { success: true, report_id: 'rpt-3', sector: '바이오', votes_inserted: 14 },
      error: null,
    });
    const sectorResults = Array.from({ length: SECTOR_PERSONA_COUNT }, () => happyPersonaResult);
    const sectorIds = Array.from({ length: SECTOR_PERSONA_COUNT }, (_, i) => `sector-바이오-slot-${i + 1}`);
    await commitSectorReport({
      month: '2026-05',
      ticker: '005930',
      sector: '바이오',
      sectorPersonaResults: sectorResults,
      sectorPersonaIds: sectorIds,
    });
    const rpcArg = mockRpc.mock.calls[0][1];
    const keys = Object.keys(rpcArg.p_sector_aggregate).sort();
    expect(keys).toEqual(['buy', 'hold', 'sell']);
    // happyPersonaResult parses to vote=BUY → 14 BUY
    expect(rpcArg.p_sector_aggregate.buy).toBe(14);
    expect(rpcArg.p_sector_aggregate.hold).toBe(0);
    expect(rpcArg.p_sector_aggregate.sell).toBe(0);
  });

  it('votes payload persona_layer=sector (Core 11 layer=core와 분리)', async () => {
    mockRpc.mockResolvedValue({
      data: { success: true, report_id: 'rpt-4', sector: '운송/물류', votes_inserted: 14 },
      error: null,
    });
    const sectorResults = Array.from({ length: SECTOR_PERSONA_COUNT }, () => happyPersonaResult);
    const sectorIds = Array.from({ length: SECTOR_PERSONA_COUNT }, (_, i) => `sector-운송/물류-slot-${i + 1}`);
    await commitSectorReport({
      month: '2026-05',
      ticker: '009540',
      sector: '운송/물류',
      sub_tags: ['조선'],
      sectorPersonaResults: sectorResults,
      sectorPersonaIds: sectorIds,
    });
    const rpcArg = mockRpc.mock.calls[0][1];
    for (const vote of rpcArg.p_votes) {
      expect(vote.persona_layer).toBe('sector');
      expect(vote.vote).toMatch(/^(BUY|HOLD|SELL)$/);
    }
  });

  it('sub_tags overlay slot 13·14 활성화 시 background sub_tag tag 포함', async () => {
    mockRpc.mockResolvedValue({
      data: { success: true, report_id: 'rpt-5', sector: '운송/물류', votes_inserted: 14 },
      error: null,
    });
    const sectorResults = Array.from({ length: SECTOR_PERSONA_COUNT }, () => happyPersonaResult);
    const sectorIds = Array.from({ length: SECTOR_PERSONA_COUNT }, (_, i) => `sector-운송/물류-slot-${i + 1}`);
    await commitSectorReport({
      month: '2026-05',
      ticker: '009540',
      sector: '운송/물류',
      sub_tags: ['조선'],
      sectorPersonaResults: sectorResults,
      sectorPersonaIds: sectorIds,
    });
    const rpcArg = mockRpc.mock.calls[0][1];
    // slot 13·14 (index 12·13)는 sub_tag overlay
    expect(rpcArg.p_part_a[12].background).toContain('sub_tag: 조선');
    expect(rpcArg.p_part_a[13].background).toContain('sub_tag: 조선');
  });

  it('length mismatch (13 results) throws sector_writer_persona_count_mismatch', async () => {
    const sectorResults = Array.from({ length: 13 }, () => happyPersonaResult);
    const sectorIds = Array.from({ length: 13 }, (_, i) => `sector-바이오-slot-${i + 1}`);
    await expect(commitSectorReport({
      month: '2026-05',
      ticker: '005930',
      sector: '바이오',
      sectorPersonaResults: sectorResults,
      sectorPersonaIds: sectorIds,
    })).rejects.toThrow('sector_writer_persona_count_mismatch');
  });

  it('RPC error throws commit_sector_personas_failed', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'core_report_missing', code: 'P0001' },
    });
    const sectorResults = Array.from({ length: SECTOR_PERSONA_COUNT }, () => happyPersonaResult);
    const sectorIds = Array.from({ length: SECTOR_PERSONA_COUNT }, (_, i) => `sector-바이오-slot-${i + 1}`);
    await expect(commitSectorReport({
      month: '2026-05',
      ticker: '005930',
      sector: '바이오',
      sectorPersonaResults: sectorResults,
      sectorPersonaIds: sectorIds,
    })).rejects.toThrow('commit_sector_personas_failed');
  });

  // omxy final R1 B-final-3 hotfix: strict parser — malformed content RPC 호출 차단
  it('JSON parse 실패 시 sector_writer_invalid_persona_content + RPC not called (B-final-3)', async () => {
    const sectorIds = Array.from({ length: SECTOR_PERSONA_COUNT }, (_, i) => `sector-바이오-slot-${i + 1}`);
    const results = Array.from({ length: SECTOR_PERSONA_COUNT }, () => happyPersonaResult);
    // slot 5 만 malformed
    results[4] = { ...happyPersonaResult, content: 'not-json' };
    await expect(
      commitSectorReport({
        month: '2026-05',
        ticker: '005930',
        sector: '바이오',
        sectorPersonaResults: results,
        sectorPersonaIds: sectorIds,
      }),
    ).rejects.toThrow('sector_writer_invalid_persona_content');
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('vote enum 불일치 시 sector_writer_invalid_persona_content (B-final-3)', async () => {
    const sectorIds = Array.from({ length: SECTOR_PERSONA_COUNT }, (_, i) => `sector-바이오-slot-${i + 1}`);
    const results = Array.from({ length: SECTOR_PERSONA_COUNT }, () => happyPersonaResult);
    results[0] = {
      ...happyPersonaResult,
      content: '{"vote":"NEUTRAL","one_line":"x","argument_excerpt":"x"}',
    };
    await expect(
      commitSectorReport({
        month: '2026-05',
        ticker: '005930',
        sector: '바이오',
        sectorPersonaResults: results,
        sectorPersonaIds: sectorIds,
      }),
    ).rejects.toThrow('sector_writer_invalid_persona_content:invalid_vote');
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('필수 필드 누락 (one_line=empty) 시 sector_writer_invalid_persona_content (B-final-3)', async () => {
    const sectorIds = Array.from({ length: SECTOR_PERSONA_COUNT }, (_, i) => `sector-바이오-slot-${i + 1}`);
    const results = Array.from({ length: SECTOR_PERSONA_COUNT }, () => happyPersonaResult);
    results[3] = {
      ...happyPersonaResult,
      content: '{"vote":"BUY","one_line":"","argument_excerpt":"x"}',
    };
    await expect(
      commitSectorReport({
        month: '2026-05',
        ticker: '005930',
        sector: '바이오',
        sectorPersonaResults: results,
        sectorPersonaIds: sectorIds,
      }),
    ).rejects.toThrow('sector_writer_invalid_persona_content:invalid_one_line');
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
