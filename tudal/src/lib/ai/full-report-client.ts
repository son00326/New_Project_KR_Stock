// PR3b — writer Section 0~7 풀 리포트 LLM 호출 wrapper.
// SoT = docs/superpowers/plans/2026-05-23-pr3b-writer-section-0-7.md (omxy R1~R5 CONVERGED).
// 별도 모듈 분리 — callPersona (anthropic-client.ts)는 200자 argument용 max_tokens 1024.
//   본 함수는 max_tokens 8192 (Section 0~7 + Appendix 통합 JSON).

import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateCostKrw, type TokenUsage } from '@/lib/cost/pricing';
import { insertCostLog } from '@/lib/cost/cost-logger';
import { FULL_REPORT_PROMPT_VERSION } from './prompts/full-report-prompt';
import { resolveRole, isRoleProviderAvailable } from './model-registry';

// PR4 Task 1 Step 1.1 (B2 fix omxy R1): caller DI seam — AI client options 2nd arg.
export interface CallFullReportOptions {
  client?: SupabaseClient;
}

const PERSONA_ID = 'full_report_writer';

export interface CallFullReportInput {
  ticker: string;
  month: string;        // 'YYYY-MM'
  systemPrompt: string;
  userPrompt: string;
  adminUserId: string;
}

export interface CallFullReportResult {
  content: string;
  usage: TokenUsage;
  costKrw: number;
}

export async function callFullReport(
  input: CallFullReportInput,
  options: CallFullReportOptions = {},
): Promise<CallFullReportResult> {
  // 항목1 — provider-agnostic 게이트: full_report = GLM primary → Claude fallback. 둘 다 부재 시만 throw.
  if (!isRoleProviderAvailable('full_report')) {
    throw new Error('ai_key_unavailable');
  }

  // W0 (65차 D28 ④): writer = full_report role(GLM primary / Claude fallback). 모델 하드코딩 제거 — registry resolve.
  const resolved = resolveRole('full_report');

  let result;
  try {
    result = await resolved.provider.call({
      model: resolved.model,
      maxTokens: resolved.maxTokens,
      systemPrompt: input.systemPrompt,
      userPrompt: input.userPrompt,
    });
  } catch (err) {
    // 3-track Track 3 Angle 4 fix (CR-3): underlying AI SDK error를 structured warn으로 capture
    // (rate-limit 429 vs auth 401 vs 5xx vs network ECONNRESET 구분 가능). 운영 디버깅성 보강.
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      `[callFullReport] ai_call_failed ticker=${input.ticker} month=${input.month} message=${message}`,
    );
    // P0 #4 fix: callPersona의 일반 LLM 실패 코드와 분리 — 본 함수는 별도 키 throw로 format-error 매핑 정합.
    throw new Error('full_report_llm_failed');
  }

  const text = result.text;
  const usage: TokenUsage = result.usage;
  const costKrw = calculateCostKrw(usage, resolved.pricingKey);

  await insertCostLog(
    {
      month: input.month,
      ticker: input.ticker,
      persona_id: PERSONA_ID,
      prompt_version: FULL_REPORT_PROMPT_VERSION,
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
