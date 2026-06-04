import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MODEL_REGISTRY,
  resolveRole,
  getRoleMaxCostPerCallKrw,
  type AiRole,
} from '../model-registry';
import { MODEL_PRICING } from '@/lib/cost/anthropic-pricing';
import { MAX_COST_PER_CALL_KRW } from '@/lib/cost/pricing';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('W0 model-registry — 역할→모델 SoT (D28 B-final)', () => {
  it('역할 7종 기본값 = D28 표 (writer/revise/judge/portfolio = opus-4-8, tier1_panel = opus-4-7)', () => {
    expect(MODEL_REGISTRY.full_report.preferred).toMatchObject({ provider: 'anthropic', model: 'claude-opus-4-8' });
    expect(MODEL_REGISTRY.revise.preferred).toMatchObject({ provider: 'anthropic', model: 'claude-opus-4-8' });
    expect(MODEL_REGISTRY.debate_judge.preferred).toMatchObject({ provider: 'anthropic', model: 'claude-opus-4-8' });
    expect(MODEL_REGISTRY.portfolio.preferred).toMatchObject({ provider: 'anthropic', model: 'claude-opus-4-8' });
    expect(MODEL_REGISTRY.tier1_panel.preferred).toMatchObject({ provider: 'anthropic', model: 'claude-opus-4-7' });
    expect(MODEL_REGISTRY.critic.preferred).toMatchObject({ provider: 'openai', model: 'gpt-5.4' });
    expect(MODEL_REGISTRY.dual_judge_gpt.preferred).toMatchObject({ provider: 'openai', model: 'gpt-5.5' });
  });

  it('OPENAI_API_KEY 부재 → critic resolve = Haiku fallback / dual_judge_gpt = opus-4-8 fallback (D28 C auto-detect)', () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const critic = resolveRole('critic');
    expect(critic.provider.id).toBe('anthropic');
    expect(critic.model).toBe('claude-haiku-4-5-20251001');
    expect(critic.pricingKey).toBe('claude-haiku-4-5');

    const dual = resolveRole('dual_judge_gpt');
    expect(dual.provider.id).toBe('anthropic');
    expect(dual.model).toBe('claude-opus-4-8');
  });

  it('OPENAI_API_KEY 존재 → critic resolve = gpt-5.4 (D28 ⑤ GPT mid 교차)', () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test-openai');
    const critic = resolveRole('critic');
    expect(critic.provider.id).toBe('openai');
    expect(critic.model).toBe('gpt-5.4');
    expect(critic.pricingKey).toBe('gpt-5.4');
  });

  it('preferred provider가 anthropic이면 OPENAI 키 유무 무관하게 preferred 유지 (full_report)', () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    expect(resolveRole('full_report').model).toBe('claude-opus-4-8');
    vi.stubEnv('OPENAI_API_KEY', 'sk-test-openai');
    expect(resolveRole('full_report').model).toBe('claude-opus-4-8');
  });

  it('getRoleMaxCostPerCallKrw(tier1_panel) = 기존 MAX_COST_PER_CALL_KRW 82.23 (무회귀 anchor)', () => {
    expect(getRoleMaxCostPerCallKrw('tier1_panel')).toBe(82.23);
    expect(getRoleMaxCostPerCallKrw('tier1_panel')).toBe(MAX_COST_PER_CALL_KRW);
  });

  it('registry 전 binding의 pricingKey가 MODEL_PRICING에 존재 (모듈 로드 invariant 명시 assert)', () => {
    for (const role of Object.keys(MODEL_REGISTRY) as AiRole[]) {
      const entry = MODEL_REGISTRY[role];
      const bindings = [entry.preferred, entry.fallback].filter(Boolean) as { pricingKey: string }[];
      for (const b of bindings) {
        expect(b.pricingKey in MODEL_PRICING).toBe(true);
      }
    }
  });

  it('SDK-bearing AI modules contain server-only import markers', () => {
    const sdkModulePaths = [
      '../anthropic-provider.ts',
      '../openai-provider.ts',
      '../model-registry.ts',
    ] as const;
    for (const sdkModulePath of sdkModulePaths) {
      const source = readFileSync(path.resolve(__dirname, sdkModulePath), 'utf8');
      expect(source).toMatch(/^import ['"]server-only['"];/);
    }
  });
});
