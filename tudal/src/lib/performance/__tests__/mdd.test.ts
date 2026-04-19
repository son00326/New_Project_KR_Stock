// mdd.test.ts — computeMaxDrawdown 단위 테스트 (S4 T4.2)
import { describe, it, expect } from 'vitest';
import { computeMaxDrawdown } from '../mdd';

describe('computeMaxDrawdown', () => {
  it('빈 배열 → 0', () => {
    expect(computeMaxDrawdown([])).toBe(0);
  });

  it('길이 1 → 0', () => {
    expect(computeMaxDrawdown([100])).toBe(0);
  });

  it('우상향만 → 0 (낙폭 없음)', () => {
    expect(computeMaxDrawdown([100, 105, 110, 120])).toBe(0);
  });

  it('낙폭 발생 → 음수 소수점 반환', () => {
    // 100 → 105 → 98: peak=105, drawdown=(98-105)/105 ≈ -0.0667
    const result = computeMaxDrawdown([100, 105, 98]);
    expect(result).toBeLessThan(0);
    expect(result).toBeCloseTo(-0.0667, 3);
  });

  it('여러 낙폭 중 최대 낙폭 선택', () => {
    // peak=105 at idx=1, valley=90 at idx=5 → dd=(90-105)/105 ≈ -0.1429
    const result = computeMaxDrawdown([100, 105, 103, 98, 102, 90]);
    expect(result).toBeCloseTo(-0.1429, 3);
  });

  it('낙폭 후 회복해도 최저점 기준 MDD 유지', () => {
    const result = computeMaxDrawdown([100, 80, 120]);
    // peak=100 → valley=80 → dd=(80-100)/100 = -0.20
    expect(result).toBeCloseTo(-0.2, 5);
  });
});
