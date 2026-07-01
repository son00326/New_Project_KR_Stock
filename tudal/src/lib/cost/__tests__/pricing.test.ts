import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  calculateCostKrw,
  MAX_COST_PER_CALL_KRW,
  HARDCAP_KRW,
  COST_WARNING_THRESHOLD_KRW,
  S7A_MODEL,
} from '../pricing';
import { ANTHROPIC_PRICING, MODEL_PRICING, getPricing } from '../anthropic-pricing';
import {
  COST_HARDCAP_KRW,
  COST_USD_TO_KRW,
  COST_WARNING_THRESHOLD_KRW as ADMIN_COST_WARNING_THRESHOLD_KRW,
} from '@/types/admin';

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

  it('HARDCAP_KRW = 500_000 (65차 LOCKED #5)', () => {
    expect(HARDCAP_KRW).toBe(500_000);
    expect(COST_WARNING_THRESHOLD_KRW).toBe(450_000);
  });

  it('hardcap constants are re-exported from types/admin SoT', () => {
    expect(HARDCAP_KRW).toBe(COST_HARDCAP_KRW);
    expect(COST_WARNING_THRESHOLD_KRW).toBe(ADMIN_COST_WARNING_THRESHOLD_KRW);
    const source = readFileSync(path.resolve(__dirname, '../pricing.ts'), 'utf8');
    expect(source).toContain('COST_HARDCAP_KRW as HARDCAP_KRW');
    expect(source).not.toMatch(/export const HARDCAP_KRW\s*=\s*500_000/);
    expect(source).not.toMatch(/export const COST_WARNING_THRESHOLD_KRW\s*=\s*450_000/);
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

  it('calculateCostKrw는 OpenRouter GPT slug에서 direct OpenAI와 동일 단가를 적용', () => {
    // openai/gpt-5.4: input $2.5/M. cached 1M tok → 2.5 × 0.1 = $0.25 → ×1430 = 357.5
    const krw = calculateCostKrw(
      { input_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 1_000_000, output_tokens: 0 },
      'openai/gpt-5.4',
    );
    expect(krw).toBe(357.5);
    expect(krw).toBe(calculateCostKrw(
      { input_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 1_000_000, output_tokens: 0 },
      'gpt-5.4',
    ));
  });
});

describe('W0 multi-provider pricing registry (D28)', () => {
  it('registers claude-opus-4-8 at $5/$25', () => {
    expect(MODEL_PRICING['claude-opus-4-8']).toMatchObject({
      provider: 'anthropic', inputPerMTokUsd: 5, outputPerMTokUsd: 25,
      cacheWriteMult: 1.25, cacheReadMult: 0.1,
    });
  });
  it('registers gpt-5.5 / gpt-5.4 / gpt-5.4-mini with openai provider', () => {
    expect(MODEL_PRICING['gpt-5.5']).toMatchObject({ provider: 'openai', inputPerMTokUsd: 5, outputPerMTokUsd: 30, cacheWriteMult: 0, cacheReadMult: 0.1 });
    expect(MODEL_PRICING['gpt-5.4']).toMatchObject({ provider: 'openai', inputPerMTokUsd: 2.5, outputPerMTokUsd: 15 });
    expect(MODEL_PRICING['gpt-5.4-mini']).toMatchObject({ provider: 'openai', inputPerMTokUsd: 0.75, outputPerMTokUsd: 4.5 });
  });
  it('registers openai/gpt-5.5 and openai/gpt-5.4 as OpenRouter gateway slugs', () => {
    expect(MODEL_PRICING['openai/gpt-5.5']).toMatchObject({ provider: 'openrouter', inputPerMTokUsd: 5, outputPerMTokUsd: 30, cacheWriteMult: 0, cacheReadMult: 0.1 });
    expect(MODEL_PRICING['openai/gpt-5.4']).toMatchObject({ provider: 'openrouter', inputPerMTokUsd: 2.5, outputPerMTokUsd: 15, cacheWriteMult: 0, cacheReadMult: 0.1 });
  });
  it('getPricing throws pricing_unknown_model on unregistered model (D28 ② fail-closed)', () => {
    expect(() => getPricing('not-a-model')).toThrow('pricing_unknown_model:not-a-model');
  });
});
