import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  commitTickerReport,
  commitBadgeOnly,
  commitSectorReport,
  commitSectorReportCron,
  extractIssueDebates,
} from '../writer';
import { section8Schema } from '../section-8-schema';
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

// B-PARTB — extractIssueDebates (Section 8 Part B 실제 issue-extraction)
// SoT spec = docs/superpowers/specs/2026-06-25-section8-partB-issue-extraction.md (CONVERGED).
describe('extractIssueDebates (B-PARTB)', () => {
  beforeEach(() => vi.clearAllMocks());
  const CORE_IDS = [
    'warren-buffett', 'stanley-druckenmiller', 'cathie-wood', 'peter-lynch',
    'charlie-munger', 'phil-fisher', 'rakesh-jhunjhunwala', 'mohnish-pabrai',
    'michael-burry', 'nassim-taleb', 'chair',
  ];
  const CON_SENTINEL = '반대 의견 없음 (위원 의견 수렴)';
  const ZERO_SENTINEL = '평가 데이터 부족 — 위원 응답 파싱/검증 실패';

  // build a CallPersonaResult from {vote, one_line, argument}
  function mk(vote: string, one_line: string, argument = '무난한 의견'): CallPersonaResult {
    return {
      content: JSON.stringify({ vote, one_line, argument_excerpt: argument }),
      usage: { input_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 1 },
      costKrw: 0,
      promptCacheEnabled: false,
    };
  }
  // raw CallPersonaResult with arbitrary content string
  function raw(content: string): CallPersonaResult {
    return {
      content,
      usage: { input_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 1 },
      costKrw: 0,
      promptCacheEnabled: false,
    };
  }

  type Issue = ReturnType<typeof extractIssueDebates>[number];

  // invariant set assertion applied to every test output
  function assertInvariants(out: Issue[]) {
    expect(out.length).toBeGreaterThanOrEqual(3);
    expect(out.length).toBeLessThanOrEqual(5);
    // distinct issue titles
    expect(new Set(out.map((o) => o.issue)).size).toBe(out.length);
    for (const o of out) {
      for (const q of [o.pro_quote, o.con_quote, o.arbiter_quote].filter((x): x is string => typeof x === 'string')) {
        expect(q).not.toBe('');
        expect(q).not.toBe('stub');
        expect(q.includes('{')).toBe(false);
        expect(q.includes('"vote"')).toBe(false);
        expect(q.includes('"one_line"')).toBe(false);
      }
    }
    // schema-valid as partB
    expect(section8Schema.shape.partB.safeParse(out).success).toBe(true);
  }

  it('1. mixed BUY/SELL/HOLD multi-axis → ≥3 issue, pro≠con, label-in-quote, no JSON', () => {
    const results = [
      mk('BUY', '밸류 매력 충분, 저평가', '밸류에이션 관점'),       // 밸류 BUY
      mk('SELL', '고평가 부담, 밸류 비싸', '밸류에이션 우려'),      // 밸류 SELL
      mk('BUY', '실적 성장 모멘텀 강력', '매출 성장'),            // 실적 BUY
      mk('SELL', '실적 둔화, 적자 우려', '영업이익 감소'),        // 실적 SELL
      mk('HOLD', '실적 중립, 관망', '마진 혼조'),                // 실적 HOLD (arbiter)
      mk('BUY', '리스크 관리 양호, 금리 안정', '거시 우호'),      // 거시 BUY (one_line caution token '리스크')
      mk('SELL', '거시 불확실, 하방 리스크 큼', '규제 부담'),     // 거시 SELL
      mk('HOLD', '재무 안정적, 부채 적정', '현금 보유'),          // 재무 HOLD
      mk('BUY', '해자 견고, 기술력 우위', '경쟁 우위'),          // 해자 BUY
      mk('HOLD', '거버넌스 보통, 배당 무난', '주주환원 보통'),    // 거버넌스 HOLD
      mk('BUY', '신사업 혁신 기대', '신제품 파이프라인'),         // 혁신 BUY
    ];
    const out = extractIssueDebates(results, CORE_IDS);
    assertInvariants(out);
    for (const o of out) {
      expect(o.pro_quote).not.toBe(o.con_quote);
      expect(o.pro_quote.includes(': ')).toBe(true);
      expect(o.con_quote.includes(': ')).toBe(true);
    }
  });

  it('2. invariant 3..5 across multiple fixtures', () => {
    const mixed = [
      mk('BUY', '밸류 저평가'), mk('SELL', '밸류 고평가'),
      mk('BUY', '실적 성장'), mk('SELL', '실적 둔화'),
      mk('BUY', '해자 견고'), mk('HOLD', '재무 안정'),
      mk('SELL', '거시 불확실'), mk('BUY', '혁신 기대'),
      mk('HOLD', '배당 무난'), mk('BUY', '현금 풍부'), mk('SELL', '부채 부담'),
    ];
    const allBuy = Array.from({ length: 11 }, (_, i) => mk('BUY', `밸류 성장 해자 혁신 우수 ${i}`));
    const allHold = Array.from({ length: 11 }, (_, i) => mk('HOLD', `밸류 실적 재무 관망 ${i}`));
    const single = [mk('BUY', '실적 성장 양호'), ...Array.from({ length: 10 }, () => raw('garbage'))];
    for (const fx of [mixed, allBuy, allHold, single]) {
      const out = extractIssueDebates(fx, CORE_IDS);
      expect(out.length).toBeGreaterThanOrEqual(3);
      expect(out.length).toBeLessThanOrEqual(5);
    }
  });

  it('3. raw JSON leak 0 (one_line containing JSON-ish text is excluded)', () => {
    const results = [
      raw('{"vote":"SELL","one_line":"{nested}","argument_excerpt":"x"}'),
      mk('BUY', '밸류 저평가'), mk('SELL', '실적 둔화'), mk('BUY', '해자 견고'),
      mk('HOLD', '재무 안정'), mk('SELL', '거시 불확실'), mk('BUY', '혁신 기대'),
      mk('HOLD', '배당 무난'), mk('BUY', '현금 풍부'), mk('SELL', '부채 부담'),
      mk('BUY', '성장 모멘텀'),
    ];
    const out = extractIssueDebates(results, CORE_IDS);
    assertInvariants(out);
    for (const o of out) {
      expect(o.pro_quote.includes('{')).toBe(false);
      expect(o.con_quote.includes('{')).toBe(false);
      expect(o.pro_quote.includes('"vote"')).toBe(false);
      expect(o.con_quote.includes('"vote"')).toBe(false);
    }
  });

  it('4. stub/empty 0 (all-BUY)', () => {
    const out = extractIssueDebates(
      Array.from({ length: 11 }, (_, i) => mk('BUY', `밸류 실적 해자 혁신 우수 ${i}`)),
      CORE_IDS,
    );
    assertInvariants(out);
    for (const o of out) {
      expect(o.pro_quote).not.toBe('stub');
      expect(o.con_quote).not.toBe('stub');
      expect(o.pro_quote).not.toBe('');
      expect(o.con_quote).not.toBe('');
    }
  });

  it('5. parse-failed persona excluded; raw string never in a quote', () => {
    const results = [
      mk('BUY', '밸류 저평가'), mk('SELL', '실적 둔화'), mk('BUY', '해자 견고'),
      raw('not-json-라구하라'),
      mk('HOLD', '재무 안정'), mk('SELL', '거시 불확실'), mk('BUY', '혁신 기대'),
      mk('HOLD', '배당 무난'), mk('BUY', '현금 풍부'), mk('SELL', '부채 부담'),
      mk('BUY', '성장 모멘텀'),
    ];
    const out = extractIssueDebates(results, CORE_IDS);
    assertInvariants(out);
    for (const o of out) {
      expect(o.pro_quote.includes('not-json-라구하라')).toBe(false);
      expect(o.con_quote.includes('not-json-라구하라')).toBe(false);
    }
  });

  it('6. one-sided BUY (11 BUY) — con is sentinel or one_line-caution, never bullish-only one_line', () => {
    // exactly one persona carries a one_line caution token; others are purely bullish.
    const results = [
      mk('BUY', '실적 성장 모멘텀 강력'),
      mk('BUY', '실적 매출 증익 양호'),
      mk('BUY', '실적 수익성 흑자 견조 (다만 변동성 존재)'), // caution-in-one_line
      mk('BUY', '밸류 저평가 매력'),
      mk('BUY', '밸류 멀티플 할인'),
      mk('BUY', '해자 견고 기술력'),
      mk('BUY', '해자 점유율 우위'),
      mk('BUY', '혁신 신사업 기대'),
      mk('BUY', '혁신 파이프라인 풍부'),
      mk('BUY', '현금 재무 안정'),
      mk('BUY', '배당 주주환원 우수'),
    ];
    const out = extractIssueDebates(results, CORE_IDS);
    assertInvariants(out);
    for (const o of out) {
      // con is either sentinel, or a one_line bearing a caution token
      if (o.con_quote !== CON_SENTINEL) {
        const hasCaution = ['리스크', '우려', '다만', '그러나', '단서', '부담', '주의', '변동성', '둔화', '불확실', '하방', '약점']
          .some((kw) => o.con_quote.includes(kw));
        expect(hasCaution).toBe(true);
      }
    }
  });

  it('7. all-same-vote, no caution, multi-axis → every con === CON_SENTINEL', () => {
    const results = [
      mk('BUY', '밸류 저평가 매력적'),
      mk('BUY', '밸류 멀티플 할인 우수'),
      mk('BUY', '실적 성장 모멘텀'),
      mk('BUY', '실적 매출 증익'),
      mk('BUY', '해자 견고 기술력'),
      mk('BUY', '해자 점유율 독점'),
      mk('BUY', '혁신 신사업 풍부'),
      mk('BUY', '혁신 파이프라인 우수'),
      mk('BUY', '현금 재무 탄탄'),
      mk('BUY', '배당 주주환원 우수'),
      mk('BUY', '거버넌스 경영진 신뢰'),
    ];
    const out = extractIssueDebates(results, CORE_IDS);
    assertInvariants(out);
    for (const o of out) {
      expect(o.con_quote).toBe(CON_SENTINEL);
    }
  });

  it('8. determinism — same input twice = deep-equal', () => {
    const results = [
      mk('BUY', '밸류 저평가'), mk('SELL', '실적 둔화'), mk('BUY', '해자 견고'),
      mk('HOLD', '재무 안정'), mk('SELL', '거시 불확실'), mk('BUY', '혁신 기대'),
      mk('HOLD', '배당 무난'), mk('BUY', '현금 풍부'), mk('SELL', '부채 부담'),
      mk('BUY', '성장 모멘텀'), mk('HOLD', '밸류 중립'),
    ];
    const a = extractIssueDebates(results, CORE_IDS);
    const b = extractIssueDebates(results, CORE_IDS);
    expect(a).toEqual(b);
  });

  it('9. schema pass on representative fixtures', () => {
    const fixtures = [
      // mixed
      [mk('BUY', '밸류 저평가'), mk('SELL', '밸류 고평가'), mk('BUY', '실적 성장'), mk('SELL', '실적 둔화'),
        mk('HOLD', '재무 안정'), mk('BUY', '해자 견고'), mk('SELL', '거시 불확실'), mk('BUY', '혁신 기대'),
        mk('HOLD', '배당 무난'), mk('BUY', '현금 풍부'), mk('SELL', '부채 부담')],
      // one-sided BUY
      Array.from({ length: 11 }, (_, i) => mk('BUY', `밸류 실적 해자 우수 ${i}`)),
      // all-hold
      Array.from({ length: 11 }, (_, i) => mk('HOLD', `밸류 실적 재무 관망 ${i}`)),
      // zero-usable
      Array.from({ length: 11 }, () => raw('garbage')),
      // usable=1
      [mk('BUY', '실적 성장 양호'), ...Array.from({ length: 10 }, () => raw('x'))],
      // keyword-0
      Array.from({ length: 11 }, (_, i) => mk('BUY', `무난한 종목 ${i}`, '평범')),
    ];
    for (const fx of fixtures) {
      const out = extractIssueDebates(fx, CORE_IDS);
      expect(section8Schema.shape.partB.safeParse(out).success).toBe(true);
    }
  });

  it('10. production regression — 000500 (SELL≥, BUY=0) & 000660 (BUY≥, SELL=0)', () => {
    // 000500-shape: SELL/HOLD only, BUY=0
    const r500 = [
      mk('SELL', '밸류 고평가 부담'), mk('SELL', '실적 둔화 적자'), mk('SELL', '거시 하방 리스크'),
      mk('HOLD', '재무 보통'), mk('SELL', '해자 약화'), mk('HOLD', '배당 무난'),
      mk('SELL', '부채 차입 부담'), mk('SELL', '수익성 둔화'), mk('HOLD', '혁신 관망'),
      mk('SELL', '점유율 하락 우려'), mk('SELL', '멀티플 고평가'),
    ];
    const out500 = extractIssueDebates(r500, CORE_IDS);
    assertInvariants(out500);

    // 000660-shape: BUY/HOLD only, SELL=0
    const r660 = [
      mk('BUY', '밸류 저평가 매력'), mk('BUY', '실적 성장 모멘텀'), mk('BUY', '해자 견고 hbm'),
      mk('HOLD', '재무 안정'), mk('BUY', '혁신 신사업'), mk('HOLD', '배당 무난'),
      mk('BUY', '현금 풍부'), mk('BUY', '수익성 흑자'), mk('HOLD', '거버넌스 보통'),
      mk('BUY', '점유율 우위'), mk('BUY', '성장 가이던스 상향'),
    ];
    const out660 = extractIssueDebates(r660, CORE_IDS);
    assertInvariants(out660);
  });

  it('11. zero-usable (all 11 parse-fail) → 3 sentinel issues, no arbiter', () => {
    const out = extractIssueDebates(Array.from({ length: 11 }, () => raw('garbage')), CORE_IDS);
    expect(out.length).toBe(3);
    for (const o of out) {
      expect(o.pro_quote).toBe(ZERO_SENTINEL);
      expect(o.con_quote).toBe(ZERO_SENTINEL);
      expect(o.arbiter_quote).toBeUndefined();
    }
    expect(out.map((o) => o.issue)).toEqual(['밸류에이션', '실적·성장 모멘텀', '재무 건전성']);
    expect(section8Schema.shape.partB.safeParse(out).success).toBe(true);
  });

  it('12. usable=1 (1 valid BUY, 10 parse-fail) → 3 issue, pro=that persona, con sentinel, distinct titles', () => {
    const results = [
      mk('BUY', '실적 성장 양호'),
      ...Array.from({ length: 10 }, () => raw('garbage')),
    ];
    const out = extractIssueDebates(results, CORE_IDS);
    expect(out.length).toBeGreaterThanOrEqual(3);
    assertInvariants(out);
    const proLabel = '워런 버핏: 실적 성장 양호';
    for (const o of out) {
      expect(o.pro_quote).toBe(proLabel);
      expect(o.con_quote).toBe(CON_SENTINEL);
    }
  });

  it('13. keyword-match 0 → Tier-3 pad, first 3 catalog titles, pro = global-max-voteRank persona', () => {
    // all neutral text, no catalog keyword; persona[2] is the only BUY (others HOLD) → global pro
    const results = Array.from({ length: 11 }, (_, i) =>
      i === 2 ? mk('BUY', '평범한 종목') : mk('HOLD', '평범한 종목'),
    );
    const out = extractIssueDebates(results, CORE_IDS);
    expect(out.length).toBe(3);
    assertInvariants(out);
    expect(out.map((o) => o.issue)).toEqual(['밸류에이션', '실적·성장 모멘텀', '재무 건전성']);
    const expectedPro = '캐시 우드: 평범한 종목'; // idx 2 = cathie-wood, the lone BUY
    for (const o of out) {
      expect(o.pro_quote).toBe(expectedPro);
    }
  });

  it('14. invalid/missing/non-string one_line interleaved — no crash, excluded', () => {
    const results = [
      raw('{"vote":"NEUTRAL","one_line":"중립","argument_excerpt":"x"}'),  // invalid vote
      raw('{"vote":"BUY","argument_excerpt":"x"}'),                       // missing one_line
      raw('{"vote":"BUY","one_line":123,"argument_excerpt":"x"}'),        // non-string one_line
      raw('{"vote":"BUY","one_line":"   ","argument_excerpt":"x"}'),      // whitespace-only
      mk('BUY', '밸류 저평가'), mk('SELL', '실적 둔화'), mk('BUY', '해자 견고'),
      mk('HOLD', '재무 안정'), mk('SELL', '거시 불확실'), mk('BUY', '혁신 기대'),
      mk('HOLD', '배당 무난'),
    ];
    const out = extractIssueDebates(results, CORE_IDS);
    assertInvariants(out);
    for (const o of out) {
      expect(o.pro_quote.includes('123')).toBe(false);
      expect(o.con_quote.includes('123')).toBe(false);
      expect(o.pro_quote.includes('NEUTRAL')).toBe(false);
      expect(o.con_quote.includes('NEUTRAL')).toBe(false);
    }
  });

  it('15. raw-JSON-in-one_line → isQuoteSafe rejects → no { in output', () => {
    const results = [
      raw('{"vote":"BUY","one_line":"{\\"vote\\":\\"BUY\\"}","argument_excerpt":"x"}'),
      mk('BUY', '밸류 저평가'), mk('SELL', '실적 둔화'), mk('BUY', '해자 견고'),
      mk('HOLD', '재무 안정'), mk('SELL', '거시 불확실'), mk('BUY', '혁신 기대'),
      mk('HOLD', '배당 무난'), mk('BUY', '현금 풍부'), mk('SELL', '부채 부담'), mk('BUY', '성장 모멘텀'),
    ];
    const out = extractIssueDebates(results, CORE_IDS);
    assertInvariants(out);
    for (const o of out) {
      expect(o.pro_quote.includes('{')).toBe(false);
      expect(o.con_quote.includes('{')).toBe(false);
    }
  });

  it('16. duplicate-title fallback — all issue titles distinct', () => {
    // Tier-1 picks 실적, then Tier-2 candidates also re-map only to 실적 axis → must not reuse title
    const results = [
      mk('BUY', '실적 성장 모멘텀'), mk('SELL', '실적 둔화 적자'),
      mk('BUY', '실적 매출 증익'), mk('HOLD', '실적 마진 혼조'),
      mk('BUY', '실적 수익성 흑자'), mk('BUY', '실적 가이던스 상향'),
      mk('BUY', '실적 턴어라운드'), mk('SELL', '실적 수주 감소'),
      mk('BUY', '밸류 저평가'), mk('SELL', '밸류 고평가'),
      mk('BUY', '해자 견고'),
    ];
    const out = extractIssueDebates(results, CORE_IDS);
    assertInvariants(out);
    expect(new Set(out.map((o) => o.issue)).size).toBe(out.length);
  });

  it('17. tie determinism (equal clash & |M|) → theme-idx-ASC ordering + deep-equal', () => {
    // theme 0 (밸류) and theme 1 (실적) each: 1 BUY + 1 SELL (clash 2, |M| 2). idx-ASC → 밸류 first.
    const results = [
      mk('BUY', '밸류 저평가'),   // idx0 밸류 BUY
      mk('SELL', '밸류 고평가'),  // idx1 밸류 SELL
      mk('BUY', '실적 성장'),     // idx2 실적 BUY
      mk('SELL', '실적 둔화'),    // idx3 실적 SELL
      ...Array.from({ length: 7 }, (_, i) => raw(`garbage${i}`)),
    ];
    const a = extractIssueDebates(results, CORE_IDS);
    const b = extractIssueDebates(results, CORE_IDS);
    expect(a).toEqual(b);
    // both 밸류 and 실적 present; 밸류(idx0) precedes 실적(idx1)
    const titles = a.map((o) => o.issue);
    expect(titles.indexOf('밸류에이션')).toBeLessThan(titles.indexOf('실적·성장 모멘텀'));
  });

  it('18. non-string/missing argument_excerpt → usable (argument=\'\'), theme via one_line', () => {
    const results = [
      raw('{"vote":"BUY","one_line":"밸류 저평가 매력","argument_excerpt":null}'),
      raw('{"vote":"SELL","one_line":"밸류 고평가 부담","argument_excerpt":123}'),
      mk('BUY', '실적 성장'), mk('SELL', '실적 둔화'), mk('BUY', '해자 견고'),
      mk('HOLD', '재무 안정'), mk('SELL', '거시 불확실'), mk('BUY', '혁신 기대'),
      mk('HOLD', '배당 무난'), mk('BUY', '현금 풍부'), mk('SELL', '부채 부담'),
    ];
    const out = extractIssueDebates(results, CORE_IDS);
    assertInvariants(out);
    // 밸류 theme should appear (matched off one_line), quote uses one_line
    const valIssue = out.find((o) => o.issue === '밸류에이션');
    if (valIssue) {
      expect(valIssue.pro_quote.includes('밸류 저평가 매력')).toBe(true);
    }
  });

  it('19. caution-in-argument-only — bullish persona never used as con', () => {
    // one BUY whose argument has 리스크/다만 but one_line is purely bullish, among other BUYs.
    const results = [
      mk('BUY', '성장성 우수', '다만 리스크 존재'),  // bullish one_line, caution in argument only
      mk('BUY', '실적 매출 증익', '견조'),
      mk('BUY', '실적 수익성 흑자', '양호'),
      mk('BUY', '밸류 저평가', '매력'),
      mk('BUY', '밸류 멀티플 할인', '우수'),
      mk('BUY', '해자 견고', '기술력'),
      mk('BUY', '해자 점유율', '독점'),
      mk('BUY', '혁신 신사업', '기대'),
      mk('BUY', '혁신 파이프라인', '풍부'),
      mk('BUY', '현금 재무 안정', '탄탄'),
      mk('BUY', '배당 주주환원', '우수'),
    ];
    const out = extractIssueDebates(results, CORE_IDS);
    assertInvariants(out);
    for (const o of out) {
      // '성장성 우수' (bullish one_line) must never be a con
      expect(o.con_quote.includes('성장성 우수')).toBe(false);
      // con is sentinel or a one_line-caution persona
      if (o.con_quote !== CON_SENTINEL) {
        const hasCaution = ['리스크', '우려', '다만', '그러나', '단서', '부담', '주의', '변동성', '둔화', '불확실', '하방', '약점']
          .some((kw) => o.con_quote.includes(kw));
        expect(hasCaution).toBe(true);
      }
    }
  });

  it('20. buildSection8AndVotes integration — committed partB schema-valid, no JSON/stub/empty', async () => {
    mockRpc.mockResolvedValue({ data: { success: true, report_id: 'rpt-pb' }, error: null });
    const personaResults = [
      mk('BUY', '밸류 저평가'), mk('SELL', '밸류 고평가'), mk('BUY', '실적 성장'), mk('SELL', '실적 둔화'),
      mk('HOLD', '재무 안정'), mk('BUY', '해자 견고'), mk('SELL', '거시 불확실'), mk('BUY', '혁신 기대'),
      mk('HOLD', '배당 무난'), mk('BUY', '현금 풍부'), mk('SELL', '부채 부담'),
    ];
    await commitTickerReport({
      month: '2026-06',
      ticker: '005930',
      personaResults,
      personaIds: CORE_IDS,
      badge: '🟢',
    });
    const partB = mockRpc.mock.calls[0][1].p_section_8.partB;
    expect(partB.length).toBeGreaterThanOrEqual(3);
    expect(partB.length).toBeLessThanOrEqual(5);
    for (const b of partB) {
      for (const q of [b.pro_quote, b.con_quote]) {
        expect(q.includes('{')).toBe(false);
        expect(q).not.toBe('stub');
        expect(q).not.toBe('');
      }
    }
    expect(section8Schema.shape.partB.safeParse(partB).success).toBe(true);
  });
});

