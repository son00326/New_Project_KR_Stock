// W1b (D28 ③ / D2) — debate_judge(Opus 4.8 per-ticker 최종 판정) + dual_judge_gpt(경계 ±2 2차 의견).
// anthropic-client.ts 패턴 동형: provider 경유 + cost_log INSERT + W1a transient classifier.
// judge는 페르소나가 아님 — persona 시스템 프롬프트 미사용, cost_log.persona_id = 'debate-judge'/'dual-judge'.
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { calculateCostKrw, type TokenUsage } from '@/lib/cost/pricing';
import { insertCostLog } from '@/lib/cost/cost-logger';
import { resolveRoleCandidates, type AiRole, type ResolvedRole } from './model-registry';
import { extractJsonObject } from '@/lib/screening/persona-panel-adapter';
import type { SelectionTrack } from '@/lib/screening/tier1-schema';
import type { LlmCallResult } from './provider';

const score0to100 = z.number().min(0).max(100).finite();

export const JudgeVerdictSchema = z.object({
  scores: z.object({ short: score0to100, mid: score0to100, long: score0to100 }),
  winning_timeframe: z.enum(['short', 'mid', 'long']),
  rationale_kr: z.string().max(120),
  conviction: score0to100,
});
export type JudgeVerdict = z.infer<typeof JudgeVerdictSchema>;

/** round=3 panel_result(JudgeVerdict jsonb) type guard — R1/R2 PersonaScore[]와 이형 공존 (D4). */
export function isJudgeVerdict(value: unknown): value is JudgeVerdict {
  return JudgeVerdictSchema.safeParse(value).success;
}

/**
 * judge LLM 출력(free-text JSON) → JudgeVerdict.
 * rationale_kr은 120자 graceful truncate(schema parse 전 coerce). 위반 시 judge_verdict_parse_failed throw.
 */
export function parseJudgeVerdict(content: string): JudgeVerdict {
  let raw: unknown;
  try {
    raw = extractJsonObject(content);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    const suffix = msg.startsWith('persona_score_parse_failed:')
      ? msg.slice('persona_score_parse_failed:'.length)
      : 'invalid_json';
    throw new Error(`judge_verdict_parse_failed:${suffix}`);
  }
  const obj = (raw ?? {}) as Record<string, unknown>;
  const candidate = {
    scores: obj.scores,
    winning_timeframe: obj.winning_timeframe,
    rationale_kr: String(obj.rationale_kr ?? '').slice(0, 120),
    conviction: obj.conviction,
  };
  const result = JudgeVerdictSchema.safeParse(candidate);
  if (!result.success) {
    const path = result.error.issues[0]?.path.join('.') ?? 'unknown';
    throw new Error(`judge_verdict_parse_failed:${path}`);
  }
  return result.data;
}

export const JUDGE_SYSTEM_PROMPT =
  '당신은 투자위원회 최종 판정관입니다. 위원들의 1차 평가와 반박 라운드를 종합해 종목의 단기/중기/장기 매력도를 최종 판정합니다.';

export const JUDGE_USER_PROMPT = `다음 종목에 대한 투자위원회 토론(1차 평가 + 반박 라운드 반영 최종 패널)을 종합해 최종 판정하세요.

티커: {{TICKER}}
트랙: {{TRACK}}

지난달 성과 컨텍스트:
{{REFLECTION_CONTEXT}}

위원 최종 평가:
{{PEER_ARGUMENTS}}

지시: 다수결이 아니라 논거 품질로 판정하세요. 소수 의견이 더 설득력 있으면 채택하세요.

응답을 다음 JSON 형식으로만 반환하세요 (다른 텍스트·마크다운 없이):
{
  "scores": { "short": 0, "mid": 0, "long": 0 },
  "winning_timeframe": "short",
  "rationale_kr": "판정 근거 (한국어, 120자 이내)",
  "conviction": 0
}`;

export interface CallJudgeInput {
  ticker: string;
  month: string;
  track: SelectionTrack;
  /** 최종 panel 11명 요약 (renderPeerArguments 재사용 — caller가 생성). */
  panelSummary: string;
  /** incumbent thesis context (W2b) — 비-incumbent는 미지정 → '' 치환. */
  reflectionContext?: string;
  adminUserId: string;
  costClient?: SupabaseClient;
}

async function callJudgeRole(
  role: Extract<AiRole, 'debate_judge' | 'dual_judge_gpt'>,
  personaIdForLog: 'debate-judge' | 'dual-judge',
  input: CallJudgeInput,
): Promise<JudgeVerdict> {
  const candidates = resolveRoleCandidates(role);
  if (candidates.length === 0) {
    throw new Error('ai_key_unavailable');
  }
  const userPrompt = JUDGE_USER_PROMPT.replaceAll('{{TICKER}}', input.ticker)
    .replaceAll('{{TRACK}}', input.track)
    .replaceAll('{{REFLECTION_CONTEXT}}', input.reflectionContext ?? '')
    .replaceAll('{{PEER_ARGUMENTS}}', input.panelSummary);

  let lastError: unknown = null;
  for (const resolved of candidates) {
    let result: LlmCallResult;
    try {
      result = await resolved.provider.call({
        model: resolved.model,
        maxTokens: resolved.maxTokens,
        systemPrompt: JUDGE_SYSTEM_PROMPT,
        userPrompt,
        enablePromptCache: false,
        responseFormat: 'json_object',
      });
    } catch (err) {
      lastError = err;
      if (resolved.provider.id === 'openrouter') continue;
      throw normalizeJudgeCallError(err);
    }
    await logJudgeCost(resolved, result.usage, personaIdForLog, input);
    return parseJudgeVerdict(result.text);
  }
  throw normalizeJudgeCallError(lastError);
}

async function logJudgeCost(
  resolved: ResolvedRole,
  usage: TokenUsage,
  personaIdForLog: 'debate-judge' | 'dual-judge',
  input: CallJudgeInput,
) {
  const costKrw = calculateCostKrw(usage, resolved.pricingKey);
  await insertCostLog(
    {
      month: input.month,
      ticker: input.ticker,
      persona_id: personaIdForLog,
      prompt_version: 'judge@v1',
      model: resolved.model,
      ...usage,
      cost_krw: costKrw,
      prompt_cache_enabled: false,
      called_by: input.adminUserId,
    },
    { client: input.costClient },
  );
}

function normalizeJudgeCallError(err: unknown): Error {
  if (err instanceof Error && err.message.startsWith('judge_verdict_parse_failed')) {
    return err;
  }
  const msg = err instanceof Error ? err.message : String(err);
  const status =
    (err as { status?: number }).status ?? (err as { statusCode?: number }).statusCode;
  const transient =
    status === 429 ||
    (status !== undefined && status >= 500) ||
    /\b(?:429|529)\b|rate.?limit|overloaded|timeout|timed out|ECONNRESET|ETIMEDOUT|fetch failed|network|length/i.test(
      msg,
    );
  return new Error(transient ? `ai_call_failed:transient:${status ?? 'network'}` : 'ai_call_failed');
}

/** D28 ③ — per-ticker 최종 judge (Opus 4.8). */
export async function callJudge(input: CallJudgeInput): Promise<JudgeVerdict> {
  return callJudgeRole('debate_judge', 'debate-judge', input);
}

/** D28 ③ — 경계 ±2 dual-judge (GPT 최고급, GPT-off 시 Opus fallback auto-detect). */
export async function callDualJudge(input: CallJudgeInput): Promise<JudgeVerdict> {
  return callJudgeRole('dual_judge_gpt', 'dual-judge', input);
}
