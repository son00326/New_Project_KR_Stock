import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getPersonaById } from './prompts/personas';
import { renderUserPrompt } from './prompts/render-user-prompt';
import { calculateCostKrw, type TokenUsage } from '@/lib/cost/pricing';
import { insertCostLog } from '@/lib/cost/cost-logger';

const MODEL = 'claude-opus-4-7';

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

  const systemBlocks = promptCacheEnabled
    ? [{ type: 'text' as const, text: persona.systemPrompt, cache_control: { type: 'ephemeral' as const } }]
    : [{ type: 'text' as const, text: persona.systemPrompt }];

  // PR-C: adapter override 우선 (PersonaScore 출력). 미지정 시 persona 기본 템플릿(legacy {vote}).
  const userPrompt = renderUserPrompt(input.userPromptTemplate ?? persona.userPromptTemplate, {
    ticker: input.ticker,
    financials: input.financials,
    reflectionContext: input.reflectionContext,
  });

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let response;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemBlocks,
      messages: [{ role: 'user', content: userPrompt }],
    });
  } catch (err) {
    throw new Error('ai_call_failed');
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

  // cost-logger 호출 (성공한 호출만 — orphan 보존을 위해 try/catch 안 함)
  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  await insertCostLog(
    {
      month,
      ticker: input.ticker,
      persona_id: persona.id,
      prompt_version: persona.version,
      model: MODEL,
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
