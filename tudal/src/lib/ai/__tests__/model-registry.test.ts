import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MODEL_REGISTRY,
  resolveRole,
  isRoleProviderAvailable,
  getRoleMaxCostPerCallKrw,
  resolveTier1PanelSlot,
  getTier1PanelWorstSlotCostKrw,
  type AiRole,
} from '../model-registry';
import { MODEL_PRICING } from '@/lib/cost/anthropic-pricing';
import { MAX_COST_PER_CALL_KRW, calculateCostKrw } from '@/lib/cost/pricing';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('W0 model-registry — 역할→모델 SoT (D28 B-final + 항목1 GLM primary)', () => {
  it('항목1 재바인딩: writer/revise/judge/portfolio/tier1_panel preferred = GLM 5.2(openrouter) + Claude fallback', () => {
    expect(MODEL_REGISTRY.full_report.preferred).toMatchObject({ provider: 'openrouter', model: 'z-ai/glm-5.2', pricingKey: 'glm-5.2' });
    expect(MODEL_REGISTRY.full_report.fallback).toMatchObject({ provider: 'anthropic', model: 'claude-opus-4-8' });
    expect(MODEL_REGISTRY.revise.preferred).toMatchObject({ provider: 'openrouter', model: 'z-ai/glm-5.2' });
    expect(MODEL_REGISTRY.revise.fallback).toMatchObject({ provider: 'anthropic', model: 'claude-opus-4-8' });
    expect(MODEL_REGISTRY.debate_judge.preferred).toMatchObject({ provider: 'openrouter', model: 'z-ai/glm-5.2' });
    expect(MODEL_REGISTRY.debate_judge.fallback).toMatchObject({ provider: 'anthropic', model: 'claude-opus-4-8' });
    expect(MODEL_REGISTRY.portfolio.preferred).toMatchObject({ provider: 'openrouter', model: 'z-ai/glm-5.2' });
    expect(MODEL_REGISTRY.portfolio.fallback).toMatchObject({ provider: 'anthropic', model: 'claude-opus-4-8' });
    expect(MODEL_REGISTRY.tier1_panel.preferred).toMatchObject({ provider: 'openrouter', model: 'z-ai/glm-5.2' });
    expect(MODEL_REGISTRY.tier1_panel.fallback).toMatchObject({ provider: 'anthropic', model: 'claude-opus-4-7' });
    // GPT 역할(항목1 후속 2026-07-01): OpenRouter 경유 실제 GPT(openai/gpt-*) preferred + Claude fallback.
    expect(MODEL_REGISTRY.critic.preferred).toMatchObject({ provider: 'openrouter', model: 'openai/gpt-5.4', pricingKey: 'openai/gpt-5.4' });
    expect(MODEL_REGISTRY.critic.fallback).toMatchObject({ provider: 'anthropic', model: 'claude-haiku-4-5-20251001', pricingKey: 'claude-haiku-4-5' });
    expect(MODEL_REGISTRY.dual_judge_gpt.preferred).toMatchObject({ provider: 'openrouter', model: 'openai/gpt-5.5', pricingKey: 'openai/gpt-5.5' });
    expect(MODEL_REGISTRY.dual_judge_gpt.fallback).toMatchObject({ provider: 'anthropic', model: 'claude-opus-4-8' });
  });

  it('항목1: OPENROUTER 키 존재 → GLM primary 역할 resolve = glm-5.2(openrouter)', () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'openrouter-test-key');
    for (const role of ['full_report', 'revise', 'debate_judge', 'portfolio'] as const) {
      const r = resolveRole(role);
      expect(r.provider.id).toBe('openrouter');
      expect(r.model).toBe('z-ai/glm-5.2');
      expect(r.pricingKey).toBe('glm-5.2');
    }
  });

  it('항목1: OPENROUTER 키 부재 → GLM primary 역할 resolve = Claude fallback (auto-detect)', () => {
    vi.stubEnv('OPENROUTER_API_KEY', '');
    expect(resolveRole('full_report').model).toBe('claude-opus-4-8');
    expect(resolveRole('full_report').provider.id).toBe('anthropic');
    expect(resolveRole('debate_judge').model).toBe('claude-opus-4-8');
    expect(resolveRole('portfolio').model).toBe('claude-opus-4-8');
    expect(resolveRole('tier1_panel').model).toBe('claude-opus-4-7');
  });

  it('항목1 후속: OPENROUTER 부재 → critic resolve = Claude Haiku fallback / dual_judge_gpt = Claude Opus fallback (auto-detect)', () => {
    // GPT 역할 preferred = openrouter(GPT 경유) → OPENROUTER 부재 시 anthropic fallback으로 auto-detect.
    vi.stubEnv('OPENROUTER_API_KEY', '');
    const critic = resolveRole('critic');
    expect(critic.provider.id).toBe('anthropic');
    expect(critic.model).toBe('claude-haiku-4-5-20251001');
    expect(critic.pricingKey).toBe('claude-haiku-4-5');

    const dual = resolveRole('dual_judge_gpt');
    expect(dual.provider.id).toBe('anthropic');
    expect(dual.model).toBe('claude-opus-4-8');
    expect(dual.pricingKey).toBe('claude-opus-4-8');
  });

  it('항목1 후속: OPENROUTER 존재 → critic resolve = openai/gpt-5.4 (D28 ⑤ GPT mid 교차, OpenRouter 경유)', () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'openrouter-test-key');
    const critic = resolveRole('critic');
    expect(critic.provider.id).toBe('openrouter');
    expect(critic.model).toBe('openai/gpt-5.4');
    expect(critic.pricingKey).toBe('openai/gpt-5.4');
  });

  it('항목1: isRoleProviderAvailable — preferred 또는 fallback 중 하나라도 키 있으면 true, 둘 다 없으면 false', () => {
    // GLM 역할(full_report): GLM only → true
    vi.stubEnv('OPENROUTER_API_KEY', 'openrouter-test-key');
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    expect(isRoleProviderAvailable('full_report')).toBe(true);
    // Claude only (GLM 부재, fallback 가용) → true
    vi.stubEnv('OPENROUTER_API_KEY', '');
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    expect(isRoleProviderAvailable('full_report')).toBe(true);
    // 둘 다 부재 → false
    vi.stubEnv('OPENROUTER_API_KEY', '');
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    expect(isRoleProviderAvailable('full_report')).toBe(false);
    // critic(GPT preferred=openrouter / fallback=anthropic): 둘 다 부재 → false
    expect(isRoleProviderAvailable('critic')).toBe(false);
    // fallback(anthropic)만 가용 → true
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    expect(isRoleProviderAvailable('critic')).toBe(true);
    // preferred(openrouter, GPT 경유)만 가용 → true
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.stubEnv('OPENROUTER_API_KEY', 'openrouter-test-key');
    expect(isRoleProviderAvailable('critic')).toBe(true);
  });

  it('getRoleMaxCostPerCallKrw(tier1_panel) = 기존 MAX_COST_PER_CALL_KRW 82.23 (OPENROUTER 부재 fallback Opus-4-7 anchor)', () => {
    // 항목1: OPENROUTER 부재 시 tier1_panel fallback=opus-4-7 → 기존 anchor 유지 (ambient env 격리).
    vi.stubEnv('OPENROUTER_API_KEY', '');
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

  it('GLM reasoning 역할은 calibration output보다 maxTokens를 크게 둔다', () => {
    for (const role of ['tier1_panel', 'debate_judge', 'portfolio'] as const) {
      expect(MODEL_REGISTRY[role].maxTokens).toBeGreaterThan(
        MODEL_REGISTRY[role].calibration.outputTokens,
      );
    }
  });

  it('SDK-bearing AI modules contain server-only import markers', () => {
    const sdkModulePaths = [
      '../anthropic-provider.ts',
      '../openai-provider.ts',
      '../openrouter-provider.ts',
      '../model-registry.ts',
    ] as const;
    for (const sdkModulePath of sdkModulePaths) {
      const source = readFileSync(path.resolve(__dirname, sdkModulePath), 'utf8');
      expect(source).toMatch(/^import ['"]server-only['"];/);
    }
  });
});

// ---------------------------------------------------------------------------
// W1a (D28 ①) — tier1 panel slot 배분 + worst-slot reservation 단가
// ---------------------------------------------------------------------------
describe('W1a resolveTier1PanelSlot — Core 11 혼합 (D28 ① + 항목1 GLM)', () => {
  it('direct-OpenAI 폐기 (OPENAI 가용 + OPENROUTER 부재): 전 슬롯 Sonnet — OPENAI는 tier1 slot resolution 무관', () => {
    // 항목1 후속: GPT 슬롯도 OpenRouter 경유 → OPENROUTER 부재 시 GPT/Claude 슬롯 모두 Sonnet 안전망.
    //   OPENAI_API_KEY가 있어도 direct-OpenAI 경로는 폐기되어 tier1 slot resolution에 영향 없음.
    vi.stubEnv('OPENAI_API_KEY', 'sk-test-openai');
    vi.stubEnv('OPENROUTER_API_KEY', '');
    const slots = Array.from({ length: 11 }, (_, i) => resolveTier1PanelSlot(i));
    expect(slots.filter((s) => s.model === 'claude-sonnet-4-6')).toHaveLength(11);
    expect(slots.filter((s) => s.model === 'gpt-5.4')).toHaveLength(0);
    expect(slots.filter((s) => s.model === 'openai/gpt-5.4')).toHaveLength(0);
    expect(slots.every((s) => s.provider.id === 'anthropic')).toBe(true);
    expect(slots.every((s) => s.role === 'tier1_panel')).toBe(true);
  });

  it('항목1 후속 (OPENAI + OPENROUTER 가용): 짝수 idx=GLM 5.2 ×6 / 홀수 idx=openai/gpt-5.4 ×5 (GPT도 OpenRouter 경유)', () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test-openai');
    vi.stubEnv('OPENROUTER_API_KEY', 'openrouter-test-key');
    const slots = Array.from({ length: 11 }, (_, i) => resolveTier1PanelSlot(i));
    expect(slots.filter((s) => s.model === 'z-ai/glm-5.2')).toHaveLength(6);
    expect(slots.filter((s) => s.model === 'openai/gpt-5.4')).toHaveLength(5);
    expect(slots[0].model).toBe('z-ai/glm-5.2');
    expect(slots[0].provider.id).toBe('openrouter');
    expect(slots[0].pricingKey).toBe('glm-5.2');
    // 항목1 후속: GPT 슬롯 = OpenRouter 경유 실제 GPT(openai/gpt-5.4) — direct OpenAI 아님.
    expect(slots[1].model).toBe('openai/gpt-5.4');
    expect(slots[1].provider.id).toBe('openrouter');
    expect(slots[1].pricingKey).toBe('openai/gpt-5.4');
  });

  it('GPT+OPENROUTER 미가용 → 전 슬롯 Sonnet (Claude-only fallback, D28 C)', () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('OPENROUTER_API_KEY', '');
    const slots = Array.from({ length: 11 }, (_, i) => resolveTier1PanelSlot(i));
    expect(slots.every((s) => s.model === 'claude-sonnet-4-6')).toBe(true);
    expect(slots.every((s) => s.provider.id === 'anthropic')).toBe(true);
  });

  it('항목1 후속 (OPENAI 부재 + OPENROUTER 가용): 짝수 GLM 5.2 ×6 / 홀수 GPT 슬롯=openai/gpt-5.4 ×5 (별도 OpenAI 키 불요)', () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('OPENROUTER_API_KEY', 'openrouter-test-key');
    const slots = Array.from({ length: 11 }, (_, i) => resolveTier1PanelSlot(i));
    expect(slots.filter((s) => s.model === 'z-ai/glm-5.2')).toHaveLength(6);
    expect(slots.filter((s) => s.model === 'openai/gpt-5.4')).toHaveLength(5);
    expect(slots.filter((s) => s.model === 'claude-sonnet-4-6')).toHaveLength(0);
    // 홀수(GPT) 슬롯: OPENAI 부재라도 OpenRouter 경유 실제 GPT (구 GLM/Sonnet fallback 기대 정정).
    expect(slots[1].model).toBe('openai/gpt-5.4');
    expect(slots[1].provider.id).toBe('openrouter');
    expect(slots[1].pricingKey).toBe('openai/gpt-5.4');
    // 짝수(GLM) + 홀수(GPT) 모두 OpenRouter 게이트웨이 경유.
    expect(slots.every((s) => s.provider.id === 'openrouter')).toBe(true);
  });

  it('slotIndex 범위 밖(11/-1/소수) → throw tier1_panel_slot_out_of_range', () => {
    expect(() => resolveTier1PanelSlot(11)).toThrow('tier1_panel_slot_out_of_range:11');
    expect(() => resolveTier1PanelSlot(-1)).toThrow('tier1_panel_slot_out_of_range:-1');
    expect(() => resolveTier1PanelSlot(1.5)).toThrow('tier1_panel_slot_out_of_range:1.5');
  });
});

describe('W1a getTier1PanelWorstSlotCostKrw (D8)', () => {
  it('= max(GLM, Sonnet, GPT mid) calibration 단가 — env 무관 (reservation undercount 금지)', () => {
    const cal = {
      input_tokens: 1500,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      output_tokens: 2000,
    };
    const expected = Math.max(
      calculateCostKrw(cal, 'glm-5.2'),
      calculateCostKrw(cal, 'claude-sonnet-4-6'),
      calculateCostKrw(cal, 'openai/gpt-5.4'),
    );
    vi.stubEnv('OPENAI_API_KEY', '');
    expect(getTier1PanelWorstSlotCostKrw()).toBe(expected);
    vi.stubEnv('OPENAI_API_KEY', 'sk-test-openai');
    expect(getTier1PanelWorstSlotCostKrw()).toBe(expected);
    expect(expected).toBeGreaterThan(0);
  });
});
