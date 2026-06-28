import type { ReactNode } from "react";
import type { BucketKind, ShortListItem } from "@/types/admin";
import { ShortlistRow } from "@/components/admin/shortlist/shortlist-row";

interface BucketSectionProps {
  bucket: BucketKind;
  label: string;
  cadence: string;
  weight: string;
  items: ShortListItem[];
  // PR4 Task 1 Step 1.3.4.2 (B10 fix omxy R2): optional row action renderer — caller가
  // item별로 TriggerFullReportButton 등을 주입 가능. 기존 caller는 prop 미지정 → 영향 0.
  renderRowAction?: (item: ShortListItem) => ReactNode;
}

// 3섹션 세로 스택 (M1). T1.3에서 `ShortlistRow`로 행 교체 완료 (M4/M6 충족).
export function BucketSection({
  bucket,
  label,
  cadence,
  weight,
  items,
  renderRowAction,
}: BucketSectionProps) {
  return (
    <section aria-labelledby={`bucket-${bucket}-heading`}>
      <header className="flex flex-wrap items-end justify-between gap-2 border-b pb-3 mb-4">
        <div className="flex items-baseline gap-3">
          <h2
            id={`bucket-${bucket}-heading`}
            className="text-base font-semibold"
          >
            {label}
            <span className="ml-2 text-sm font-normal text-muted-foreground tabular-nums">
              · {items.length}종
            </span>
          </h2>
          <span className="text-xs text-muted-foreground">
            {cadence} · {weight}
          </span>
        </div>
      </header>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed bg-muted/20 py-10 text-center text-sm text-muted-foreground">
          {label} 섹션에 종목이 없습니다.
        </p>
      ) : (
        <div className="divide-y overflow-hidden rounded-2xl border bg-card shadow-toss-sm">
          {items.map((item) => (
            <ShortlistRow
              key={item.id}
              item={item}
              action={renderRowAction?.(item)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
