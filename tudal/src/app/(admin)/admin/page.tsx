import { BriefingCard } from "@/components/admin/briefing/briefing-card";
import { IntradayBadge } from "@/components/admin/intraday/intraday-badge";
import { BucketSection } from "@/components/admin/shortlist/bucket-section";
import { DeltaBanner } from "@/components/admin/shortlist/delta-banner";
import { MissingCountBanner } from "@/components/admin/shortlist/missing-count-banner";
import { getActiveShortList } from "@/lib/data/admin-shortlist";
import { getBriefingLogForDate } from "@/lib/data/admin-briefing-log";
import { resolveShortageReason } from "@/lib/admin/shortage-reason";
import type { BucketKind, IntradayAnomalyEvent } from "@/types/admin";

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
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">홈 — Short List 30</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {monthLabel} · 단기 주간 · 중·장기 월간 선정 · 단·중·장 각 10종
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          ※ short_list_30 SELECT · seed는 T7e.8 Tier 0 인디케이터 후 채워짐
        </div>
      </header>

      {/* M13 장중 이상 감지 배지 — 최상단 (T5b.1). boundary stub: events=[], intradayMode=false, referenceNow=실시간. */}
      <IntradayBadge
        events={visibleIntradayEvents}
        intradayMode={intradayMode}
        referenceNow={referenceNow}
      />

      {/* M11 모닝 브리핑 카드 (T5a.2). PR-fix1 (E): 오늘(KST) briefing_log 실 SELECT 결과. 없으면 카드 empty state. */}
      <BriefingCard briefing={briefing} />

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
          />
        ))}
      </div>
    </div>
  );
}
