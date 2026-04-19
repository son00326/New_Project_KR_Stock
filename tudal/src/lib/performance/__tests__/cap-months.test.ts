// cap-months.test.ts — computeCapMonths 단위 테스트 (S4 T4.2)
import { describe, it, expect } from 'vitest';
import { computeCapMonths, CAP_MONTHS_TARGET } from '../cap-months';

describe('computeCapMonths', () => {
  it('빈 배열 → currentStreak: 0', () => {
    const result = computeCapMonths([]);
    expect(result.currentStreak).toBe(0);
    expect(result.target).toBe(CAP_MONTHS_TARGET);
  });

  it('○ 없음 → currentStreak: 0', () => {
    const result = computeCapMonths(['△', '✕', '△']);
    expect(result.currentStreak).toBe(0);
  });

  it('말미 연속 ○ 3개', () => {
    const result = computeCapMonths(['✕', '△', '○', '○', '○']);
    expect(result.currentStreak).toBe(3);
  });

  it('중간에 끊김 — 말미 연속만 카운트', () => {
    // 앞쪽 ○ 3개 있어도 △로 끊기면 리셋, 말미 ○ 2개만 카운트
    const result = computeCapMonths(['○', '○', '○', '△', '○', '○']);
    expect(result.currentStreak).toBe(2);
  });

  it('전체 ○ — 전체 길이가 streak', () => {
    const result = computeCapMonths(['○', '○', '○', '○']);
    expect(result.currentStreak).toBe(4);
  });

  it('target은 항상 CAP_MONTHS_TARGET(12)', () => {
    const result = computeCapMonths(['○', '○']);
    expect(result.target).toBe(12);
  });
});
