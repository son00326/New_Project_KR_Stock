// W3b-2a (D2/D3) — portfolio_proposal 영속 helper (DI client, dormant 0034).
//   getProposalByMonth: SELECT + 저장 row schema 재검증(오염 행 거부).
//   assertProposalPersistenceReady: AI 호출 전 schema-ready preflight(유료 제안 유실 방지).
//   upsertProposalRpc: server-boundary 재검증 + upsert RPC(latest-only, created_by=auth.uid()).
// 0034 미적용/스키마캐시 부재 = proposal_schema_missing fail-closed (0032/0033 dormant 패턴 동형).
// money-path 무접촉 — W3b-2b Accept가 getProposalByMonth 소비 예정(이번 PR live consumer 0).
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  PortfolioProposalSchema,
  type PortfolioProposal,
} from "@/lib/ai/portfolio-proposal-client";

interface PgLikeError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

// 0034 미적용/스키마캐시 미갱신 코드 → schema-missing 정규화.
//   42P01 undefined_table · 42883 undefined_function · PGRST202 RPC 부재(schema cache)
//   · PGRST204 컬럼 부재(schema cache) · PGRST205 테이블 부재(schema cache).
const SCHEMA_MISSING_CODES = new Set([
  "42P01",
  "42883",
  "PGRST202",
  "PGRST204",
  "PGRST205",
]);

function normalizeSchemaError(error: PgLikeError, op: string): Error {
  if (error.code && SCHEMA_MISSING_CODES.has(error.code)) {
    return new Error("proposal_schema_missing");
  }
  return new Error(`proposal_persist_failed:${error.code ?? op}`);
}

export interface PersistedPortfolioProposal {
  id: string;
  month: string; // YYYY-MM-01
  model: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  proposal: PortfolioProposal;
}

interface DbProposalRow {
  id: string;
  month: string;
  positions: unknown;
  cash_weight: number | string;
  rationale_kr: string;
  model: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

const PROPOSAL_COLUMNS =
  "id, month, positions, cash_weight, rationale_kr, model, created_by, created_at, updated_at";

/**
 * 월(YYYY-MM-01)의 영속 제안 1건 조회. 저장 row도 PortfolioProposalSchema로 재검증(오염 행 거부).
 * 0034 미적용 → proposal_schema_missing. row 없음 → null. (W3b-2b Accept consumer.)
 */
export async function getProposalByMonth(input: {
  month: string;
  client?: SupabaseClient;
}): Promise<PersistedPortfolioProposal | null> {
  const client = input.client ?? (await createClient());
  const { data, error } = await client
    .from("portfolio_proposal")
    .select(PROPOSAL_COLUMNS)
    .eq("month", input.month)
    .maybeSingle();

  if (error) {
    throw normalizeSchemaError(error as PgLikeError, "select");
  }
  if (!data) return null;

  const row = data as DbProposalRow;
  const parsed = PortfolioProposalSchema.safeParse({
    positions: row.positions,
    cashWeight: typeof row.cash_weight === "string" ? Number(row.cash_weight) : row.cash_weight,
    rationale_kr: row.rationale_kr,
  });
  if (!parsed.success) {
    const path = parsed.error.issues[0]?.path.join(".") ?? "unknown";
    throw new Error(`portfolio_proposal_parse_failed:${path}`);
  }
  return {
    id: row.id,
    month: row.month,
    model: row.model,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    proposal: parsed.data,
  };
}

/**
 * AI 호출 전 schema-ready preflight. 0034(테이블+RPC) 미적용이면 assert RPC 자체가 부재 →
 * proposal_schema_missing throw → caller가 AI 호출 0회로 fail-closed(유료 제안 유실 방지).
 */
export async function assertProposalPersistenceReady(input: {
  client?: SupabaseClient;
}): Promise<void> {
  const client = input.client ?? (await createClient());
  const { error } = await client.rpc("assert_portfolio_proposal_schema");
  if (error) {
    throw normalizeSchemaError(error as PgLikeError, "assert");
  }
}

/**
 * 제안 영속(latest-only upsert). server-boundary에서 PortfolioProposalSchema 재검증 후 RPC 호출.
 * created_by는 RPC 내부 auth.uid()로 결정(spoof 차단 — 인자 없음). 0034 미적용 → proposal_schema_missing.
 */
export async function upsertProposalRpc(input: {
  month: string; // YYYY-MM-01
  proposal: PortfolioProposal;
  model: string;
  client?: SupabaseClient;
}): Promise<{ id: string; createdAt: string }> {
  const parsed = PortfolioProposalSchema.safeParse(input.proposal);
  if (!parsed.success) {
    const path = parsed.error.issues[0]?.path.join(".") ?? "unknown";
    throw new Error(`portfolio_proposal_parse_failed:${path}`);
  }
  const client = input.client ?? (await createClient());
  const { data, error } = await client.rpc("upsert_portfolio_proposal", {
    p_month: input.month,
    p_positions: parsed.data.positions,
    p_cash_weight: parsed.data.cashWeight,
    p_rationale_kr: parsed.data.rationale_kr,
    p_model: input.model,
  });
  if (error) {
    throw normalizeSchemaError(error as PgLikeError, "upsert");
  }
  const result = (data ?? {}) as { id?: string; created_at?: string };
  return { id: result.id ?? "", createdAt: result.created_at ?? "" };
}
