import { MOCK_ADMIN_SHORTLIST } from "@/lib/data/mock-admin-shortlist";
import { MOCK_ADMIN_APPROVALS } from "@/lib/data/mock-admin-approvals";
import { MOCK_ADMIN_ACCESS_LOGS } from "@/lib/data/mock-admin-access-logs";
import { MOCK_ADMIN_REPORT_VIEW_LOG } from "@/lib/data/mock-admin-report-view-log";
import { MOCK_KR_BUSINESS_DAYS_2026 } from "@/lib/portfolio/calendar";
import { addBusinessDays, formatDateKey } from "@/lib/portfolio/business-days";
import { computeAcceptGate } from "@/lib/portfolio/gating";
import { detectSingleAdminStreak } from "@/lib/portfolio/auto-relief";
import { BucketSection } from "@/components/admin/shortlist/bucket-section";
import { PortfolioPanel } from "./portfolio-panel";
import type { BucketKind } from "@/types/admin";

// US-T3.2 / US-T3.4 / US-T3.5 / US-T3.6 / US-T3.8 — /admin/portfolio
// Server Component: Short List 30 표시 + Accept/Reject 클라이언트 island.
// Wave 4: D15 게이팅(24h Hold·2인 열람) + BL-20 자동 바이패스 배지 통합.

const CURRENT_MONTH = "2026-04-01"; // TODO: new Date() 기반 첫째날로 전환 (S5)
const BUCKET_ORDER: BucketKind[] = ["short", "mid", "long"];

const BUCKET_META: Record<
  BucketKind,
  { label: string; cadence: string; weight: string }
> = {
  short: {
    label: "단기 (Short)",
    cadence: "21일 리밸런스",
    weight: "축 비중 30%",
  },
  mid: {
    label: "중기 (Mid)",
    cadence: "42일 리밸런스",
    weight: "축 비중 40%",
  },
  long: {
    label: "장기 (Long)",
    cadence: "63일 리밸런스",
    weight: "축 비중 30%",
  },
};

function formatMonthLabel(month: string): string {
  if (!month) return "";
  const [y, m] = month.split("-");
  return `${y}년 ${Number(m)}월`;
}

