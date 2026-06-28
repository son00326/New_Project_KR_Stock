"use client";

import { useState, useTransition } from "react";
import {
  setIntradayMode,
  setTickerAlertEnabled,
} from "@/app/(admin)/admin/settings/actions";
import { formatErrorMessage } from "@/lib/admin/format-error";
import type { ShortListItem } from "@/types/admin";

// /admin/settings Client island — 모드 토글 + 종목별 ON/OFF (S5b T5b.2)
// Server Action 호출은 useTransition으로 pending UI 분기.

interface SettingsPanelProps {
  initialIntradayMode: boolean;
  shortlist: ShortListItem[];
  initialTickerMap: Record<string, boolean>;
}

export function SettingsPanel({
  initialIntradayMode,
  shortlist,
  initialTickerMap,
}: SettingsPanelProps) {
  const [intradayMode, setMode] = useState(initialIntradayMode);
  const [tickerMap, setTickerMap] = useState(initialTickerMap);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const enabledCount = shortlist.filter(
    (s) => (tickerMap[s.ticker] ?? true) !== false,
  ).length;
  const totalCount = shortlist.length;

  function onModeChange(next: boolean) {
    setError(null);
    startTransition(async () => {
      const prev = intradayMode;
      setMode(next);
      const res = await setIntradayMode(next);
      if (!res.success) {
        setMode(prev);
        setError(res.error);
      }
    });
  }

  function onTickerToggle(ticker: string, next: boolean) {
    setError(null);
    startTransition(async () => {
      const prev = tickerMap[ticker] ?? true;
      setTickerMap((m) => ({ ...m, [ticker]: next }));
      const res = await setTickerAlertEnabled(ticker, next);
      if (!res.success) {
        setTickerMap((m) => ({ ...m, [ticker]: prev }));
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-market-down/40 bg-market-down/10 px-3 py-2 text-sm text-market-down"
        >
          {formatErrorMessage(error)}
        </p>
      )}

      <section
        aria-label="상시 모니터링 모드"
        className="rounded-2xl border border-border/60 bg-card p-5 shadow-toss-sm"
      >
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">상시 모니터링 모드</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              M13 장중 이상 감지 (±5% / 거래량 3배) · 홈 배지 + 텔레그램 즉시 알림
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={intradayMode}
              onChange={(e) => onModeChange(e.target.checked)}
              disabled={isPending}
              aria-label="상시 모니터링 모드 ON/OFF"
            />
            <span>{intradayMode ? "ON" : "OFF"}</span>
          </label>
        </header>
        <p className="mt-3 text-xs text-muted-foreground">
          ※ Exit 시그널(§3.5 R3.5-5)은 이 모드·토글과 무관하게 항상 발송됩니다.
        </p>
      </section>

      <section
        aria-label="종목별 알림 토글"
        className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-toss-sm"
      >
        <header className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
          <h2 className="text-sm font-semibold">
            종목별 알림 토글 ({enabledCount}/{totalCount})
          </h2>
          <span className="text-xs text-muted-foreground">
            OFF → 해당 종목 장중 감지·뉴스 Warning 알림 차단 (Exit 제외)
          </span>
        </header>
        <ul className="divide-y">
          {shortlist.map((item) => {
            const enabled = tickerMap[item.ticker] ?? true;
            return (
              <li
                key={item.ticker}
                className="flex items-center gap-3 px-4 py-2.5"
              >
                <span className="w-16 font-mono text-xs tabular-nums text-muted-foreground">
                  {item.ticker}
                </span>
                <span className="flex-1 text-sm">{item.name}</span>
                <span className="hidden w-24 text-xs text-muted-foreground md:inline">
                  {item.sector}
                </span>
                <span className="w-14 text-xs text-muted-foreground">
                  {item.bucket === "short"
                    ? "단기"
                    : item.bucket === "mid"
                      ? "중기"
                      : "장기"}
                </span>
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={enabled}
                    onChange={(e) =>
                      onTickerToggle(item.ticker, e.target.checked)
                    }
                    disabled={isPending}
                    aria-label={`${item.ticker} 알림 ${enabled ? "ON" : "OFF"}`}
                  />
                  <span className={enabled ? "" : "text-muted-foreground"}>
                    {enabled ? "ON" : "OFF"}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
