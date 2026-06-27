import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { FunnelReflectionOutput } from "@/lib/reflection/funnel-reflection";

// G1 Tier0 Reflection Lab — tier0_funnel_reflection(0047) 데이터 레이어.
// 자동 적용 영구 금지: decide=status 기록만(funnel/production 무변경). DORMANT(0047 미적용 시 미사용).
// SoT: docs/superpowers/specs/2026-06-28-g1-tier0-reflection-lab.md

export type FunnelReflectionStatus = "proposed" | "approved" | "rejected";

export interface FunnelReflectionRow {
  id: string;
  periodKey: string;
  createdAt: string;
  championConfig: Record<string, number>;
  challengerConfig: Record<string, number>;
  rationale: string;
  evidence: Record<string, unknown>;
  status: FunnelReflectionStatus;
}

const SELECT_COLUMNS =
  "id, period_key, created_at, champion_config, challenger_config, rationale, evidence, status";

function toRow(r: Record<string, unknown>): FunnelReflectionRow {
  return {
    id: String(r.id),
    periodKey: String(r.period_key),
    createdAt: String(r.created_at),
    championConfig: (r.champion_config as Record<string, number>) ?? {},
    challengerConfig: (r.challenger_config as Record<string, number>) ?? {},
    rationale: typeof r.rationale === "string" ? r.rationale : "",
    evidence: (r.evidence as Record<string, unknown>) ?? {},
    status: (r.status as FunnelReflectionStatus) ?? "proposed",
  };
}

/** 회고 제안 적재 (period_key upsert — 월/주기당 1 제안 idempotent). status='proposed'. */
export async function insertFunnelReflectionProposal(
  proposal: FunnelReflectionOutput,
  options: { client?: SupabaseClient } = {},
): Promise<void> {
  const supabase = options.client ?? (await createClient());
  const { error } = await supabase.from("tier0_funnel_reflection").upsert(
    {
      period_key: proposal.periodKey,
      reflection_kind: "funnel_weight_retro",
      champion_config: proposal.championConfig,
      challenger_config: proposal.challengerConfig,
      rationale: proposal.rationale,
      evidence: proposal.evidence,
      status: "proposed",
    },
    { onConflict: "period_key" },
  );
  if (error) {
    throw new Error(`funnel_reflection_insert_failed:${error.code ?? "unknown"}`);
  }
}

/** 제안 목록 (created_at desc). 오류 시 throw(admin page error boundary 위임). */
export async function getFunnelReflectionProposals(
  options: { limit?: number; client?: SupabaseClient } = {},
): Promise<FunnelReflectionRow[]> {
  const supabase = options.client ?? (await createClient());
  let query = supabase
    .from("tier0_funnel_reflection")
    .select(SELECT_COLUMNS)
    .order("created_at", { ascending: false });
  if (typeof options.limit === "number" && options.limit > 0) {
    query = query.limit(options.limit);
  }
  const { data, error } = await query;
  if (error) {
    throw new Error(`funnel_reflection_select_failed:${error.code ?? "unknown"}`);
  }
  return (data ?? []).map((r) => toRow(r as Record<string, unknown>));
}

/**
 * 제안 승인/거절 — **status 기록만**(funnel config/production 무변경, 자동 적용 영구 금지).
 * proposed 상태에서만 전이. admin RLS(0047)로 보호. 채택은 USER + forward-validate 후 별도.
 */
export async function decideFunnelReflection(
  id: string,
  decision: "approved" | "rejected",
  options: { client?: SupabaseClient } = {},
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: "invalid_input" };
  if (decision !== "approved" && decision !== "rejected") {
    return { success: false, error: "invalid_decision" };
  }
  const supabase = options.client ?? (await createClient());
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData?.user?.id ?? null;
  const { data, error } = await supabase
    .from("tier0_funnel_reflection")
    .update({ status: decision, decided_by: uid, decided_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "proposed")
    .select("id");
  if (error) {
    return { success: false, error: "funnel_reflection_decide_failed" };
  }
  if (!data || data.length === 0) {
    return { success: false, error: "funnel_reflection_not_found_or_decided" };
  }
  return { success: true };
}
