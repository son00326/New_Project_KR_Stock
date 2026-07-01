import { BriefingCard } from "@/components/admin/briefing/briefing-card";
import { IntradayBadge } from "@/components/admin/intraday/intraday-badge";
import { BucketSection } from "@/components/admin/shortlist/bucket-section";
import { DeltaBanner } from "@/components/admin/shortlist/delta-banner";
import { MissingCountBanner } from "@/components/admin/shortlist/missing-count-banner";
import { CurrentHoldingsCard } from "@/components/admin/dashboard/current-holdings-card";
import { SectorDistributionLine } from "@/components/admin/dashboard/sector-distribution";
import { getActiveShortList } from "@/lib/data/admin-shortlist";
import { getCurrentHoldings } from "@/lib/data/admin-snapshots";
import { getBriefingLogForDate } from "@/lib/data/admin-briefing-log";
import { resolveShortageReason } from "@/lib/admin/shortage-reason";
import type {
  BucketKind,
  IntradayAnomalyEvent,
  PortfolioSnapshot,
} from "@/types/admin";

// Mock cleanup Step 1.2 (58차): user-visible mock 4종 제거 — LATEST_BRIEFING / MOCK_ADMIN_INTRADAY_EVENTS /
// MOCK_ADMIN_SETTINGS / MOCK_ADMIN_TICKER_PREFS / INTRADAY_BADGE_REFERENCE_NOW 하드코딩 4/19.
// boundary stub 패턴 (T7e.6 access-logs 동일): intraday events = [] (S7c 실 alert_event 연결 전까지 빈 배지),
// intradayMode = false (default — settings real DB SELECT는 별도 PR), referenceNow = 실시간 Date.
// PR-fix1 (E): briefing은 더 이상 undefined 하드코딩이 아니라 오늘(KST) briefing_log 실 SELECT.

// M1 Short List 30 홈. 3섹션 세로 스택(단·중·장) + Delta 배너 + 종목 카드.
// T1.3 ShortlistRow (M4·M6) · T1.4 DeltaBanner (M5) · T1.6 MissingCountBanner 완료.
// short_list_30 테이블 SELECT (T7e.2). seed는 T7e.8 Tier 0 인디케이터 자동 스크리닝.

const BUCKET_ORDER: BucketKind[] = ["short", "mid", "long"];

const BUCKET_META: Record<
  BucketKind,
  { label: string; cadence: string; weight: string }
> = {
  short: {
    label: "단기",
    cadence: "주간 선정",
    weight: "비중 30%",
  },
  mid: {
    label: "중기",
    cadence: "월간 선정",
    weight: "비중 40%",
  },
  long: {
    label: "장기",
    cadence: "월간 선정",
    weight: "비중 30%",
  },
};

function formatMonthLabel(month: string): string {
  if (!month) return "";
  const [y, m] = month.split("-");
  return `${y}년 ${Number(m)}월`;
}

