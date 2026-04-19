// ---------------------------------------------------------------------------
// Anthropic API 가격표 + KRW 환산 (S6 M17, BL-16 A·BL-18 B)
// ref: https://www.anthropic.com/pricing (2026-01 기준 캐시·배치 미적용 표준가)
//
// 가격 단위: USD per 1M tokens (input·output 분리)
// 환산: cost_usd = (tokens_in × in_price + tokens_out × out_price) / 1_000_000
// KRW: cost_usd × COST_USD_TO_KRW (1430, 보수적 환율)
// ---------------------------------------------------------------------------

import { COST_USD_TO_KRW } from "@/types/admin";

export interface ModelPricing {
  inputPerMTokUsd: number;
  outputPerMTokUsd: number;
}

// 2026-01 기준 표준 단가. 캐싱·배치 할인은 호출부에서 별도 처리.
export const ANTHROPIC_PRICING: Record<string, ModelPricing> = {
  "claude-opus-4-7": { inputPerMTokUsd: 15, outputPerMTokUsd: 75 },
  "claude-sonnet-4-6": { inputPerMTokUsd: 3, outputPerMTokUsd: 15 },
  "claude-haiku-4-5": { inputPerMTokUsd: 1, outputPerMTokUsd: 5 },
};

export const DEFAULT_MODEL = "claude-sonnet-4-6";

export function getPricing(model: string): ModelPricing {
  return ANTHROPIC_PRICING[model] ?? ANTHROPIC_PRICING[DEFAULT_MODEL];
}

// USD 비용 계산
export function computeCostUsd(
  model: string,
  tokensPrompt: number,
  tokensCompletion: number,
): number {
  const p = getPricing(model);
  return (
    (tokensPrompt * p.inputPerMTokUsd) / 1_000_000 +
    (tokensCompletion * p.outputPerMTokUsd) / 1_000_000
  );
}

// KRW 환산 (소수점 2자리 round)
export function computeCostKrw(
  model: string,
  tokensPrompt: number,
  tokensCompletion: number,
  usdToKrw: number = COST_USD_TO_KRW,
): number {
  const usd = computeCostUsd(model, tokensPrompt, tokensCompletion);
  return Math.round(usd * usdToKrw * 100) / 100;
}
