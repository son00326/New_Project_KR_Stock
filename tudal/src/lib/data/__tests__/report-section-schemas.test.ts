import { describe, it, expect } from 'vitest';
import {
  reportSection0Schema,
  reportSection1Schema,
  reportSection2Schema,
  reportSection3Schema,
  reportSection4Schema,
  reportSection5Schema,
  reportSection6Schema,
  reportSection7Schema,
  reportAppendixSchema,
  parseSectionSafe,
  parseReportSection8,
} from '../report-section-schemas';
import {
  section8HappyExample,
  section8BScopeExample,
} from '@/lib/report/section-8-schema';

describe('reportSection0Schema', () => {
  it('accepts a valid section 0', () => {
    const valid = {
      headline: '투자 요약',
      thesis: ['논제 1', '논제 2'],
      conviction: 75,
      committeeMini: {
        core: { approve: 7, reject: 2, abstain: 2 },
        sector: { approve: 8, reject: 4, abstain: 2 },
      },
      priceBands: { bear: '5만원', base: '7만원', bull: '9만원' },
    };
    expect(reportSection0Schema.safeParse(valid).success).toBe(true);
  });

  it('rejects missing conviction', () => {
    const invalid = {
      headline: 'h',
      thesis: [],
      committeeMini: {
        core: { approve: 0, reject: 0, abstain: 0 },
        sector: { approve: 0, reject: 0, abstain: 0 },
      },
      priceBands: { bear: '', base: '', bull: '' },
    };
    expect(reportSection0Schema.safeParse(invalid).success).toBe(false);
  });

  it('rejects null', () => {
    expect(reportSection0Schema.safeParse(null).success).toBe(false);
  });
});

describe('parseSectionSafe', () => {
  it('returns parsed data on valid input', () => {
    const result = parseSectionSafe(reportSection4Schema, {
      summary: '성장성',
      drivers: ['driver 1'],
      tam: '1조원',
    });
    expect(result).toEqual({ summary: '성장성', drivers: ['driver 1'], tam: '1조원' });
  });

  it('returns null on invalid input', () => {
    expect(parseSectionSafe(reportSection4Schema, null)).toBeNull();
    expect(parseSectionSafe(reportSection4Schema, { summary: 'ok' })).toBeNull();
  });
});

describe('reportSection5Schema', () => {
  it('accepts valid severity enum', () => {
    const valid = {
      summary: '리스크',
      risks: [{ title: '특허 분쟁', severity: 'high', detail: 'detail' }],
    };
    expect(reportSection5Schema.safeParse(valid).success).toBe(true);
  });

  it('rejects severity outside enum', () => {
    const invalid = {
      summary: 's',
      risks: [{ title: 't', severity: 'critical', detail: 'd' }],
    };
    expect(reportSection5Schema.safeParse(invalid).success).toBe(false);
  });
});

describe('reportSection6Schema', () => {
  it('accepts valid signal state enum', () => {
    const valid = {
      summary: 'momentum',
      signals: [{ name: 'm5', state: 'on', note: '' }],
      axis: { trend: 70, momentum: 60, volatility: 50 },
      divergencePct: 2.5,
    };
    expect(reportSection6Schema.safeParse(valid).success).toBe(true);
  });
});

