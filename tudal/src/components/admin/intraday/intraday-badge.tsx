import type {
  IntradayAnomalyEvent,
  IntradayTriggerType,
} from "@/types/admin";
import { INTRADAY_BADGE_RECENT_WINDOW_MS } from "@/types/admin";

// M13 장중 이상 감지 배지 — /admin 홈 상단 (S5b T5b.1).
// 상시 모니터링 모드 ON + 최근 15분 이내 이벤트만 노출.
// 토글 OFF 종목은 호출부에서 필터링 후 전달.

interface IntradayBadgeProps {
  events: IntradayAnomalyEvent[];
  intradayMode: boolean;
  /**
   * 기준 시각 — Server Component purity 때문에 호출부에서 명시적으로 주입.
   * 실배포 시 호출부가 `new Date().toISOString()`를 생성해 전달 (또는 dynamic render).
   */
  referenceNow: string | Date;
}

const TRIGGER_LABEL: Record<IntradayTriggerType, string> = {
  price_spike: "급등",
  price_drop: "급락",
  volume_spike: "거래량 폭증",
};

const TRIGGER_COLOR: Record<IntradayTriggerType, string> = {
  price_spike:
    "bg-market-up/15 text-market-up border-market-up/40",
  price_drop:
    "bg-market-down/15 text-market-down border-market-down/40",
  volume_spike:
    "bg-warning/15 text-warning border-warning/40",
};

function formatDelta(ev: IntradayAnomalyEvent): string {
  if (ev.priceChangePct !== null) {
    const sign = ev.priceChangePct > 0 ? "+" : "";
    return `${sign}${ev.priceChangePct.toFixed(2)}%`;
  }
  if (ev.volumeRatio !== null) {
    return `${ev.volumeRatio.toFixed(2)}×`;
  }
  return "";
}

function recentEvents(
  events: IntradayAnomalyEvent[],
  referenceNow: number,
): IntradayAnomalyEvent[] {
  return events
    .filter((ev) => {
      const ts = new Date(ev.detectedAt).getTime();
      return (
        Number.isFinite(ts) &&
        referenceNow - ts <= INTRADAY_BADGE_RECENT_WINDOW_MS &&
        ts <= referenceNow
      );
    })
    .sort(
      (a, b) =>
        new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime(),
    );
}

export function IntradayBadge({
  events,
  intradayMode,
  referenceNow,
}: IntradayBadgeProps) {
  if (!intradayMode) return null;
  const now = new Date(referenceNow).getTime();
  const recent = recentEvents(events, now);
  if (recent.length === 0) return null;

  return (
    <aside
      aria-label="장중 이상 감지"
      className="rounded-2xl border border-market-down/40 bg-market-down/5 p-4 shadow-toss-sm"
    >
      <header className="flex items-baseline gap-2">
        <span className="text-sm font-semibold text-market-down">
          🚨 장중 이상 감지 ({recent.length}건)
        </span>
        <span className="text-xs text-muted-foreground">
          최근 15분 · 상시 모니터링 모드 ON
        </span>
      </header>
      <ul className="mt-2 space-y-1.5">
        {recent.map((ev) => (
          <li
            key={ev.id}
            className="flex flex-wrap items-baseline gap-2 text-sm"
          >
            <span
              className={`rounded-full border px-2 py-0.5 text-xs ${TRIGGER_COLOR[ev.triggerType]}`}
            >
              {TRIGGER_LABEL[ev.triggerType]}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {ev.ticker}
            </span>
            <strong className="tabular-nums">{formatDelta(ev)}</strong>
            {ev.lastPrice !== null && (
              <span className="text-xs text-muted-foreground tabular-nums">
                last {ev.lastPrice.toLocaleString("ko-KR")}
              </span>
            )}
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              {new Date(ev.detectedAt).toLocaleTimeString("ko-KR", {
                hour12: false,
              })}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
