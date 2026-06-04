// W1b (D3) — dual-judge 경계 산정 + 결정론 불일치 판정.
import { describe, it, expect } from 'vitest';
import {
  computeDualJudgeBoundary,
  isDualJudgeDisagreement,
} from '../judge-stage';
import type { JudgeVerdict } from '@/lib/ai/judge-client';
import type { Timeframe } from '../tier1-schema';

function verdict(
  scores: Record<Timeframe, number>,
  winning: Timeframe = 'short',
): JudgeVerdict {
  return { scores, winning_timeframe: winning, rationale_kr: '', conviction: 60 };
}

// short 트랙 60 ticker: J000(100) ~ J059(41)
function shortJudgeScores(): Map<string, Record<Timeframe, number>> {
  const m = new Map<string, Record<Timeframe, number>>();
  for (let i = 0; i < 60; i++) {
    m.set(`J${String(i).padStart(3, '0')}`, { short: 100 - i, mid: 0, long: 0 });
  }
  return m;
}

describe('computeDualJudgeBoundary', () => {
  it('short: judge 점수 rank 9..12 (±2 — top10.5 기준), 동점 ticker asc', () => {
    const boundary = computeDualJudgeBoundary(shortJudgeScores(), 'short');
    expect(boundary).toEqual(['J008', 'J009', 'J010', 'J011']); // rank 9,10,11,12
  });

  it('midlong: mid/long 각 bucket rank 9..12 합집합 (≤8) + dedupe', () => {
    const m = new Map<string, Record<Timeframe, number>>();
    for (let i = 0; i < 60; i++) {
      m.set(`M${String(i).padStart(3, '0')}`, { short: 0, mid: 100 - i, long: 0 });
    }
    for (let i = 0; i < 60; i++) {
      m.set(`L${String(i).padStart(3, '0')}`, { short: 0, mid: 0, long: 100 - i });
    }
    const boundary = computeDualJudgeBoundary(m, 'midlong');
    expect(boundary.length).toBeLessThanOrEqual(8);
    expect(boundary).toContain('M008'); // mid rank 9
    expect(boundary).toContain('L008'); // long rank 9
  });

  it('pool < 12: rank 범위 교집합 안전 (throw 없음)', () => {
    const m = new Map(
      [...shortJudgeScores().entries()].slice(0, 10),
    );
    const boundary = computeDualJudgeBoundary(m, 'short');
    expect(boundary).toEqual(['J008', 'J009']); // rank 9,10만 존재
  });

  it('빈 입력 → []', () => {
    expect(computeDualJudgeBoundary(new Map(), 'short')).toEqual([]);
  });
});

describe('isDualJudgeDisagreement', () => {
  const opus = verdict({ short: 70, mid: 50, long: 40 }, 'short');

  it('winning_timeframe 상이 → true', () => {
    const gpt = verdict({ short: 70, mid: 50, long: 40 }, 'mid');
    expect(isDualJudgeDisagreement(opus, gpt)).toBe(true);
  });

  it('argmax-tf(short) 점수 차 > 15 → true / ≤ 15 → false', () => {
    expect(isDualJudgeDisagreement(opus, verdict({ short: 54, mid: 50, long: 40 }, 'short'))).toBe(true); // |70-54|=16
    expect(isDualJudgeDisagreement(opus, verdict({ short: 55, mid: 50, long: 40 }, 'short'))).toBe(false); // 15
  });
});