describe('reportAppendixSchema', () => {
  it('accepts valid appendix', () => {
    const valid = {
      technicals: [{ name: 'RSI', value: '55' }],
      dataSources: ['DART', 'KRX'],
    };
    expect(reportAppendixSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects when technicals not an array', () => {
    expect(reportAppendixSchema.safeParse({ technicals: 'oops', dataSources: [] }).success).toBe(false);
  });
});

describe('reportSection1Schema + reportSection2Schema + reportSection3Schema + reportSection7Schema (shape smoke)', () => {
  it('section 1: accepts valid description + segments + keyFacts', () => {
    const valid = {
      description: '기업 개요',
      segments: [{ name: '가전', share: '40%' }],
      keyFacts: [{ label: '시총', value: '500조' }],
    };
    expect(reportSection1Schema.safeParse(valid).success).toBe(true);
  });

  it('section 2: accepts valid revenue + margins + balance', () => {
    const valid = {
      summary: '재무',
      revenue: [{ fy: 'FY24', value: '100', yoy: '+5%' }],
      margins: { operating: '10%', net: '8%' },
      balance: { debtRatio: '50%', cash: '10조' },
    };
    expect(reportSection2Schema.safeParse(valid).success).toBe(true);
  });

  it('section 3: accepts valid multiples', () => {
    const valid = {
      summary: '밸류에이션',
      multiples: [{ metric: 'PER', value: '12', peer: '15' }],
    };
    expect(reportSection3Schema.safeParse(valid).success).toBe(true);
  });

  it('section 7: accepts valid triggers + alternatives', () => {
    const valid = {
      summary: 'Exit',
      triggers: ['트리거 1'],
      alternatives: [{ label: '대안 1', detail: '상세' }],
    };
    expect(reportSection7Schema.safeParse(valid).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Section 8 dual-shape detection + B2 edge-case TDD 전수 + B4 cross-check
// ---------------------------------------------------------------------------

const modernValidBScope = {
  partA: [], // B scope (length 0)
  partB: [
    { issue: '특허', pro_quote: 'p', con_quote: 'c' },
    { issue: '수수료', pro_quote: 'p', con_quote: 'c' },
    { issue: '신약', pro_quote: 'p', con_quote: 'c' },
  ],
  partC: {
    sector_aggregate: { buy: 0, hold: 0, sell: 0 },
    core_revote: { buy: 7, hold: 3, sell: 1 },
    co_chair_unanimous: false,
    verdict: 'BUY' as const,
    rationale: ['근거 1'],
  },
  partD: Array.from({ length: 11 }, (_, i) => ({
    persona_id: `core-${i}`,
    label: `Core ${i}`,
    philosophy: 'value',
    vote: 'BUY',
    one_line: 'one',
  })),
};

const legacyValid = {
  conclusion: '결론',
  recommendation: '매수',
  keyQuotes: [{ side: 'pro', quote: '근거' }],
};

describe('parseReportSection8 (dual-shape detection)', () => {
  it('detects modern shape (B scope, partA=0) and tags it', () => {
    const result = parseReportSection8(modernValidBScope);
    expect(result?.shape).toBe('modern');
    if (result?.shape === 'modern') {
      expect(result.data.partD).toHaveLength(11);
      expect(result.data.partA).toHaveLength(0);
    }
  });

  it('detects modern shape (Tier 2 active, partA=14) using section8HappyExample (B4 cross-check)', () => {
    const result = parseReportSection8(section8HappyExample);
    expect(result?.shape).toBe('modern');
    if (result?.shape === 'modern') {
      expect(result.data.partA).toHaveLength(14);
    }
  });

  it('detects modern shape using section8BScopeExample (B4 cross-check)', () => {
    const result = parseReportSection8(section8BScopeExample);
    expect(result?.shape).toBe('modern');
  });

  it('detects legacy shape and tags it', () => {
    const result = parseReportSection8(legacyValid);
    expect(result?.shape).toBe('legacy');
    if (result?.shape === 'legacy') {
      expect(result.data.conclusion).toBe('결론');
    }
  });

  it('returns null on neither shape (malformed)', () => {
    expect(parseReportSection8({ foo: 'bar' })).toBeNull();
  });

  it('returns null on null input', () => {
    expect(parseReportSection8(null)).toBeNull();
  });

  it('prefers modern over legacy when both could match', () => {
    const ambiguous = {
      ...modernValidBScope,
      conclusion: 'stray',
      recommendation: 'stray',
      keyQuotes: [],
    };
    expect(parseReportSection8(ambiguous)?.shape).toBe('modern');
  });
});

describe('Section 8 modern refinements (B2)', () => {
  it('rejects partA length 1 (must be 0 or 14)', () => {
    const invalid = {
      ...modernValidBScope,
      partA: [
        { persona_id: 'p', label: 'l', background: 'b', vote: 'BUY', one_line: 'o' },
      ],
    };
    expect(parseReportSection8(invalid)).toBeNull();
  });

  it('rejects partA length 13 (must be 0 or 14)', () => {
    const invalid = {
      ...modernValidBScope,
      partA: Array.from({ length: 13 }, (_, i) => ({
        persona_id: `s${i}`,
        label: `l${i}`,
        background: 'b',
        vote: 'BUY',
        one_line: 'o',
      })),
    };
    expect(parseReportSection8(invalid)).toBeNull();
  });

  it('rejects partB length 2 (min 3)', () => {
    const invalid = {
      ...modernValidBScope,
      partB: modernValidBScope.partB.slice(0, 2),
    };
    expect(parseReportSection8(invalid)).toBeNull();
  });

  it('accepts partB length 5 (max boundary)', () => {
    const valid = {
      ...modernValidBScope,
      partB: [
        ...modernValidBScope.partB,
        { issue: 'i4', pro_quote: 'p', con_quote: 'c' },
        { issue: 'i5', pro_quote: 'p', con_quote: 'c' },
      ],
    };
    expect(parseReportSection8(valid)?.shape).toBe('modern');
  });

  it('rejects partB length 6 (max 5)', () => {
    const invalid = {
      ...modernValidBScope,
      partB: [
        ...modernValidBScope.partB,
        { issue: 'i4', pro_quote: 'p', con_quote: 'c' },
        { issue: 'i5', pro_quote: 'p', con_quote: 'c' },
        { issue: 'i6', pro_quote: 'p', con_quote: 'c' },
      ],
    };
    expect(parseReportSection8(invalid)).toBeNull();
  });

  it('rejects partD length 10 (must be exactly 11)', () => {
    const invalid = {
      ...modernValidBScope,
      partD: modernValidBScope.partD.slice(0, 10),
    };
    expect(parseReportSection8(invalid)).toBeNull();
  });

  it('rejects partD length 12 (must be exactly 11)', () => {
    const invalid = {
      ...modernValidBScope,
      partD: [
        ...modernValidBScope.partD,
        { persona_id: 'extra', label: 'l', philosophy: 'v', vote: 'BUY', one_line: 'o' },
      ],
    };
    expect(parseReportSection8(invalid)).toBeNull();
  });

  it('rejects partC.rationale length 0 (min 1)', () => {
    const invalid = {
      ...modernValidBScope,
      partC: { ...modernValidBScope.partC, rationale: [] },
    };
    expect(parseReportSection8(invalid)).toBeNull();
  });

  it('rejects partC.rationale length 6 (max 5)', () => {
    const invalid = {
      ...modernValidBScope,
      partC: {
        ...modernValidBScope.partC,
        rationale: ['1', '2', '3', '4', '5', '6'],
      },
    };
    expect(parseReportSection8(invalid)).toBeNull();
  });

  it('rejects partD with invalid vote enum', () => {
    const invalid = {
      ...modernValidBScope,
      partD: [
        { ...modernValidBScope.partD[0], vote: 'STRONG_BUY' },
        ...modernValidBScope.partD.slice(1),
      ],
    };
    expect(parseReportSection8(invalid)).toBeNull();
  });

  it('rejects partA with invalid vote enum (Tier 2 active, partA=14, B6 정정)', () => {
    const modernValidTier2 = {
      ...modernValidBScope,
      partA: Array.from({ length: 14 }, (_, i) => ({
        persona_id: `s${i}`,
        label: `l${i}`,
        background: 'b',
        vote: 'BUY' as const,
        one_line: 'o',
      })),
    };
    const invalid = {
      ...modernValidTier2,
      partA: [
        { ...modernValidTier2.partA[0], vote: 'STRONG_BUY' },
        ...modernValidTier2.partA.slice(1),
      ],
    };
    expect(parseReportSection8(invalid)).toBeNull();
  });

  it('rejects partC.verdict outside enum', () => {
    const invalid = {
      ...modernValidBScope,
      partC: { ...modernValidBScope.partC, verdict: 'STRONG_SELL' },
    };
    expect(parseReportSection8(invalid)).toBeNull();
  });
});

describe('Section 8 legacy refinements (B2)', () => {
  it('rejects keyQuotes.side outside enum', () => {
    const invalid = {
      conclusion: 'c',
      recommendation: 'r',
      keyQuotes: [{ side: 'bullish', quote: 'q' }],
    };
    expect(parseReportSection8(invalid)).toBeNull();
  });
});
