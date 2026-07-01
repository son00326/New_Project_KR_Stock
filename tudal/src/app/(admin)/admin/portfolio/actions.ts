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
import { isCostLoggingEnabled, preflightHardcap } from "@/lib/cost/cost-logger";
import {
  getRoleWorstCaseMaxCostPerCallKrw,
  isRoleProviderAvailable,
} from "@/lib/ai/model-registry";
import { getActiveShortList } from "@/lib/data/admin-shortlist";
import {
  assertProposalPersistenceReady,
  getProposalByMonth,
  upsertProposalRpc,
} from "@/lib/data/admin-proposals";
import {
  hasRiskDebateAssessment,
  insertRiskDebateAssessment,
} from "@/lib/data/admin-risk-debate";
import { buildSnapshotRowsFromProposal } from "@/lib/portfolio/proposal-snapshots";
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
  filterActiveShortlist,
  resolveShortlistGeneratedAt,
  getGateTickers,
  computeMinimumViewerCount,
} from "@/lib/portfolio/shortlist-gate";
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
import { isRiskDebateEnabled } from "@/lib/risk/flags";
import { runRiskDebate } from "@/lib/risk/risk-debate-orchestrator";
import { callRiskDebator } from "@/lib/risk/risk-debate-client";
import type { RiskPortfolioInput } from "@/lib/risk/risk-debate";
import { logStructured } from "@/lib/log/structured-log";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])-01$/;

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

function validateShortlistMonth(month: string, shortlist: ShortListItem[]) {
  if (!MONTH_RE.test(month)) {
    return { success: false as const, error: "invalid_month" };
  }
  if (filterActiveShortlist(shortlist).length === 0) {
    return { success: false as const, error: "shortlist_month_not_found" };
  }
  return { success: true as const };
}

// 77차 Accept-gate fix: resolveShortlistGeneratedAt / getGateTickers / computeMinimumViewerCount는
//   @/lib/portfolio/shortlist-gate 공유 모듈로 단일화 (page display gate ↔ actions enforcement gate
//   split-brain 해소 + legacy mock 하드코딩 제거). 구 getRequiredGateTickers/로컬 정의 제거.

