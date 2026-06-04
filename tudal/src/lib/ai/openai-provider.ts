import OpenAI from 'openai';
import type { TokenUsage } from '@/lib/cost/pricing';
import { isOpenAiAvailable, type LlmCallParams, type LlmCallResult, type LlmProvider } from './provider';

export const openaiProvider: LlmProvider = {
  id: 'openai',
  isAvailable: isOpenAiAvailable,
  async call(params: LlmCallParams): Promise<LlmCallResult> {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: params.model,
      instructions: params.systemPrompt,
      input: params.userPrompt,
      max_output_tokens: params.maxTokens,
    });
    const text = response.output_text ?? '';
    const u = response.usage;
    const cached = u?.input_tokens_details?.cached_tokens ?? 0;
    const totalInput = u?.input_tokens ?? 0;
    // ⚠️ OpenAI input_tokens = cached 포함 total / Anthropic = uncached만.
    //    calculateCostKrw 산식(uncached ×1.0 + read ×0.1) 재사용 위해 분리 정규화.
    const usage: TokenUsage = {
      input_tokens: Math.max(0, totalInput - cached),
      cache_creation_input_tokens: 0, // OpenAI 자동 캐시 — write tier 없음
      cache_read_input_tokens: cached,
      output_tokens: u?.output_tokens ?? 0,
    };
    return { text, usage };
  },
};
