// judge.test.ts — judgeDecisionTree 단위 테스트 (S4 T4.2)
import { describe, it, expect } from 'vitest';
import {
  judgeDecisionTree,
  ALPHA_THRESHOLD,
  SHARPE_THRESHOLD,
  MDD_THRESHOLD,
} from '../judge';

describe('judgeDecisionTree', () => {
  it('3/3 통과 → ○', () => {
    const result = judgeDecisionTree({ alpha: 0.05, sharpe: 1.2, mdd: -0.08 });
    expect(result.overall).toBe('○');
    expect(result.breakdown.alpha).toBe(true);
    expect(result.breakdown.sharpe).toBe(true);
    expect(result.breakdown.mdd).toBe(true);
  });

  it('2/3 통과 (alpha fail) → △', () => {
    const result = judgeDecisionTree({ alpha: -0.01, sharpe: 0.8, mdd: -0.10 });
    expect(result.overall).toBe('△');
    expect(result.breakdown.alpha).toBe(false);
    expect(result.breakdown.sharpe).toBe(true);
    expect(result.breakdown.mdd).toBe(true);
  });

  it('1/3 통과 (sharpe·mdd fail) → ✕', () => {
    const result = judgeDecisionTree({ alpha: 0.05, sharpe: 0.3, mdd: -0.20 });
    expect(result.overall).toBe('✕');
    expect(result.breakdown.alpha).toBe(true);
    expect(result.breakdown.sharpe).toBe(false);
    expect(result.breakdown.mdd).toBe(false);
  });

  it('0/3 통과 → ✕', () => {
    const result = judgeDecisionTree({ alpha: -0.05, sharpe: 0.2, mdd: -0.30 });
    expect(result.overall).toBe('✕');
    expect(result.breakdown.alpha).toBe(false);
    expect(result.breakdown.sharpe).toBe(false);
    expect(result.breakdown.mdd).toBe(false);
  });

  it('경계값 — 임계값 정확히 equal은 통과 (>=)', () => {
    const result = judgeDecisionTree({
      alpha: ALPHA_THRESHOLD,
      sharpe: SHARPE_THRESHOLD,
      mdd: MDD_THRESHOLD,
    });
    expect(result.overall).toBe('○');
    expect(result.breakdown.alpha).toBe(true);
    expect(result.breakdown.sharpe).toBe(true);
    expect(result.breakdown.mdd).toBe(true);
  });

  it('경계값 바로 아래 — 모두 실패 → ✕', () => {
    const result = judgeDecisionTree({
      alpha: ALPHA_THRESHOLD - 0.001,
      sharpe: SHARPE_THRESHOLD - 0.001,
      mdd: MDD_THRESHOLD - 0.001,
    });
    expect(result.overall).toBe('✕');
  });

  it('2/3 통과 (mdd fail) → △', () => {
    const result = judgeDecisionTree({ alpha: 0.05, sharpe: 0.8, mdd: -0.20 });
    expect(result.overall).toBe('△');
    expect(result.breakdown.mdd).toBe(false);
  });
});
