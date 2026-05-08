"use server";

import { MOCK_ADMIN_ACCESS_LOGS } from "@/lib/data/mock-admin-access-logs";
import { MOCK_ADMIN_REPORT_VIEW_LOG } from "@/lib/data/mock-admin-report-view-log";
import {
  createPortfolioApproval,
  getApprovalById,
  getApprovalsByMonth,
  raisePortfolioDispute,
  resolvePortfolioDispute,
} from "@/lib/data/admin-approvals";
import { getActiveShortList } from "@/lib/data/admin-shortlist";
import {
  insertPortfolioSnapshots,
  type NewPortfolioSnapshot,
} from "@/lib/data/admin-snapshots";
import { MOCK_KR_BUSINESS_DAYS_2026 } from "@/lib/portfolio/calendar";
import { detectSingleAdminStreak } from "@/lib/portfolio/auto-relief";
import { computeAcceptGate } from "@/lib/portfolio/gating";
import {
  validateDisputeReason,
  canRaiseDispute,
} from "@/lib/portfolio/dispute";
import { isUniqueViolation } from "@/lib/portfolio/approval-logic";
import { createClient } from "@/lib/supabase/server";
import type { PortfolioApproval, ShortListItem } from "@/types/admin";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])-01$/;
const REQUIRED_GATE_TICKERS = new Set([
  "005930",
  "000660",
  "012450",
  "196170",
  "373220",
]);

// ---------------------------------------------------------------------------
// resolveAdminId — Supabase 세션에서 admin ID 추출 (mock fallback 포함)
// ---------------------------------------------------------------------------
function isProductionLike(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.NEXT_PUBLIC_APP_ENV === "production"
  );
}

async function resolveAdminId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id) return user.id;
    return isProductionLike() ? null : "admin-001";
  } catch {
    return isProductionLike() ? null : "admin-001";
  }
}

function filterActiveShortlist(shortlist: ShortListItem[]): ShortListItem[] {
  return shortlist.filter((item) => item.deltaStatus !== "removed");
}

function validateShortlistMonth(month: string, shortlist: ShortListItem[]) {
  if (!MONTH_RE.test(month)) {
    return { success: false as const, error: "invalid_month" };
  }
  if (filterActiveShortlist(shortlist).length === 0) {
    return { success: false as const, error: "shortlist_month_not_found" };
  }
  return { success: true as const };
}

function resolveShortlistGeneratedAt(
  _month: string,
  shortlist: ShortListItem[],
): Date | null {
  // T7e.2 — 실 short_list_30.created_at 기반 (Tier 0 batch INSERT 시 동일 createdAt).
  // 같은 월의 행들은 batch INSERT라 createdAt이 일치한다고 가정.
  const active = filterActiveShortlist(shortlist);
  if (active.length === 0) return null;
  const createdAtRaw = active[0]?.createdAt;
  if (!createdAtRaw) return null;
  const createdAt = new Date(createdAtRaw);
  return Number.isNaN(createdAt.getTime()) ? null : createdAt;
}

function getRequiredGateReportIds(
  month: string,
  shortlist: ShortListItem[],
): string[] {
  const active = filterActiveShortlist(shortlist);
  const representativeTickers = active
    .map((item) => item.ticker)
    .filter((ticker) => REQUIRED_GATE_TICKERS.has(ticker));
  const tickers = representativeTickers.length > 0
    ? representativeTickers
    : active.map((item) => item.ticker);
  return tickers.map((ticker) => `rpt-${month}-${ticker}`);
}

function getMinimumRequiredViewerCount(
  month: string,
  shortlist: ShortListItem[],
): number {
  const reportIds = getRequiredGateReportIds(month, shortlist);
  if (reportIds.length === 0) return 0;

  return Math.min(
    ...reportIds.map(
      (reportId) =>
        new Set(
          MOCK_ADMIN_REPORT_VIEW_LOG
            .filter((row) => row.reportId === reportId)
            .map((row) => row.adminId),
        ).size,
    ),
  );
}

