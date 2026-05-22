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
} from '../report-section-schemas';

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
