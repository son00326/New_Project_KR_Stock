import Anthropic from '@anthropic-ai/sdk';
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

  const userPrompt = renderUserPrompt(persona.userPromptTemplate, {
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

  const usage: TokenUsage = {
    input_tokens: response.usage.input_tokens ?? 0,
    cache_creation_input_tokens: (response.usage as any).cache_creation_input_tokens ?? 0,
    cache_read_input_tokens: (response.usage as any).cache_read_input_tokens ?? 0,
    output_tokens: response.usage.output_tokens ?? 0,
  };
  const costKrw = calculateCostKrw(usage);

  // cost-logger 호출 (성공한 호출만 — orphan 보존을 위해 try/catch 안 함)
  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  await insertCostLog({
    month,
    ticker: input.ticker,
    persona_id: persona.id,
    prompt_version: persona.version,
    model: MODEL,
    ...usage,
    cost_krw: costKrw,
    prompt_cache_enabled: promptCacheEnabled,
    called_by: input.adminUserId,
  });

  return { content: text, usage, costKrw, promptCacheEnabled };
}
