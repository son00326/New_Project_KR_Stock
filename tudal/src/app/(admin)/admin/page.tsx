import { BucketSection } from "@/components/admin/shortlist/bucket-section";
import { DeltaBanner } from "@/components/admin/shortlist/delta-banner";
import { MissingCountBanner } from "@/components/admin/shortlist/missing-count-banner";
import { MOCK_ADMIN_SHORTLIST } from "@/lib/data/mock-admin-shortlist";
import type { BucketKind, ShortageReason } from "@/types/admin";
import { SHORTLIST_TARGET_COUNT } from "@/types/admin";

// M1 Short List 30 홈. 3섹션 세로 스택(단·중·장) + Delta 배너 + 종목 카드.
// T1.3 ShortlistRow (M4·M6) · T1.4 DeltaBanner (M5) · T1.6 MissingCountBanner 완료.
// fixture는 mock-admin-shortlist.ts. 실데이터 전환은 S5 M10.

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

// T1.6 — 미달 원인을 결정. mock에서는 항상 충족 (30 = active).
// 실배치 연결 후(S5 M10) shortlist fetch 결과의 원인 플래그로 교체.
function resolveShortageReason(activeCount: number): ShortageReason {
  if (activeCount >= SHORTLIST_TARGET_COUNT) return "none";
  // MVP: 스케줄러 실패 판정은 M10 연결 후, 우선 스크리닝 미달로 간주.
  return "screening";
}

export default function AdminHomePage() {
  const month = MOCK_ADMIN_SHORTLIST[0]?.month ?? "";
  const monthLabel = formatMonthLabel(month);

  const byBucket = BUCKET_ORDER.map((bucket) => ({
    bucket,
    items: MOCK_ADMIN_SHORTLIST.filter(
      (r) => r.bucket === bucket && r.deltaStatus !== "removed",
    ).sort((a, b) => a.rank - b.rank),
  }));

  const activeCount = byBucket.reduce((sum, b) => sum + b.items.length, 0);
  const shortageReason = resolveShortageReason(activeCount);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">홈 — Short List 30</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {monthLabel} 월간 선정 · 단·중·장 각 10종 · v6 선정엔진 기준
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          ※ mock fixture · 실데이터 전환 S5 M10
        </div>
      </header>

      {/* M5 Delta 배너 — 편입/유지/제외 집계 + 펼침 패널 (T1.4) */}
      <DeltaBanner items={MOCK_ADMIN_SHORTLIST} />

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
