// sharpe.test.ts — computeSharpeRatio 단위 테스트 (S4 T4.2)
import { describe, it, expect } from 'vitest';
import { computeSharpeRatio } from '../sharpe';

describe('computeSharpeRatio', () => {
  it('빈 배열 → 0', () => {
    expect(computeSharpeRatio([])).toBe(0);
  });

  it('길이 1 → 0 (표준편차 계산 불가)', () => {
    expect(computeSharpeRatio([0.01])).toBe(0);
  });

  it('표준편차 0 (모든 수익률 동일) → 0', () => {
    expect(computeSharpeRatio([0.01, 0.01, 0.01])).toBe(0);
  });

  it('양의 분산 → 연환산 샤프 지수 반환', () => {
    // 일별 수익률 평균 0.001, 분산이 있는 시계열
    const returns = [0.01, -0.005, 0.02, 0.003, -0.002];
    const result = computeSharpeRatio(returns);
    // 결과가 유한한 숫자여야 하고 0이 아님
    expect(Number.isFinite(result)).toBe(true);
    expect(result).not.toBe(0);
  });

  it('무위험 수익률 적용 — rf 높을수록 샤프 감소', () => {
    const returns = [0.01, 0.02, 0.015, 0.005, 0.01];
    const sharpeNoRf = computeSharpeRatio(returns, 0);
    const sharpeWithRf = computeSharpeRatio(returns, 0.0001);
    expect(sharpeWithRf).toBeLessThan(sharpeNoRf);
  });

  it('음의 평균 수익률 → 음수 샤프 지수', () => {
    const returns = [-0.01, -0.02, -0.015, -0.005, -0.01];
    const result = computeSharpeRatio(returns);
    expect(result).toBeLessThan(0);
  });
});
