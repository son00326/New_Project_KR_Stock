import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, FileText } from "lucide-react";
import type { ConsensusBadge, ShortListItem } from "@/types/admin";
import { CRISIS_VOL_THRESHOLD } from "@/types/admin";
import { ShortlistRowActionSlot } from "./shortlist-row-action-slot";

// PR-F (D19 Q5b) — 5종 합의 배지 한국어 라벨.
const BADGE_LABEL: Record<ConsensusBadge, string> = {
  "🟢": "강한 합의",
  "🔵": "숫자 우세",
  "🟣": "AI 우세",
  "🟡": "관망",
  "⚪": "AI 분석 대기",
};

const TIMEFRAME_LABEL: Record<"short" | "mid" | "long", string> = {
  short: "단기",
  mid: "중기",
  long: "장기",
};

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

  // PR4 Task 9 omxy R4 B43 fix: action을 <summary> OUT으로 이동.
  // HTML5는 interactive content (button)를 <summary> descendant로 disallow.
  // 구조: flex wrapper → <details> (toggle 영역) + action (sibling, 우측 별도 영역).
  // 시각: action이 row 우측 끝에 위치 (변경 전: chevron 직전 inline).
  return (
    <div className="flex items-stretch">
    <details className="group flex-1 min-w-0">
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

        {/* PR-F: 🤖 AI 점수 + 합의 배지 (ADR D-7). null/⚪ = AI 분석 대기 (W-tier1pill). */}
        <AiBadge badge={item.consensusBadge} score={item.aiScore} />

        {/* composite score (🔢 Tier 0) */}
        <span
          className="w-12 text-right font-mono text-base font-semibold tabular-nums"
          aria-label={`Tier 0 점수 ${item.compositeScore}`}
        >
          {item.compositeScore}
        </span>

        {/* delta badge */}
        <DeltaBadge status={item.deltaStatus} />

        {/* PR4 Task 9 omxy R4 B43 fix: action slot은 <details> sibling으로 이동 (HTML5 nesting violation 해소).
            기존 위치 (summary 내부)는 본 commit으로 삭제. */}

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
            {/* PR-F: AI 코멘트 (있을 때만 — Tier 1 평가 완료 종목). */}
            {item.aiCommentKr ? (
              <div className="mt-2 rounded border border-border/60 bg-background/60 px-2.5 py-1.5">
                <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  🤖 AI 코멘트
                  {item.consensusBadge ? (
                    <span className="ml-1 font-normal normal-case">
                      {item.consensusBadge} {BADGE_LABEL[item.consensusBadge]}
                    </span>
                  ) : null}
                </div>
                <p className="leading-relaxed">{item.aiCommentKr}</p>
              </div>
            ) : null}
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
              {/* PR-F: AI 점수/horizon/conviction (Tier 1 평가 완료 시). */}
              {item.aiScore != null ? (
                <>
                  <dt className="text-muted-foreground">🤖 AI 점수</dt>
                  <dd className="text-right font-mono tabular-nums">
                    {Math.round(item.aiScore)}
                    {item.winningTimeframe
                      ? ` · ${TIMEFRAME_LABEL[item.winningTimeframe]}`
                      : ""}
                  </dd>
                </>
              ) : null}
              {item.conviction != null ? (
                <>
                  <dt className="text-muted-foreground">Conviction</dt>
                  <dd className="text-right font-mono tabular-nums">
                    {Math.round(item.conviction)}
                  </dd>
                </>
              ) : null}
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
    {/* B43 fix: action as <details> sibling, NOT descendant of <summary>. */}
    {/* Issue 1 fix (58차): onClick stopPropagation은 별도 client wrapper로 분리
        (Server Component가 host element에 event handler 직접 attach 시 Next.js 16 RSC throw 회피). */}
    {action ? <ShortlistRowActionSlot>{action}</ShortlistRowActionSlot> : null}
    </div>
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

// PR-F (ADR D-7): 요약 행의 🤖 AI 점수 + 합의 배지. null/⚪ = AI 분석 대기 muted pill (W-tier1pill).
function AiBadge({
  badge,
  score,
}: {
  badge?: ConsensusBadge | null;
  score?: number | null;
}) {
  if (badge == null || badge === "⚪") {
    return (
      <span
        className="inline-flex w-16 items-center justify-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
        title="AI 분석 대기 (Tier 0 지표만)"
      >
        ⚪<span className="hidden lg:inline">AI 대기</span>
      </span>
    );
  }
  return (
    <span
      className="inline-flex w-16 items-center justify-center gap-1 text-xs"
      title={`합의 ${BADGE_LABEL[badge]}${score != null ? ` · AI ${Math.round(score)}` : ""}`}
      aria-label={`합의 배지 ${BADGE_LABEL[badge]}${score != null ? `, AI 점수 ${Math.round(score)}` : ""}`}
    >
      <span aria-hidden>{badge}</span>
      {score != null ? (
        <span className="font-mono font-semibold tabular-nums">
          🤖{Math.round(score)}
        </span>
      ) : null}
    </span>
  );
}
