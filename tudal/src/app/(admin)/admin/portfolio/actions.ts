"use server";

import { MOCK_ADMIN_APPROVALS } from "@/lib/data/mock-admin-approvals";
import { MOCK_ADMIN_ACCESS_LOGS } from "@/lib/data/mock-admin-access-logs";
import { MOCK_ADMIN_REPORT_VIEW_LOG } from "@/lib/data/mock-admin-report-view-log";
import { MOCK_ADMIN_SNAPSHOTS } from "@/lib/data/mock-admin-snapshots";
import { getActiveShortList } from "@/lib/data/admin-shortlist";
import { MOCK_KR_BUSINESS_DAYS_2026 } from "@/lib/portfolio/calendar";
import { detectSingleAdminStreak } from "@/lib/portfolio/auto-relief";
import { computeAcceptGate } from "@/lib/portfolio/gating";
import {
  validateDisputeReason,
  canRaiseDispute,
} from "@/lib/portfolio/dispute";
import { isUniqueViolation } from "@/lib/portfolio/approval-logic";
import { createClient } from "@/lib/supabase/server";
import type { PortfolioSnapshot, ShortListItem } from "@/types/admin";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])-01$/;
const REQUIRED_GATE_TICKERS = new Set([
  "005930",
  "000660",
  "012450",
  "196170",
  "373220",
]);
const REAL_PERSISTENCE_ERROR = "real_persistence_not_configured";

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

// ---------------------------------------------------------------------------
// hashCode — ticker 기반 결정적 해시 (mock 진입가 계산용)
// ---------------------------------------------------------------------------
function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
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
  if (isProductionLike()) {
    return { success: false, error: REAL_PERSISTENCE_ERROR };
  }

  // 이미 확정된 승인이 있으면 거부
  const alreadyFinalized = MOCK_ADMIN_APPROVALS.some(
    (a) => a.month === month && a.isFinal && a.approvalType === "accept",
  );
  if (alreadyFinalized) {
    return { success: false, error: "already_finalized" };
  }

  const gate = validateAcceptGate(month, shortlist);
  if (!gate.success) return gate;

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
      shortlistGeneratedAt: gate.generatedAt.toISOString(),
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

  const shortlistForMonth = filterActiveShortlist(shortlist);

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
  if (isProductionLike()) {
    return { success: false, error: REAL_PERSISTENCE_ERROR };
  }

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
      shortlistGeneratedAt: generatedAt.toISOString(),
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
  if (isProductionLike()) {
    return { success: false, error: REAL_PERSISTENCE_ERROR };
  }

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
    // TODO(S5): await supabase.rpc("raise_portfolio_dispute", {
    //   p_approval_id: approvalId,
    //   p_reason: reasonValidation.trimmed,
    // })
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
  if (isProductionLike()) {
    return { success: false, error: REAL_PERSISTENCE_ERROR };
  }

  // approval 조회
  const approval = MOCK_ADMIN_APPROVALS.find((a) => a.id === approvalId);
  if (!approval) {
    return { success: false, error: "approval_not_found" };
  }

  const resolvedAt = new Date().toISOString();

  try {
    // TODO(S5): await supabase.rpc("resolve_portfolio_dispute", {
    //   p_approval_id: approvalId,
    // })
    approval.disputeResolvedAt = resolvedAt;
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      return { success: false, error: "already_finalized" };
    }
    throw err;
  }

  return { success: true, data: { resolvedAt } };
}
