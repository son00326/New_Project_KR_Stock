// tudal/src/lib/screening/__tests__/consensus.test.ts
import { describe, it, expect } from 'vitest';
import { assignBadge, isTopTier, TOP_PERCENTILE_THRESHOLD } from '../consensus';

describe('consensus (Q5 + Q5b)', () => {
  describe('isTopTier (Q5)', () => {
    it('total=10 rank=3 returns true (ceil(10*0.3)=3)', () => {
      expect(isTopTier(3, 10)).toBe(true);
    });
    it('total=10 rank=4 returns false', () => {
      expect(isTopTier(4, 10)).toBe(false);
    });
    it('total=10 rank=1 returns true', () => {
      expect(isTopTier(1, 10)).toBe(true);
    });
    it('invalid rank=0 throws consensus_rank_invalid', () => {
      expect(() => isTopTier(0, 10)).toThrow('consensus_rank_invalid');
    });
    it('invalid rank>total throws', () => {
      expect(() => isTopTier(11, 10)).toThrow('consensus_rank_invalid');
    });
  });

  describe('assignBadge (Q5b 5종)', () => {
    it('tier1Available=false → ⚪ regardless of ranks', () => {
      expect(assignBadge({ tier1Available: false, tier0IsTop: true, tier1IsTop: true })).toBe('⚪');
    });
    it('top + top + avail → 🟢', () => {
      expect(assignBadge({ tier1Available: true, tier0IsTop: true, tier1IsTop: true })).toBe('🟢');
    });
    it('top + non-top + avail → 🔵', () => {
      expect(assignBadge({ tier1Available: true, tier0IsTop: true, tier1IsTop: false })).toBe('🔵');
    });
    it('non-top + top + avail → 🟣', () => {
      expect(assignBadge({ tier1Available: true, tier0IsTop: false, tier1IsTop: true })).toBe('🟣');
    });
    it('non-top + non-top + avail → 🟡 관망 (Q5b 신규)', () => {
      expect(assignBadge({ tier1Available: true, tier0IsTop: false, tier1IsTop: false })).toBe('🟡');
    });
  });

  it('TOP_PERCENTILE_THRESHOLD = 0.30 (D19 SoT)', () => {
    expect(TOP_PERCENTILE_THRESHOLD).toBe(0.30);
  });
});
