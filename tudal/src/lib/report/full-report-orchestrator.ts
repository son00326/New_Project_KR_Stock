// PR3c — 3-step orchestration (analyst → writer → critic) + conditional revise + persistence.
// SoT = plan v6, omxy R6 CONVERGED. 누적 21 BLOCKERS catch & fix.
//
// Architecture:
//   Step 1 analyst (pure-code, LLM 0) — enrichInput shape transform
//   Step 2 writer (Opus 4.7 max 8192) — PR3b callFullReport 재사용
//   Step 3 critic (Haiku 4.5 max 2048) — 6축 verdict + Q3 threshold
//   Step 4 conditional revise (Opus 4.7 max 8192) — any FAIL OR WARN >= 4, 1회 hard cap (recursive 차단)
//
// Persistence:
//   1. update_report_sections_0_7 RPC (PR3b 재사용 — blocking throw)
//   2. insert_critic_findings_run RPC (target_stage='writer_draft', blocking throw)
//   3. insert_or_bump_sector_backlog RPC (B21 fix — non-blocking warn, Level A guard helper)
//
// fixes:
//   - B1 cost-hardcap preflight (ORCHESTRATE_TOTAL_COST_BUDGET_KRW, pricing.ts calculateCostKrw 통과)
//   - B17 criticRunId 반환 (OrchestrateFullReportResult.criticRunId 필드)
//   - B19 target_stage='writer_draft' (PR3c 1회 hard cap)
//   - B21 backlog non-blocking warn (critic findings는 blocking)
//   - 1회 hard cap invariant: critic call 1회 + revise 1회 (recursive revise 차단)

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { callFullReport } from '@/lib/ai/full-report-client';
import {
  FULL_REPORT_SYSTEM_PROMPT,
  buildFullReportUserPrompt,
  type FullReportUserPromptInput,
} from '@/lib/ai/prompts/full-report-prompt';
import { callRevise } from '@/lib/ai/revise-client';
import { REVISE_SYSTEM_PROMPT, buildReviseUserPrompt } from '@/lib/ai/prompts/revise-prompt';
import { evaluateReport } from '@/lib/report/critic';
import { enrichInput } from '@/lib/report/analyst';
import { preflightHardcap } from '@/lib/cost/cost-logger';
import { ORCHESTRATE_TOTAL_COST_BUDGET_KRW } from '@/lib/cost/pricing';
import { insertCriticFindingsRun } from '@/lib/data/report-critic-findings';
import { insertOrBumpBacklog } from '@/lib/data/sector-reference-backlog';
import type { CriticResultJson } from '@/lib/ai/critic-client';

export interface OrchestrateFullReportInput extends FullReportUserPromptInput {
  adminUserId: string;
}

export interface OrchestrateFullReportResult {
  reportId: string;
  costKrw: number;
  revised: boolean;
  criticVerdict: CriticResultJson;
  criticRunId: string;  // B17 fix (omxy R4): strict run_id 반환
}

// PR4 Task 2 Step 2.1 (caller DI seam): orchestrateFullReport options 2nd arg —
// Step 1.1 commitFullReport 패턴 동일 (admin caller가 모든 chain helper에 client 전파).
export interface OrchestrateFullReportOptions {
  client?: SupabaseClient;
  callerKind?: 'cron' | 'admin';
}

// extractJsonObject helper는 PR3b full-report-writer.ts에서 재사용 가능.
// 본 orchestrator는 LLM raw text를 parseAndValidate (depth-aware extract + per-section schema validate) 수행.
// 단순 path: JSON.parse 직접 사용 — section validation은 PR3b writer가 이미 수행 (callFullReport이 LLM raw text 반환).
// 본 orchestrator는 LLM content를 그대로 RPC에 전달 X — parseAndValidate 후 전달.
//
// PR3b writer (commitFullReport)는 자체 parseAndValidate + RPC UPDATE 수행.
// orchestrator는 callFullReport (raw LLM call)만 사용하고 parseAndValidate를 자체 수행 (writer commit RPC 대체).
import { extractJsonObject } from '@/lib/report/full-report-writer';
import {
  reportSection0Schema,
  reportSection1Schema,
  reportSection2Schema,
  reportSection3Schema,
  reportSection4Schema,
  reportSection5Schema,
  reportSection6Schema,
  reportSection7Schema,
  reportAppendixSchema,
} from '@/lib/data/report-section-schemas';
import type { z } from 'zod';

const SECTION_SCHEMAS = {
  section_0: reportSection0Schema,
  section_1: reportSection1Schema,
  section_2: reportSection2Schema,
  section_3: reportSection3Schema,
  section_4: reportSection4Schema,
  section_5: reportSection5Schema,
  section_6: reportSection6Schema,
  section_7: reportSection7Schema,
  appendix: reportAppendixSchema,
} as const;

