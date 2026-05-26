// PR3c — 3-step orchestration critic 단계 orchestrator.
// SoT = plan v6, omxy R6 CONVERGED.
//
// Q3 threshold: any FAIL ≥ 1 OR WARN ≥ 4 → shouldRevise=true.
// 1회 hard cap invariant: 본 helper는 callCritic 한 번만 호출. revise는 orchestrator가 별도 처리.
//   ✱ critic.ts에 callRevise 호출 0 (recursive revise 차단 — Verification gate 13).

import type { SupabaseClient } from '@supabase/supabase-js';
import { callCritic, type CallCriticResult, type CriticResultJson } from '@/lib/ai/critic-client';
import { CRITIC_SYSTEM_PROMPT, buildCriticUserPrompt } from '@/lib/ai/prompts/critic-prompt';

export const REVISE_TRIGGER_WARN_THRESHOLD = 4;

// PR4 Task 2 Step 2.1 (caller DI seam): evaluateReport에 options 3rd arg —
// callCritic으로 client 전파 (cost_log RLS 정합).
export interface EvaluateReportOptions {
  client?: SupabaseClient;
}

export interface EvaluateReportContext {
  ticker: string;
  month: string;
  adminUserId: string;
  sectorContext?: string;
  kevinV31Markers?: string;
  consensusBadge?: '🟢' | '🔵' | '🟣' | '🟡';
}

export interface CriticResult {
  verdict: CriticResultJson;
  shouldRevise: boolean;
  failCount: number;
  warnCount: number;
  costKrw: number;
}

export async function evaluateReport(
  sections: Record<string, unknown>,
  ctx: EvaluateReportContext,
  options: EvaluateReportOptions = {},
): Promise<CriticResult> {
  const sectionsSummary = JSON.stringify(sections);
  const userPrompt = buildCriticUserPrompt({
    ticker: ctx.ticker,
    month: ctx.month,
    sectionsSummary,
    sectorContext: ctx.sectorContext ?? '',
    kevinV31Markers: ctx.kevinV31Markers ?? 'M1~M8 markers',
    consensusBadge: ctx.consensusBadge ?? '🟢',
  });

  const criticCall: CallCriticResult = await callCritic(
    {
      ticker: ctx.ticker,
      month: ctx.month,
      systemPrompt: CRITIC_SYSTEM_PROMPT,
      userPrompt,
      adminUserId: ctx.adminUserId,
    },
    { client: options.client },
  );

  const verdicts = Object.values(criticCall.verdict);
  const failCount = verdicts.filter((v) => v.verdict === 'FAIL').length;
  const warnCount = verdicts.filter((v) => v.verdict === 'WARN').length;
  // Q3 threshold: any FAIL OR WARN ≥ 4
  const shouldRevise = failCount > 0 || warnCount >= REVISE_TRIGGER_WARN_THRESHOLD;

  return {
    verdict: criticCall.verdict,
    shouldRevise,
    failCount,
    warnCount,
    costKrw: criticCall.costKrw,
  };
}
