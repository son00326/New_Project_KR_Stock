"use server";

import { getRecentAdminAccessLogs } from "@/lib/data/admin-access-logs";
import { getDistinctViewerCountsByTicker } from "@/lib/data/admin-report-view-log";
import {
  acceptShortlistRpc,
  createPortfolioApproval,
  getApprovalById,
  getApprovalsByMonth,
  raisePortfolioDispute,
  resolvePortfolioDispute,
} from "@/lib/data/admin-approvals";
import { reportExistsForMonth } from "@/lib/data/admin-reports";
import { isCostLoggingEnabled } from "@/lib/cost/cost-logger";
import { getActiveShortList } from "@/lib/data/admin-shortlist";
import {
  callPortfolioProposal,
  renderPortfolioShortlistSummary,
  type PortfolioProposal,
  type PortfolioShortlistItem,
} from "@/lib/ai/portfolio-proposal-client";
import type { NewPortfolioSnapshot } from "@/lib/data/admin-snapshots";
import {
  loadKrBusinessDays,
  MOCK_KR_BUSINESS_DAYS_2026,
} from "@/lib/portfolio/calendar";
import {
  resolveEntryPricesKrw,
  resolveLatestCompletedTradingDay,
} from "@/lib/data/krx-eod";
import { detectSingleAdminStreak } from "@/lib/portfolio/auto-relief";
import { computeAcceptGate } from "@/lib/portfolio/gating";
import {
  validateDisputeReason,
  canRaiseDispute,
} from "@/lib/portfolio/dispute";
import { isUniqueViolation } from "@/lib/portfolio/approval-logic";
import { createClient } from "@/lib/supabase/server";
import {
  type PortfolioApproval,
  type ShortListItem,
  SHORTLIST_TARGET_COUNT,
} from "@/types/admin";

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
  // T7e.2 — 실 short_list_30.created_at 기반.
  // W2a Task 9.5 (R4 HIGH-3): 트랙 split로 같은 월에 mixed createdAt 공존 가능(오래된 mid/long +
  //   주간 refresh된 short = now()). '첫 활성 행' anchor면 오래된 mid가 freshly-refreshed short의
  //   24h/D+4 Hold를 우회시킨다 → anchor를 가장 최근(MAX) createdAt으로 (per-ticker 정확).
  const active = filterActiveShortlist(shortlist);
  if (active.length === 0) return null;
  let latest: number | null = null;
  for (const item of active) {
    if (!item.createdAt) continue;
    const t = new Date(item.createdAt).getTime();
    if (Number.isNaN(t)) continue;
    if (latest === null || t > latest) latest = t;
  }
  return latest === null ? null : new Date(latest);
}

// Mock cleanup Step 1.3 (58차, omxy/Spinoza D1 HIGH split-brain fix):
// MOCK_ADMIN_REPORT_VIEW_LOG의 가짜 2인 열람 시드를 actions.ts에서도 제거.
// page.tsx (display gate)와 동일 source — real report_view_log SELECT via getDistinctViewerCountsByTicker.
function getRequiredGateTickers(shortlist: ShortListItem[]): string[] {
  const active = filterActiveShortlist(shortlist);
  const representativeTickers = active
    .map((item) => item.ticker)
    .filter((ticker) => REQUIRED_GATE_TICKERS.has(ticker));
  return representativeTickers.length > 0
    ? representativeTickers
    : active.map((item) => item.ticker);
}

