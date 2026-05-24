// PR3c — 3-step orchestration revise (Opus 4.7 max_tokens 8192 — B3 fix) LLM 호출 wrapper.
// SoT = plan v6, omxy R6 CONVERGED. 누적 21 BLOCKERS.
// PR3b full-report-client.ts + Task 2 critic-client.ts 패턴 follow.
//
// max_tokens 8192 (B3 fix omxy R1): full rewrite tolerate, truncation 차단.
// REVISE input 8000 보수화 (B11 fix omxy R2) — pricing.ts REVISE_MAX_COST_PER_CALL_KRW 정합.
// (d) fix (omxy R2): persona_id='revise', prompt_version='revise-v1' (cost_log filter UI 분리).
// (j) fix (omxy R4): SDK error catch + structured warn capture (PR3b CR-3 패턴).

import Anthropic from '@anthropic-ai/sdk';
import {
  calculateCostKrw,
  REVISE_PRICING_KEY,
  type TokenUsage,
} from '@/lib/cost/pricing';
import { insertCostLog } from '@/lib/cost/cost-logger';
import { REVISE_PROMPT_VERSION } from './prompts/revise-prompt';

export const REVISE_API_MODEL = 'claude-opus-4-7';
export const REVISE_MAX_TOKENS = 8192;
const PERSONA_ID = 'revise';

export interface CallReviseInput {
  ticker: string;
  month: string;
  systemPrompt: string;
  userPrompt: string;
  adminUserId: string;
}

export interface CallReviseResult {
  content: string;
  usage: TokenUsage;
  costKrw: number;
}

export async function callRevise(input: CallReviseInput): Promise<CallReviseResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ai_key_unavailable');
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let response;
  try {
    response = await client.messages.create({
      model: REVISE_API_MODEL,
      max_tokens: REVISE_MAX_TOKENS,
      system: input.systemPrompt,
      messages: [{ role: 'user', content: input.userPrompt }],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      `[callRevise] anthropic_failed ticker=${input.ticker} month=${input.month} message=${message}`,
    );
    throw new Error('revise_llm_failed');
  }

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
  // Track 3 C-1 fix (5-angle scan): REVISE_PRICING_KEY 명시 — B14 patten 정합 (CRITIC_PRICING_KEY 대칭).
  // S7A_MODEL 변경 시 silent fallback Sonnet 단가 차단.
  const costKrw = calculateCostKrw(usage, REVISE_PRICING_KEY);

  await insertCostLog({
    month: input.month,
    ticker: input.ticker,
    persona_id: PERSONA_ID,
    prompt_version: REVISE_PROMPT_VERSION,
    model: REVISE_API_MODEL,
    ...usage,
    cost_krw: costKrw,
    prompt_cache_enabled: false,
    called_by: input.adminUserId,
  });

  return { content: text, usage, costKrw };
}
