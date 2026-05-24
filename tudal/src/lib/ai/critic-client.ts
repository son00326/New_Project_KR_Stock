// PR3c — 3-step orchestration critic (Haiku 4.5) LLM 호출 wrapper.
// SoT = docs/superpowers/plans/2026-05-24-pr3c-orchestration-sector-reference.md (v6, omxy R6 CONVERGED).
// PR3b full-report-client.ts 패턴 follow.
//
// B14 fix (omxy R3): CRITIC_API_MODEL (actual Anthropic API ID) vs CRITIC_PRICING_KEY 분리.
//   - API call → CRITIC_API_MODEL ('claude-haiku-4-5-20251001')
//   - calculateCostKrw → CRITIC_PRICING_KEY ('claude-haiku-4-5', pricing.ts SoT)
// B7 fix (omxy R1): reason 한국어 500자 cap (zod max(500)).
// (d) fix (omxy R2): prompt_version 분리 (cost_log filter UI) — CRITIC_PROMPT_VERSION = 'critic-v1'.
// (j) fix (omxy R4): SDK error catch + structured console.warn capture (PR3b CR-3 패턴).

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import {
  calculateCostKrw,
  CRITIC_PRICING_KEY,
  type TokenUsage,
} from '@/lib/cost/pricing';
import { insertCostLog } from '@/lib/cost/cost-logger';
import { CRITIC_PROMPT_VERSION } from './prompts/critic-prompt';
import { extractJsonObject } from '@/lib/report/full-report-writer';

export const CRITIC_API_MODEL = 'claude-haiku-4-5-20251001';
export const CRITIC_MAX_TOKENS = 2048;
const PERSONA_ID = 'critic';

// B7 fix: zod max 500자 cap (한국어 multi-byte JS code unit count safe — emoji 제외).
const verdictSchema = z.object({
  verdict: z.enum(['PASS', 'WARN', 'FAIL']),
  reason: z.string().min(1).max(500),
});

const criticResultSchema = z.object({
  factuality: verdictSchema,
  logic: verdictSchema,
  completeness: verdictSchema,
  structure: verdictSchema,
  bias: verdictSchema,
  reader_level: verdictSchema,
});

export type CriticResultJson = z.infer<typeof criticResultSchema>;

export interface CallCriticInput {
  ticker: string;
  month: string;
  systemPrompt: string;
  userPrompt: string;
  adminUserId: string;
}

export interface CallCriticResult {
  verdict: CriticResultJson;
  usage: TokenUsage;
  costKrw: number;
}

export async function callCritic(input: CallCriticInput): Promise<CallCriticResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ai_key_unavailable');
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let response;
  try {
    response = await client.messages.create({
      model: CRITIC_API_MODEL,
      max_tokens: CRITIC_MAX_TOKENS,
      system: input.systemPrompt,
      messages: [{ role: 'user', content: input.userPrompt }],
    });
  } catch (err) {
    // (j) fix (omxy R4): structured warn capture — rate-limit / 5xx / network 구분.
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      `[callCritic] anthropic_failed ticker=${input.ticker} month=${input.month} message=${message}`,
    );
    throw new Error('critic_llm_failed');
  }

  const text = response.content
    .filter((c) => c.type === 'text')
    .map((c) => (c as { type: 'text'; text: string }).text)
    .join('');

  const jsonStr = extractJsonObject(text);
  if (jsonStr === null) {
    throw new Error('critic_parse_failed:no_json_object');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error('critic_parse_failed:invalid_json');
  }

  const result = criticResultSchema.safeParse(parsed);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first?.path?.join('.') ?? 'root';
    console.warn(
      `[callCritic] validation_failed ticker=${input.ticker} month=${input.month} path=${path} message=${first?.message ?? 'unknown'}`,
    );
    throw new Error(`critic_validation_failed:${path}`);
  }

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
  // B14 fix: calculateCostKrw에 CRITIC_PRICING_KEY 명시 — fallback Sonnet 단가 차단.
  const costKrw = calculateCostKrw(usage, CRITIC_PRICING_KEY);

  await insertCostLog({
    month: input.month,
    ticker: input.ticker,
    persona_id: PERSONA_ID,
    prompt_version: CRITIC_PROMPT_VERSION,
    model: CRITIC_API_MODEL,
    ...usage,
    cost_krw: costKrw,
    prompt_cache_enabled: false,
    called_by: input.adminUserId,
  });

  return { verdict: result.data, usage, costKrw };
}
