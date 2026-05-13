import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import type { ShortListItem } from "@/types/admin";

interface DeltaBannerProps {
  items: ShortListItem[]; // 33행 전체 (NEW·HOLD·REMOVED 포함)
}

// T1.4 Delta 배너 (M5). 편입·유지·제외 집계 + 펼침 패널.
// `<details>`로 구현해 Server Component 유지, No-JS에서도 동작.
export function DeltaBanner({ items }: DeltaBannerProps) {
  const news = items.filter((r) => r.deltaStatus === "new");
  const holds = items.filter((r) => r.deltaStatus === "hold");
  const removeds = items.filter((r) => r.deltaStatus === "removed");

  return (
    <details className="group rounded-lg border bg-muted/30">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-sm [&::-webkit-details-marker]:hidden">
        <span className="font-semibold">전월 대비 Delta</span>
        <DeltaCount
          label="편입"
          count={news.length}
          color="var(--color-market-up)"
          icon={<ArrowUpRight className="h-3.5 w-3.5" aria-hidden />}
        />
        <DeltaCount
          label="유지"
          count={holds.length}
          color="var(--color-market-neutral)"
          icon={<ArrowRight className="h-3.5 w-3.5" aria-hidden />}
        />
        <DeltaCount
          label="제외"
          count={removeds.length}
          color="var(--color-market-down)"
          icon={<ArrowDownRight className="h-3.5 w-3.5" aria-hidden />}
        />
        <span className="ml-auto text-xs text-muted-foreground group-open:hidden">
          ▸ 상세 펼치기
        </span>
        <span className="ml-auto hidden text-xs text-muted-foreground group-open:inline">
          ▾ 접기
        </span>
      </summary>

      <div className="grid gap-4 border-t px-4 py-3 md:grid-cols-2">
        <DeltaList
          title="편입 (NEW)"
          color="var(--color-market-up)"
          items={news}
          emptyText="이번 달 신규 편입 없음"
        />
        <DeltaList
          title="제외 (REMOVED)"
          color="var(--color-market-down)"
          items={removeds}
          emptyText="이번 달 제외 종목 없음"
        />
      </div>
    </details>
  );
}

export function canLinkDeltaReport(
  item: Pick<ShortListItem, "deltaStatus">,
): boolean {
  return item.deltaStatus !== "removed";
}

function DeltaCount({
  label,
  count,
  color,
  icon,
}: {
  label: string;
  count: number;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span style={{ color }} aria-hidden>
        {icon}
      </span>
      {label}
      <b className="font-mono tabular-nums" style={{ color }}>
        {count}
      </b>
    </span>
  );
}

function DeltaList({
  title,
  color,
  items,
  emptyText,
}: {
  title: string;
  color: string;
  items: ShortListItem[];
  emptyText: string;
}) {
  return (
    <div>
      <div
        className="mb-2 text-xs font-semibold uppercase tracking-wider"
        style={{ color }}
      >
        {title} · {items.length}
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((r) => (
            <li key={r.id} className="flex items-center gap-2 text-xs">
              <span className="w-16 font-mono">{r.ticker}</span>
              <span className="w-24 truncate text-muted-foreground">
                {r.name}
              </span>
              <span className="flex-1 truncate">{r.deltaReason}</span>
              {canLinkDeltaReport(r) ? (
                <Link
                  href={`/admin/report/${r.ticker}`}
                  className="shrink-0 text-[10px] text-muted-foreground underline-offset-2 hover:underline"
                >
                  리포트
                </Link>
              ) : (
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  리포트 대기
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
