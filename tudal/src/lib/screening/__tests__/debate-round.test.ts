// W1a (D3/D6) — computeR2Targets(경계 ±5 ∪ 분산 상위 20%) + pickFinalPanels 결정론 유닛테스트.
import { describe, it, expect } from 'vitest';
import { computeR2Targets, pickFinalPanels, type R1PanelRow } from '../debate-round';
import type { PersonaScore } from '../tier1-schema';
import { CORE_11_PERSONAS } from '@/lib/ai/prompts/personas';

const CORE_IDS = CORE_11_PERSONAS.map((p) => p.id);

// 균일 패널: 11명 전원이 같은 점수 (분산 0).
function uniformPanel(score: number): PersonaScore[] {
  return CORE_IDS.map((pid) => ({
    persona_id: pid,
    scores: { short: score, mid: score, long: score },
    winning_timeframe: 'short' as const,
    rationale_kr: '',
    conviction: 50,
  }));
}

// 고분산 패널: 절반 high/절반 low (평균은 mid 부근, 분산 큼).
function splitPanel(high: number, low: number): PersonaScore[] {
  return CORE_IDS.map((pid, i) => {
    const s = i % 2 === 0 ? high : low;
    return {
      persona_id: pid,
      scores: { short: s, mid: s, long: s },
      winning_timeframe: 'short' as const,
      rationale_kr: '',
      conviction: 50,
    };
  });
}

// 50 fresh short pool: ticker T000(점수 100) ~ T049(점수 51) — 균일 분산 0.
function shortPool(): R1PanelRow[] {
  return Array.from({ length: 50 }, (_, i) => ({
    ticker: `T${String(i).padStart(3, '0')}`,
    panel: uniformPanel(100 - i),
  }));
}

describe('computeR2Targets', () => {
  it('경계 ±5: short 트랙 rank 6..15만 (균일 분산 0이면 분산 기여는 동률 tie-break 결정론)', () => {
    const targets = computeR2Targets(shortPool(), 'short');
    // boundary 6..15 = T005..T014 (rank = idx+1).
    for (const t of ['T005', 'T009', 'T014']) expect(targets).toContain(t);
    expect(targets).not.toContain('T000'); // rank 1 — 경계 밖 + 분산 0
    expect(targets).not.toContain('T020'); // rank 21
    // 분산 전부 0(전원 동의) → 분산 기여 0 (v>0 필터) — 경계 10명만.
    expect(targets).toHaveLength(10);
    // 결정론: 두 번 호출 동일
    expect(computeR2Targets(shortPool(), 'short')).toEqual(targets);
  });

  it('분산 상위 20%: 고분산 ticker는 경계 밖 rank여도 포함', () => {
    const pool = shortPool();
    // T049(rank 50, 경계 밖)를 고분산으로 교체 — 평균 낮아 rank 최하위 유지.
    pool[49] = { ticker: 'T049', panel: splitPanel(60, 2) };
    const targets = computeR2Targets(pool, 'short');
    expect(targets).toContain('T049');
  });

  it('degraded(panel null) 제외 + ticker asc 정렬 + dedupe', () => {
    const pool = shortPool();
    pool[7] = { ticker: 'T007', panel: null }; // rank 경계권이지만 degraded
    const targets = computeR2Targets(pool, 'short');
    expect(targets).not.toContain('T007');
    expect([...targets]).toEqual([...targets].sort());
    expect(new Set(targets).size).toBe(targets.length);
  });

  it('midlong: mid/long 각 tf 경계 합집합', () => {
    // 100 pool: 앞 50은 mid 강세, 뒤 50은 long 강세 (각 tf rank 6..15 다른 ticker 집합)
    const pool: R1PanelRow[] = Array.from({ length: 100 }, (_, i) => {
      const midScore = i < 50 ? 100 - i : 10;
      const longScore = i >= 50 ? 100 - (i - 50) : 10;
      return {
        ticker: `M${String(i).padStart(3, '0')}`,
        panel: CORE_IDS.map((pid) => ({
          persona_id: pid,
          scores: { short: 0, mid: midScore, long: longScore },
          winning_timeframe: 'mid' as const,
          rationale_kr: '',
          conviction: 50,
        })),
      };
    });
    const targets = computeR2Targets(pool, 'midlong');
    expect(targets).toContain('M005'); // mid rank 6
    expect(targets).toContain('M055'); // long rank 6
  });

  it('pool 12 (<10+5): rank 범위 교집합으로 안전 (throw 없음)', () => {
    const pool = shortPool().slice(0, 12);
    const targets = computeR2Targets(pool, 'short');
    // rank 6..12만 경계 (13~15 부재) — 안전 동작
    expect(targets.length).toBeGreaterThan(0);
    expect(targets.length).toBeLessThanOrEqual(12);
  });

  it('전부 degraded → []', () => {
    const pool: R1PanelRow[] = [{ ticker: 'T000', panel: null }];
    expect(computeR2Targets(pool, 'short')).toEqual([]);
  });
});

describe('pickFinalPanels', () => {
  it('round2 done 우선 / 없으면 round1 / 양쪽 없으면 미포함', () => {
    const r1 = new Map<string, PersonaScore[]>([
      ['T001', uniformPanel(50)],
      ['T002', uniformPanel(60)],
    ]);
    const r2 = new Map<string, PersonaScore[]>([['T001', uniformPanel(80)]]);
    const final = pickFinalPanels(r1, r2);
    expect(final.get('T001')![0].scores.short).toBe(80); // R2 우선
    expect(final.get('T002')![0].scores.short).toBe(60); // R1 fallback
    expect(final.has('T003')).toBe(false);
    expect(final.size).toBe(2);
  });
});
