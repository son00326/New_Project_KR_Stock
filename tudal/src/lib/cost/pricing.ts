// S7a Q6 cache-aware cost adapter — anthropic-pricing.ts wrapper.
// 단가표 + 환율 SoT = anthropic-pricing.ts (S6 M17). 본 모듈은 cache 비용 처리만 추가.
// omxy R5 합의 (옵션 B 채택): DRY + COST_USD_TO_KRW 통일 + 기존 importers 영향 0.

import { ANTHROPIC_PRICING, getPricing } from "./anthropic-pricing";
import { COST_USD_TO_KRW } from "@/types/admin";

export interface TokenUsage {
  input_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  output_tokens: number;
}

// S7a 페르소나 평가 = Opus 4.7 (기본 sonnet과 분리)
export const S7A_MODEL = "claude-opus-4-7";

if (!(S7A_MODEL in ANTHROPIC_PRICING)) {
  throw new Error(`S7A_MODEL ${S7A_MODEL} not found in ANTHROPIC_PRICING — anthropic-pricing.ts SoT 갱신 필요`);
}

// cache multipliers (Anthropic prompt caching 공식):
// - normal input ×1.0
// - cache creation ×1.25 (write 비용 추가)
// - cache read    ×0.10 (90% 할인)
// - output        ×1.0
const CACHE_CREATION_MULT = 1.25;
const CACHE_READ_MULT = 0.10;

export function calculateCostKrw(usage: TokenUsage, model: string = S7A_MODEL): number {
  const pricing = getPricing(model);
  const inUsdPerTok = pricing.inputPerMTokUsd / 1_000_000;
  const outUsdPerTok = pricing.outputPerMTokUsd / 1_000_000;

  const inputUsd = usage.input_tokens * inUsdPerTok;
  const cacheCreationUsd = usage.cache_creation_input_tokens * inUsdPerTok * CACHE_CREATION_MULT;
  const cacheReadUsd = usage.cache_read_input_tokens * inUsdPerTok * CACHE_READ_MULT;
  const outputUsd = usage.output_tokens * outUsdPerTok;
  const totalUsd = inputUsd + cacheCreationUsd + cacheReadUsd + outputUsd;

  return Math.round(totalUsd * COST_USD_TO_KRW * 100) / 100;
}

// 보수적 upper-bound — preflight reservation용 (Plan R3 BLOCKER 1).
// 페르소나당 systemPrompt ~1.5KB + user input ~2KB → 1500 input tokens (cache miss 가정)
// output 보수적 upper-bound 2000 tokens
export const MAX_COST_PER_CALL_KRW = calculateCostKrw({
  input_tokens: 1500,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
  output_tokens: 2000,
});

// M17 hardcap (Q2 합의 — 40만원)
export const HARDCAP_KRW = 400_000;