// PR-T2a — commitSectorReportCron (service-role-DI 변형, commit_sector_personas_cron + p_called_by)
describe('commitSectorReportCron (PR-T2a, cron service-role)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('options.client.rpc("commit_sector_personas_cron", { ..., p_called_by }) 호출 + 동일 payload 조립', async () => {
    const cronRpc = vi.fn().mockResolvedValue({
      data: { success: true, report_id: 'rpt-cron', sector: '반도체', votes_inserted: 14 },
      error: null,
    });
    const client = { rpc: cronRpc } as never;
    const sectorResults = Array.from({ length: SECTOR_PERSONA_COUNT }, () => happyPersonaResult);
    const sectorIds = Array.from({ length: SECTOR_PERSONA_COUNT }, (_, i) => `sector-반도체-slot-${i + 1}`);

    const result = await commitSectorReportCron(
      {
        month: '2026-06',
        ticker: '042700',
        sector: '반도체',
        sectorPersonaResults: sectorResults,
        sectorPersonaIds: sectorIds,
      },
      { client, calledBy: '39202d8b-1042-48a6-8da0-df14a52fabea' },
    );

    expect(cronRpc).toHaveBeenCalledWith(
      'commit_sector_personas_cron',
      expect.objectContaining({
        p_month: '2026-06',
        p_ticker: '042700',
        p_sector: '반도체',
        p_called_by: '39202d8b-1042-48a6-8da0-df14a52fabea',
      }),
    );
    const rpcArg = cronRpc.mock.calls[0][1];
    expect(rpcArg.p_part_a).toHaveLength(14);
    expect(rpcArg.p_votes).toHaveLength(14);
    expect(Object.keys(rpcArg.p_sector_aggregate).sort()).toEqual(['buy', 'hold', 'sell']);
    // admin createClient(commit_sector_personas)은 호출되지 않음 — cron 경로는 DI client만.
    expect(mockRpc).not.toHaveBeenCalled();
    expect(result.reportId).toBe('rpt-cron');
    expect(result.votesInserted).toBe(14);
  });

  it('RPC error → commit_sector_personas_cron_failed throw', async () => {
    const cronRpc = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST500' } });
    const client = { rpc: cronRpc } as never;
    const sectorResults = Array.from({ length: SECTOR_PERSONA_COUNT }, () => happyPersonaResult);
    const sectorIds = Array.from({ length: SECTOR_PERSONA_COUNT }, (_, i) => `sector-반도체-slot-${i + 1}`);
    await expect(
      commitSectorReportCron(
        { month: '2026-06', ticker: '042700', sector: '반도체', sectorPersonaResults: sectorResults, sectorPersonaIds: sectorIds },
        { client, calledBy: 'u' },
      ),
    ).rejects.toThrow(/commit_sector_personas_cron_failed/);
  });
});
