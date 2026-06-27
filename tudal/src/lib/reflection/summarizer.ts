// PR-K Reflection — (선택) LLM 케이스 요약 호출 (judge-client 패턴 동형).
//   critic 역할(저가 cross-check 모델)로 과거 실현 성과를 1~2줄 회고 요약.
//   provider 경유 + cost_log INSERT(persona_id='reflection-summary') + W1a transient classifier.
//   회고지 예측 아님(미래 수익 예측 금지 — summary-prompt 지시문). Claude 필수 primary(GPT-only 미지원).
// SoT: docs/superpowers/specs/2026-06-27-reflection-prk-build.md §4·§6.

import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateCostKrw, type TokenUsage } from "@/lib/cost/pricing";
import { insertCostLog } from "@/lib/cost/cost-logger";
import { resolveRole } from "@/lib/ai/model-registry";
import {
  REFLECTION_SUMMARY_SYSTEM_PROMPT,
  buildReflectionSummaryPrompt,
} from "@/lib/reflection/summary-prompt";
import type { ReflectionMetrics, ReflectionTrack } from "@/lib/reflection/types";

const SUMMARY_MAX_CHARS = 300;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PREDICTION_CLAIM_RE =
  /예측|전망|예상|오를|상승할|하락할|다음|사이클|늘리면|줄이면|좋은 결과|날 것입니다|forecast|predict|next cycle|should|would|will|improve|higher|lower/i;
const NEGATED_PREDICTION_RE =
  /(?:예측\s*(?:아님|금지)|예측하지\s*(?:않|마세요|말)|전망\s*(?:아님|금지)|예상\s*(?:아님|금지))/g;
const RETROSPECTIVE_SUMMARY_RE =
  /회고|과거|실현|정렬|결과와|표본|평가군|직전|was aligned|were aligned|retrospective|realized|past/i;

export interface SummarizeReflectionInput {
  metrics: ReflectionMetrics;
  track: ReflectionTrack;
  /** cost_log.month — LLM 비용이 발생하는 실행 시점 월(YYYY-MM). preflight month와 정합. */
  month: string;
  adminUserId: string;
  costPreflightReserved?: true;
  costClient?: SupabaseClient;
}

export async function summarizeReflection(
  input: SummarizeReflectionInput,
): Promise<string> {
  if (process.env.AI_COST_LOG_REAL_INSERT_ENABLED !== "true") {
    throw new Error("reflection_summary_cost_logging_required");
  }
  if (!UUID_RE.test(input.adminUserId)) {
    throw new Error("reflection_summary_admin_user_id_invalid");
  }
  if (input.costPreflightReserved !== true) {
    throw new Error("reflection_summary_preflight_required");
  }
  // D28 A — Claude 필수 primary 불변 (GPT-only 미지원).
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ai_key_unavailable");
  }
  const resolved = resolveRole("critic");
  const userPrompt = buildReflectionSummaryPrompt(input.metrics, input.track);

  let result;
  try {
    result = await resolved.provider.call({
      model: resolved.model,
      maxTokens: resolved.maxTokens,
      systemPrompt: REFLECTION_SUMMARY_SYSTEM_PROMPT,
      userPrompt,
      enablePromptCache: false,
    });
  } catch (err) {
    // W1a (D9) classifier 동일 — transient 분류 보존(worker 재시도 판단).
    const msg = err instanceof Error ? err.message : String(err);
    const status =
      (err as { status?: number }).status ??
      (err as { statusCode?: number }).statusCode;
    const transient =
      status === 429 ||
      (status !== undefined && status >= 500) ||
      /\b(?:429|529)\b|rate.?limit|overloaded|timeout|timed out|ECONNRESET|ETIMEDOUT|fetch failed|network/i.test(
        msg,
      );
    throw new Error(
      transient ? `ai_call_failed:transient:${status ?? "network"}` : "ai_call_failed",
    );
  }

  const usage: TokenUsage = result.usage;
  const costKrw = calculateCostKrw(usage, resolved.pricingKey);
  // cost_log — persona_id='reflection-summary'(페르소나 아님), ticker는 N/A 마커.
  await insertCostLog(
    {
      month: input.month,
      ticker: "000000", // 6-digit sentinel(non-ticker, 미할당 코드) — cycle-level call(향후 6자리 CHECK 대비)
      persona_id: "reflection-summary",
      prompt_version: "reflection-summary@v1",
      model: resolved.model,
      ...usage,
      cost_krw: costKrw,
      prompt_cache_enabled: false,
      called_by: input.adminUserId,
    },
    { client: input.costClient },
  );

  const summary = result.text.trim().slice(0, SUMMARY_MAX_CHARS);
  const claimText = summary.replace(NEGATED_PREDICTION_RE, "");
  if (PREDICTION_CLAIM_RE.test(claimText) || !RETROSPECTIVE_SUMMARY_RE.test(summary)) {
    throw new Error("reflection_summary_prediction_claim");
  }
  return summary;
}
