import { createClient } from "@/lib/supabase/server";
import type { ApprovalType, PortfolioApproval } from "@/types/admin";
import type { NewPortfolioSnapshot } from "@/lib/data/admin-snapshots";

// ---------------------------------------------------------------------------
// portfolio_approval (E4) — Supabase 실 I/O (T7e.4).
// RLS 정책 = admin-wide SELECT + self INSERT/UPDATE, cross-admin dispute는
// 0010의 security-definer RPC만 사용한다.
// ---------------------------------------------------------------------------

export interface PortfolioApprovalDbRow {
  id: string;
  month: string;
  admin_id: string;
  approval_type: ApprovalType;
  approved_at: string;
  is_final: boolean;
  prev_portfolio_held: boolean;
  shortlist_generated_at: string;
  dispute_raised_at: string | null;
  dispute_raised_by: string | null;
  dispute_reason: string | null;
  dispute_resolved_at: string | null;
  gating_auto_relief_active: boolean;
  reanalysis_count: number;
}

export interface NewPortfolioApproval {
  month: string;
  adminId: string;
  approvalType: ApprovalType;
  isFinal: boolean;
  prevPortfolioHeld: boolean;
  shortlistGeneratedAt: string;
  disputeRaisedAt?: string | null;
  disputeRaisedBy?: string | null;
  disputeReason?: string | null;
  disputeResolvedAt?: string | null;
  gatingAutoReliefActive: boolean;
  reanalysisCount: number;
}

const APPROVAL_COLUMNS =
  "id, month, admin_id, approval_type, approved_at, is_final, prev_portfolio_held, shortlist_generated_at, dispute_raised_at, dispute_raised_by, dispute_reason, dispute_resolved_at, gating_auto_relief_active, reanalysis_count";

export function transformPortfolioApprovalRow(
  row: PortfolioApprovalDbRow,
): PortfolioApproval {
  return {
    id: row.id,
    month: row.month,
    adminId: row.admin_id,
    approvalType: row.approval_type,
    approvedAt: row.approved_at,
    isFinal: row.is_final,
    prevPortfolioHeld: row.prev_portfolio_held,
    shortlistGeneratedAt: row.shortlist_generated_at,
    disputeRaisedAt: row.dispute_raised_at,
    disputeRaisedBy: row.dispute_raised_by,
    disputeReason: row.dispute_reason,
    disputeResolvedAt: row.dispute_resolved_at,
    gatingAutoReliefActive: row.gating_auto_relief_active,
    reanalysisCount: row.reanalysis_count,
  };
}

function toInsertPayload(input: NewPortfolioApproval) {
  return {
    month: input.month,
    admin_id: input.adminId,
    approval_type: input.approvalType,
    is_final: input.isFinal,
    prev_portfolio_held: input.prevPortfolioHeld,
    shortlist_generated_at: input.shortlistGeneratedAt,
    dispute_raised_at: input.disputeRaisedAt ?? null,
    dispute_raised_by: input.disputeRaisedBy ?? null,
    dispute_reason: input.disputeReason ?? null,
    dispute_resolved_at: input.disputeResolvedAt ?? null,
    gating_auto_relief_active: input.gatingAutoReliefActive,
    reanalysis_count: input.reanalysisCount,
  };
}

export async function getApprovalsByMonth(
  month: string,
): Promise<PortfolioApproval[]> {
  const client = await createClient();
  const { data, error } = await client
    .from("portfolio_approval")
    .select(APPROVAL_COLUMNS)
    .eq("month", month)
    .order("approved_at", { ascending: true });

  if (error) {
    throw new Error(
      `portfolio_approval query failed: ${error.message ?? "unknown error"}`,
    );
  }

  const rows = (data ?? []) as PortfolioApprovalDbRow[];
  return rows.map(transformPortfolioApprovalRow);
}

