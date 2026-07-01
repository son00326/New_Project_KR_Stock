// W0 (65차 Q3/D28) — LLM provider 추상화 인터페이스.
// 항목1(2026-07-01 USER) — GLM 5.2(OpenRouter) = primary / Claude = fallback / GPT = 선택 secondary.
//   OPENROUTER_API_KEY 부재 시 registry가 Claude fallback로 auto-detect(무회귀). 구 "Claude 필수 primary"(D28 A) supersede.
import type { TokenUsage } from '@/lib/cost/pricing';
import type { AiProviderId } from '@/lib/cost/anthropic-pricing';

export interface LlmCallParams {
  model: string;          // 공급자별 API model id (registry가 resolve)
  maxTokens: number;
  systemPrompt: string;
  userPrompt: string;
  // Anthropic prompt cache opt-in (AI_PROMPT_CACHE_ENABLED). OpenAI는 자동 캐시라 무시.
  enablePromptCache?: boolean;
  responseFormat?: 'json_object';
}

export interface LlmCallResult {
  text: string;
  usage: TokenUsage;      // 정규화: input=uncached, cache_read, cache_creation(openai=0), output
}

export interface LlmProvider {
  readonly id: AiProviderId;
  /** env 키 존재 여부 (auto-detect — D28 C) */
  isAvailable(): boolean;
  /** 단발 system+user 호출. SDK 원시 에러를 그대로 throw (코드 매핑은 caller 책임). */
  call(params: LlmCallParams): Promise<LlmCallResult>;
}

export function isAnthropicAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}
export function isOpenAiAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}
// 항목1 — GLM 5.2 primary(OpenRouter). auto-detect: OPENROUTER_API_KEY 부재 시 registry가 Claude fallback.
export function isOpenRouterAvailable(): boolean {
  return !!process.env.OPENROUTER_API_KEY;
}
