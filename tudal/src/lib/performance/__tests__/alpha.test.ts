// alpha.test.ts — computeAlpha 단위 테스트 (S4 T4.2)
import { describe, it, expect } from 'vitest';
import { computeAlpha } from '../alpha';

describe('computeAlpha', () => {
  it('양의 알파 — 포트폴리오가 벤치마크 초과', () => {
    expect(computeAlpha(0.15, 0.10)).toBeCloseTo(0.05, 10);
  });

  it('음의 알파 — 포트폴리오가 벤치마크 미달', () => {
    expect(computeAlpha(0.05, 0.10)).toBeCloseTo(-0.05, 10);
  });

  it('알파 0 — 포트폴리오와 벤치마크 동일', () => {
    expect(computeAlpha(0.10, 0.10)).toBe(0);
  });

  it('둘 다 음수 수익률 — 차이를 올바르게 반환', () => {
    expect(computeAlpha(-0.05, -0.10)).toBeCloseTo(0.05, 10);
  });
});
