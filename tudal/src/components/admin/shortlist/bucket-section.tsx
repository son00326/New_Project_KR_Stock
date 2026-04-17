import type { BucketKind, ShortListItem } from "@/types/admin";

interface BucketSectionProps {
  bucket: BucketKind;
  label: string;
  cadence: string;
  weight: string;
  items: ShortListItem[];
}

// 3섹션 세로 스택 (M1). 종목 카드 상세(M4 Composite·3축·Crisis·스파크라인)는
// T1.3에서 `shortlist-row.tsx`로 분리해 교체 예정. 현재는 placeholder 행.
export function BucketSection({
  bucket,
  label,
  cadence,
  weight,
  items,
}: BucketSectionProps) {
  return (
    <section aria-labelledby={`bucket-${bucket}-heading`}>
      <header className="flex flex-wrap items-end justify-between gap-2 border-b pb-2 mb-3">
        <div className="flex items-baseline gap-3">
          <h2
            id={`bucket-${bucket}-heading`}
            className="text-lg font-semibold"
          >
            {label}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              · {items.length}종
            </span>
          </h2>
          <span className="text-xs text-muted-foreground">
            {cadence} · {weight}
          </span>
        </div>
      </header>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {label} 섹션에 종목이 없습니다.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 transition-colors"
            >
              <span className="w-6 text-center text-xs font-mono text-muted-foreground">
                {item.rank}
              </span>
              <span className="w-16 font-mono text-sm">{item.ticker}</span>
              <span className="flex-1 truncate text-sm">
                {item.signalLabel}
              </span>
              <span className="hidden sm:inline-block w-28 text-xs text-muted-foreground truncate">
                {item.deltaReason}
              </span>
              <span className="w-14 text-right">
                <span className="font-mono text-sm font-semibold">
                  {item.compositeScore}
                </span>
              </span>
              <DeltaBadge status={item.deltaStatus} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// T1.5(3줄 근거 팝오버) 직전까지 쓰는 간이 배지. Delta 정책: 빨강=상승=NEW.
function DeltaBadge({ status }: { status: ShortListItem["deltaStatus"] }) {
  if (status === "new") {
    return (
      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-[color:var(--color-market-up)]/15 text-[color:var(--color-market-up)]">
        NEW
      </span>
    );
  }
  if (status === "removed") {
    return (
      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-[color:var(--color-market-down)]/15 text-[color:var(--color-market-down)]">
        REMOVED
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground">
      HOLD
    </span>
  );
}
