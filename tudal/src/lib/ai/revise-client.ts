// PR3c — 3-step orchestration revise LLM 호출 wrapper.
// SoT = plan v6, omxy R6 CONVERGED. 누적 21 BLOCKERS.
// PR3b full-report-client.ts + Task 2 critic-client.ts 패턴 follow.
//
// W0 (65차 D28 ④): revise = Opus 4.8. 모델 하드코딩 제거 — revise 역할로 registry resolve.
//   REVISE_API_MODEL/REVISE_MAX_TOKENS는 registry 파생값으로 export 유지 (기존 import 호환).
// max_tokens 8192 (B3 fix omxy R1): full rewrite tolerate, truncation 차단.
// REVISE input 8000 보수화 (B11 fix omxy R2) — pricing.ts REVISE_MAX_COST_PER_CALL_KRW 정합.
// (d) fix (omxy R2): persona_id='revise', prompt_version='revise-v1' (cost_log filter UI 분리).
// (j) fix (omxy R4): SDK error catch + structured warn capture (PR3b CR-3 패턴).

import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateCostKrw, type TokenUsage } from '@/lib/cost/pricing';
import { insertCostLog } from '@/lib/cost/cost-logger';
import { REVISE_PROMPT_VERSION } from './prompts/revise-prompt';
import { resolveRole } from './model-registry';

// PR4 Task 1 Step 1.1 (B2 fix omxy R1): caller DI seam — AI client options 2nd arg.
export interface CallReviseOptions {
  client?: SupabaseClient;
}

const REVISE_ROLE = resolveRole('revise');
export const REVISE_API_MODEL = REVISE_ROLE.model;
export const REVISE_MAX_TOKENS = REVISE_ROLE.maxTokens;
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

export async function callRevise(
  input: CallReviseInput,
  options: CallReviseOptions = {},
): Promise<CallReviseResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ai_key_unavailable');
  }

  // W0 (65차 D28 ④): revise = Opus 4.8. provider 경유 호출 (registry resolve).
  const resolved = resolveRole('revise');

  let result;
  try {
    result = await resolved.provider.call({
      model: resolved.model,
      maxTokens: resolved.maxTokens,
      systemPrompt: input.systemPrompt,
      userPrompt: input.userPrompt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      `[callRevise] ai_call_failed ticker=${input.ticker} month=${input.month} message=${message}`,
    );
    throw new Error('revise_llm_failed');
  }

  const text = result.text;
  const usage: TokenUsage = result.usage;
  // Track 3 C-1 fix (5-angle scan): registry pricingKey 명시 — silent fallback 단가 차단.
  const costKrw = calculateCostKrw(usage, resolved.pricingKey);

  await insertCostLog(
    {
      month: input.month,
      ticker: input.ticker,
      persona_id: PERSONA_ID,
      prompt_version: REVISE_PROMPT_VERSION,
      model: resolved.model,
      ...usage,
      cost_krw: costKrw,
      prompt_cache_enabled: false,
      called_by: input.adminUserId,
    },
    { client: options.client },
  );

  return { content: text, usage, costKrw };
}
