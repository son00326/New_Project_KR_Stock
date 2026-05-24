// PR3c — 3-step orchestration Step 1 analyst (pure-code shape transform).
// SoT = plan v6, omxy R6 CONVERGED.
//
// B9 fix (omxy R1): quality lift 주장 0. 본 analyst는 production data A/B comparison 별도 PR로 위임.
//   PR3c에서는 shape transform invariant + idempotent invariant만 보장.
// (i) fix (omxy R4): test snapshot pattern 대신 explicit shape assertions 사용.

import type { FullReportUserPromptInput } from '@/lib/ai/prompts/full-report-prompt';

// EnrichedFullReportInput = 기존 FullReportUserPromptInput과 동일 shape.
// 미래 enrichment fields (예: marker hint, peer list 추출) 추가 시 본 인터페이스에 optional 필드 확장.
export type EnrichedFullReportInput = FullReportUserPromptInput;

/**
 * Pure-code shape transform — input summary strings를 enriched shape로 변환.
 *
 * 현재 PR3c (v6) 구현 = identity transform (모든 입력 필드 그대로 통과).
 * 미래 extension hook: financialsSummary 정규식 파싱·peer list 추출·marker hint 주입 등.
 *
 * ✱ quality lift 주장 0 (B9 fix omxy R1): production data A/B comparison 별도 PR. 본 PR3c는
 *   pure function shape invariant + idempotent invariant만 박제.
 *
 * LLM 호출 0. 비용 0. side-effect 0.
 */
export function enrichInput(input: FullReportUserPromptInput): EnrichedFullReportInput {
  return {
    ticker: input.ticker,
    name: input.name,
    sector: input.sector,
    month: input.month,
    tier1Verdict: input.tier1Verdict,
    consensusBadge: input.consensusBadge,
    financialsSummary: input.financialsSummary,
    technicalsSummary: input.technicalsSummary,
    macroSummary: input.macroSummary,
    sectorReference: input.sectorReference,
  };
}
