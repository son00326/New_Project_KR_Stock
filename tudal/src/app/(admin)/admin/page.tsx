import { BucketSection } from "@/components/admin/shortlist/bucket-section";
import {
  MOCK_ADMIN_SHORTLIST,
  MOCK_ADMIN_SHORTLIST_DELTA,
} from "@/lib/data/mock-admin-shortlist";
import type { BucketKind } from "@/types/admin";

// M1 Short List 30 홈. 3섹션 세로 스택(단·중·장) + Delta 집계 요약.
// T1.3(종목 카드)·T1.4(Delta 배너)·T1.5(3줄 팝오버)·T1.6(미달 경고)에서 확장 예정.
// v6 로직 관점에서 fixture는 mock-admin-shortlist.ts. 실데이터 전환은 S5 M10.

const BUCKET_ORDER: BucketKind[] = ["short", "mid", "long"];

const BUCKET_META: Record<
  BucketKind,
  { label: string; cadence: string; weight: string }
> = {
  short: {
    label: "단기",
    cadence: "21일 리밸런스",
    weight: "축 비중 30%",
  },
  mid: {
    label: "중기",
    cadence: "42일 리밸런스",
    weight: "축 비중 40%",
  },
  long: {
    label: "장기",
    cadence: "63일 리밸런스",
    weight: "축 비중 30%",
  },
};

function formatMonthLabel(month: string): string {
  if (!month) return "";
  const [y, m] = month.split("-");
  return `${y}년 ${Number(m)}월`;
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
  const hasShortage = activeCount < 30;

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

      {/* Delta 집계 (T1.4에서 펼침 패널로 확장) */}
      <div className="rounded-lg border bg-muted/30 px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <span className="font-medium">Delta</span>
        <DeltaCount
          label="편입"
          count={MOCK_ADMIN_SHORTLIST_DELTA.newCount}
          color="var(--color-market-up)"
        />
        <DeltaCount
          label="유지"
          count={MOCK_ADMIN_SHORTLIST_DELTA.holdCount}
          color="var(--color-market-neutral)"
        />
        <DeltaCount
          label="제외"
          count={MOCK_ADMIN_SHORTLIST_DELTA.removedCount}
          color="var(--color-market-down)"
        />
        <span className="ml-auto text-xs text-muted-foreground">
          T1.4 펼침 패널 예정
        </span>
      </div>

      {/* 30종 미달 경고 (T1.6에서 원인 분리 정식 배너) */}
      {hasShortage && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
          <b className="text-destructive">30종목 미달 경고</b>
          <span className="text-muted-foreground ml-2">
            현재 {activeCount}종. 원인 분리(스크리닝 미달 / 스케줄러 실패)는
            T1.6에서 구현.
          </span>
        </div>
      )}

      {/* 3섹션 세로 스택 (M1) */}
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

function DeltaCount({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      {label}{" "}
      <b className="font-mono tabular-nums">{count}</b>
    </span>
  );
}