function computeMinimumViewerCount(
  tickers: string[],
  viewerCountsByTicker: Map<string, number>,
): number {
  if (tickers.length === 0) return 0;
  return Math.min(...tickers.map((t) => viewerCountsByTicker.get(t) ?? 0));
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

  // Mock cleanup Step 1.3: real report_view_log SELECT (page.tsx와 동일 source — split-brain 해소).
  const gateTickers = getRequiredGateTickers(shortlist);
  const viewerCountsByTicker = await getDistinctViewerCountsByTicker({
    month: month.slice(0, 7),
    tickers: gateTickers,
  });

  const gate = computeAcceptGate({
    shortlistGeneratedAt: generatedAt,
    now,
    distinctViewerCount: computeMinimumViewerCount(gateTickers, viewerCountsByTicker),
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

async function buildInitialSnapshots(input: {
  month: string;
  acceptDate: string;
  shortlist: ShortListItem[];
}): Promise<
  | { success: true; snapshots: NewPortfolioSnapshot[] }
  | { success: false; error: "entry_price_unavailable" }
> {
  // W3a — entry_price 이중 게이트(behavior-neutral): flag off 또는 KRX 키 부재 → 현 동작 1:1.
  //   USER가 PORTFOLIO_REAL_ENTRY_PRICE_ENABLED=true + KRX_OPENAPI_KEY 둘 다 설정 시에만 실 EOD 종가.
  if (process.env.PORTFOLIO_REAL_ENTRY_PRICE_ENABLED !== "true") {
    return { success: false, error: "entry_price_unavailable" };
  }
  const authKey = process.env.KRX_OPENAPI_KEY?.trim();
  if (!authKey) {
    return { success: false, error: "entry_price_unavailable" };
  }

  // 최신 완료 거래일 KOSPI+KOSDAQ 종가 1배치. fetch throw는 catch → entry_price_unavailable
  //   (snapshot build는 RPC 前이라 accept 트랜잭션 미시작 — money-path 안전).
  let priceMap: Map<string, number>;
  try {
    const now = new Date();
    const businessDays = await loadKrBusinessDays(
      new Date(now.getTime() - 14 * 86_400_000),
      now,
    );
    const basDd = resolveLatestCompletedTradingDay(
      now,
      businessDays,
    );
    if (!basDd) {
      return { success: false, error: "entry_price_unavailable" };
    }
    priceMap = await resolveEntryPricesKrw(
      input.shortlist.map((s) => s.ticker),
      { authKey, basDd },
    );
  } catch {
    return { success: false, error: "entry_price_unavailable" };
  }

  const snapshots: NewPortfolioSnapshot[] = [];

  for (const item of input.shortlist) {
    // W3a — 실 EOD 종가. 누락(한쪽에도 없음) 또는 ≤0 → 전체 거부(부분 snapshot 금지, money-path 안전).
    const entryPrice = priceMap.get(item.ticker);
    if (entryPrice == null || entryPrice <= 0) {
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
  // W2a Task 9.5 (R3 HIGH-2): 트랙 split로 일시 <30 가능 → 부분 리스트가 snapshot에 진입하면 포트 오염.
  //   빈 리스트만 거부(validateShortlistMonth)하던 가드를 length<30 거부로 강화 (정상 30 경로 무회귀).
  if (filterActiveShortlist(shortlist).length < SHORTLIST_TARGET_COUNT) {
    return { success: false, error: "shortlist_incomplete" };
  }
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

  // Mock cleanup Step 1.3 R2 (omxy Gödel HIGH fix): validateAcceptGate가 real DB select 의존하므로
  // Supabase 실패 시 throw 가능 → Server Action contract `{ success, error }` 보존 위해 catch.
  let gate: Awaited<ReturnType<typeof validateAcceptGate>>;
  try {
    gate = await validateAcceptGate(month, shortlist);
  } catch {
    return { success: false, error: "accept_gate_lookup_failed" };
  }
  if (!gate.success) return gate;

  // Build snapshots BEFORE the RPC so missing price data cannot start an
  // accept transaction. The RPC (마이그 0016) then performs portfolio_approval
  // INSERT + portfolio_snapshot bulk INSERT atomically — Postgres function
  // body is a single transaction, so an exception (including unique_violation
  // re-raise on the snapshot side) auto-rollbacks. This removes the orphan
  // approval risk (G-1) that existed when the two writes ran sequentially.
  const acceptDate = new Date().toISOString().slice(0, 10);
  const snapshotPlan = await buildInitialSnapshots({
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
  adminId?: string;
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
  adminId?: string;
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
// PR1 legacy — triggerMonthlyBatch admin server action.
// W2a wiring audit: the old synchronous single-shot selector is superseded by
// selection-worker chunks. It cannot persist W2a midlong(20) output into the old
// 30-row writer, so fail closed before loading orchestrator/AI code.
// ---------------------------------------------------------------------------

const TRIGGER_MONTH_YM_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const MONTHLY_BATCH_SINGLE_SHOT_DEPRECATED =
  "monthly_batch_single_shot_deprecated";

export async function triggerMonthlyBatch(input: {
  month: string;
}): Promise<
  | { success: true; data: { selectedCount: number } }
  | { success: false; error: string }
> {
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

  // Keep the admin assertion even though the path is deprecated: non-admin callers
  // should not learn operational details beyond the normal admin_required code.
  const { data: isAdmin, error: adminErr } = await supabase.rpc("is_admin");
  if (adminErr || !isAdmin) {
    return { success: false, error: "admin_required" };
  }

  return { success: false, error: MONTHLY_BATCH_SINGLE_SHOT_DEPRECATED };
}

// ---------------------------------------------------------------------------
// PR4 Task 1 — triggerFullReport admin server action (Group D 잔여 + B8 박제 caller path).
// T5 first vertical slice: fast path wire. Task 2에서 quality path (3-step orchestrate) swap.
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
  // PR4 Task 9 Track 2 C-2 fix: empty name/sector 차단 (silent LLM prompt degradation 방어).
  // page.tsx의 `sector ?? ""` 회피 path가 빈 문자열을 propagate해서 writer prompt가
  // "[종목] 이름 (티커) —  섹터" 더블 공백 + 빈 sector 문맥으로 LLM 호출되면 ₩535 낭비
  // + backlog non-blocking warn(sector_reference_backlog_invalid_sector:empty) 발생.
  if (input.name.trim() === "" || input.sector.trim() === "") {
    return { success: false, error: "invalid_input" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { success: false, error: "auth_unavailable" };

  // B65-P3 omxy R1 HIGH + R2 BLOCKER fix: server-side admin assertion via is_admin() RPC.
  // 미들웨어만 신뢰 X (AGENTS 원칙) + flag=true 시 row-missing preflight skip되므로 비admin cost-burn 차단.
  // ⚠️ admin_emails 직접 SELECT 금지: RESTRICTIVE RLS using(false) (0001:30-35)라 session client는
  // admin이라도 0 rows → real admin 전원 오차단. is_admin()은 SECURITY DEFINER + authenticated execute
  // grant (0015a:28)로 RLS 우회 + auth.jwt() email 기반 판별. RPC error/false 모두 fail-closed.
  const { data: isAdmin, error: adminErr } = await supabase.rpc("is_admin");
  if (adminErr || !isAdmin) {
    return { success: false, error: "admin_required" };
  }

  // PR-B2 (B7/D-8): cost-logging fail-closed — flag off면 cost_log noop → getMonthlyTotal=0 →
  //   preflightHardcap fail-open(50만원 hardcap 무력화). 실 AI(orchestrate) 전 차단, spend 0.
  if (!isCostLoggingEnabled()) {
    return { success: false, error: "cost_logging_disabled" };
  }

  // B65-P1 Phase 1: row-missing preflight (cost burn 차단).
  // update_report_sections_0_7 RPC가 UPDATE-only (마이그 0022) — row 부재 시
  // 1~3 LLM call 비용 burn 후 fail. Preflight cheap SELECT로 fail-fast.
  // B86: input.month YYYY-MM → stock_reports.month (date) YYYY-MM-01 변환 (preflight 전용).
  //   orchestrate payload month는 YYYY-MM 유지 (RPC contract: ^[0-9]{4}-[0-9]{2}$).
  // B65-P3 toggle (옵션 A): flag=true 시 orchestrator가 UPSERT RPC INSERT branch 진입 가능 →
  //   preflight skip. flag=false 시 B65-P1 guard 유지 (cost burn 차단 + production rollback 보장).
  const upsertEnabled = process.env.PR4_TRIGGER_UPSERT_ENABLED === "true";
  if (!upsertEnabled) {
    const monthDate = `${input.month}-01`;
    let exists: boolean;
    try {
      exists = await reportExistsForMonth(input.ticker, monthDate);
    } catch {
      return { success: false, error: "report_lookup_failed" };
    }
    if (!exists) {
      return { success: false, error: "report_not_found" };
    }
  }

  // PR-H scope 2: 입력 enrich (placeholder → 실 source). short_list_30 row 1회 조회(cost 0 SELECT)
  //   → enrichReportInput(row)로 stub 6필드 교체. input.month YYYY-MM → short_list_30.month YYYY-MM-01.
  let enrich: Awaited<
    ReturnType<typeof import("@/lib/report/report-input-enricher").enrichReportInput>
  >;
  let shortlistItem: ShortListItem | undefined;
  try {
    const items = await getActiveShortList({
      month: `${input.month}-01`,
      client: supabase,
    });
    const match = items.find((item) => item.ticker === input.ticker);
    if (!match) {
      return { success: false, error: "shortlist_item_not_found" };
    }
    if (match.name.trim() === "" || match.sector.trim() === "") {
      return { success: false, error: "shortlist_item_not_found" };
    }
    shortlistItem = match;
  } catch {
    return { success: false, error: "shortlist_lookup_failed" };
  }
  if (!shortlistItem) {
    return { success: false, error: "shortlist_item_not_found" };
  }
  try {
    const { enrichReportInput } = await import(
      "@/lib/report/report-input-enricher"
    );
    enrich = await enrichReportInput(shortlistItem, { client: supabase });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (
      message.startsWith("financials_corp_lookup_failed:") ||
      message.startsWith("financials_fetch_failed:")
    ) {
      return { success: false, error: message };
    }
    return {
      success: false,
      error: "enrich_failed",
    };
  }

  try {
    // PR4 Task 2 Step 2.2: commit → orchestrate swap (admin quality path).
    // T5 (Task 1)는 fast path. Task 2부터 quality path (3-step
    // analyst → writer → critic + conditional revise, Kevin v3.1 quality target).
    // Dynamic import — orchestrator module heavy (PR3c 본체) lazy load.
    const { orchestrateFullReport } = await import(
      "@/lib/report/full-report-orchestrator"
    );
    const result = await orchestrateFullReport(
      {
        ticker: input.ticker,
        name: shortlistItem.name,
        sector: shortlistItem.sector,
        month: input.month,
        // PR-H scope 2: stub → 실 source (short_list_30 배지/점수 + DART 재무, cost 0).
        // macroSummary는 S7b 전까지 "근거 부족"(enrich 내부 고정).
        tier1Verdict: enrich.tier1Verdict,
        consensusBadge: enrich.consensusBadge,
        financialsSummary: enrich.financialsSummary,
        technicalsSummary: enrich.technicalsSummary,
        macroSummary: enrich.macroSummary,
        sectorReference: enrich.sectorReference,
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

// ---------------------------------------------------------------------------
// W3b-1 (D26 Q2 / D3) — proposePortfolio admin server action.
// 선정 30 종목에 대해 AI(Opus 4.8 `portfolio` role)가 편입 여부·종목별 비중·현금(0~30%)을 자율 제안.
// 게이트 순서: input → getUser(auth_unavailable) → is_admin RPC(admin_required) →
//   flag(PORTFOLIO_AI_PROPOSAL_ENABLED)+key(ANTHROPIC_API_KEY) 이중(proposal_disabled) →
//   getActiveShortList(active 30) → callPortfolioProposal → positions ⊆ shortlist 검증.
// cost burn = admin+flag+key 3중 게이트 후에만 (flag-off는 prod key 존재해도 call/shortlist 미호출 → 비용 0).
// W3b-1 = proposal 반환만 — DB 영속·Accept·snapshot 무변경(money-path 무접촉, W3b-2에서 통합).
// UI 미연결이나 server action export로 호출 가능(W3b-3 UI 연결 예정).
// ---------------------------------------------------------------------------
export async function proposePortfolio(input: {
  month: string; // YYYY-MM-01 (acceptShortList/portfolio page와 동일)
}): Promise<
  | { success: true; data: { proposal: PortfolioProposal } }
  | { success: false; error: string }
> {
  if (!input || typeof input.month !== "string") {
    return { success: false, error: "invalid_input" };
  }
  if (!MONTH_RE.test(input.month)) {
    return { success: false, error: "invalid_month" };
  }

  // AI cost path — dev mock fallback(resolveAdminId) 금지. 실 세션 user만.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { success: false, error: "auth_unavailable" };

  // is_admin() RPC 게이트 (triggerFullReport/triggerMonthlyBatch 대칭). error/false 모두 fail-closed.
  const { data: isAdmin, error: adminErr } = await supabase.rpc("is_admin");
  if (adminErr || !isAdmin) {
    return { success: false, error: "admin_required" };
  }

  // flag+key 이중 게이트(behavior-neutral): 둘 다 충족해야 cost burn. flag-off는 prod key가 있어도
  //   getActiveShortList/callPortfolioProposal 미호출 → 비용 0. key 부재도 동일(proposal_disabled).
  if (process.env.PORTFOLIO_AI_PROPOSAL_ENABLED !== "true") {
    return { success: false, error: "proposal_disabled" };
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return { success: false, error: "proposal_disabled" };
  }

  let shortlist: ShortListItem[];
  try {
    shortlist = await getActiveShortList({
      month: input.month,
      client: supabase,
    });
  } catch {
    return { success: false, error: "shortlist_lookup_failed" };
  }
  // acceptShortList와 동일 가드 — 부분 리스트(<30)가 제안 universe에 진입하지 않도록 거부.
  const active = filterActiveShortlist(shortlist);
  if (active.length < SHORTLIST_TARGET_COUNT) {
    return { success: false, error: "shortlist_incomplete" };
  }

  const summary = renderPortfolioShortlistSummary(
    active.map(
      (item): PortfolioShortlistItem => ({
        ticker: item.ticker,
        name: item.name,
        consensusBadge: item.consensusBadge ?? null,
        aiScore: item.aiScore ?? null,
        winningTimeframe: item.winningTimeframe ?? null,
        conviction: item.conviction ?? null,
      }),
    ),
  );

  let proposal: PortfolioProposal;
  try {
    proposal = await callPortfolioProposal({
      month: input.month.slice(0, 7), // cost_log/prompt month = YYYY-MM
      shortlistSummary: summary,
      adminUserId: user.id,
      costClient: supabase,
    });
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "ai_call_failed",
    };
  }

  // D2 — positions ⊆ 입력(active shortlist) ticker. schema는 universe를 모르므로 caller가 검증.
  const universe = new Set(active.map((item) => item.ticker));
  for (const position of proposal.positions) {
    if (!universe.has(position.ticker)) {
      return { success: false, error: "portfolio_proposal_unknown_ticker" };
    }
  }

  return { success: true, data: { proposal } };
}

// ---------------------------------------------------------------------------
// PR-H scope 4 — triggerReportWorkerChunk admin server action (report-worker wiring).
// SoT spec: tasks/w99tzsvzw.output §4.
//
// report-worker(runGuardedReportChunk, full-report-batch-worker MERGED-dormant)를 admin이 트리거.
// admin은 session client로 is_admin() 게이트만 — 실행은 service-role client 주입 (worker 내부는
// acquire_report_worker_lock / cost_log.called_by=CRON_SYSTEM_USER_ID / auth.admin.getUserById 등
// service-role 전제). session client로는 worker가 깨짐.
//
// 실 가동 = USER flag (PR5_CRON_AUTO_ENABLED + AI_COST_LOG_REAL_INSERT_ENABLED + CRON_SYSTEM_USER_ID,
// Vercel env, USER-only). flag-off면 worker step0 abortBeforeSpend → throw → action error, orchestrate
// 0회 = cost 0. 신규 cost guard 코드 0 (worker step0 3중 flag + orchestrator preflightHardcap 재사용).
// ---------------------------------------------------------------------------
export async function triggerReportWorkerChunk(input: {
  month: string; // YYYY-MM
}): Promise<
  | {
      success: true;
      data: { processed: number; remaining: number; aborted: string | null };
    }
  | { success: true; skipped: "already_running" }
  | { success: true; notReady: { reason: "shortlist_not_ready" } }
  | { success: false; error: string }
> {
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

  // is_admin() 게이트 (triggerMonthlyBatch/triggerFullReport 대칭). 비admin worker 트리거 차단.
  const { data: isAdmin, error: adminErr } = await supabase.rpc("is_admin");
  if (adminErr || !isAdmin) {
    return { success: false, error: "admin_required" };
  }

  try {
    // Dynamic import — worker(server-only service-role 전제) + heavy lib lazy load.
    const { runGuardedReportChunk } = await import(
      "@/lib/report/full-report-batch-worker"
    );
    const { createServiceRoleClient } = await import(
      "@/lib/supabase/service-role"
    );
    const guarded = await runGuardedReportChunk({
      month: input.month,
      client: createServiceRoleClient(),
    });
    if (guarded.skipped) {
      return { success: true, skipped: guarded.skipped };
    }
    const result = guarded.result!;
    if (result.notReady) {
      return { success: true, notReady: result.notReady };
    }
    return {
      success: true,
      data: {
        processed: result.done + result.skipped + result.failed,
        remaining: result.remaining,
        aborted: result.aborted,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "report_worker_failed",
    };
  }
}
