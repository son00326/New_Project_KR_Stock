// PR3c — 3-step orchestration critic LLM 호출 wrapper.
// SoT = docs/superpowers/plans/2026-05-24-pr3c-orchestration-sector-reference.md (v6, omxy R6 CONVERGED).
// PR3b full-report-client.ts 패턴 follow.
//
// W0 (65차 D28 ⑤): critic = GPT mid (gpt-5.4) 교차 — GPT 키 부재 시 Haiku fallback (auto-detect).
//   ⚠️ critic은 호출 시점 resolve (모듈 로드 고정 금지 — env 가변). CRITIC_API_MODEL/
//      CRITIC_PRICING_KEY는 모듈 로드 시점 기본값(편의 export — GPT off=Haiku) 이며 cost 계산은
//      callCritic 내부 resolved.pricingKey 사용.
// B7 fix (omxy R1): reason 한국어 500자 cap (zod max(500)).
// (d) fix (omxy R2): prompt_version 분리 (cost_log filter UI) — CRITIC_PROMPT_VERSION = 'critic-v1'.
// (j) fix (omxy R4): SDK error catch + structured console.warn capture (PR3b CR-3 패턴).

import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { calculateCostKrw, type TokenUsage } from '@/lib/cost/pricing';
import { insertCostLog } from '@/lib/cost/cost-logger';
import { CRITIC_PROMPT_VERSION } from './prompts/critic-prompt';
import { extractJsonObject } from '@/lib/report/full-report-writer';
import { resolveRole } from './model-registry';

// PR4 Task 1 Step 1.1 (B2 fix omxy R1): caller DI seam — AI client options 2nd arg.
export interface CallCriticOptions {
  client?: SupabaseClient;
}

// 모듈 로드 시점 기본값 (편의 export — 실 cost 계산은 callCritic 내부 resolve). GPT 키 부재 시 Haiku.
const CRITIC_ROLE_DEFAULT = resolveRole('critic');
export const CRITIC_API_MODEL = CRITIC_ROLE_DEFAULT.model;
export const CRITIC_PRICING_KEY = CRITIC_ROLE_DEFAULT.pricingKey;
export const CRITIC_MAX_TOKENS = CRITIC_ROLE_DEFAULT.maxTokens;
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

export async function callCritic(
  input: CallCriticInput,
  options: CallCriticOptions = {},
): Promise<CallCriticResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ai_key_unavailable');
  }

  // W0 (65차 D28 ⑤): critic = GPT mid 교차 / GPT off → Haiku fallback. 호출 시점 resolve (env 가변).
  const resolved = resolveRole('critic');

  let aiResult;
  try {
    aiResult = await resolved.provider.call({
      model: resolved.model,
      maxTokens: resolved.maxTokens,
      systemPrompt: input.systemPrompt,
      userPrompt: input.userPrompt,
    });
  } catch (err) {
    // (j) fix (omxy R4): structured warn capture — rate-limit / 5xx / network 구분.
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      `[callCritic] ai_call_failed ticker=${input.ticker} month=${input.month} message=${message}`,
    );
    throw new Error('critic_llm_failed');
  }

  const text = aiResult.text;

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

  const usage: TokenUsage = aiResult.usage;
  // W0 (65차 D28 ⑤): registry resolved pricingKey 명시 — env 가변 모델(gpt-5.4↔haiku) 단가 정합.
  const costKrw = calculateCostKrw(usage, resolved.pricingKey);

  await insertCostLog(
    {
      month: input.month,
      ticker: input.ticker,
      persona_id: PERSONA_ID,
      prompt_version: CRITIC_PROMPT_VERSION,
      model: resolved.model,
      ...usage,
      cost_krw: costKrw,
      prompt_cache_enabled: false,
      called_by: input.adminUserId,
    },
    { client: options.client },
  );

  return { verdict: result.data, usage, costKrw };
}