async function validateAcceptGate(month: string, shortlist: ShortListItem[]) {
  const generatedAt = resolveShortlistGeneratedAt(shortlist);
  if (!generatedAt) {
    return { success: false as const, error: "shortlist_month_not_found" };
  }

  const now = new Date();

  // 77차 D31 — 내부도구(3인·가상 포트 확정) default = 완화 모드(D+4 Hold + 2인 열람 면제, 24h만).
  //   멤버서비스급 strict 복원 = PORTFOLIO_ACCEPT_GATE_STRICT=true opt-in. page.tsx와 동일 규칙.
  //   relaxed면 viewer/auto-relief DB 조회 자체를 skip — 게이트가 그 값을 무시하므로, DB/RLS 실패가
  //   accept를 막지 않도록(omxy R1 MED: relaxed인데 viewer lookup이 hard dependency로 남던 것 해소).
  const relaxGate = process.env.PORTFOLIO_ACCEPT_GATE_STRICT !== "true";

  let autoReliefActive = false;
  let distinctViewerCount = 0;
  if (!relaxGate) {
    // T7e.6 — access-logs source는 boundary stub ([]) → autoReliefActive=false 영구.
    autoReliefActive = detectSingleAdminStreak(
      await getRecentAdminAccessLogs(now, 7),
      now,
      7,
    ).active;
    // Mock cleanup Step 1.3: real report_view_log SELECT (page.tsx와 동일 source — split-brain 해소).
    const gateTickers = getGateTickers(shortlist);
    const viewerCountsByTicker = await getDistinctViewerCountsByTicker({
      month: month.slice(0, 7),
      tickers: gateTickers,
    });
    distinctViewerCount = computeMinimumViewerCount(gateTickers, viewerCountsByTicker);
  }

  const gate = computeAcceptGate({
    shortlistGeneratedAt: generatedAt,
    now,
    distinctViewerCount,
    calendar: MOCK_KR_BUSINESS_DAYS_2026,
    autoReliefActive,
    relaxGate,
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
  // W3b-2b — proposal 있으면 snapshot을 proposal.positions(편입 종목만) + proposal weight로 구성.
  //   없으면(flag-off/미존재/fallback) 현 shortlist.suggestedWeight 경로 1:1(behavior-neutral).
  proposal?: PortfolioProposal | null;
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

  // W3b-2b — entry_price fetch scope는 proposal-aware: proposal 있으면 편입 종목만(비편입 stale가 spurious
  //   거부 유발 안 함), 없으면 전체 shortlist(현 동작).
  const tickersToPrice = input.proposal
    ? input.proposal.positions.map((p) => p.ticker)
    : input.shortlist.map((s) => s.ticker);

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
    priceMap = await resolveEntryPricesKrw(tickersToPrice, { authKey, basDd });
  } catch {
    return { success: false, error: "entry_price_unavailable" };
  }

  // W3b-2b — proposal 경로: 편입 종목만 + proposal weight. 누락 entry_price → 전체 거부(helper throw).
  if (input.proposal) {
    try {
      const snapshots = buildSnapshotRowsFromProposal({
        positions: input.proposal.positions,
        // W3b-2c — 명시 cash 행. flag off(기본)면 cash-implicit 유지(behavior-neutral). USER는 0035 apply 후에만 on.
        cashWeight: input.proposal.cashWeight,
        emitCashRow: process.env.PORTFOLIO_EXPLICIT_CASH_ROW_ENABLED === "true",
        priceMap,
        month: input.month,
        acceptDate: input.acceptDate,
      });
      return { success: true, snapshots };
    } catch {
      return { success: false, error: "entry_price_unavailable" };
    }
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
// W3b-2b (D2/D3/D6) — Accept 시점 proposal 로드(money-path).
//   PORTFOLIO_USE_PROPOSAL_ENABLED off → null(현 suggestedWeight 경로 1:1).
//   0034 미적용(proposal_schema_missing) / proposal row 부재(null) → null fallback(기존 Accept 무브릭).
//   row 존재 but stale(positions ⊄ 현 active) → proposal_stale_for_month reject.
//   row 오염(portfolio_proposal_parse_failed) → reject. 기타 SELECT 실패 → proposal_lookup_failed reject.
//   getProposalByMonth raw throw가 acceptShortList {success,error} contract를 깨지 않도록 전부 catch.
// ---------------------------------------------------------------------------
async function loadProposalForAccept(
  month: string,
  activeTickers: Set<string>,
): Promise<
  | { ok: true; proposal: PortfolioProposal | null }
  | { ok: false; error: string }
> {
  if (process.env.PORTFOLIO_USE_PROPOSAL_ENABLED !== "true") {
    return { ok: true, proposal: null };
  }
  let persisted: Awaited<ReturnType<typeof getProposalByMonth>>;
  try {
    persisted = await getProposalByMonth({ month });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "proposal_schema_missing") {
      return { ok: true, proposal: null }; // 0034 미적용 → fallback(behavior-neutral, Accept 무브릭).
    }
    if (msg.startsWith("portfolio_proposal_parse_failed")) {
      return { ok: false, error: msg }; // 오염 row → reject(silent 오중 weight 금지).
    }
    return { ok: false, error: "proposal_lookup_failed" };
  }
  if (!persisted) {
    return { ok: true, proposal: null }; // row 부재 → fallback.
  }
  // stale: proposal 종목이 현 active shortlist에 모두 있어야(생성 후 re-screening 가능). 위반 → orphan 배분 차단.
  for (const pos of persisted.proposal.positions) {
    if (!activeTickers.has(pos.ticker)) {
      return { ok: false, error: "proposal_stale_for_month" };
    }
  }
  return { ok: true, proposal: persisted.proposal };
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
  const generatedAt = resolveShortlistGeneratedAt(shortlist);
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
  // W3b-2b (D2/D3/D6) — proposal 소비. flag-off/미존재/0034 미적용 → null(fallback, suggestedWeight 1:1).
  //   present-but-stale → proposal_stale_for_month, corrupted → parse_failed, SELECT 실패 → proposal_lookup_failed.
  const activeShortlist = filterActiveShortlist(shortlist);
  const proposalLoad = await loadProposalForAccept(
    month,
    new Set(activeShortlist.map((s) => s.ticker)),
  );
  if (!proposalLoad.ok) {
    return { success: false, error: proposalLoad.error };
  }

  const acceptDate = new Date().toISOString().slice(0, 10);
  const snapshotPlan = await buildInitialSnapshots({
    month,
    acceptDate,
    shortlist: activeShortlist,
    proposal: proposalLoad.proposal,
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
    // (R33 HIGH) 진짜 already_finalized(approval finalization race)는 RPC가 in-band로 반환한다(위 result.error
    //   처리). 이 catch는 RPC가 re-raise한 snapshot-side unique violation만 받는다 — 예: 0035 미적용/drift 시
    //   cash 인덱스 충돌, 동일 date 재Accept의 aggregate 충돌. 이를 already_finalized로 매핑하면 money-path
    //   장애가 "이미 확정"으로 오표시되어 디버깅이 어려워진다 → accept_write_conflict로 정직히 구분
    //   (스키마 readiness / 재진입 충돌 신호). panel raw throw는 여전히 방지.
    if (isUniqueViolation(err)) {
      return { success: false, error: "accept_write_conflict" };
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
  const generatedAt = resolveShortlistGeneratedAt(shortlist);
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

function toRiskPortfolioInput(
  month: string,
  proposal: PortfolioProposal,
  active: ShortListItem[],
): RiskPortfolioInput {
  const byTicker = new Map(active.map((item) => [item.ticker, item]));
  const bucketMix = { short: 0, mid: 0, long: 0 };
  const holdings = proposal.positions.map((position) => {
    bucketMix[position.timeframe] += 1;
    const item = byTicker.get(position.ticker);
    return {
      ticker: position.ticker,
      sector: item?.sector ?? "",
      weight: position.weight,
    };
  });
  return {
    month,
    holdings,
    cashWeight: proposal.cashWeight,
    bucketMix,
  };
}

async function runRiskDebateAdvisory(input: {
  month: string;
  costMonth: string;
  proposal: PortfolioProposal;
  active: ShortListItem[];
  adminUserId: string;
  client: Awaited<ReturnType<typeof createClient>>;
}): Promise<void> {
  if (!isRiskDebateEnabled()) return;
  try {
    await runRiskDebate(toRiskPortfolioInput(input.month, input.proposal, input.active), {
      hasExistingAssessment: (month) =>
        hasRiskDebateAssessment(month, { client: input.client }),
      preflightCost: async () => {
        try {
          await preflightHardcap(
            {
              month: input.costMonth,
              lines: [
                {
                  callCount: 3,
                  maxCostPerCallKrw: getRoleWorstCaseMaxCostPerCallKrw("critic"),
                },
              ],
            },
            { client: input.client },
          );
          return true;
        } catch {
          return false;
        }
      },
      callRiskDebator: (prompt, stance) =>
        callRiskDebator({
          prompt,
          stance,
          month: input.costMonth,
          adminUserId: input.adminUserId,
          costClient: input.client,
        }),
      insert: (assessment) =>
        insertRiskDebateAssessment(assessment, { client: input.client }),
    });
  } catch (err) {
    logStructured("warn", "risk_debate_advisory_skipped", {
      reason: err instanceof Error ? err.message : "unknown",
    });
  }
}
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
// W3b-1/W3b-2a (D26 Q2) — proposePortfolio admin server action.
// 선정 30 종목에 대해 AI(Opus 4.8 `portfolio` role)가 편입 여부·종목별 비중·현금(0~30%)을 자율 제안.
// 게이트 순서(R19/W3b-2a 반영): input → getUser(auth_unavailable) → is_admin RPC(admin_required) →
//   flag(PORTFOLIO_AI_PROPOSAL_ENABLED)+key(ANTHROPIC_API_KEY) 이중(proposal_disabled) →
//   isCostLoggingEnabled(cost_logging_disabled) → [persist-on이면 assertProposalPersistenceReady preflight,
//   schema-missing 시 AI 호출 0] → getActiveShortList(active exact 30, else shortlist_incomplete) →
//   preflightHardcap(cost_hardcap_exceeded) → callPortfolioProposal → positions ⊆ shortlist 검증 →
//   [persist-on이면 upsertProposalRpc → proposalId].
// cost burn = admin+flag+key+logging+hardcap 모두 통과 후에만 (어느 게이트든 실패 시 call/shortlist 미호출 → 비용 0).
// W3b-1 = proposal 생성·반환 / W3b-2a = persist 게이트(PORTFOLIO_PROPOSAL_PERSIST_ENABLED, default off=영속 0).
//   **Accept·snapshot·0016 RPC 무변경**(money-path 무접촉) — Accept 통합은 W3b-2b, UI는 W3b-3.
// ---------------------------------------------------------------------------
export async function proposePortfolio(input: {
  month: string; // YYYY-MM-01 (acceptShortList/portfolio page와 동일)
}): Promise<
  | { success: true; data: { proposal: PortfolioProposal; proposalId?: string } }
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
  // 항목1 — provider-agnostic 게이트: portfolio 역할이 resolve될 provider(GLM primary → Claude fallback)의
  //   키 존재 여부. GLM-only 배포에서 ANTHROPIC_API_KEY 부재만으로 거짓 disabled 되던 문제 제거.
  if (!isRoleProviderAvailable("portfolio")) {
    return { success: false, error: "proposal_disabled" };
  }

  // R19 HIGH (omxy) — cost master guard. triggerFullReport와 동형: isCostLoggingEnabled() 부재 시
  //   insertCostLog noop → 실 Opus 비용은 발생했는데 cost_log 미기록 → getMonthlyTotal=0 →
  //   hardcap fail-open(무제한 burn). flag=true인데 logging off면 실호출 전 차단.
  if (!isCostLoggingEnabled()) {
    return { success: false, error: "cost_logging_disabled" };
  }

  // W3b-2a (D4) — persist 게이트. flag-on이면 AI 비용 발생 전(getActiveShortList/preflight/call 前)
  //   schema-ready preflight로 0034 미적용을 fail-closed → 유료 제안 유실 방지(AI 호출 0회).
  const shouldPersist =
    process.env.PORTFOLIO_PROPOSAL_PERSIST_ENABLED === "true";
  if (shouldPersist) {
    try {
      await assertProposalPersistenceReady({ client: supabase });
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "proposal_schema_missing",
      };
    }
  }

  const monthYm = input.month.slice(0, 7); // cost_log/prompt month = YYYY-MM

  let shortlist: ShortListItem[];
  try {
    shortlist = await getActiveShortList({
      month: input.month,
      client: supabase,
    });
  } catch {
    return { success: false, error: "shortlist_lookup_failed" };
  }
  // R19 MED (omxy) — "선정 30" 입력 계약 + bounded prompt. acceptShortList(`<`)보다 엄격한 exact-30:
  //   AI cost path는 universe가 30을 초과(트랙 split 전이 등)해도 안 되므로 !== 로 fail-closed.
  const active = filterActiveShortlist(shortlist);
  if (active.length !== SHORTLIST_TARGET_COUNT) {
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

  // R19 HIGH (omxy) — preflight hardcap. 단일 Opus(portfolio) 콜 보수 단가 reservation으로
  //   50만원/월 hardcap 초과 시 실호출 전 fail-closed. is_admin 게이트 후라 admin cost SUM RPC 정합.
  try {
    await preflightHardcap(
      {
        month: monthYm,
        lines: [
          { callCount: 1, maxCostPerCallKrw: getRoleWorstCaseMaxCostPerCallKrw("portfolio") },
        ],
      },
      { client: supabase },
    );
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "cost_hardcap_exceeded",
    };
  }

  let proposal: PortfolioProposal;
  let proposalModel: string | null = null;
  try {
    proposal = await callPortfolioProposal({
      month: monthYm,
      shortlistSummary: summary,
      adminUserId: user.id,
      costClient: supabase,
      onResolvedBinding: (binding) => {
        proposalModel = binding.model;
      },
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

  // W3b-2a (D4) — persist(영속). flag-on이면 생성된 proposal을 upsert. post-AI 영속 실패는 fail-closed
  //   (D5 정책 — 비영속 proposal을 success로 노출 금지). flag-off=영속 0(W3b-1 1:1, proposalId 없음).
  let proposalId: string | undefined;
  if (shouldPersist) {
    if (!proposalModel) {
      return { success: false, error: "proposal_model_missing" };
    }
    try {
      const result = await upsertProposalRpc({
        month: input.month, // 테이블 month=date(YYYY-MM-01) — cost_log의 monthYm(YYYY-MM)과 구분.
        proposal,
        model: proposalModel,
        client: supabase,
      });
      proposalId = result.id;
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "proposal_persist_failed",
      };
    }
  }

  await runRiskDebateAdvisory({
    month: input.month,
    costMonth: monthYm,
    proposal,
    active,
    adminUserId: user.id,
    client: supabase,
  });

  return {
    success: true,
    data: proposalId ? { proposal, proposalId } : { proposal },
  };
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
