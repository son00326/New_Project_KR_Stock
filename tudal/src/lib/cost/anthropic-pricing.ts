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

export type AiProviderId = "anthropic" | "openai" | "openrouter";

export interface ModelPricing {
  provider: AiProviderId;
  inputPerMTokUsd: number;
  outputPerMTokUsd: number;
  // prompt cache 승수 (input 단가 기준):
  //   anthropic:  write(5m) ×1.25 / read ×0.10 (공식 docs 2026-06 재검증)
  //   openai:     자동 캐시 — write 개념 없음(0) / cached input ×0.10
  //   openrouter: GLM 5.2 명시 캐시 — read = $0.18/$0.93 ≈ 0.1935 (실측 slug 단가).
  //     write 별도 단가 미공시 → 보수적으로 anthropic과 동일 ×1.25 (undercount 금지, fail-closed).
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
  // OpenRouter (항목1 — GLM 5.2 primary. slug "z-ai/glm-5.2" 실측 단가 USD/Mtok: 입력 0.93 / 출력 3.00 / 캐시읽기 0.18)
  "glm-5.2":          { provider: "openrouter", inputPerMTokUsd: 0.93, outputPerMTokUsd: 3,  cacheWriteMult: 1.25, cacheReadMult: 0.18 / 0.93 },
  // OpenRouter 경유 GPT (항목1 후속 2026-07-01 — GPT 역할을 별도 OpenAI 키 없이 OpenRouter로.
  //   per-token 단가 = OpenAI 직접 list와 동일(실측 slug openai/gpt-5.5=$5/$30, openai/gpt-5.4=$2.5/$15).
  //   OpenRouter 수수료 ~5%는 크레딧 충전 시점(per-call 아님)이라 per-token 단가엔 미반영.
  "openai/gpt-5.5":   { provider: "openrouter", inputPerMTokUsd: 5,    outputPerMTokUsd: 30,  cacheWriteMult: 0,    cacheReadMult: 0.1 },
  "openai/gpt-5.4":   { provider: "openrouter", inputPerMTokUsd: 2.5,  outputPerMTokUsd: 15,  cacheWriteMult: 0,    cacheReadMult: 0.1 },
};

// 하위호환 alias (기존 import 보존 — 신규 코드는 MODEL_PRICING 사용)
export const ANTHROPIC_PRICING = MODEL_PRICING;

// dry-run 견적 기본 모델 (settings/cost 견적 화면용 — 실호출 아님). GLM primary 역할 기준.
export const DEFAULT_MODEL = "glm-5.2";

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
