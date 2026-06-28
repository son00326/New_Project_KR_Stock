import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateCostKrw, type TokenUsage } from "@/lib/cost/pricing";
import { insertCostLog } from "@/lib/cost/cost-logger";
import { extractJsonObject } from "@/lib/screening/persona-panel-adapter";
import { resolveRole } from "@/lib/ai/model-registry";
import type { RiskStance } from "@/lib/risk/risk-debate";

export interface CallRiskDebatorInput {
  prompt: string;
  stance: RiskStance;
  month: string;
  adminUserId: string;
  costClient?: SupabaseClient;
}

const RISK_DEBATE_SYSTEM_PROMPT =
  "당신은 포트폴리오 위험 심사위원입니다. 매매 지시가 아닌 advisory 위험 평가만 수행합니다.";

export async function callRiskDebator(
  input: CallRiskDebatorInput,
): Promise<unknown> {
  const resolved = resolveRole("critic");
  const result = await resolved.provider.call({
    model: resolved.model,
    maxTokens: resolved.maxTokens,
    systemPrompt: RISK_DEBATE_SYSTEM_PROMPT,
    userPrompt: input.prompt,
    enablePromptCache: false,
  });

  const usage: TokenUsage = result.usage;
  const costKrw = calculateCostKrw(usage, resolved.pricingKey);
  await insertCostLog(
    {
      month: input.month,
      ticker: "000000",
      persona_id: `risk-debate-${input.stance}`,
      prompt_version: "risk-debate@v1",
      model: resolved.model,
      ...usage,
      cost_krw: costKrw,
      prompt_cache_enabled: false,
      called_by: input.adminUserId,
    },
    { client: input.costClient },
  );

  return extractJsonObject(result.text);
}
