// S7a Q6 cache-aware cost adapter — anthropic-pricing.ts wrapper.
// 단가표 + 환율 SoT = anthropic-pricing.ts (S6 M17). 본 모듈은 cache 비용 처리만 추가.
// omxy R5 합의 (옵션 B 채택): DRY + COST_USD_TO_KRW 통일 + 기존 importers 영향 0.

import { MODEL_PRICING, getPricing } from "./anthropic-pricing";
import { COST_USD_TO_KRW } from "@/types/admin";

export { COST_HARDCAP_KRW as HARDCAP_KRW, COST_WARNING_THRESHOLD_KRW } from "@/types/admin";

export interface TokenUsage {
  input_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  output_tokens: number;
}

// S7a 페르소나 평가 = Opus 4.7 (기본 sonnet과 분리)
export const S7A_MODEL = "claude-opus-4-7";

if (!(S7A_MODEL in MODEL_PRICING)) {
  throw new Error(`S7A_MODEL ${S7A_MODEL} not found in MODEL_PRICING — anthropic-pricing.ts SoT 갱신 필요`);
}

// cache multipliers는 W0(D28 ④)부터 per-model 단가표 필드(cacheWriteMult/cacheReadMult)로 이동.
//   anthropic: write ×1.25 / read ×0.10 · openai: write 0(자동 캐시) / read ×0.10.
export function calculateCostKrw(usage: TokenUsage, model: string = S7A_MODEL): number {
  const pricing = getPricing(model); // D28 ② 미등록 모델 throw
  const inUsdPerTok = pricing.inputPerMTokUsd / 1_000_000;
  const outUsdPerTok = pricing.outputPerMTokUsd / 1_000_000;

  const inputUsd = usage.input_tokens * inUsdPerTok;
  const cacheCreationUsd = usage.cache_creation_input_tokens * inUsdPerTok * pricing.cacheWriteMult;
  const cacheReadUsd = usage.cache_read_input_tokens * inUsdPerTok * pricing.cacheReadMult;
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

// ---------------------------------------------------------------------------
// PR3c (omxy R6 CONVERGED, 누적 21 BLOCKERS) — 3-step orchestration cost calibration.
// SoT = docs/superpowers/plans/2026-05-24-pr3c-orchestration-sector-reference.md (v6)
// ---------------------------------------------------------------------------

// PR3c — revise call (W0 D28 ④: Opus 4.8, max_tokens 8192 — B3 fix · input 8000 — B11 보수화)
// Track 3 C-1 fix (5-angle scan cross-confirmed angles 3+5): defense-in-depth — B14 pattern 정합.
// REVISE_PRICING_KEY 명시 + throw guard로 model bump 시 silent fallback Sonnet 단가 차단.
export const REVISE_PRICING_KEY = "claude-opus-4-8" as const;
if (!(REVISE_PRICING_KEY in MODEL_PRICING)) {
  throw new Error(`${REVISE_PRICING_KEY} not in MODEL_PRICING — anthropic-pricing.ts SoT 갱신 필요`);
}
// 현재 단가: Opus $5 input / $25 output × 1430 ≈ 271원 (input 8000 + output 6000).
export const REVISE_MAX_COST_PER_CALL_KRW = calculateCostKrw(
  {
    input_tokens: 8000,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    output_tokens: 6000,
  },
  REVISE_PRICING_KEY,
);

// W0 D28 ③ supersede: legacy fixed orchestration budget(writer+critic+revise 고정 합산)은
// critic이 GPT mid로 resolve되면 Haiku 고정 단가로 undercount → model-registry
// getOrchestrateBudgetKrw()(역할별 worst-case 합산)로 이전. 본 상수는 importer 0이라 제거.
