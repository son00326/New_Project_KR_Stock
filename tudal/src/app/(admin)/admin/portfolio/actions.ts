"use server";

import { MOCK_ADMIN_APPROVALS } from "@/lib/data/mock-admin-approvals";
import { MOCK_ADMIN_SNAPSHOTS } from "@/lib/data/mock-admin-snapshots";
import { MOCK_ADMIN_SHORTLIST } from "@/lib/data/mock-admin-shortlist";
import {
  validateDisputeReason,
  canRaiseDispute,
} from "@/lib/portfolio/dispute";
import { isUniqueViolation } from "@/lib/portfolio/approval-logic";
import { createClient } from "@/lib/supabase/server";
import type { PortfolioSnapshot } from "@/types/admin";

// ---------------------------------------------------------------------------
// resolveAdminId — Supabase 세션에서 admin ID 추출 (mock fallback 포함)
// ---------------------------------------------------------------------------
async function resolveAdminId(): Promise<string> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? "admin-001";
  } catch {
    return "admin-001";
  }
}

// ---------------------------------------------------------------------------
// hashCode — ticker 기반 결정적 해시 (mock 진입가 계산용)
// ---------------------------------------------------------------------------
function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

// ---------------------------------------------------------------------------
// acceptShortList — 이번 달 Short List 30 확정
// ---------------------------------------------------------------------------
export async function acceptShortList(params: {
  month: string;
  shortlistGeneratedAt: string;
}): Promise<
  | { success: true; data: { approvalId: string; isFinal: boolean } }
  | { success: false; error: string }
> {
  const { month, shortlistGeneratedAt } = params;
  const adminId = await resolveAdminId();

  // TODO(T3.7 hardening): server-side gate 재검증

  // 이미 확정된 승인이 있으면 거부
  const alreadyFinalized = MOCK_ADMIN_APPROVALS.some(
    (a) => a.month === month && a.isFinal && a.approvalType === "accept",
  );
  if (alreadyFinalized) {
    return { success: false, error: "already_finalized" };
  }

  const approvalId = `mock-${Date.now()}`;

  try {
    // TODO(S5): await supabase.from("portfolio_approvals").insert({ ... });
    MOCK_ADMIN_APPROVALS.push({
      id: approvalId,
      month,
      adminId,
      approvalType: "accept",
      approvedAt: new Date().toISOString(),
      isFinal: true,
      prevPortfolioHeld: false,
      shortlistGeneratedAt,
      disputeRaisedAt: null,
      disputeRaisedBy: null,
      disputeReason: null,
      disputeResolvedAt: null,
      gatingAutoReliefActive: false,
      reanalysisCount: 0,
    });
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      return { success: false, error: "already_finalized" };
    }
    throw err;
  }

  // E5 PortfolioSnapshot INSERT hook — Accept 확정 시 가상 포트 스냅샷 초기화
  const approvalMonth = month; // 'YYYY-MM-01'
  const acceptDate = new Date().toISOString().slice(0, 10);

  const shortlistForMonth = MOCK_ADMIN_SHORTLIST.filter(
    (item) => item.month === approvalMonth && item.deltaStatus !== "removed",
  );

  const snapshots: PortfolioSnapshot[] = [];

  for (const item of shortlistForMonth) {
    const mockEntryPrice =
      50000 + (Math.abs(hashCode(item.ticker)) % 200000);
    snapshots.push({
      id: `snap-${approvalId}-${item.ticker}`,
      date: acceptDate,
      month: approvalMonth,
      ticker: item.ticker,
      entryPrice: mockEntryPrice,
      currentPrice: mockEntryPrice, // Day 0: currentPrice == entryPrice
      weight: item.suggestedWeight,
      isCash: false,
      dailyReturn: 0,
      totalReturn: 0,
      kospiReturn: 0,
      alpha: 0,
      sharpe: 0,
    });
  }

  const totalEquityWeight = shortlistForMonth.reduce(
    (a, b) => a + b.suggestedWeight,
    0,
  );
  const cashWeight = Math.max(0, 1 - totalEquityWeight);
  if (cashWeight > 0) {
    snapshots.push({
      id: `snap-${approvalId}-cash`,
      date: acceptDate,
      month: approvalMonth,
      ticker: null,
      entryPrice: 0,
      currentPrice: 0,
      weight: cashWeight,
      isCash: true,
      dailyReturn: 0,
      totalReturn: 0,
      kospiReturn: 0,
      alpha: 0,
      sharpe: 0,
    });
  }

  for (const snap of snapshots) {
    MOCK_ADMIN_SNAPSHOTS.push(snap);
  }

  // TODO(S5): await supabase.from("portfolio_snapshot").insert(snapshots);

  return { success: true, data: { approvalId, isFinal: true } };
}

