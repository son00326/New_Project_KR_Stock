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
import { computeAcceptGate } from "@/lib/portfolio/gating";
import { detectSingleAdminStreak } from "@/lib/portfolio/auto-relief";
import { BucketSection } from "@/components/admin/shortlist/bucket-section";
import { TriggerFullReportButton } from "./trigger-full-report-button";
import { PortfolioPanel } from "./portfolio-panel";
import type { BucketKind } from "@/types/admin";

// US-T3.2 / US-T3.4 / US-T3.5 / US-T3.6 / US-T3.8 — /admin/portfolio
// Server Component: Short List 30 표시 + Accept/Reject 클라이언트 island.
// Wave 4: D15 게이팅(24h Hold·2인 열람) + BL-20 자동 바이패스 배지 통합.

// 이번 달 = short_list_30에 INSERT된 가장 최신 month (T7e.2 — DB 기반).
// Tier 0 스크리너가 월초 외 시점에 INSERT해도 page는 latest를 따라간다.
const BUCKET_ORDER: BucketKind[] = ["short", "mid", "long"];
const REQUIRED_GATE_TICKERS = new Set([
  "005930",
  "000660",
  "012450",
  "196170",
  "373220",
]);

const BUCKET_META: Record<
  BucketKind,
  { label: string; cadence: string; weight: string }
> = {
  short: {
    label: "단기 (Short)",
    cadence: "주간 선정",
    weight: "축 비중 30%",
  },
  mid: {
    label: "중기 (Mid)",
    cadence: "월간 선정",
    weight: "축 비중 40%",
  },
  long: {
    label: "장기 (Long)",
    cadence: "월간 선정",
    weight: "축 비중 30%",
  },
};

function formatMonthLabel(month: string): string {
  if (!month) return "";
  const [y, m] = month.split("-");
  return `${y}년 ${Number(m)}월`;
}

// Mock cleanup Step 1.3 (58차): MOCK_ADMIN_REPORT_VIEW_LOG의 가짜 2인 열람 시드 제거.
// 실 운영에서는 report_view_log 테이블 SELECT (admin이 /admin/report/[ticker] 방문 시 INSERT,
// BL-5 1일 1회 dedupe). 0건이면 viewers_insufficient honest 차단.
function getMinimumRequiredViewerCount(
  tickers: string[],
  viewerCountsByTicker: Map<string, number>,
): number {
  const representativeTickers = tickers.filter((ticker) =>
    REQUIRED_GATE_TICKERS.has(ticker),
  );
  const requiredTickers =
    representativeTickers.length > 0 ? representativeTickers : tickers;
  if (requiredTickers.length === 0) return 0;

  return Math.min(
    ...requiredTickers.map((ticker) => viewerCountsByTicker.get(ticker) ?? 0),
  );
}

export default async function AdminPortfolioPage() {
  // T7e.2 — latest month를 DB에서 조회. 빈 DB일 때는 month=""로 빈 화면 안내.
  const monthShortlist = await getActiveShortList();
  const month = monthShortlist[0]?.month ?? "";
  const monthLabel = formatMonthLabel(month);

  const thisMonthItems = monthShortlist.filter(
    (r) => r.deltaStatus !== "removed",
  );

  if (!month || thisMonthItems.length === 0) {
    return (
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold">이번 달 포트 확정</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              short_list_30 테이블에 활성 종목이 없습니다.
            </p>
          </div>
          <div className="text-xs text-muted-foreground">
            ※ T7e.8 Tier 0 seed 후 Accept/Reject가 활성화됩니다
          </div>
        </header>

        <div className="rounded-lg border border-dashed bg-muted/20 px-6 py-10 text-center">
          <p className="text-sm font-medium">포트 확정 대기</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Tier 0 스크리너가 Short List 30을 INSERT하면 이 화면에서
            D+5 게이트와 Accept/Reject를 검증할 수 있습니다.
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

  // T7e.2 — shortlistGeneratedAt = 실 short_list_30 row의 createdAt 기준.
  // 같은 월 행은 Tier 0 batch INSERT라 createdAt 동일.
  // DB 비어있을 때는 epoch fallback (게이트 자동 비활성).
  const shortlistGeneratedAtDate = thisMonthItems[0]?.createdAt
    ? new Date(thisMonthItems[0].createdAt)
    : new Date(0);
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
  // T7e.6 — access-logs source는 boundary stub ([]) → autoReliefActive=false 영구.
  const accessLogs = await getRecentAdminAccessLogs(now, 7);
  const autoReliefResult = detectSingleAdminStreak(accessLogs, now, 7);
  const autoReliefActive = autoReliefResult.active;

  // (b) 2인 열람 게이팅 — 대표 상세 리포트 전체가 2인 열람을 만족해야 통과.
  // Mock cleanup Step 1.3 (58차): mock-admin-report-view-log 제거 → real report_view_log SELECT.
  const tickersForGate = thisMonthItems.map((item) => item.ticker);
  const viewerCountsByTicker = await getDistinctViewerCountsByTicker({
    month: month.slice(0, 7),
    tickers: tickersForGate,
  });
  const distinctViewerCount = getMinimumRequiredViewerCount(
    tickersForGate,
    viewerCountsByTicker,
  );

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
          <span>※ short_list_30 SELECT · seed는 T7e.8 Tier 0 후 채워짐</span>
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
        persistedProposal={persistedProposal}
        shortlistView={shortlistView}
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
            // PR4 Task 1 Step 1.3.4.3 (B10 fix omxy R2): admin trigger 버튼 주입.
            // commitFullReport (fast path) wire — Task 2에서 quality path swap.
            // month는 YYYY-MM-01 → YYYY-MM 변환 (triggerFullReport regex 정합, B3 fix).
            renderRowAction={(item) => (
              <TriggerFullReportButton
                ticker={item.ticker}
                name={item.name ?? item.ticker}
                sector={item.sector ?? ""}
                month={item.month.slice(0, 7)}
              />
            )}
          />
        ))}
      </div>
    </div>
  );
}
