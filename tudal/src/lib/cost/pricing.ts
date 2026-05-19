// Anthropic 공식 단가 — 변경 시 SoT는 공식 문서. 본 상수는 conservative upper-bound 추정.
// claude-opus-4-7 base pricing (USD per 1M tokens, 2026-05 기준 가정)

const USD_PER_KRW = 1 / 1380;  // 1 USD = 1380 KRW (대략)

const OPUS_INPUT_USD_PER_MTOK = 15;
const OPUS_OUTPUT_USD_PER_MTOK = 75;

const KRW_PER_INPUT_TOKEN = OPUS_INPUT_USD_PER_MTOK / 1_000_000 / USD_PER_KRW;
const KRW_PER_OUTPUT_TOKEN = OPUS_OUTPUT_USD_PER_MTOK / 1_000_000 / USD_PER_KRW;

export interface TokenUsage {
  input_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  output_tokens: number;
}

export function calculateCostKrw(usage: TokenUsage): number {
  const inputCost = usage.input_tokens * KRW_PER_INPUT_TOKEN;
  const cacheCreationCost = usage.cache_creation_input_tokens * KRW_PER_INPUT_TOKEN * 1.25;
  const cacheReadCost = usage.cache_read_input_tokens * KRW_PER_INPUT_TOKEN * 0.10;
  const outputCost = usage.output_tokens * KRW_PER_OUTPUT_TOKEN;
  return Number((inputCost + cacheCreationCost + cacheReadCost + outputCost).toFixed(2));
}

// 보수적 upper-bound — preflight reservation용 (Plan R3 BLOCKER 1)
// 페르소나당 systemPrompt 1.5KB + userPromptTemplate input 2KB 정도 → 보수적으로 1500 input tokens
// output 평균 1000 tokens, 보수적 upper-bound 2000
// cache miss 가정
export const MAX_COST_PER_CALL_KRW = calculateCostKrw({
  input_tokens: 1500,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
  output_tokens: 2000,
});

// M17 hardcap (Q2 합의 — 40만원)
export const HARDCAP_KRW = 400_000;
