// ---------------------------------------------------------------------------
// 멀티프로바이더 AI API 가격표 + KRW 환산 (S6 M17 → W0 D28 확장)
// ref Anthropic: https://platform.claude.com/docs/en/about-claude/pricing (2026-06 검증)
// ref OpenAI:   https://developers.openai.com/api/docs/pricing (2026-06 검증)
//
// ⚠️ 파일명은 historical (S6 당시 Anthropic 단독). W0(65차 Q3/D28)부터 멀티프로바이더
//    MODEL_PRICING SoT. 이름 변경은 import 경로 churn 대비 이득 없어 유지.
//
// D28 ② fail-closed: getPricing은 미등록 모델에서 throw (구 silent Sonnet fallback 제거
//    — reservation undercount 차단).
// ---------------------------------------------------------------------------

import { COST_USD_TO_KRW } from "@/types/admin";

export type AiProviderId = "anthropic" | "openai";

export interface ModelPricing {
  provider: AiProviderId;
  inputPerMTokUsd: number;
  outputPerMTokUsd: number;
  // prompt cache 승수 (input 단가 기준):
  //   anthropic: write(5m) ×1.25 / read ×0.10 (공식 docs 2026-06 재검증)
  //   openai:    자동 캐시 — write 개념 없음(0) / cached input ×0.10
  cacheWriteMult: number;
  cacheReadMult: number;
}

// 2026-06 기준 표준 단가 (각 공식 docs). 배치/규모 할인 미적용.
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Anthropic
  "claude-opus-4-8":  { provider: "anthropic", inputPerMTokUsd: 5,    outputPerMTokUsd: 25,  cacheWriteMult: 1.25, cacheReadMult: 0.1 },
  "claude-opus-4-7":  { provider: "anthropic", inputPerMTokUsd: 5,    outputPerMTokUsd: 25,  cacheWriteMult: 1.25, cacheReadMult: 0.1 },
  "claude-sonnet-4-6":{ provider: "anthropic", inputPerMTokUsd: 3,    outputPerMTokUsd: 15,  cacheWriteMult: 1.25, cacheReadMult: 0.1 },
  "claude-haiku-4-5": { provider: "anthropic", inputPerMTokUsd: 1,    outputPerMTokUsd: 5,   cacheWriteMult: 1.25, cacheReadMult: 0.1 },
  // OpenAI (D28 ① GPT 단가 등록 — gpt-5.4 ≈ Sonnet급 검증 TRUE)
  "gpt-5.5":          { provider: "openai",    inputPerMTokUsd: 5,    outputPerMTokUsd: 30,  cacheWriteMult: 0,    cacheReadMult: 0.1 },
  "gpt-5.4":          { provider: "openai",    inputPerMTokUsd: 2.5,  outputPerMTokUsd: 15,  cacheWriteMult: 0,    cacheReadMult: 0.1 },
  "gpt-5.4-mini":     { provider: "openai",    inputPerMTokUsd: 0.75, outputPerMTokUsd: 4.5, cacheWriteMult: 0,    cacheReadMult: 0.1 },
};

// 하위호환 alias (기존 import 보존 — 신규 코드는 MODEL_PRICING 사용)
export const ANTHROPIC_PRICING = MODEL_PRICING;

// dry-run 견적 기본 모델 (settings/cost 견적 화면용 — fallback 아님)
export const DEFAULT_MODEL = "claude-sonnet-4-6";

// D28 ② fail-closed: silent fallback 제거 — 미등록 모델 = throw.
export function getPricing(model: string): ModelPricing {
  const p = MODEL_PRICING[model];
  if (!p) throw new Error(`pricing_unknown_model:${model}`);
  return p;
}

// USD 비용 계산 (cache 미반영 단순 견적 — dry-run-estimate 전용)
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
