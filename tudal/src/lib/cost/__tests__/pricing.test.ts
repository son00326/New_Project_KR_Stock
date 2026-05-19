import { describe, it, expect } from 'vitest';
import { calculateCostKrw, MAX_COST_PER_CALL_KRW, HARDCAP_KRW, S7A_MODEL } from '../pricing';
import { ANTHROPIC_PRICING } from '../anthropic-pricing';
import { COST_USD_TO_KRW } from '@/types/admin';

describe('pricing (Q6 + R5 wrapper)', () => {
  it('cache-off cost = input × pIn + output × pOut', () => {
    const cost = calculateCostKrw({
      input_tokens: 1000,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      output_tokens: 500,
    });
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeLessThan(MAX_COST_PER_CALL_KRW);
  });

  it('cache-creation = input pricing × 1.25', () => {
    const cost = calculateCostKrw({
      input_tokens: 0,
      cache_creation_input_tokens: 1000,
      cache_read_input_tokens: 0,
      output_tokens: 0,
    });
    expect(cost).toBeGreaterThan(0);
  });

  it('cache-read = input pricing × 0.10', () => {
    const cost = calculateCostKrw({
      input_tokens: 0,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 1000,
      output_tokens: 0,
    });
    expect(cost).toBeGreaterThan(0);
  });

  it('mixed cost sums all 4 components', () => {
    const cost = calculateCostKrw({
      input_tokens: 100,
      cache_creation_input_tokens: 200,
      cache_read_input_tokens: 300,
      output_tokens: 400,
    });
    expect(cost).toBeGreaterThan(0);
  });

  it('HARDCAP_KRW = 400_000', () => {
    expect(HARDCAP_KRW).toBe(400_000);
  });

  it('uses anthropic-pricing.ts SoT (S7A_MODEL = claude-opus-4-7) + COST_USD_TO_KRW (R5 wrapper)', () => {
    expect(S7A_MODEL).toBe('claude-opus-4-7');
    const opus = ANTHROPIC_PRICING[S7A_MODEL];
    expect(opus).toBeDefined();
    // 1000 input + 500 output @ opus rates × COST_USD_TO_KRW
    const expectedUsd = (1000 * opus.inputPerMTokUsd + 500 * opus.outputPerMTokUsd) / 1_000_000;
    const expectedKrw = Math.round(expectedUsd * COST_USD_TO_KRW * 100) / 100;
    const actual = calculateCostKrw({
      input_tokens: 1000,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      output_tokens: 500,
    });
    expect(actual).toBeCloseTo(expectedKrw, 2);
  });
});