type SectionKey = keyof typeof SECTION_SCHEMAS;

function parseAndValidate(
  raw: string,
  ctx: { ticker: string; month: string; phase: 'writer' | 'revise' },
): Record<SectionKey, unknown> {
  const jsonStr = extractJsonObject(raw);
  if (jsonStr === null) {
    throw new Error(`orchestrate_failed:${ctx.phase}_parse:no_json_object`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(`orchestrate_failed:${ctx.phase}_parse:invalid_json`);
  }
  if (parsed === null || typeof parsed !== 'object') {
    throw new Error(`orchestrate_failed:${ctx.phase}_parse:not_object`);
  }
  const record = parsed as Record<string, unknown>;
  const out = {} as Record<SectionKey, unknown>;
  for (const key of Object.keys(SECTION_SCHEMAS) as SectionKey[]) {
    if (!(key in record)) {
      console.warn(
        `[orchestrateFullReport] validation_failed phase=${ctx.phase} ticker=${ctx.ticker} month=${ctx.month} section=${key} reason=missing`,
      );
      throw new Error(`orchestrate_failed:${ctx.phase}_validation:${key}:missing`);
    }
    const schema = SECTION_SCHEMAS[key] as z.ZodTypeAny;
    const result = schema.safeParse(record[key]);
    if (!result.success) {
      const first = result.error.issues[0];
      const path = first?.path?.join('.') ?? 'root';
      console.warn(
        `[orchestrateFullReport] validation_failed phase=${ctx.phase} ticker=${ctx.ticker} month=${ctx.month} section=${key} path=${path}`,
      );
      throw new Error(`orchestrate_failed:${ctx.phase}_validation:${key}:${path}`);
    }
    out[key] = result.data;
  }
  return out;
}

export async function orchestrateFullReport(
  input: OrchestrateFullReportInput,
  options: OrchestrateFullReportOptions = {},
): Promise<OrchestrateFullReportResult> {
  // Step 1 analyst (pure-code, LLM 0) — input → enriched 변환 (현재 identity, 미래 enrichment hook).
  // PR4 Task 8 W7 fix: enrichInput을 cost-hardcap preflight + writer + critic + revise + persist + backlog
  // 모든 단계에서 일관 사용 (input.* drift 차단). adminUserId만 input 유지 (EnrichedFullReportInput에 없음).
  const enriched = enrichInput(input);

  // B1 fix: cost-hardcap preflight (ORCHESTRATE_TOTAL_COST_BUDGET_KRW = writer + critic + revise worst case)
  // PR4 Task 2 Step 2.1: caller-supplied client 전파 (cost_log RLS 정합).
  // PR4 Task 8 W7 fix: enriched.month 사용.
  await preflightHardcap(
    {
      month: enriched.month,
      callCount: 1,
      maxCostPerCallKrw: ORCHESTRATE_TOTAL_COST_BUDGET_KRW,
    },
    { client: options.client },
  );

  // Step 2 writer (Opus max 8192 — PR3b callFullReport 재사용)
  const userPrompt = buildFullReportUserPrompt({
    ticker: enriched.ticker,
    name: enriched.name,
    sector: enriched.sector,
    month: enriched.month,
    tier1Verdict: enriched.tier1Verdict,
    consensusBadge: enriched.consensusBadge,
    financialsSummary: enriched.financialsSummary,
    technicalsSummary: enriched.technicalsSummary,
    macroSummary: enriched.macroSummary,
    sectorReference: enriched.sectorReference,
  });
  // PR4 Task 8 W7 fix: writer call도 enriched.* (adminUserId만 input).
  const writerLlm = await callFullReport(
    {
      ticker: enriched.ticker,
      month: enriched.month,
      systemPrompt: FULL_REPORT_SYSTEM_PROMPT,
      userPrompt,
      adminUserId: input.adminUserId,
    },
    { client: options.client },
  );
  let finalSections = parseAndValidate(writerLlm.content, {
    ticker: enriched.ticker,
    month: enriched.month,
    phase: 'writer',
  });

  // Step 3 critic (Haiku LLM)
  // Track 2 W2 fix (gsd-deep): kevinV31Markers thread through orchestrator → critic.
  // PR3c quality 보장 핵심 — M1~M8 markers 명시. 미전달 시 critic prompt가 placeholder fallback.
  // PR4 Task 2 Step 2.1: caller DI 3rd arg — evaluateReport → callCritic chain 전파.
  // PR4 Task 8 W7 fix: critic context도 enriched.* (sectorReference/consensusBadge/ticker/month).
  const critic = await evaluateReport(
    finalSections,
    {
      ticker: enriched.ticker,
      month: enriched.month,
      adminUserId: input.adminUserId,
      sectorContext: enriched.sectorReference,
      consensusBadge: enriched.consensusBadge,
      kevinV31Markers:
        'M1 4 axes (안정성·수익성·성장성·밸류) / M2 financial cite / M3 no-fabrication / M4 peer 3+ / M5 valuation trial / M6 BUY|HOLD|SELL / M7 일상 비유 / M8 200자 cap',
    },
    { client: options.client },
  );

  // Step 4 conditional revise (Opus max 8192, 1회 hard cap — recursive revise 차단)
  let reviseCostKrw = 0;
  let revised = false;
  if (critic.shouldRevise) {
    // PR4 Task 8 W7 fix: revise prompt + call도 enriched.* (ticker/month).
    const revisePrompt = buildReviseUserPrompt({
      ticker: enriched.ticker,
      month: enriched.month,
      originalSections: finalSections,
      criticFindings: critic.verdict,
    });
    const reviseLlm = await callRevise(
      {
        ticker: enriched.ticker,
        month: enriched.month,
        systemPrompt: REVISE_SYSTEM_PROMPT,
        userPrompt: revisePrompt,
        adminUserId: input.adminUserId,
      },
      { client: options.client },
    );
    finalSections = parseAndValidate(reviseLlm.content, {
      ticker: enriched.ticker,
      month: enriched.month,
      phase: 'revise',
    });
    reviseCostKrw = reviseLlm.costKrw;
    revised = true;
    // ✱ 1회 hard cap invariant: 본 if 블록 안에서 critic 재호출 0 (recursive revise 차단)
  }

  // Persistence: 3 RPC 순서
  // (a) stock_reports UPDATE (PR3b RPC 재사용 — blocking throw)
  // PR4 Task 2 Step 2.1: caller DI — options.client 주입 시 createClient bypass.
  // PR4 Task 8 W7 fix: persisted ticker/month도 enriched.* (writer가 받은 값과 정합).
  const supabase = options.client ?? (await createClient());
  const { data, error } = await supabase.rpc('update_report_sections_0_7', {
    p_ticker: enriched.ticker,
    p_month: enriched.month,
    p_section_0: finalSections.section_0,
    p_section_1: finalSections.section_1,
    p_section_2: finalSections.section_2,
    p_section_3: finalSections.section_3,
    p_section_4: finalSections.section_4,
    p_section_5: finalSections.section_5,
    p_section_6: finalSections.section_6,
    p_section_7: finalSections.section_7,
    p_appendix: finalSections.appendix,
  });
  if (error) {
    if (typeof error.message === 'string' && error.message.includes('report_not_found_for_section_0_7_update')) {
      throw new Error('report_not_found_for_section_0_7_update');
    }
    throw new Error(`update_report_sections_0_7_failed:${error.code ?? 'unknown'}`);
  }
  if (!data?.success) {
    throw new Error('update_report_sections_0_7_failed:no_success');
  }

  // (b) critic findings INSERT (atomic RPC) — blocking throw (PR3c quality audit 핵심)
  // B17 fix: runId wire. B19 fix: target_stage='writer_draft' (PR3c 1회 hard cap).
  // PR4 Task 2 Step 2.1: caller DI — 4th arg options.
  const { runId: criticRunId } = await insertCriticFindingsRun(
    data.report_id,
    critic.verdict,
    'writer_draft',
    { client: options.client },
  );

  // (c) sector backlog INSERT-or-BUMP (atomic RPC) — B21 fix: non-blocking warn (운영 추적 부가 효과)
  // B18 fix: trim+canonical helper에서 검증. B20 fix: Level A 보유 sector는 helper에서 early return.
  // PR4 Task 2 Step 2.1: caller DI — 2nd arg options.
  // PR4 Task 8 W7 fix: backlog는 enriched.sector 사용 (writer가 받은 값과 정합).
  try {
    await insertOrBumpBacklog(enriched.sector, { client: options.client });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      `[orchestrateFullReport] sector_backlog_insert_failed ticker=${enriched.ticker} sector=${enriched.sector} message=${message}`,
    );
    // 보고서 commit + critic findings는 이미 성공. backlog 부가효과만 실패이므로 계속.
  }

  return {
    reportId: data.report_id,
    costKrw: writerLlm.costKrw + critic.costKrw + reviseCostKrw,
    revised,
    criticVerdict: critic.verdict,
    criticRunId,
  };
}
