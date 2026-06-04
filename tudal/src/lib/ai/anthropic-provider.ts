import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type { TokenUsage } from '@/lib/cost/pricing';
import { isAnthropicAvailable, type LlmCallParams, type LlmCallResult, type LlmProvider } from './provider';

export const anthropicProvider: LlmProvider = {
  id: 'anthropic',
  isAvailable: isAnthropicAvailable,
  async call(params: LlmCallParams): Promise<LlmCallResult> {
    // D28 A fail-closed: Claude 키 부재 = AI 기능 비활성 (기존 ai_key_unavailable 계약은 caller가 throw)
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const systemBlocks = params.enablePromptCache
      ? [{ type: 'text' as const, text: params.systemPrompt, cache_control: { type: 'ephemeral' as const } }]
      : [{ type: 'text' as const, text: params.systemPrompt }];
    const response = await client.messages.create({
      model: params.model,
      max_tokens: params.maxTokens,
      system: systemBlocks,
      messages: [{ role: 'user', content: params.userPrompt }],
    });
    const text = response.content
      .filter((c) => c.type === 'text')
      .map((c) => (c as { type: 'text'; text: string }).text)
      .join('');
    const usageWithCache = response.usage as typeof response.usage & {
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
    const usage: TokenUsage = {
      input_tokens: response.usage.input_tokens ?? 0,
      cache_creation_input_tokens: usageWithCache.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: usageWithCache.cache_read_input_tokens ?? 0,
      output_tokens: response.usage.output_tokens ?? 0,
    };
    return { text, usage };
  },
};