export default async function AdminHomePage() {
  const shortlist = await getActiveShortList();
  const month = shortlist[0]?.month ?? "";
  const monthLabel = formatMonthLabel(month);

  const byBucket = BUCKET_ORDER.map((bucket) => ({
    bucket,
    items: shortlist
      .filter((r) => r.bucket === bucket && r.deltaStatus !== "removed")
      .sort((a, b) => a.rank - b.rank),
  }));

  const bucketCounts = byBucket.map((b) => b.items.length);
  const activeCount = bucketCounts.reduce((sum, n) => sum + n, 0);
  // W2a 트랙 분리(단기 주1회 / 중장기 월1회) finalize 시차 → per-bucket 카운트로 track_pending 구분.
  const shortageReason = resolveShortageReason(bucketCounts);

  let holdings: PortfolioSnapshot[] = [];
  let holdingsLoadError = false;
  try {
    holdings = await getCurrentHoldings();
  } catch {
    holdingsLoadError = true;
    holdings = [];
  }
  const heldTickers = new Set(
    holdings.filter((h) => !h.isCash && h.ticker).map((h) => h.ticker as string),
  );
  // 보유 종목 이름 조인용 — 이번 달 추천 리스트에 있는 종목명 재사용(신규 조회 없음).
  const nameByTicker: Record<string, string> = {};
  for (const item of shortlist) {
    nameByTicker[item.ticker] = item.name;
  }

  // 항목4(b) — 추천 30 섹터 분포 입력(활성 종목 sector 태그).
  const activeSectors = byBucket.flatMap((b) => b.items.map((i) => i.sector));

  // M13 장중 이상 감지 — boundary stub (S7c WS alert_event 실 연결 전까지 빈 배지).
  // settings ticker prefs 필터는 events 0건이라 moot — S7c에서 prefMap + alert_event SELECT 동시 wire.
  const visibleIntradayEvents: IntradayAnomalyEvent[] = [];
  const intradayMode = false; // settings real SELECT는 별도 PR (S7c에서 admin_settings 테이블 연결)
  const referenceNow = new Date().toISOString();

  // PR-fix1 (E) — 오늘(KST) 모닝 브리핑 SELECT. morning-briefing cron이 일 1회 briefing_log upsert(date).
  //   날짜 경계는 cron(morning-briefing/route.ts todayKstIsoDate)와 동일: UTC+9 → ISO date(0,10).
  //   해당 date row 없으면 undefined → 카드 empty state ("오늘 브리핑 아직 없음"). "latest" 표시 금지(stale 차단).
  const todayKst = new Date(new Date().getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const briefing = await getBriefingLogForDate(todayKst);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">홈</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {monthLabel} 기준 · 현재 운영 중인 포트폴리오와 이번 달 AI 추천 30
        </p>
      </header>

      {/* 항목3 섹션1 — 현재 운영 중(확정 운영 포트폴리오). 추천과 시각적으로 분리된 카드. */}
      <CurrentHoldingsCard
        holdings={holdings}
        basisMonth={holdings[0]?.month ?? month}
        nameByTicker={nameByTicker}
        loadError={holdingsLoadError}
      />

      {/* 항목3 섹션2 — 이번 달 추천 30. 섹션1(운영 중)과 구분되는 별도 영역 헤더. */}
      <section aria-labelledby="recommend-30-heading" className="space-y-4">
        <div className="border-t border-border/60 pt-6">
          <h2
            id="recommend-30-heading"
            className="text-lg font-bold tracking-tight"
          >
            이번 달 추천 30
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            단기 주간 · 중·장기 월간 선정 · 단·중·장 각 10종
          </p>
          {/* 항목4(b) — 추천 30 섹터 분포 compact 1줄(상위 5 + 기타) */}
          <div className="mt-2">
            <SectorDistributionLine sectors={activeSectors} />
          </div>
        </div>

        {/* M5 Delta 배너 — 편입/유지/제외 집계 + 펼침 패널 (T1.4) */}
        <DeltaBanner items={shortlist} />

        {/* 30종 미달 경고 — 원인 분리 (T1.6). 30이면 렌더 안 함 */}
        <MissingCountBanner
          activeCount={activeCount}
          reason={shortageReason}
          fallbackMonth={month}
        />

        {/* 3섹션 세로 스택 (M1) — 각 버킷은 ShortlistRow로 렌더 (T1.3·T1.5) */}
        <div className="space-y-8">
          {byBucket.map(({ bucket, items }) => (
            <BucketSection
              key={bucket}
              bucket={bucket}
              label={BUCKET_META[bucket].label}
              cadence={BUCKET_META[bucket].cadence}
              weight={BUCKET_META[bucket].weight}
              items={items}
              heldTickers={heldTickers}
            />
          ))}
        </div>
      </section>

      {/* 장중·오늘 브리핑 — 운영/추천 서사 아래 보조 위젯 (T5b.1/T5a.2). boundary stub: intraday events=[]. */}
      <section aria-label="오늘의 현황" className="space-y-4 border-t border-border/60 pt-6">
        <IntradayBadge
          events={visibleIntradayEvents}
          intradayMode={intradayMode}
          referenceNow={referenceNow}
        />
        <BriefingCard briefing={briefing} />
      </section>
    </div>
  );
}
