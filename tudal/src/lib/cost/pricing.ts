// S7a Q6 cache-aware cost adapter — anthropic-pricing.ts wrapper.
// 단가표 + 환율 SoT = anthropic-pricing.ts (S6 M17). 본 모듈은 cache 비용 처리만 추가.
// omxy R5 합의 (옵션 B 채택): DRY + COST_USD_TO_KRW 통일 + 기존 importers 영향 0.

import { MODEL_PRICING, getPricing } from "./anthropic-pricing";
import { COST_USD_TO_KRW } from "@/types/admin";

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

// 65차 LOCKED #5 (2026-06-04) — 40만 → 50만. 구 "M17 Q2 40만"은 supersede.
export const HARDCAP_KRW = 500_000;

// ---------------------------------------------------------------------------
// PR3c (omxy R6 CONVERGED, 누적 21 BLOCKERS) — 3-step orchestration cost calibration.
// SoT = docs/superpowers/plans/2026-05-24-pr3c-orchestration-sector-reference.md (v6)
// ---------------------------------------------------------------------------

// B14 fix (omxy R3): anthropic-pricing.ts ANTHROPIC_PRICING 키 (calculateCostKrw 2nd arg).
// CRITIC_API_MODEL ('claude-haiku-4-5-20251001')는 critic-client.ts에 별도 declare —
// API call vs pricing key 분리로 fallback Sonnet 단가 차단.
export const CRITIC_PRICING_KEY = "claude-haiku-4-5" as const;
if (!(CRITIC_PRICING_KEY in MODEL_PRICING)) {
  throw new Error(`${CRITIC_PRICING_KEY} not in MODEL_PRICING — anthropic-pricing.ts SoT 갱신 필요`);
}

// PR3c — critic call (Haiku 4.5)
// B22 fix (omxy R7): evaluateReport이 sectionsSummary = JSON.stringify(sections) 전체 inject.
// hardcap 보수적 calibration = input 9000 (Section 0~7 + Appendix JSON stringify upper-bound) +
// output 2048 (CRITIC_MAX_TOKENS). 현재 단가 ≈ 27.5원 (Haiku $1 input / $5 output × 1430 KRW/USD).
export const CRITIC_MAX_COST_PER_CALL_KRW = calculateCostKrw(
  { input_tokens: 9000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 2048 },
  CRITIC_PRICING_KEY,
);

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

// PR3c — orchestrate total budget (writer + critic + revise worst case)
// 약 236 + 27.5 + 272 ≈ 535원/per ticker worst case (revise 항상 발생 가정 + B22 critic input 9000 보수화).
// 30 stocks × 535 ≈ 16,050원/월 ≈ hardcap 500k(65차 LOCKED #5)의 3.2%.
// 평균 30% revise trigger 가정 시 ≈ 345원/ticker × 30 ≈ 10,350원/월 (2.1%).
export const ORCHESTRATE_TOTAL_COST_BUDGET_KRW =
  FULL_REPORT_MAX_COST_PER_CALL_KRW + CRITIC_MAX_COST_PER_CALL_KRW + REVISE_MAX_COST_PER_CALL_KRW;

// PR5 — cron batch cost-warning 임계 (HARDCAP_KRW=500k 대비 조기 경고).
// 65차 LOCKED #5 (2026-06-04): 35만 → 45만 (hardcap 90% 파생).
// best-effort budget guard (R4 MEDIUM-2): 535는 projection이지 strict token ceiling 아님.
export const COST_WARNING_THRESHOLD_KRW = 450_000;
