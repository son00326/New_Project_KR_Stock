"use server";

import { MOCK_ADMIN_APPROVALS } from "@/lib/data/mock-admin-approvals";
import {
  validateDisputeReason,
  canRaiseDispute,
} from "@/lib/portfolio/dispute";

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

  // TODO(T3.7 hardening): server-side gate 재검증

  // 이미 확정된 승인이 있으면 거부
  const alreadyFinalized = MOCK_ADMIN_APPROVALS.some(
    (a) => a.month === month && a.isFinal && a.approvalType === "accept",
  );
  if (alreadyFinalized) {
    return { success: false, error: "already_finalized" };
  }

  // mock: in-memory push (실 Supabase write는 TODO)
  // TODO: await supabase.from("portfolio_approvals").insert({ ... })
  const approvalId = `mock-${Date.now()}`;
  MOCK_ADMIN_APPROVALS.push({
    id: approvalId,
    month,
    adminId: "admin-001", // TODO(hardening): adminId 세션 주입
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

  // mock: in-memory push (실 Supabase write는 TODO)
  // TODO: await supabase.from("portfolio_approvals").insert({ ... })
  MOCK_ADMIN_APPROVALS.push({
    id: `mock-reject-${Date.now()}`,
    month,
    adminId: "admin-001", // TODO(hardening): adminId 세션 주입
    approvalType: "reject",
    approvedAt: new Date().toISOString(),
    isFinal: false,
    prevPortfolioHeld: portfolioHoldWarning,
    shortlistGeneratedAt: `${month.slice(0, 7)}-01T00:00:00.000Z`,
    disputeRaisedAt: new Date().toISOString(),
    disputeRaisedBy: "admin-001", // TODO(hardening): adminId 세션 주입
    disputeReason: reason ?? null,
    disputeResolvedAt: null,
    gatingAutoReliefActive: false,
    reanalysisCount,
  });

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
  const { approvalId, adminId, reason } = input;

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

  // mock: in-memory mutation (실 Supabase UPDATE는 TODO(S3 hardening))
  // TODO(S3 hardening): await supabase.from("portfolio_approvals").update({
  //   dispute_raised_at: raisedAt,
  //   dispute_raised_by: adminId,
  //   dispute_reason: reason,
  // }).eq("id", approvalId)
  const raisedAt = new Date().toISOString();
  approval.disputeRaisedAt = raisedAt;
  approval.disputeRaisedBy = adminId;
  approval.disputeReason = reason;

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
  // TODO(hardening): adminId 세션 주입
  const { approvalId } = input;

  // approval 조회
  const approval = MOCK_ADMIN_APPROVALS.find((a) => a.id === approvalId);
  if (!approval) {
    return { success: false, error: "approval_not_found" };
  }

  // mock: in-memory mutation (실 Supabase UPDATE는 TODO(S3 hardening))
  // TODO(S3 hardening): await supabase.from("portfolio_approvals").update({
  //   dispute_resolved_at: resolvedAt,
  // }).eq("id", approvalId)
  const resolvedAt = new Date().toISOString();
  approval.disputeResolvedAt = resolvedAt;

  return { success: true, data: { resolvedAt } };
}
