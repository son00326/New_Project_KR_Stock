// W3b-1 (D26 Q2 / D1) — portfolio_proposal AI 자율 제안 (Opus 4.8 `portfolio` role).
// judge-client.ts 패턴 동형: provider 경유 + cost_log INSERT + W1a transient classifier + zod 파서.
// AI 호출은 caller(proposePortfolio)가 flag+key+admin 게이트 후에만 — 본 모듈은 ANTHROPIC_API_KEY 가용성만 확인.
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { calculateCostKrw, type TokenUsage } from '@/lib/cost/pricing';
import { insertCostLog } from '@/lib/cost/cost-logger';
import { resolveRole } from './model-registry';
import { extractJsonObject } from '@/lib/screening/persona-panel-adapter';

const weightSchema = z.number().gt(0).lte(1).finite();

export const PortfolioProposalSchema = z
  .object({
    positions: z
      .array(
        z.object({
          ticker: z.string().regex(/^\d{6}$/),
          weight: weightSchema,
          timeframe: z.enum(['short', 'mid', 'long']),
        }),
      )
      .min(1) // W3b-1: 현 cash cap 0~30% 유지 → 최소 1종목. 0종목/현금100%는 product 변경(ESCALATE).
      .max(30),
    cashWeight: z.number().min(0).max(0.3).finite(),
    rationale_kr: z.string().max(200),
  })
  .refine(
    (v) => {
      const sum = v.positions.reduce((s, p) => s + p.weight, 0) + v.cashWeight;
      return sum >= 0.99 && sum <= 1.01; // 부동소수 tolerance
    },
    { message: 'weights_sum_invalid' },
  )
  .refine((v) => new Set(v.positions.map((p) => p.ticker)).size === v.positions.length, {
    message: 'duplicate_ticker',
  });

export type PortfolioProposal = z.infer<typeof PortfolioProposalSchema>;

/** AI 출력(free-text JSON) → PortfolioProposal. rationale 200자 graceful truncate. 위반 시 throw. */
export function parsePortfolioProposal(content: string): PortfolioProposal {
  let raw: unknown;
  try {
    raw = extractJsonObject(content);
  } catch {
    throw new Error('portfolio_proposal_parse_failed:no_json_object');
  }
  const obj = (raw ?? {}) as Record<string, unknown>;
  const candidate = {
    positions: obj.positions,
    cashWeight: obj.cashWeight,
    rationale_kr:
      typeof obj.rationale_kr === 'string' ? obj.rationale_kr.slice(0, 200) : '',
  };
  const result = PortfolioProposalSchema.safeParse(candidate);
  if (!result.success) {
    const path = result.error.issues[0]?.path.join('.') ?? 'unknown';
    const msg = result.error.issues[0]?.message ?? '';
    throw new Error(`portfolio_proposal_parse_failed:${path || msg}`);
  }
  return result.data;
}

export interface PortfolioShortlistItem {
  ticker: string;
  name: string | null;
  consensusBadge: string | null;
  aiScore: number | null;
  winningTimeframe: string | null;
  conviction: number | null;
}

const NAME_MAX = 40;
/** 30 종목 요약 — 종목당 1줄(prompt payload bounded). */
export function renderPortfolioShortlistSummary(
  items: readonly PortfolioShortlistItem[],
): string {
  return items
    .map(
      (it) =>
        `- ${it.ticker} ${(it.name ?? '').slice(0, NAME_MAX)}: ${it.consensusBadge ?? '⚪'} ` +
        `AI${it.aiScore ?? '-'} ${it.winningTimeframe ?? '-'} 확신${it.conviction ?? '-'}`,
    )
    .join('\n');
}

export const PORTFOLIO_PROPOSAL_SYSTEM_PROMPT =
  '당신은 투자위원회의 포트폴리오 매니저입니다. 선정된 종목 후보 중 편입 종목·비중·현금 비중을 자율적으로 결정합니다.';

export const PORTFOLIO_PROPOSAL_USER_PROMPT = `다음은 이번 선정 리스트(후보)입니다. 이 중 실제 편입할 종목과 비중, 현금 비중을 자율적으로 결정하세요.

기준월: {{MONTH}}

후보 종목:
{{SHORTLIST}}

규칙:
- 후보 전부를 편입할 필요 없습니다. 확신이 높은 종목만 편입하세요.
- 종목별 비중(weight)과 현금 비중(cashWeight)의 합은 1.0이어야 합니다.
- 현금 비중은 0~0.30 범위입니다.
- 각 종목에 timeframe(short/mid/long)을 부여하세요.

응답을 다음 JSON 형식으로만 반환하세요 (다른 텍스트·마크다운 없이):
{
  "positions": [{ "ticker": "005930", "weight": 0.2, "timeframe": "long" }],
  "cashWeight": 0.1,
  "rationale_kr": "편입·비중·현금 결정 근거 (한국어, 200자 이내)"
}`;

export interface CallPortfolioProposalInput {
  month: string;
  shortlistSummary: string;
  adminUserId: string;
  costClient?: SupabaseClient;
}

export async function callPortfolioProposal(
  input: CallPortfolioProposalInput,
): Promise<PortfolioProposal> {
  // D28 A — Claude 필수 primary 불변.
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ai_key_unavailable');
  }
  const resolved = resolveRole('portfolio');
  const userPrompt = PORTFOLIO_PROPOSAL_USER_PROMPT.replaceAll(
    '{{MONTH}}',
    input.month,
  ).replaceAll('{{SHORTLIST}}', input.shortlistSummary);

  let result;
  try {
    result = await resolved.provider.call({
      model: resolved.model,
      maxTokens: resolved.maxTokens,
      systemPrompt: PORTFOLIO_PROPOSAL_SYSTEM_PROMPT,
      userPrompt,
      enablePromptCache: false,
    });
  } catch (err) {
    // W1a (D9) classifier 동일 — transient 분류 보존.
    const msg = err instanceof Error ? err.message : String(err);
    const status =
      (err as { status?: number }).status ?? (err as { statusCode?: number }).statusCode;
    const transient =
      status === 429 ||
      (status !== undefined && status >= 500) ||
      /\b(?:429|529)\b|rate.?limit|overloaded|timeout|timed out|ECONNRESET|ETIMEDOUT|fetch failed|network/i.test(
        msg,
      );
    throw new Error(transient ? `ai_call_failed:transient:${status ?? 'network'}` : 'ai_call_failed');
  }

  const usage: TokenUsage = result.usage;
  const costKrw = calculateCostKrw(usage, resolved.pricingKey);
  await insertCostLog(
    {
      month: input.month,
      // portfolio-proposal은 월 단위 aggregate(단일 ticker 없음) — cost_log.ticker(not null, 6자리 컨벤션)에
      //   sentinel '000000'. 식별자는 persona_id='portfolio-proposal' (downstream은 persona_id+cost_krw 소비).
      ticker: '000000',
      persona_id: 'portfolio-proposal',
      prompt_version: 'portfolio@v1',
      model: resolved.model,
      ...usage,
      cost_krw: costKrw,
      prompt_cache_enabled: false,
      called_by: input.adminUserId,
    },
    { client: input.costClient },
  );

  return parsePortfolioProposal(result.text);
}