// ---------------------------------------------------------------------------
// rejectShortList — 이번 달 Short List 30 Reject → 재분석 큐 stub
// ---------------------------------------------------------------------------
export async function rejectShortList(params: {
  month: string;
  reason?: string;
}): Promise<
  | {
      success: true;
      data: {
        reanalysisCount: number;
        portfolioHoldWarning?: boolean;
      };
    }
  | { success: false; error: string }
> {
  const { month, reason } = params;
  const adminId = await resolveAdminId();

  // 이미 Accept 확정된 경우 Reject 불가
  const alreadyAccepted = MOCK_ADMIN_APPROVALS.some(
    (a) => a.month === month && a.isFinal && a.approvalType === "accept",
  );
  if (alreadyAccepted) {
    return { success: false, error: "already_finalized" };
  }

  // 기존 Reject 이력 수 → second Reject 판정
  const existingRejects = MOCK_ADMIN_APPROVALS.filter(
    (a) => a.month === month && a.approvalType === "reject",
  );
  const reanalysisCount = existingRejects.length + 1;
  const portfolioHoldWarning = reanalysisCount >= 2;

  try {
    // TODO(S5): await supabase.from("portfolio_approvals").insert({ ... });
    MOCK_ADMIN_APPROVALS.push({
      id: `mock-reject-${Date.now()}`,
      month,
      adminId,
      approvalType: "reject",
      approvedAt: new Date().toISOString(),
      isFinal: false,
      prevPortfolioHeld: portfolioHoldWarning,
      shortlistGeneratedAt: `${month.slice(0, 7)}-01T00:00:00.000Z`,
      disputeRaisedAt: new Date().toISOString(),
      disputeRaisedBy: adminId,
      disputeReason: reason ?? null,
      disputeResolvedAt: null,
      gatingAutoReliefActive: false,
      reanalysisCount,
    });
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      return { success: false, error: "already_finalized" };
    }
    throw err;
  }

  return {
    success: true,
    data: { reanalysisCount, ...(portfolioHoldWarning ? { portfolioHoldWarning } : {}) },
  };
}

// ---------------------------------------------------------------------------
// raiseDispute — 이의 제기 (BL-7 A: 자유 텍스트 min 20자 + 48h Hold)
// ---------------------------------------------------------------------------
export async function raiseDispute(input: {
  approvalId: string;
  adminId: string;
  reason: string;
}): Promise<
  | { success: true; data: { raisedAt: string } }
  | { success: false; error: string }
> {
  const { approvalId, reason } = input;
  const adminId = await resolveAdminId();

  // 앱 레벨 검증 1차 방어선 (DB constraint length≥20은 2차)
  const reasonValidation = validateDisputeReason(reason);
  if (!reasonValidation.valid) {
    return { success: false, error: "reason_too_short" };
  }

  // approval 조회
  const approval = MOCK_ADMIN_APPROVALS.find((a) => a.id === approvalId);
  if (!approval) {
    return { success: false, error: "approval_not_found" };
  }

  // 중복 이의 제기 차단
  const disputeCheck = canRaiseDispute({
    disputeRaisedAt: approval.disputeRaisedAt,
    disputeResolvedAt: approval.disputeResolvedAt,
  });
  if (!disputeCheck.valid) {
    return { success: false, error: "already_disputed" };
  }

  const raisedAt = new Date().toISOString();

  try {
    // TODO(S5): await supabase.from("portfolio_approvals").update({
    //   dispute_raised_at: raisedAt,
    //   dispute_raised_by: adminId,
    //   dispute_reason: reasonValidation.trimmed,
    // }).eq("id", approvalId)
    approval.disputeRaisedAt = raisedAt;
    approval.disputeRaisedBy = adminId;
    approval.disputeReason = reasonValidation.trimmed;
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      return { success: false, error: "already_finalized" };
    }
    throw err;
  }

  return { success: true, data: { raisedAt } };
}

// ---------------------------------------------------------------------------
// resolveDispute — 이의 제기 해소
// ---------------------------------------------------------------------------
export async function resolveDispute(input: {
  approvalId: string;
  adminId: string;
}): Promise<
  | { success: true; data: { resolvedAt: string } }
  | { success: false; error: string }
> {
  const { approvalId } = input;

  // approval 조회
  const approval = MOCK_ADMIN_APPROVALS.find((a) => a.id === approvalId);
  if (!approval) {
    return { success: false, error: "approval_not_found" };
  }

  const resolvedAt = new Date().toISOString();

  try {
    // TODO(S5): await supabase.from("portfolio_approvals").update({
    //   dispute_resolved_at: resolvedAt,
    // }).eq("id", approvalId)
    approval.disputeResolvedAt = resolvedAt;
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      return { success: false, error: "already_finalized" };
    }
    throw err;
  }

  return { success: true, data: { resolvedAt } };
}
