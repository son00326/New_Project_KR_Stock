// PR3b — writer Section 0~7 + Appendix 풀 리포트 생성 + commit.
// SoT = docs/superpowers/plans/2026-05-23-pr3b-writer-section-0-7.md (omxy R1~R5 CONVERGED, 누적 24 BLOCKERS).
// 기존 writer.ts (Section 8 path)와 별도 모듈 — separation of concerns.
//
// flow: input → buildFullReportUserPrompt → callFullReport (LLM) → extractJsonObject → per-section safeParse → RPC UPDATE.
// caller wire (cron / UI / Regen)는 PR4 scope.

import { createClient } from '@/lib/supabase/server';
import { callFullReport } from '@/lib/ai/full-report-client';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  FULL_REPORT_SYSTEM_PROMPT,
  buildFullReportUserPrompt,
  type FullReportUserPromptInput,
} from '@/lib/ai/prompts/full-report-prompt';
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
import { preflightHardcap } from '@/lib/cost/cost-logger';
import { FULL_REPORT_MAX_COST_PER_CALL_KRW } from '@/lib/cost/pricing';
import type { z } from 'zod';

// P1 #7 fix: prompt module wire — input은 prompt builder의 input + adminUserId 추가.
export interface CommitFullReportInput extends FullReportUserPromptInput {
  adminUserId: string;
}

// PR4 Task 1 Step 1.1 (B2 fix omxy R1): caller DI seam options.
// 모든 helper (preflightHardcap / insertCostLog / callFullReport) + RPC client에 전파.
// admin caller (Task 2)는 quality path → orchestrateFullReport에서 동일 옵션 패턴 사용.
export interface CommitFullReportOptions {
  client?: SupabaseClient;
  callerKind?: 'cron' | 'admin';
}

export interface CommitFullReportResult {
  reportId: string;
  costKrw: number;
}

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

// R2 B11 fix: LLM이 markdown fence 또는 prefix/suffix 설명을 추가하는 경우 첫 {...} JSON object를 추출.
// depth-aware brace matching + string literal escape 처리.
// 정상 JSON object만 추출하고 외부 텍스트 무시. 부재 시 null 반환 (caller가 throw).
export function extractJsonObject(raw: string): string | null {
  const trimmed = raw.trim();
  const start = trimmed.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return trimmed.slice(start, i + 1);
      }
    }
  }
  return null;
}

function parseAndValidate(
  raw: string,
  ctx: { ticker: string; month: string },
): Record<SectionKey, unknown> {
  const jsonStr = extractJsonObject(raw);
  if (jsonStr === null) {
    throw new Error('full_report_parse_failed:no_json_object');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error('full_report_parse_failed:invalid_json');
  }
  if (parsed === null || typeof parsed !== 'object') {
    throw new Error('full_report_parse_failed:not_object');
  }
  const record = parsed as Record<string, unknown>;
  const out = {} as Record<SectionKey, unknown>;
  for (const key of Object.keys(SECTION_SCHEMAS) as SectionKey[]) {
    if (!(key in record)) {
      // 3-track Track 3 Angle 2 fix (CR-2): structured warn before throw — PR3a CR-01 패턴 정합.
      console.warn(
        `[full-report-writer] validation_failed ticker=${ctx.ticker} month=${ctx.month} section=${key} reason=missing`,
      );
      throw new Error(`full_report_validation_failed:${key}:missing`);
    }
    const schema = SECTION_SCHEMAS[key] as z.ZodTypeAny;
    const result = schema.safeParse(record[key]);
    if (!result.success) {
      const first = result.error.issues[0];
      const path = first?.path?.join('.') ?? 'root';
      console.warn(
        `[full-report-writer] validation_failed ticker=${ctx.ticker} month=${ctx.month} section=${key} path=${path} message=${first?.message ?? 'unknown'}`,
      );
      throw new Error(`full_report_validation_failed:${key}:${path}`);
    }
    out[key] = result.data;
  }
  return out;
}

export async function commitFullReport(
  input: CommitFullReportInput,
  options: CommitFullReportOptions = {},
): Promise<CommitFullReportResult> {
  // 3-track Track 2 C1 fix: cost-hardcap preflight (40만원). FULL_REPORT_MAX_COST_PER_CALL_KRW은
  // max_tokens 8192 calibration (input 3000 + output 6000). preflightHardcap 호출 시 caller가
  // 명시적으로 override 주입해야 — 기본 MAX_COST_PER_CALL_KRW (2000 output)은 부족.
  // PR4 Task 1 Step 1.1 (B2): caller-supplied client 전파 (cost_log RLS 정합).
  await preflightHardcap(
    {
      month: input.month,
      callCount: 1,
      maxCostPerCallKrw: FULL_REPORT_MAX_COST_PER_CALL_KRW,
    },
    { client: options.client },
  );

  // P1 #7 fix: prompt module wire — buildFullReportUserPrompt + FULL_REPORT_SYSTEM_PROMPT 직접 호출.
  const userPrompt = buildFullReportUserPrompt({
    ticker: input.ticker,
    name: input.name,
    sector: input.sector,
    month: input.month,
    tier1Verdict: input.tier1Verdict,
    consensusBadge: input.consensusBadge,
    financialsSummary: input.financialsSummary,
    technicalsSummary: input.technicalsSummary,
    macroSummary: input.macroSummary,
    sectorReference: input.sectorReference,
  });

  const llm = await callFullReport(
    {
      ticker: input.ticker,
      month: input.month,
      systemPrompt: FULL_REPORT_SYSTEM_PROMPT,
      userPrompt,
      adminUserId: input.adminUserId,
    },
    { client: options.client },
  );

  const sections = parseAndValidate(llm.content, {
    ticker: input.ticker,
    month: input.month,
  });

  // PR4 Task 1 Step 1.1 (B2): options.client 주입 시 createClient bypass — admin caller path.
  const supabase = options.client ?? (await createClient());
  const { data, error } = await supabase.rpc('update_report_sections_0_7', {
    p_ticker: input.ticker,
    p_month: input.month,
    p_section_0: sections.section_0,
    p_section_1: sections.section_1,
    p_section_2: sections.section_2,
    p_section_3: sections.section_3,
    p_section_4: sections.section_4,
    p_section_5: sections.section_5,
    p_section_6: sections.section_6,
    p_section_7: sections.section_7,
    p_appendix: sections.appendix,
  });

  if (error) {
    // P0 #4 fix: error.message가 'report_not_found_for_section_0_7_update' 포함 → 직접 throw.
    if (typeof error.message === 'string' && error.message.includes('report_not_found_for_section_0_7_update')) {
      throw new Error('report_not_found_for_section_0_7_update');
    }
    throw new Error(`update_report_sections_0_7_failed:${error.code ?? 'unknown'}`);
  }
  if (!data?.success) {
    throw new Error('update_report_sections_0_7_failed:no_success');
  }
  return { reportId: data.report_id, costKrw: llm.costKrw };
}
