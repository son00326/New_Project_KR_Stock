import type { SupabaseClient } from '@supabase/supabase-js';
import { getPersonaById } from './prompts/personas';
import { renderUserPrompt } from './prompts/render-user-prompt';
import { calculateCostKrw, type TokenUsage } from '@/lib/cost/pricing';
import { insertCostLog } from '@/lib/cost/cost-logger';
import { resolveRole, type ResolvedRole } from './model-registry';

export interface CallPersonaInput {
  personaId: string;
  ticker: string;
  financials: string;
  reflectionContext: string;
  adminUserId: string;
  // PR-C (ADR 2026-05-31): output 스키마 override. 미지정 시 persona.userPromptTemplate(legacy {vote}) 유지(비파괴).
  //   Tier 1 selection 어댑터는 PERSONA_SCORE_USER_PROMPT_TEMPLATE(scores/winning_timeframe/conviction) 주입.
  userPromptTemplate?: string;
  // PR-G (ADR 2026-05-31, cron 실 AI prep): cost_log INSERT용 client DI seam.
  //   admin path는 미지정 → insertCostLog가 session createClient() (auth.uid()=admin → RLS+called_by FK 통과).
  //   cron path는 service-role client 주입 (auth.uid()=null → RLS bypass + called_by=CRON_SYSTEM_USER_ID FK).
  costClient?: SupabaseClient;
  // W1a (D28 ① / D2): per-slot 모델 binding override — 패널 어댑터가 resolveTier1PanelSlot(i) 주입.
  //   미지정 시 기존 resolveRole('tier1_panel') 무회귀. cost_log.model = per-slot 실모델 기록.
  modelBinding?: ResolvedRole;
  // W1a (D5): R2 반박 라운드 placeholder — DEBATE_R2_USER_PROMPT_TEMPLATE 전용. 미지정 시 no-op.
  peerArguments?: string;
  ownPrior?: string;
  // G4 (D33 §4): 거시 컨텍스트(컨텍스트 입력 only). 미지정/"" → 프롬프트 byte-identical(dormant).
  //   Tier0 factor 아님·M12a와 범주 분리. renderUserPrompt가 끝에 조건부 append.
  macroContextString?: string;
  // P2 (PR5b, omxy R4 fix2): cost_log.month DI. 미지정 시 현 UTC월(기존 동작 무회귀).
  //   report-time Section 8 pass는 report month를 주입해 preflightHardcap month == insertCostLog month 정합
  //   (UTC-월 경계에서 hardcap/accounting drift 차단 — W1b judge cost_log month 버그와 동일 클래스).
  costLogMonth?: string;
}

export interface CallPersonaResult {
  content: string;
  usage: TokenUsage;
  costKrw: number;
  promptCacheEnabled: boolean;
}

function isCacheEnabled(): boolean {
  return process.env.AI_PROMPT_CACHE_ENABLED === 'true';
}

export async function callPersona(input: CallPersonaInput): Promise<CallPersonaResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ai_key_unavailable');
  }
  const persona = getPersonaById(input.personaId);
  if (!persona) throw new Error(`unknown_persona_id:${input.personaId}`);

  const promptCacheEnabled = isCacheEnabled();

  // PR-C: adapter override 우선 (PersonaScore 출력). 미지정 시 persona 기본 템플릿(legacy {vote}).
  const userPrompt = renderUserPrompt(input.userPromptTemplate ?? persona.userPromptTemplate, {
    ticker: input.ticker,
    financials: input.financials,
    reflectionContext: input.reflectionContext,
    peerArguments: input.peerArguments,
    ownPrior: input.ownPrior,
    macroContext: input.macroContextString,
  });

  // W1a (D28 ① / D2): per-slot binding override 우선. 미지정 시 tier1_panel 역할 resolve(무회귀).
  const resolved = input.modelBinding ?? resolveRole('tier1_panel');

  let result;
  try {
    result = await resolved.provider.call({
      model: resolved.model,
      maxTokens: resolved.maxTokens,
      systemPrompt: persona.systemPrompt,
      userPrompt,
      enablePromptCache: promptCacheEnabled,
    });
  } catch (err) {
    // W1a (D9) — transient 분류 보존: worker retryWithBackoff가 재시도 판단 가능하게.
    //   429/5xx/네트워크 hint = transient(suffix 부착) / 그 외 = 기존 ai_call_failed 유지.
    const msg = err instanceof Error ? err.message : String(err);
    const status =
      (err as { status?: number }).status ?? (err as { statusCode?: number }).statusCode;
    const transient =
      status === 429 ||
      (status !== undefined && status >= 500) ||
      /\b(?:429|529)\b|rate.?limit|overloaded|timeout|timed out|ECONNRESET|ETIMEDOUT|fetch failed|network/i.test(msg);
    throw new Error(transient ? `ai_call_failed:transient:${status ?? 'network'}` : 'ai_call_failed');
  }

  const text = result.text;
  const usage: TokenUsage = result.usage;
  const costKrw = calculateCostKrw(usage, resolved.pricingKey);

  // cost-logger 호출 (성공한 호출만 — orphan 보존을 위해 try/catch 안 함)
  // P2 (PR5b, omxy R4 fix2): costLogMonth DI 우선 — 미지정 시 현 UTC월(기존 동작 무회귀).
  const now = new Date();
  const month =
    input.costLogMonth ??
    `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  await insertCostLog(
    {
      month,
      ticker: input.ticker,
      persona_id: persona.id,
      prompt_version: persona.version,
      model: resolved.model,
      ...usage,
      cost_krw: costKrw,
      prompt_cache_enabled: promptCacheEnabled,
      called_by: input.adminUserId,
    },
    // PR-G — cron은 service-role client 주입, admin은 undefined → session createClient() fallback.
    { client: input.costClient },
  );

  return { content: text, usage, costKrw, promptCacheEnabled };
}
