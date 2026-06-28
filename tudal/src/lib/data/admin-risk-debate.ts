import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { RiskJudgment, RiskVote } from "@/lib/risk/risk-debate";

// G3 Risk 토론 — risk_debate_assessment(0048) 데이터 레이어.
// advisory only: 저장은 평가 기록(is_advisory always true). Accept 경로 무개입. DORMANT(0048 미적용 시 미사용).

export interface RiskDebateAssessment {
  id: string;
  month: string;
  createdAt: string;
  finalVerdict: RiskVote;
  votes: RiskJudgment[];
  summary: string;
}

const SELECT_COLUMNS =
  "id, month, created_at, final_verdict, votes, summary, is_advisory";

export async function insertRiskDebateAssessment(
  input: {
    month: string;
    finalVerdict: RiskVote;
    votes: RiskJudgment[];
    summary: string;
  },
  options: { client?: SupabaseClient } = {},
): Promise<void> {
  const supabase = options.client ?? (await createClient());
  const { error } = await supabase.from("risk_debate_assessment").insert({
    month: input.month,
    final_verdict: input.finalVerdict,
    votes: input.votes,
    summary: input.summary,
  });
  if (error?.code === "23505") return;
  if (error) {
    throw new Error(`risk_debate_insert_failed:${error.code ?? "unknown"}`);
  }
}

export async function hasRiskDebateAssessment(
  month: string,
  options: { client?: SupabaseClient } = {},
): Promise<boolean> {
  const supabase = options.client ?? (await createClient());
  const { data, error } = await supabase
    .from("risk_debate_assessment")
    .select("id")
    .eq("month", month)
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(`risk_debate_select_failed:${error.code ?? "unknown"}`);
  }
  return data !== null;
}

/** 특정 월 최신 위험 재판정 (advisory 표시용). 부재/오류 → null (fail-soft — Accept 페이지 비차단). */
export async function getRiskDebateForMonth(
  month: string,
  options: { client?: SupabaseClient } = {},
): Promise<RiskDebateAssessment | null> {
  try {
    const supabase = options.client ?? (await createClient());
    const { data, error } = await supabase
      .from("risk_debate_assessment")
      .select(SELECT_COLUMNS)
      .eq("month", month)
      .maybeSingle();
    if (error || !data) return null;
    const r = data as Record<string, unknown>;
    return {
      id: String(r.id),
      month: String(r.month),
      createdAt: String(r.created_at),
      finalVerdict: r.final_verdict as RiskVote,
      votes: Array.isArray(r.votes) ? (r.votes as RiskJudgment[]) : [],
      summary: typeof r.summary === "string" ? r.summary : "",
    };
  } catch {
    return null;
  }
}