function validateAcceptGate(month: string, shortlist: ShortListItem[]) {
  const generatedAt = resolveShortlistGeneratedAt(month, shortlist);
  if (!generatedAt) {
    return { success: false as const, error: "shortlist_month_not_found" };
  }

  const now = new Date();
  const autoReliefActive = detectSingleAdminStreak(
    MOCK_ADMIN_ACCESS_LOGS,
    now,
    7,
  ).active;

  const gate = computeAcceptGate({
    shortlistGeneratedAt: generatedAt,
    now,
    distinctViewerCount: getMinimumRequiredViewerCount(month, shortlist),
    calendar: MOCK_KR_BUSINESS_DAYS_2026,
    autoReliefActive,
  });

  if (!gate.allowed) {
    return { success: false as const, error: `accept_gate_blocked:${gate.reason}` };
  }
  return { success: true as const, generatedAt };
}

function hasFinalAccept(approvals: PortfolioApproval[]): boolean {
  return approvals.some(
    (a) => a.isFinal && a.approvalType === "accept",
  );
}

function countRejects(approvals: PortfolioApproval[]): number {
  return approvals.filter((a) => a.approvalType === "reject").length;
}

function buildInitialSnapshots(input: {
  month: string;
  acceptDate: string;
  shortlist: ShortListItem[];
}):
  | { success: true; snapshots: NewPortfolioSnapshot[] }
  | { success: false; error: "entry_price_unavailable" } {
  const snapshots: NewPortfolioSnapshot[] = [];

  for (const item of input.shortlist) {
    // T7e.4 safety: never persist synthetic prices to production DB.
    // Real entry prices must be wired by T7e.8/T7e.6 from a KRX/pykrx/EOD source.
    const entryPrice = resolveRealEntryPrice();
    if (entryPrice === null) {
      return { success: false, error: "entry_price_unavailable" };
    }
    snapshots.push({
      date: input.acceptDate,
      month: input.month,
      ticker: item.ticker,
      entryPrice,
      currentPrice: entryPrice,
      weight: item.suggestedWeight,
      isCash: false,
      dailyReturn: 0,
      totalReturn: 0,
      kospiReturn: 0,
      alpha: 0,
      sharpe: 0,
    });
  }

  const totalEquityWeight = input.shortlist.reduce(
    (a, b) => a + b.suggestedWeight,
    0,
  );
  const cashWeight = Math.max(0, 1 - totalEquityWeight);
  if (cashWeight > 0) {
    snapshots.push({
      date: input.acceptDate,
      month: input.month,
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

  return { success: true, snapshots };
}

function resolveRealEntryPrice(): number | null {
  // TODO(T7e.6/T7e.8): wire KRX/pykrx EOD source before enabling real Accept snapshots.
  return null;
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
  if (!params || typeof params !== "object") {
    return { success: false, error: "invalid_input" };
  }
  const { month } = params;
  if (typeof month !== "string") {
    return { success: false, error: "invalid_month" };
  }
  let shortlist: ShortListItem[];
  try {
    shortlist = await getActiveShortList({ month });
  } catch {
    return { success: false, error: "shortlist_lookup_failed" };
  }
  const monthValidation = validateShortlistMonth(month, shortlist);
  if (!monthValidation.success) return monthValidation;
  const generatedAt = resolveShortlistGeneratedAt(month, shortlist);
  if (!generatedAt) {
    return { success: false, error: "shortlist_month_not_found" };
  }

  const adminId = await resolveAdminId();
  if (!adminId) {
    return { success: false, error: "auth_unavailable" };
  }

  // 이미 확정된 승인이 있으면 거부
  let approvals: PortfolioApproval[];
  try {
    approvals = await getApprovalsByMonth(month);
  } catch {
    return { success: false, error: "approval_lookup_failed" };
  }
  if (hasFinalAccept(approvals)) {
    return { success: false, error: "already_finalized" };
  }

  const gate = validateAcceptGate(month, shortlist);
  if (!gate.success) return gate;

  try {
    // Build snapshots before E4 INSERT so missing price data cannot leave an
    // is_final approval without its Day 0 portfolio_snapshot rows.
    const acceptDate = new Date().toISOString().slice(0, 10);
    const snapshotPlan = buildInitialSnapshots({
      month,
      acceptDate,
      shortlist: filterActiveShortlist(shortlist),
    });
    if (!snapshotPlan.success) {
      return { success: false, error: snapshotPlan.error };
    }

    const approval = await createPortfolioApproval({
      month,
      adminId,
      approvalType: "accept",
      isFinal: true,
      prevPortfolioHeld: false,
      shortlistGeneratedAt: gate.generatedAt.toISOString(),
      gatingAutoReliefActive: false,
      reanalysisCount: 0,
    });

    await insertPortfolioSnapshots(snapshotPlan.snapshots);

    return {
      success: true,
      data: { approvalId: approval.id, isFinal: approval.isFinal },
    };
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      return { success: false, error: "already_finalized" };
    }
    throw err;
  }
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
  if (!params || typeof params !== "object") {
    return { success: false, error: "invalid_input" };
  }
  const { month, reason } = params;
  if (typeof month !== "string") {
    return { success: false, error: "invalid_month" };
  }
  if (reason !== undefined && typeof reason !== "string") {
    return { success: false, error: "invalid_reason" };
  }
  let shortlist: ShortListItem[];
  try {
    shortlist = await getActiveShortList({ month });
  } catch {
    return { success: false, error: "shortlist_lookup_failed" };
  }
  const monthValidation = validateShortlistMonth(month, shortlist);
  if (!monthValidation.success) return monthValidation;
  const generatedAt = resolveShortlistGeneratedAt(month, shortlist);
  if (!generatedAt) {
    return { success: false, error: "shortlist_month_not_found" };
  }

  const adminId = await resolveAdminId();
  if (!adminId) {
    return { success: false, error: "auth_unavailable" };
  }

  let approvals: PortfolioApproval[];
  try {
    approvals = await getApprovalsByMonth(month);
  } catch {
    return { success: false, error: "approval_lookup_failed" };
  }

  // 이미 Accept 확정된 경우 Reject 불가
  if (hasFinalAccept(approvals)) {
    return { success: false, error: "already_finalized" };
  }

  // 기존 Reject 이력 수 → second Reject 판정
  const existingRejectCount = countRejects(approvals);
  if (existingRejectCount >= 2) {
    return { success: false, error: "reanalysis_limit_reached" };
  }

  const reanalysisCount = existingRejectCount + 1;
  const portfolioHoldWarning = reanalysisCount >= 2;

  try {
    await createPortfolioApproval({
      month,
      adminId,
      approvalType: "reject",
      isFinal: false,
      prevPortfolioHeld: portfolioHoldWarning,
      shortlistGeneratedAt: generatedAt.toISOString(),
      disputeRaisedAt: new Date().toISOString(),
      disputeRaisedBy: adminId,
      disputeReason: reason ?? null,
      gatingAutoReliefActive: false,
      reanalysisCount: Math.min(reanalysisCount, 1),
    });
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      return { success: false, error: "approval_write_failed" };
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
  if (!input || typeof input !== "object") {
    return { success: false, error: "invalid_input" };
  }
  const { approvalId, reason } = input;
  if (typeof approvalId !== "string" || typeof reason !== "string") {
    return { success: false, error: "invalid_input" };
  }
  const adminId = await resolveAdminId();
  if (!adminId) {
    return { success: false, error: "auth_unavailable" };
  }

  // 앱 레벨 검증 1차 방어선 (DB constraint length≥20은 2차)
  const reasonValidation = validateDisputeReason(reason);
  if (!reasonValidation.valid) {
    return { success: false, error: "reason_too_short" };
  }

  // approval 조회
  let approval: PortfolioApproval | null;
  try {
    approval = await getApprovalById(approvalId);
  } catch {
    return { success: false, error: "approval_lookup_failed" };
  }
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

  try {
    const persistedRaisedAt = await raisePortfolioDispute({
      approvalId,
      reason: reasonValidation.trimmed,
    });
    return { success: true, data: { raisedAt: persistedRaisedAt } };
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      return { success: false, error: "already_finalized" };
    }
    return { success: false, error: "approval_not_found" };
  }
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
  if (!input || typeof input !== "object") {
    return { success: false, error: "invalid_input" };
  }
  const { approvalId } = input;
  if (typeof approvalId !== "string") {
    return { success: false, error: "invalid_input" };
  }
  if (!(await resolveAdminId())) {
    return { success: false, error: "auth_unavailable" };
  }

  try {
    const resolvedAt = await resolvePortfolioDispute(approvalId);
    return { success: true, data: { resolvedAt } };
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      return { success: false, error: "already_finalized" };
    }
    return { success: false, error: "approval_not_found" };
  }
}
