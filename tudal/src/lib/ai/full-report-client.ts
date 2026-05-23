// PR3b — writer Section 0~7 풀 리포트 LLM 호출 wrapper.
// SoT = docs/superpowers/plans/2026-05-23-pr3b-writer-section-0-7.md (omxy R1~R5 CONVERGED).
// 별도 모듈 분리 — callPersona (anthropic-client.ts)는 200자 argument용 max_tokens 1024.
//   본 함수는 max_tokens 8192 (Section 0~7 + Appendix 통합 JSON).

import Anthropic from '@anthropic-ai/sdk';
import { calculateCostKrw, type TokenUsage } from '@/lib/cost/pricing';
import { insertCostLog } from '@/lib/cost/cost-logger';
import { FULL_REPORT_PROMPT_VERSION } from './prompts/full-report-prompt';

const MODEL = 'claude-opus-4-7';
const MAX_TOKENS = 8192;
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

export async function callFullReport(input: CallFullReportInput): Promise<CallFullReportResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ai_key_unavailable');
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let response;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: input.systemPrompt,
      messages: [{ role: 'user', content: input.userPrompt }],
    });
  } catch {
    // P0 #4 fix: callPersona는 ai_call_failed throw — 본 함수는 별도 키 throw로 format-error 매핑 정합.
    throw new Error('full_report_llm_failed');
  }

  const text = response.content
    .filter((c) => c.type === 'text')
    .map((c) => (c as { type: 'text'; text: string }).text)
    .join('');

  const usageWithCache = response.usage as typeof response.usage & {
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  const usage: TokenUsage = {
    input_tokens: response.usage.input_tokens ?? 0,
    cache_creation_input_tokens: usageWithCache.cache_creation_input_tokens ?? 0,
    cache_read_input_tokens: usageWithCache.cache_read_input_tokens ?? 0,
    output_tokens: response.usage.output_tokens ?? 0,
  };
  const costKrw = calculateCostKrw(usage);

  await insertCostLog({
    month: input.month,
    ticker: input.ticker,
    persona_id: PERSONA_ID,
    prompt_version: FULL_REPORT_PROMPT_VERSION,
    model: MODEL,
    ...usage,
    cost_krw: costKrw,
    prompt_cache_enabled: false,
    called_by: input.adminUserId,
  });

  return { content: text, usage, costKrw };
}
