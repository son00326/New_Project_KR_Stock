import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, FileText } from "lucide-react";
import type { ShortListItem } from "@/types/admin";
import { CRISIS_VOL_THRESHOLD } from "@/types/admin";

interface ShortlistRowProps {
  item: ShortListItem;
  // PR4 Task 1 Step 1.3.4.1 (B10 fix omxy R2): optional action slot — BucketSection이 row 옆에
  // TriggerFullReportButton 등을 주입 가능. 기존 caller는 prop 미지정 → 영향 0.
  action?: ReactNode;
}

// T1.3 종목 카드 + T1.5 3줄 근거 팝오버 (M4·M6). Server Component.
// `<details>`로 접근성·No-JS 동작 보장. 펼침 시 summary_3line + 풀 리포트 링크.
// 괴리율 색상: 한국 증시 관례 (빨강=상승=+ / 파랑=하락=-).
export function ShortlistRow({ item, action }: ShortlistRowProps) {
  const isCrisis = item.volatilityScore < CRISIS_VOL_THRESHOLD;
  const divergenceUp = item.divergencePct >= 0;
  const divergenceColor = divergenceUp
    ? "var(--color-market-up)"
    : "var(--color-market-down)";

  const divergenceText =
    (divergenceUp ? "+" : "") + item.divergencePct.toFixed(1) + "%";

  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
        {/* rank */}
        <span className="w-6 text-center text-xs font-mono text-muted-foreground">
          {item.rank === 99 ? "—" : item.rank}
        </span>

        {/* ticker + name */}
        <div className="w-28 min-w-28 flex flex-col leading-tight">
          <span className="font-mono text-sm">{item.ticker}</span>
          <span className="truncate text-xs text-muted-foreground">
            {item.name}
          </span>
        </div>

        {/* sector */}
        <span className="hidden md:inline-flex w-20 items-center rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {item.sector}
        </span>

        {/* signal label */}
        <span className="flex-1 truncate text-sm">{item.signalLabel}</span>

        {/* 3-axis mini (추세·모멘·변동 Quality) */}
        <div
          className="hidden lg:flex w-28 flex-col gap-0.5"
          aria-label={`3축 점수: 추세 ${item.trendScore}, 모멘텀 ${item.momentumScore}, 변동성 Quality ${item.volatilityScore}`}
        >
          <AxisBar label="T" value={item.trendScore} />
          <AxisBar label="M" value={item.momentumScore} />
          <AxisBar label="V" value={item.volatilityScore} />
        </div>

        {/* Crisis badge */}
        <span className="w-14 text-center">
          {isCrisis ? (
            <span className="inline-flex items-center gap-0.5 rounded bg-[color:var(--color-market-up)]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[color:var(--color-market-up)]">
              <AlertTriangle className="h-3 w-3" aria-hidden />
              Crisis
            </span>
          ) : null}
        </span>

        {/* divergence % */}
        <span
          className="w-16 text-right font-mono text-xs tabular-nums"
          style={{ color: divergenceColor }}
          aria-label={`m60 괴리율 ${divergenceText}`}
        >
          {divergenceText}
        </span>

        {/* sparkline */}
        <Sparkline
          values={item.sparkline7d}
          up={item.momentumScore >= 70}
          className="hidden sm:inline-block"
        />

        {/* composite score */}
        <span className="w-12 text-right font-mono text-base font-semibold tabular-nums">
          {item.compositeScore}
        </span>

        {/* delta badge */}
        <DeltaBadge status={item.deltaStatus} />

        {/* PR4 B10 fix: optional action slot (TriggerFullReportButton 등). summary 클릭 시 details
            가 토글되지만 버튼 자체 onClick은 client component에서 별도 처리 (UX 허용). */}
        {action ? <div className="flex items-center">{action}</div> : null}

        {/* expand chevron (rotates via group-open) */}
        <ChevronRight
          className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90"
          aria-hidden
        />
      </summary>

      {/* Expanded: 3줄 근거 + 메타 + 풀 리포트 링크 (T1.5 M6) */}
      <div className="border-t bg-muted/20 px-4 py-3 text-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              선정 근거 (3줄)
            </div>
            <p className="whitespace-pre-line leading-relaxed">
              {item.summary3Line}
            </p>
            <div className="mt-2 text-xs text-muted-foreground">
              Delta: {item.deltaReason}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-1.5 md:items-end">
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <dt className="text-muted-foreground">편입 제안</dt>
              <dd className="text-right font-mono tabular-nums">
                {(item.suggestedWeight * 100).toFixed(1)}%
              </dd>
              <dt className="text-muted-foreground">추세·모멘·변동</dt>
              <dd className="text-right font-mono tabular-nums">
                {item.trendScore}·{item.momentumScore}·{item.volatilityScore}
              </dd>
            </dl>
            <Link
              href={`/admin/report/${item.ticker}`}
              className="inline-flex items-center gap-1 rounded-md border border-border/70 px-2.5 py-1 text-xs font-medium hover:bg-background"
            >
              <FileText className="h-3 w-3" aria-hidden />
              풀 리포트
            </Link>
          </div>
        </div>
      </div>
    </details>
  );
}

// ─── helpers ────────────────────────────────────────────────────────────

function AxisBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-3 text-[9px] font-mono text-muted-foreground">
        {label}
      </span>
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-foreground/60"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-6 text-right text-[9px] font-mono tabular-nums text-muted-foreground">
        {value}
      </span>
    </div>
  );
}

function Sparkline({
  values,
  up,
  className,
}: {
  values: number[];
  up: boolean;
  className?: string;
}) {
  if (values.length < 2) return null;
  const W = 64;
  const H = 20;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = W / (values.length - 1);
  const points = values
    .map((v, i) => {
      const x = Math.round(i * step);
      const y = Math.round(H - ((v - min) / span) * H);
      return `${x},${y}`;
    })
    .join(" ");
  const color = up ? "var(--color-market-up)" : "var(--color-market-down)";
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      role="img"
      aria-label="최근 7일 종가 추이"
      className={className}
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DeltaBadge({ status }: { status: ShortListItem["deltaStatus"] }) {
  if (status === "new") {
    return (
      <span className="inline-flex w-14 justify-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-[color:var(--color-market-up)]/15 text-[color:var(--color-market-up)]">
        NEW
      </span>
    );
  }
  if (status === "removed") {
    return (
      <span className="inline-flex w-14 justify-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-[color:var(--color-market-down)]/15 text-[color:var(--color-market-down)]">
        REMOVED
      </span>
    );
  }
  return (
    <span className="inline-flex w-14 justify-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground">
      HOLD
    </span>
  );
}
