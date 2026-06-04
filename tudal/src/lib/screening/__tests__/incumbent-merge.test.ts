import { describe, it, expect } from 'vitest';
import {
  mergeFreshWithIncumbents,
  type IncumbentInfo,
} from '../incumbent-merge';
import type { Tier1Candidate } from '../persona-eval';

function freshCandidate(ticker: string, bucket: 'short' | 'mid' | 'long'): Tier1Candidate {
  return {
    ticker,
    sector: '반도체',
    tier0_buckets: { short: bucket === 'short', mid: bucket === 'mid', long: bucket === 'long' },
    tier0_scores: {
      short: bucket === 'short' ? 80 : null,
      mid: bucket === 'mid' ? 80 : null,
      long: bucket === 'long' ? 80 : null,
    },
  };
}
function incumbent(
  ticker: string,
  bucket: 'short' | 'mid' | 'long',
  sector: string | null = '반도체',
): IncumbentInfo {
  return {
    ticker,
    bucket,
    rank: 1,
    month: '2026-06-01',
    sector,
    name: `종목${ticker}`,
    aiCommentKr: '직전 논거',
    consensusBadge: '🟢',
    aiScore: 78.2,
    conviction: 71,
    deltaStatus: 'new',
    compositeScore: 72.5,
    signalLabel: '기존 신호',
  };
}

describe('mergeFreshWithIncumbents', () => {
  it('incumbent-only ticker는 tier0_scores 전부 null + 직전 bucket true로 합성 추가', () => {
    const fresh = [freshCandidate('000001', 'short')];
    const merged = mergeFreshWithIncumbents(fresh, [incumbent('999999', 'short')]);
    expect(merged).toHaveLength(2);
    const synth = merged.find((c) => c.ticker === '999999')!;
    expect(synth.tier0_buckets).toEqual({ short: true, mid: false, long: false });
    expect(synth.tier0_scores).toEqual({ short: null, mid: null, long: null });
    expect(synth.sector).toBe('반도체');
  });
  it('fresh와 겹치는 incumbent는 fresh row 유지 (dedupe, tier0 score 보존)', () => {
    const fresh = [freshCandidate('000001', 'short')];
    const merged = mergeFreshWithIncumbents(fresh, [incumbent('000001', 'short')]);
    expect(merged).toHaveLength(1);
    expect(merged[0].tier0_scores.short).toBe(80);
  });
  it('비-canonical sector incumbent는 sector null로 합성', () => {
    const merged = mergeFreshWithIncumbents([], [incumbent('999999', 'mid', '미분류')]);
    expect(merged[0].sector).toBeNull();
  });
  it('incumbent 내부 중복 ticker는 1회만 합성 (방어적 dedupe)', () => {
    const merged = mergeFreshWithIncumbents(
      [],
      [incumbent('999999', 'long'), incumbent('999999', 'long')],
    );
    expect(merged).toHaveLength(1);
  });
  it('순서 결정성: fresh 전체 → incumbent-only (입력 순서 보존)', () => {
    const merged = mergeFreshWithIncumbents(
      [freshCandidate('000001', 'short'), freshCandidate('000002', 'short')],
      [incumbent('999998', 'short'), incumbent('999999', 'short')],
    );
    expect(merged.map((c) => c.ticker)).toEqual(['000001', '000002', '999998', '999999']);
  });
});