export default function AdminPortfolioPage() {
  const month = CURRENT_MONTH;
  const monthLabel = formatMonthLabel(month);

  // 이번 달 shortlist (active 30종 — removed 제외)
  const thisMonthItems = MOCK_ADMIN_SHORTLIST.filter(
    (r) => r.month === month && r.deltaStatus !== "removed",
  );

  // Delta 집계
  const newCount = MOCK_ADMIN_SHORTLIST.filter(
    (r) => r.month === month && r.deltaStatus === "new",
  ).length;
  const holdCount = MOCK_ADMIN_SHORTLIST.filter(
    (r) => r.month === month && r.deltaStatus === "hold",
  ).length;
  const removedCount = MOCK_ADMIN_SHORTLIST.filter(
    (r) => r.deltaStatus === "removed",
  ).length;

  // 이번 달 승인 상태
  const thisMonthApprovals = MOCK_ADMIN_APPROVALS.filter(
    (a) => a.month === month,
  );
  const finalApproval =
    thisMonthApprovals.find((a) => a.isFinal && a.approvalType === "accept") ??
    null;
  const isAlreadyFinalized = finalApproval !== null;
  const reanalysisCount = thisMonthApprovals.filter(
    (a) => a.approvalType === "reject",
  ).length;

  // ── Wave 4: D15 게이팅 계산 ─────────────────────────────────────────────

  // shortlistGeneratedAt — 2026-04 확정 mock: 04-01 09:00 KST
  const shortlistGeneratedAtDate = new Date("2026-04-01T09:00:00+09:00");
  const shortlistGeneratedAt = shortlistGeneratedAtDate.toISOString();

  const now = new Date();
  const calendar = MOCK_KR_BUSINESS_DAYS_2026;

  // (a) D+5 영업일 위젯 (T3.5)
  const d5Date = addBusinessDays(shortlistGeneratedAtDate, 5, calendar);
  const d5Label = formatDateKey(d5Date);
  const d5DiffDays = Math.ceil(
    (d5Date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  // (c) BL-20 자동 바이패스 배지 (T3.8)
  const autoReliefResult = detectSingleAdminStreak(MOCK_ADMIN_ACCESS_LOGS, now, 7);
  const autoReliefActive = autoReliefResult.active;

  // (b) 2인 열람 게이팅 — 첫 번째 shortlist ticker 기준 report_id로 단순화
  const firstTicker = thisMonthItems[0]?.ticker ?? "005930";
  const firstReportId = `rpt-${month}-${firstTicker}`;
  const distinctViewerCount = new Set(
    MOCK_ADMIN_REPORT_VIEW_LOG
      .filter((r) => r.reportId === firstReportId)
      .map((r) => r.adminId),
  ).size;

  // computeAcceptGate 호출
  const gateResult = computeAcceptGate({
    shortlistGeneratedAt: shortlistGeneratedAtDate,
    now,
    distinctViewerCount,
    calendar,
    autoReliefActive,
  });

  // 게이팅 메시지 생성
  function buildGateMessage(): string | null {
    if (gateResult.allowed) return null;
    if (gateResult.reason === "hold_24h") {
      const remainingMs = gateResult.remainingMs ?? 0;
      const totalMin = Math.ceil(remainingMs / (1000 * 60));
      const hours = Math.floor(totalMin / 60);
      const mins = totalMin % 60;
      return `⏳ 24h Hold 진행 중 — 남은 ${hours}시간 ${mins}분`;
    }
    if (gateResult.reason === "business_days_bypass") {
      const expiresAt = gateResult.holdExpiresAt;
      const expiresLabel = expiresAt ? formatDateKey(expiresAt) : "—";
      return `⏳ D+4 영업일 Hold 진행 중 — 만료 ${expiresLabel}`;
    }
    if (gateResult.reason === "viewers_insufficient") {
      const remaining = gateResult.viewersRemaining ?? 0;
      return `👥 열람 ${remaining}/2명 필요`;
    }
    return null;
  }

  const gateMessage = buildGateMessage();

  // 버킷별 그룹
  const byBucket = BUCKET_ORDER.map((bucket) => ({
    bucket,
    items: thisMonthItems
      .filter((r) => r.bucket === bucket)
      .sort((a, b) => a.rank - b.rank),
  }));

  return (
    <div className="space-y-6">
      {/* (c) BL-20 자동 바이패스 배지 (T3.8) — active=true 시 최상단 */}
      {autoReliefActive && (
        <div className="flex items-center gap-2 rounded-lg border border-red-400/60 bg-red-50 px-4 py-3 text-sm font-semibold text-red-900 dark:border-red-500/40 dark:bg-red-950/30 dark:text-red-200">
          ⚠️ 비상 완화 모드: 최근 7일 단일 접속 — {autoReliefResult.adminId}
        </div>
      )}

      {/* 헤더 */}
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">
            이번 달 포트 확정 — {monthLabel}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Short List 30 · 편입{" "}
            <span className="font-mono font-semibold" style={{ color: "var(--color-market-up)" }}>
              {newCount}
            </span>{" "}
            · 유지{" "}
            <span className="font-mono font-semibold">{holdCount}</span> · 제외{" "}
            <span
              className="font-mono font-semibold"
              style={{ color: "var(--color-market-down)" }}
            >
              {removedCount}
            </span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
          {/* (a) D+5 영업일 위젯 (T3.5) */}
          <span>
            📅 D+5 영업일: {d5Label}{" "}
            {d5DiffDays > 0
              ? `(${d5DiffDays}일 남음)`
              : d5DiffDays === 0
                ? "(오늘)"
                : "(지남)"}
          </span>
          <span>※ mock fixture · 실데이터 전환 S5 M10</span>
        </div>
      </header>

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
      />

      {/* Short List 30 표 — 버킷별 섹션 */}
      <div className="space-y-8">
        {byBucket.map(({ bucket, items }) => (
          <BucketSection
            key={bucket}
            bucket={bucket}
            label={BUCKET_META[bucket].label}
            cadence={BUCKET_META[bucket].cadence}
            weight={BUCKET_META[bucket].weight}
            items={items}
          />
        ))}
      </div>
    </div>
  );
}
