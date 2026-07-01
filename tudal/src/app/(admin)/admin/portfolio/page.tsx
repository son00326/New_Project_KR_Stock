import { getActiveShortList } from "@/lib/data/admin-shortlist";
import { getApprovalsByMonth } from "@/lib/data/admin-approvals";
import {
  getProposalByMonth,
  type PersistedPortfolioProposal,
} from "@/lib/data/admin-proposals";
import type { ShortlistNameItem } from "@/lib/portfolio/proposal-view";
import { getRecentAdminAccessLogs } from "@/lib/data/admin-access-logs";
import { getDistinctViewerCountsByTicker } from "@/lib/data/admin-report-view-log";
import { MOCK_KR_BUSINESS_DAYS_2026 } from "@/lib/portfolio/calendar";
import { addBusinessDays, formatDateKey } from "@/lib/portfolio/business-days";
import {
  resolveShortlistGeneratedAt,
  getGateTickers,
  computeMinimumViewerCount,
} from "@/lib/portfolio/shortlist-gate";
import { computeAcceptGate } from "@/lib/portfolio/gating";
import { detectSingleAdminStreak } from "@/lib/portfolio/auto-relief";
import { getCurrentHoldings } from "@/lib/data/admin-snapshots";
import { CurrentHoldingsCard } from "@/components/admin/dashboard/current-holdings-card";
import { SectorDistributionLine } from "@/components/admin/dashboard/sector-distribution";
import { getRiskDebateForMonth } from "@/lib/data/admin-risk-debate";
import { RiskDebateAdvisory } from "@/components/admin/risk/risk-debate-advisory";
import { PortfolioPanel } from "./portfolio-panel";
import type { PortfolioSnapshot } from "@/types/admin";
import { isRoleProviderAvailable } from "@/lib/ai/model-registry";
import { isCostLoggingEnabled } from "@/lib/cost/cost-logger";
import { AlertTriangle, Calendar } from "lucide-react";

// US-T3.2 / US-T3.4 / US-T3.5 / US-T3.6 / US-T3.8 — /admin/portfolio
// Server Component: Short List 30 표시 + Accept/Reject 클라이언트 island.
// Wave 4: D15 게이팅(24h Hold·2인 열람) + BL-20 자동 바이패스 배지 통합.

// 이번 달 = short_list_30에 INSERT된 가장 최신 month (T7e.2 — DB 기반).
// Tier 0 스크리너가 월초 외 시점에 INSERT해도 page는 latest를 따라간다.

function formatMonthLabel(month: string): string {
  if (!month) return "";
  const [y, m] = month.split("-");
  return `${y}년 ${Number(m)}월`;
}

// 77차 Accept-gate fix: 게이트 대상 티커·viewer-min·anchor는 @/lib/portfolio/shortlist-gate 공유
//   모듈로 단일화 (구 REQUIRED_GATE_TICKERS legacy mock 하드코딩 + getMinimumRequiredViewerCount
//   로컬 정의 제거 — page display gate ↔ actions enforcement gate split-brain 해소).

