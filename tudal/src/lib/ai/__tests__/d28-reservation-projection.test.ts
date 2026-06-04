import { describe, expect, it } from 'vitest';
import {
  projectD28MonthlyReservationKrw,
  getRoleMaxCostPerCallKrw,
} from '../model-registry';
import { HARDCAP_KRW } from '@/lib/cost/pricing';

describe('W0 D28 reservation projection (≤50만 hardcap DoD 게이트)', () => {
  it('D28 B-final 배분 기준 월간 reservation ≤ HARDCAP_KRW 50만 (W0 DoD 게이트)', () => {
    const p = projectD28MonthlyReservationKrw();
    // 결과 가시화 (notes 기록용)
    console.log('[D28 projection] totalKrw =', p.totalKrw);
    for (const l of p.lines) {
      console.log(`  - ${l.label}: ${Math.round(l.krw)}원`);
    }
    expect(p.totalKrw).toBeLessThanOrEqual(HARDCAP_KRW);
    expect(p.totalKrw).toBeGreaterThan(100_000); // 산식 공동(空) 방지 sanity
  });

  it('all-Opus 2라운드면 50만 초과 (HANDOFF 비용 가드 근거 재현 — 혼합 필수성 증명)', () => {
    // 60×4.345 + 120 tickers × 11콜 × 2라운드 × 82.23 ≈ 69만 > 50만
    const tickers = (50 + 10) * 4.345 + (100 + 20);
    const allOpus2R = tickers * 11 * 2 * getRoleMaxCostPerCallKrw('tier1_panel');
    expect(allOpus2R).toBeGreaterThan(HARDCAP_KRW);
  });
});
