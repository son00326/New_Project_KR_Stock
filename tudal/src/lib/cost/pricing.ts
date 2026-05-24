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

// PR3b — full report writer는 max_tokens 8192 (Section 0~7 + Appendix 통합 JSON).
// 3-track deep-review C1 fix (Track 2): MAX_COST_PER_CALL_KRW (output 2000 calibration)는
// full report 호출에 부족. input 3000 (sectorReference + macro + financials + technicals 합산)
// + output 6000 (8192 max_tokens realistic 사용량 75%) 기준으로 별도 calibration.
export const FULL_REPORT_MAX_COST_PER_CALL_KRW = calculateCostKrw({
  input_tokens: 3000,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
  output_tokens: 6000,
});

// M17 hardcap (Q2 합의 — 40만원)
export const HARDCAP_KRW = 400_000;

// ---------------------------------------------------------------------------
// PR3c (omxy R6 CONVERGED, 누적 21 BLOCKERS) — 3-step orchestration cost calibration.
// SoT = docs/superpowers/plans/2026-05-24-pr3c-orchestration-sector-reference.md (v6)
// ---------------------------------------------------------------------------

// B14 fix (omxy R3): anthropic-pricing.ts ANTHROPIC_PRICING 키 (calculateCostKrw 2nd arg).
// CRITIC_API_MODEL ('claude-haiku-4-5-20251001')는 critic-client.ts에 별도 declare —
// API call vs pricing key 분리로 fallback Sonnet 단가 차단.
export const CRITIC_PRICING_KEY = "claude-haiku-4-5" as const;
if (!(CRITIC_PRICING_KEY in ANTHROPIC_PRICING)) {
  throw new Error(`${CRITIC_PRICING_KEY} not in ANTHROPIC_PRICING — anthropic-pricing.ts SoT 갱신 필요`);
}

// PR3c — critic call (Haiku 4.5)
// 현재 단가: Haiku $1 input / $5 output × 1430 KRW/USD ≈ 5원 (input 1000 + output 500).
export const CRITIC_MAX_COST_PER_CALL_KRW = calculateCostKrw(
  { input_tokens: 1000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 500 },
  CRITIC_PRICING_KEY,
);

// PR3c — revise call (Opus 4.7, max_tokens 8192 — B3 fix · input 8000 — B11 보수화)
// 현재 단가: Opus $5 input / $25 output × 1430 ≈ 271원 (input 8000 + output 6000).
export const REVISE_MAX_COST_PER_CALL_KRW = calculateCostKrw({
  input_tokens: 8000,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
  output_tokens: 6000,
});

// PR3c — orchestrate total budget (writer + critic + revise worst case)
// 약 236 + 5 + 271 = 512원/per ticker worst case (revise 항상 발생 가정).
// 30 stocks × 512 = 15,360원/월 ≈ M17 hardcap 400k의 3.8%.
export const ORCHESTRATE_TOTAL_COST_BUDGET_KRW =
  FULL_REPORT_MAX_COST_PER_CALL_KRW + CRITIC_MAX_COST_PER_CALL_KRW + REVISE_MAX_COST_PER_CALL_KRW;