export default async function AdminPortfolioPage() {
  // T7e.2 — latest month를 DB에서 조회. 빈 DB일 때는 month=""로 빈 화면 안내.
  const monthShortlist = await getActiveShortList();
  const month = monthShortlist[0]?.month ?? "";
  const monthLabel = formatMonthLabel(month);

  const thisMonthItems = monthShortlist.filter(
    (r) => r.deltaStatus !== "removed",
  );

  let holdings: PortfolioSnapshot[] = [];
  let holdingsLoadError = false;
  try {
    holdings = await getCurrentHoldings();
  } catch {
    holdingsLoadError = true;
    holdings = [];
  }
  const holdingsNameByTicker: Record<string, string> = {};
  for (const item of thisMonthItems) {
    holdingsNameByTicker[item.ticker] = item.name;
  }

  if (!month || thisMonthItems.length === 0) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">포트폴리오</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            확정 운영 포트폴리오와 이번 달 포트 확정을 관리합니다.
          </p>
        </header>

        <CurrentHoldingsCard
          holdings={holdings}
          basisMonth={holdings[0]?.month ?? month}
          nameByTicker={holdingsNameByTicker}
          loadError={holdingsLoadError}
        />

        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 px-6 py-12 text-center">
          <p className="text-base font-semibold">아직 준비 중입니다</p>
          <p className="mt-2 text-sm text-muted-foreground">
            이번 달 추천 종목이 준비되면 이 화면에서 포트를 확정할 수 있습니다.
          </p>
        </div>
      </div>
    );
  }

  // Delta 집계
  const newCount = monthShortlist.filter((r) => r.deltaStatus === "new").length;
  const holdCount = monthShortlist.filter((r) => r.deltaStatus === "hold").length;
  const removedCount = monthShortlist.filter(
    (r) => r.deltaStatus === "removed",
  ).length;

  // G3 위험 재판정 (advisory only — Accept 비차단·fail-soft null). RISK_DEBATE_ENABLED off / 0048 미적용 → null.
  const riskDebate = await getRiskDebateForMonth(month);

  // 이번 달 승인 상태
  const thisMonthApprovals = await getApprovalsByMonth(month);
  const finalApproval =
    thisMonthApprovals.find((a) => a.isFinal && a.approvalType === "accept") ??
    null;
  const isAlreadyFinalized = finalApproval !== null;
  const reanalysisCount = thisMonthApprovals.filter(
    (a) => a.approvalType === "reject",
  ).length;

  // ── Wave 4: D15 게이팅 계산 ─────────────────────────────────────────────

  // 77차 fix: anchor = active 중 MAX createdAt (actions enforcement gate와 동일 helper — 구 [0] anchor는
  //   W2a mixed-cadence서 오래된 mid가 freshly-refreshed short보다 먼저 enable시키는 불일치였다).
  //   DB 비어있을 때는 epoch fallback (게이트 자동 비활성).
  const shortlistGeneratedAtDate =
    resolveShortlistGeneratedAt(monthShortlist) ?? new Date(0);
  const shortlistGeneratedAt = shortlistGeneratedAtDate.toISOString();

  const now = new Date();
  const calendar = MOCK_KR_BUSINESS_DAYS_2026;

  // (a) D+5 영업일 위젯 (T3.5)
  const d5Date = addBusinessDays(shortlistGeneratedAtDate, 5, calendar);
  const d5Label = formatDateKey(d5Date);
  const d5DiffDays = Math.ceil(
    (d5Date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  // 77차 D31 — 내부도구(3인·가상 포트 확정) default = 완화 모드(D+4 Hold + 2인 열람 면제, 24h만).
  //   멤버서비스급 strict 복원 = PORTFOLIO_ACCEPT_GATE_STRICT=true opt-in. actions.ts와 동일 규칙.
  //   relaxed면 viewer/auto-relief DB 조회를 skip — 게이트가 무시하므로 + DB/RLS 실패가 Server Component
  //   crash를 일으키지 않도록(omxy R1 MED: relaxed인데 viewer query가 catch 없이 hard dependency로 남던 것).
  const relaxGate = process.env.PORTFOLIO_ACCEPT_GATE_STRICT !== "true";

  // (c) BL-20 자동 바이패스 배지 (T3.8) + (b) 2인 열람 게이팅 — strict 모드에서만 조회.
  // T7e.6 — access-logs source는 boundary stub ([]) → autoReliefActive=false 영구.
  let autoReliefActive = false;
  let autoReliefAdminId: string | null = null;
  let distinctViewerCount = 0;
  if (!relaxGate) {
    const accessLogs = await getRecentAdminAccessLogs(now, 7);
    const autoReliefResult = detectSingleAdminStreak(accessLogs, now, 7);
    autoReliefActive = autoReliefResult.active;
    autoReliefAdminId = autoReliefResult.adminId ?? null;
    // Mock cleanup Step 1.3 (58차): mock-admin-report-view-log 제거 → real report_view_log SELECT.
    const tickersForGate = getGateTickers(monthShortlist);
    const viewerCountsByTicker = await getDistinctViewerCountsByTicker({
      month: month.slice(0, 7),
      tickers: tickersForGate,
    });
    distinctViewerCount = computeMinimumViewerCount(
      tickersForGate,
      viewerCountsByTicker,
    );
  }

  // computeAcceptGate 호출
  const gateResult = computeAcceptGate({
    shortlistGeneratedAt: shortlistGeneratedAtDate,
    now,
    distinctViewerCount,
    calendar,
    autoReliefActive,
    relaxGate,
  });

  // 게이팅 메시지 생성
  function buildGateMessage(): string | null {
    if (gateResult.allowed) return null;
    if (gateResult.reason === "hold_24h") {
      const remainingMs = gateResult.remainingMs ?? 0;
      const totalMin = Math.ceil(remainingMs / (1000 * 60));
      const hours = Math.floor(totalMin / 60);
      const mins = totalMin % 60;
      return `24시간 대기 진행 중 — 남은 ${hours}시간 ${mins}분`;
    }
    if (gateResult.reason === "business_days_bypass") {
      const expiresAt = gateResult.holdExpiresAt;
      const expiresLabel = expiresAt ? formatDateKey(expiresAt) : "—";
      // 77차 UX: D+4 Hold 중에도 다음 blocker(2인 열람) 현황을 함께 노출 (Hold만 끝나면 바로
      //   enable될 것처럼 오인하지 않도록 — omxy 권고).
      const viewerNote =
        distinctViewerCount < 2 ? ` · 열람 ${distinctViewerCount}/2명` : "";
      return `D+4 영업일 대기 진행 중 — 만료 ${expiresLabel}${viewerNote}`;
    }
    if (gateResult.reason === "viewers_insufficient") {
      const remaining = gateResult.viewersRemaining ?? 0;
      return `열람 ${remaining}/2명 필요`;
    }
    return null;
  }

  const gateMessage = buildGateMessage();

  // 접힌 후보 요약용 섹터 분포(30 전체 재노출 금지 — 상위 5 + 기타 1줄만).
  const candidateSectors = thisMonthItems.map((r) => r.sector);

  // W3b-3 — 영속된 AI 제안(read-only 표시) + 종목 이름 조인용 view model(직렬화 안전: plain object만).
  //   getProposalByMonth는 0034 미적용/오염/조회실패 시 throw → 전부 catch해 null(Server Component crash 금지).
  //   raw error는 client에 넘기지 않고 표시 생략(기존 화면 보존).
  let persistedProposal: PersistedPortfolioProposal | null = null;
  try {
    persistedProposal = await getProposalByMonth({ month });
  } catch {
    persistedProposal = null;
  }
  const shortlistView: ShortlistNameItem[] = thisMonthItems.map((r) => ({
    ticker: r.ticker,
    name: r.name,
    sector: r.sector,
  }));
  const portfolioProposalEnabled =
    process.env.PORTFOLIO_AI_PROPOSAL_ENABLED === "true" &&
    isRoleProviderAvailable("portfolio") &&
    isCostLoggingEnabled();
  const reportBatchEnabled =
    process.env.PR5_CRON_AUTO_ENABLED === "true" &&
    !!process.env.CRON_SYSTEM_USER_ID &&
    isCostLoggingEnabled() &&
    isRoleProviderAvailable("full_report");

  return (
    <div className="space-y-6">
      {/* (c) BL-20 자동 바이패스 배지 (T3.8) — active=true 시 최상단 */}
      {autoReliefActive && (
        <div className="flex items-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm font-semibold text-destructive shadow-toss-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          <span>비상 완화 모드: 최근 7일 단일 접속 — {autoReliefAdminId}</span>
        </div>
      )}

      {/* 77차 D31 — 내부도구 완화 게이트 모드 표시 (silent 안전변경 방지·감사성) */}
      {relaxGate && (
        <div className="rounded-2xl border border-warning/30 bg-warning/10 px-4 py-2 text-xs text-foreground shadow-toss-sm">
          내부도구 게이트 모드: 확정은 24시간 대기만 적용합니다. 영업일 대기와 2인 열람은 면제됩니다.
        </div>
      )}

      {/* G3 위험 재판정 advisory (D33) — Accept 비차단·참고용. 부재 시 미표시. */}
      <RiskDebateAdvisory assessment={riskDebate} />

      {/* 헤더 */}
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            이번 달 포트 확정 — {monthLabel}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            이번 달 추천 30 · 편입{" "}
            <span className="font-bold tabular-nums text-success">
              {newCount}
            </span>{" "}
            · 유지{" "}
            <span className="font-bold tabular-nums">{holdCount}</span> · 제외{" "}
            <span className="font-bold tabular-nums text-warning">
              {removedCount}
            </span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
          {/* (a) D+5 영업일 위젯 (T3.5) */}
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              D+5 영업일: {d5Label}{" "}
              {d5DiffDays > 0
                ? `(${d5DiffDays}일 남음)`
                : d5DiffDays === 0
                  ? "(오늘)"
                  : "(지남)"}
            </span>
          </span>
        </div>
      </header>

      {/* 확정 운영 포트폴리오 — Accept 후 스냅샷. 미확정 시 카드가 "아직 운영 포트 확정 전" 빈 상태. */}
      <CurrentHoldingsCard
        holdings={holdings}
        basisMonth={holdings[0]?.month ?? month}
        nameByTicker={holdingsNameByTicker}
        loadError={holdingsLoadError}
      />

      {/* Accept 전(미확정)일 때만 접힌 후보 요약 — 30 전체 재노출 금지, 분포 1줄만. */}
      {!isAlreadyFinalized && (
        <details className="rounded-2xl border border-border/70 bg-card p-4 shadow-toss-sm md:p-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
            <span>이번 달 추천 후보 요약</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              편입 {newCount} · 유지 {holdCount} · 제외 {removedCount}
            </span>
          </summary>
          <div className="mt-3 space-y-2">
            <SectorDistributionLine sectors={candidateSectors} />
            <p className="text-xs text-muted-foreground">
              전체 추천 목록은 홈 화면 “이번 달 추천 30”에서 확인하세요.
            </p>
          </div>
        </details>
      )}

      {/* Accept/Reject 패널 (client island) — 경고 배너 포함 */}
      <PortfolioPanel
        month={month}
        shortlistGeneratedAt={shortlistGeneratedAt}
        newCount={newCount}
        holdCount={holdCount}
        removedCount={removedCount}
        reanalysisCount={reanalysisCount}
        isAlreadyFinalized={isAlreadyFinalized}
        acceptAllowed={gateResult.allowed}
        gateMessage={gateMessage}
        gateReason={gateResult.reason}
        finalApproval={finalApproval}
        persistedProposal={persistedProposal}
        shortlistView={shortlistView}
        portfolioProposalEnabled={portfolioProposalEnabled}
        reportBatchEnabled={reportBatchEnabled}
      />
    </div>
  );
}