export async function getApprovalById(
  approvalId: string,
): Promise<PortfolioApproval | null> {
  const client = await createClient();
  const { data, error } = await client
    .from("portfolio_approval")
    .select(APPROVAL_COLUMNS)
    .eq("id", approvalId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `portfolio_approval lookup failed: ${error.message ?? "unknown error"}`,
    );
  }
  if (!data) return null;
  return transformPortfolioApprovalRow(data as PortfolioApprovalDbRow);
}

export async function createPortfolioApproval(
  input: NewPortfolioApproval,
): Promise<{ id: string; isFinal: boolean }> {
  const client = await createClient();
  const { data, error } = await client
    .from("portfolio_approval")
    .insert(toInsertPayload(input))
    .select("id, is_final")
    .single();

  if (error) throw error;

  const row = data as { id: string; is_final: boolean };
  return { id: row.id, isFinal: row.is_final };
}

export async function raisePortfolioDispute(input: {
  approvalId: string;
  reason: string;
}): Promise<string> {
  const client = await createClient();
  const { data, error } = await client.rpc("raise_portfolio_dispute", {
    p_approval_id: input.approvalId,
    p_reason: input.reason,
  });

  if (error) throw error;
  return String(data);
}

export async function resolvePortfolioDispute(
  approvalId: string,
): Promise<string> {
  const client = await createClient();
  const { data, error } = await client.rpc("resolve_portfolio_dispute", {
    p_approval_id: approvalId,
  });

  if (error) throw error;
  return String(data);
}

// ---------------------------------------------------------------------------
// acceptShortlistRpc — atomic Accept (마이그 0016, P3.2 48차)
// ---------------------------------------------------------------------------
// accept_shortlist_with_snapshots(p_month, p_shortlist_generated_at, p_snapshots)
// RPC를 호출해 portfolio_approval INSERT + portfolio_snapshot bulk INSERT를
// 단일 트랜잭션으로 원자 처리한다. orphan approval(approval 성공 + snapshot
// 실패) 위험을 차단.
//
// 반환:
//   - { approvalId, isFinal: true } — 성공
//   - { error: "already_finalized" } — 동시 accept race (RPC 내 unique 매핑)
//
// 비-already_finalized 에러는 raw로 throw (P3.3 taxonomy 결정 전까지 passthrough,
// actions.ts에서 success:false 매핑).
function toSnapshotJson(snapshot: NewPortfolioSnapshot) {
  return {
    date: snapshot.date,
    month: snapshot.month,
    ticker: snapshot.ticker,
    entry_price: snapshot.entryPrice,
    current_price: snapshot.currentPrice,
    weight: snapshot.weight,
    is_cash: snapshot.isCash,
    daily_return: snapshot.dailyReturn,
    total_return: snapshot.totalReturn,
    kospi_return: snapshot.kospiReturn,
    alpha: snapshot.alpha,
    sharpe: snapshot.sharpe,
  };
}

export async function acceptShortlistRpc(input: {
  month: string;
  shortlistGeneratedAt: string;
  snapshots: NewPortfolioSnapshot[];
}): Promise<
  | { approvalId: string; isFinal: true }
  | { error: "already_finalized" }
> {
  const client = await createClient();
  const { data, error } = await client.rpc(
    "accept_shortlist_with_snapshots",
    {
      p_month: input.month,
      p_shortlist_generated_at: input.shortlistGeneratedAt,
      p_snapshots: input.snapshots.map(toSnapshotJson),
    },
  );

  if (error) throw error;

  const payload = (data ?? {}) as
    | { approval_id?: string; is_final?: boolean; error?: string };

  if (payload.error === "already_finalized") {
    return { error: "already_finalized" };
  }

  if (!payload.approval_id || payload.is_final !== true) {
    throw new Error(
      `accept_shortlist_rpc unexpected payload: ${JSON.stringify(payload)}`,
    );
  }

  return { approvalId: payload.approval_id, isFinal: true };
}
