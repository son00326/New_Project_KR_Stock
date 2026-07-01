import { describe, it, expect } from 'vitest';

import { anthropicProvider } from '../anthropic-provider';
import { openaiProvider } from '../openai-provider';
import { openrouterProvider } from '../openrouter-provider';
import type { LlmProvider } from '../provider';
import { calculateCostKrw } from '@/lib/cost/pricing';

// ---------------------------------------------------------------------------
// W0 (65차 Q3/D28) — provider 계층 실 API smoke (env-gated).
//
// ⚠️ 실 API 호출 = 비용 발생. CI/test:ci에서는 항상 skip (W0_LIVE_SMOKE !== 'true').
//    실행은 USER 비용 승인 게이트 (plan Task 8 Step 8.2 가이드 참조):
//      cd tudal && set -a && source .env.local && set +a
//      W0_LIVE_SMOKE=true npx vitest run src/lib/ai/__tests__/w0-provider-smoke.live.test.ts
//    예상 비용: haiku 1콜 + gpt-5.4-mini 1콜 + glm-5.2 1콜 ≈ 20~30원 미만.
//
// persist 금지 — short_list/report 쓰기 없음, cost_log insert 없음 (콘솔 출력만).
// 각 provider는 키 가용 시에만 호출 (isAvailable false면 해당 probe skip).
// 항목1 — GLM 5.2(OpenRouter) probe 추가: OPENROUTER_API_KEY 가용 시에만 실행.
// ---------------------------------------------------------------------------

const LIVE = process.env.W0_LIVE_SMOKE === 'true';

// cheap model (provider별 최저가). pricingKey는 cost 계산용 (haiku는 dateless alias).
// 항목1 — GLM 5.2는 reasoning 모델(reasoning_tokens 소비) → content 여유 위해 maxTokens 상향(1024).
const PROBES: Array<{
  provider: LlmProvider;
  model: string;
  pricingKey: string;
  maxTokens: number;
}> = [
  { provider: anthropicProvider, model: 'claude-haiku-4-5-20251001', pricingKey: 'claude-haiku-4-5', maxTokens: 256 },
  { provider: openaiProvider, model: 'gpt-5.4-mini', pricingKey: 'gpt-5.4-mini', maxTokens: 256 },
  { provider: openrouterProvider, model: 'z-ai/glm-5.2', pricingKey: 'glm-5.2', maxTokens: 1024 },
];

const SYSTEM_PROMPT =
  '너는 한국 주식 애널리스트다. 입력된 종목을 한 줄로 간단히 평가하라. 한국어로 답하라.';
const USER_PROMPT = '종목 005930 (삼성전자)를 한 줄로 평가하라.';

describe.skipIf(!LIVE)('W0 provider live smoke (env-gated, USER 비용 승인 후)', () => {
  for (const probe of PROBES) {
    it.skipIf(!probe.provider.isAvailable())(
      `${probe.provider.id} (${probe.model}) — 1콜 평가 + usage + cost 양수`,
      async () => {
        const result = await probe.provider.call({
          model: probe.model,
          maxTokens: probe.maxTokens,
          systemPrompt: SYSTEM_PROMPT,
          userPrompt: USER_PROMPT,
        });

        // text 비공백
        expect(typeof result.text).toBe('string');
        expect(result.text.trim().length).toBeGreaterThan(0);

        // usage 4필드 존재 + 비음수 (정규화 결과)
        const { usage } = result;
        expect(usage.input_tokens).toBeGreaterThanOrEqual(0);
        expect(usage.cache_creation_input_tokens).toBeGreaterThanOrEqual(0);
        expect(usage.cache_read_input_tokens).toBeGreaterThanOrEqual(0);
        expect(usage.output_tokens).toBeGreaterThanOrEqual(0);

        // 실 1콜이면 input/output 토큰은 양수여야 함
        expect(usage.input_tokens + usage.cache_read_input_tokens).toBeGreaterThan(0);
        expect(usage.output_tokens).toBeGreaterThan(0);

        // cost 양수 (등록 단가로 환산 — pricingKey가 MODEL_PRICING에 존재해야 throw 안 함)
        const costKrw = calculateCostKrw(usage, probe.pricingKey);
        expect(costKrw).toBeGreaterThan(0);

        // 콘솔 출력만 (persist 없음)
        console.log(
          `[W0 smoke] ${probe.provider.id}/${probe.model}: cost ₩${costKrw} · usage`,
          usage,
          `· text "${result.text.trim().slice(0, 60)}…"`,
        );
      },
      30_000,
    );
  }
});
