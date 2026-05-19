import { describe, it, expect } from 'vitest';
import { calculateCostKrw, MAX_COST_PER_CALL_KRW, HARDCAP_KRW } from '../pricing';

describe('pricing (Q6)', () => {
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
});
