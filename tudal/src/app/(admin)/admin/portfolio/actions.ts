"use server";

import { getRecentAdminAccessLogs } from "@/lib/data/admin-access-logs";
import { MOCK_ADMIN_REPORT_VIEW_LOG } from "@/lib/data/mock-admin-report-view-log";
import {
  acceptShortlistRpc,
  createPortfolioApproval,
  getApprovalById,
  getApprovalsByMonth,
  raisePortfolioDispute,
  resolvePortfolioDispute,
} from "@/lib/data/admin-approvals";
import { getActiveShortList } from "@/lib/data/admin-shortlist";
import type { NewPortfolioSnapshot } from "@/lib/data/admin-snapshots";
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

async function validateAcceptGate(month: string, shortlist: ShortListItem[]) {
  const generatedAt = resolveShortlistGeneratedAt(month, shortlist);
  if (!generatedAt) {
    return { success: false as const, error: "shortlist_month_not_found" };
  }

  const now = new Date();
  // T7e.6 — access-logs source는 boundary stub ([]) → autoReliefActive=false 영구.
  const autoReliefActive = detectSingleAdminStreak(
    await getRecentAdminAccessLogs(now, 7),
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

  // E5 contract: ticker=NULL is the portfolio-wide aggregate row consumed by
  // track-record/decision-tree. Cash remains implicit in (1 - equity weights)
  // until a schema-backed cash representation is defined.
  snapshots.push({
    date: input.acceptDate,
    month: input.month,
    ticker: null,
    entryPrice: 0,
    currentPrice: 0,
    weight: 1,
    isCash: false,
    dailyReturn: 0,
    totalReturn: 0,
    kospiReturn: 0,
    alpha: 0,
    sharpe: 0,
  });

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

  const gate = await validateAcceptGate(month, shortlist);
  if (!gate.success) return gate;

  // Build snapshots BEFORE the RPC so missing price data cannot start an
  // accept transaction. The RPC (마이그 0016) then performs portfolio_approval
  // INSERT + portfolio_snapshot bulk INSERT atomically — Postgres function
  // body is a single transaction, so an exception (including unique_violation
  // re-raise on the snapshot side) auto-rollbacks. This removes the orphan
  // approval risk (G-1) that existed when the two writes ran sequentially.
  const acceptDate = new Date().toISOString().slice(0, 10);
  const snapshotPlan = buildInitialSnapshots({
    month,
    acceptDate,
    shortlist: filterActiveShortlist(shortlist),
  });
  if (!snapshotPlan.success) {
    return { success: false, error: snapshotPlan.error };
  }

  try {
    const result = await acceptShortlistRpc({
      month,
      shortlistGeneratedAt: gate.generatedAt.toISOString(),
      snapshots: snapshotPlan.snapshots,
    });
    if ("error" in result) {
      return { success: false, error: result.error };
    }
    return {
      success: true,
      data: { approvalId: result.approvalId, isFinal: result.isFinal },
    };
  } catch (err: unknown) {
    // RPC re-raises non-approval unique_violation (e.g., snapshot-side
    // portfolio_snapshot_date_*_uniq). Defensive catch maps any unique 23505
    // that escapes the RPC's constraint_name match to already_finalized rather
    // than throwing raw to the panel.
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

// ---------------------------------------------------------------------------
// PR1 — triggerMonthlyBatch admin server action (omxy R1~R8 CONVERGED).
// admin caller가 cron flow와 동일한 orchestrator를 호출. cron secret 분리 (admin auth.uid() + is_admin()).
// 본 PR scope: server action까지만. UI 버튼은 PR4 scope.
// ---------------------------------------------------------------------------

const TRIGGER_MONTH_YM_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function triggerMonthlyBatch(input: {
  month: string;
}): Promise<
  | { success: true; data: { selectedCount: number } }
  | { success: false; error: string }
> {
  // Dynamic import — heavy lib (orchestrator + screening) lazy load.
  const { runMonthlyBatchOrchestrator } = await import(
    "@/lib/screening/monthly-batch-orchestrator"
  );
  const { acquireBatchLock, releaseBatchLock } = await import(
    "@/lib/data/admin-batch-runs"
  );
  const { upsertShortList30 } = await import(
    "@/lib/data/admin-shortlist-persist"
  );

  if (!input || typeof input.month !== "string") {
    return { success: false, error: "invalid_input" };
  }
  if (!TRIGGER_MONTH_YM_RE.test(input.month)) {
    return { success: false, error: "invalid_month" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { success: false, error: "auth_unavailable" };

  try {
    const outcome = await runMonthlyBatchOrchestrator({
      month: input.month,
      adminUserId: user.id,
      promptVersionId:
        process.env.PROMPT_VERSION_ID ?? "render-user-prompt@v1",
      personasVersionId:
        process.env.PERSONAS_VERSION_ID ?? "core11@v3.1",
      tier0Source: async () => {
        throw new Error("tier0_source_not_wired_pr1_followup");
      },
      callPersonaPanel: async () => {
        throw new Error("persona_panel_not_wired_pr1_followup");
      },
      fetchFinancials: async () => "",
      lock: { acquire: acquireBatchLock, release: releaseBatchLock },
      persist: upsertShortList30,
      commitBadgeOnly: async () => {
        throw new Error("commit_badge_only_not_wired_pr1_followup");
      },
      // server action path는 alert noop wire (admin trigger fail은 UI toast로 — PR4 scope)
      recordSchedulerFailAlert: async () => {},
    });
    return { success: true, data: { selectedCount: outcome.selectedCount } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "orchestrator_failed",
    };
  }
}

// ---------------------------------------------------------------------------
// PR4 Task 1 — triggerFullReport admin server action (Group D 잔여 + B8 박제 caller path).
// T5 first vertical slice: commitFullReport (fast) wire. Task 2에서 orchestrate path swap.
// 사용자 lock-in §1.3 (3 trigger path) + §1.4 (UI 흐름). admin 1개 즉석 quality 재생성은 Task 2.
//
// v2 amend (omxy R1 B3 plan): minimum stub은 prompt schema 통과 valid value.
//   - tier1Verdict: 'HOLD' (prompt-allowed enum)
//   - consensusBadge: '🟡' (관망, 사용자 lock-in 5종 중 default)
//   - summaries: "근거 부족" (한국어 placeholder, validation 통과)
//   - month: 입력은 YYYY-MM (regex 강제, caller가 ShortListItem.month.slice(0,7) 변환)
// ---------------------------------------------------------------------------

const TRIGGER_FULL_REPORT_TICKER_RE = /^\d{6}$/;
const TRIGGER_FULL_REPORT_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function triggerFullReport(input: {
  ticker: string;
  name: string;
  sector: string;
  month: string; // YYYY-MM
}): Promise<
  | { success: true; data: { reportId: string } }
  | { success: false; error: string }
> {
  if (
    !input ||
    typeof input.ticker !== "string" ||
    typeof input.name !== "string" ||
    typeof input.sector !== "string" ||
    typeof input.month !== "string"
  ) {
    return { success: false, error: "invalid_input" };
  }
  if (input.ticker === "" || !TRIGGER_FULL_REPORT_TICKER_RE.test(input.ticker)) {
    return {
      success: false,
      error: input.ticker === "" ? "invalid_input" : "invalid_ticker",
    };
  }
  if (!TRIGGER_FULL_REPORT_MONTH_RE.test(input.month)) {
    return { success: false, error: "invalid_month" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { success: false, error: "auth_unavailable" };

  try {
    // PR4 Task 2 Step 2.2: commit → orchestrate swap (admin quality path).
    // T5 (Task 1)는 commitFullReport (fast). Task 2부터 orchestrateFullReport (3-step
    // analyst → writer → critic + conditional revise, Kevin v3.1 quality target).
    // Dynamic import — orchestrator module heavy (PR3c 본체) lazy load.
    const { orchestrateFullReport } = await import(
      "@/lib/report/full-report-orchestrator"
    );
    const result = await orchestrateFullReport(
      {
        ticker: input.ticker,
        name: input.name,
        sector: input.sector,
        month: input.month,
        // v2 (B3 fix): prompt-valid stub. enriched input은 후속 Tier 1·Tier 2 결과 활용
        // (short_list_30 + cost_log + technicals 합산).
        tier1Verdict: "HOLD",
        consensusBadge: "🟡",
        financialsSummary: "근거 부족",
        technicalsSummary: "근거 부족",
        macroSummary: "근거 부족",
        sectorReference: "근거 부족",
        adminUserId: user.id,
      },
      {
        client: supabase, // admin SSR session client (Step 1.1 caller DI seam)
        callerKind: "admin",
      },
    );
    return { success: true, data: { reportId: result.reportId } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error
        ? err.message
        : "orchestrate_full_report_failed",
    };
  }
}
