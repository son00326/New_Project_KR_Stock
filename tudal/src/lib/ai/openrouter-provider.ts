import 'server-only';
import OpenAI from 'openai';
import type { TokenUsage } from '@/lib/cost/pricing';
import { isOpenRouterAvailable, type LlmCallParams, type LlmCallResult, type LlmProvider } from './provider';

// 항목1 — GLM 5.2 primary(OpenRouter). OpenRouter = OpenAI 호환 **Chat Completions** (Responses API 아님).
//   openai SDK로 baseURL만 openrouter.ai/api/v1 override → client.chat.completions.create.
//   ⚠️ GLM 5.2 = reasoning 모델(reasoning_tokens 소비). max_tokens는 registry 역할 예산(reasoning 여유 포함) 사용.
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

// OpenRouter usage 확장 필드 (openai SDK 타입 미포함 — anthropic-provider의 cache cast 패턴 동형).
interface OpenRouterPromptTokensDetails {
  cached_tokens?: number;
  cache_write_tokens?: number;
}

function requiredUsageNumber(value: unknown, field: string): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  throw new Error(`openrouter_usage_missing:${field}`);
}

function optionalUsageNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export const openrouterProvider: LlmProvider = {
  id: 'openrouter',
  isAvailable: isOpenRouterAvailable,
  async call(params: LlmCallParams): Promise<LlmCallResult> {
    // 키는 env에서만 (하드코딩 금지). 키 부재 = caller 게이트가 이미 차단 (fail-closed).
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('ai_key_unavailable');
    }
    const client = new OpenAI({
      apiKey,
      baseURL: OPENROUTER_BASE_URL,
    });
    const response = await client.chat.completions.create({
      model: params.model,
      max_tokens: params.maxTokens,
      reasoning_effort: 'high',
      response_format:
        params.responseFormat === 'json_object'
          ? { type: 'json_object' }
          : undefined,
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userPrompt },
      ],
    });
    const finishReason = response.choices[0]?.finish_reason;
    if (finishReason === 'length') {
      throw new Error('ai_call_failed:transient:length');
    }
    const text = response.choices[0]?.message?.content ?? '';
    const u = response.usage;
    if (!u) {
      throw new Error('openrouter_usage_missing:usage');
    }
    const promptDetails = u?.prompt_tokens_details as OpenRouterPromptTokensDetails | undefined;
    const cachedRead = optionalUsageNumber(promptDetails?.cached_tokens);
    const cacheWrite = optionalUsageNumber(promptDetails?.cache_write_tokens);
    const totalPrompt = requiredUsageNumber(u.prompt_tokens, 'prompt_tokens');
    const completionTokens = requiredUsageNumber(u.completion_tokens, 'completion_tokens');
    const uncachedPrompt = Math.max(0, totalPrompt - cachedRead - cacheWrite);
    const usage: TokenUsage = {
      input_tokens: uncachedPrompt,
      cache_creation_input_tokens: cacheWrite,
      cache_read_input_tokens: cachedRead,
      output_tokens: completionTokens,
    };
    return { text, usage };
  },
};
