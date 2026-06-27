import { NextResponse, type NextRequest } from "next/server";
import { getCurrentHoldings } from "@/lib/data/admin-snapshots";
import { getActiveShortList } from "@/lib/data/admin-shortlist";
import { insertAlertEvents } from "@/lib/data/admin-alerts-insert";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendTelegram } from "@/lib/notify/telegram";
import { isExitSignalEnabled } from "@/lib/intraday/flags";
import { runExitSignalEval } from "@/lib/notify/run-exit-eval";
import type { BucketKind } from "@/types/admin";
import type { ExitPosition } from "@/lib/notify/exit-signal";

// M15 Exit 시그널 생성 cron (S7c, 2026-06-27).
// 보유 포지션(portfolio_snapshot 최신) → evaluateExitSignal(목표가/모멘텀꺾임/시간만료)
//   → durable alert_event(exit_signal) + 텔레그램 best-effort.
// shadow-first: EXIT_SIGNAL_ENABLED off(default) → 200 skip·writes 0. (vercel.json 미스케줄 = USER go-live.)
// ref: ServicePlan-Admin §3.10 R3.10-11 · spec 2026-06-27-s7c-s7d §1.3.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MS_PER_DAY = 24 * 3600 * 1000;

function isProductionLikeForAuth(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.VERCEL_ENV === "preview" ||
    process.env.NEXT_PUBLIC_APP_ENV === "production"
  );
}

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return !isProductionLikeForAuth();
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function holdingDaysSinceMonth(month: string, now: Date): number {
  const start = new Date(`${month.slice(0, 10)}T00:00:00+09:00`).getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((now.getTime() - start) / MS_PER_DAY));
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isExitSignalEnabled()) {
    return NextResponse.json({ ok: true, skipped: "flag_off", signals: 0 });
  }

  const now = new Date();
  const serviceRoleClient = createServiceRoleClient();
  const holdings = await getCurrentHoldings({ client: serviceRoleClient });
  if (holdings.length === 0) {
    return NextResponse.json({ ok: true, evaluated: 0, signals: 0 });
  }

  // bucket(시간대 horizon)은 active Short List에서 ticker 매칭(없으면 'mid' 기본).
  const shortlist = await getActiveShortList({ client: serviceRoleClient });
  const bucketByTicker = new Map<string, BucketKind>(
    shortlist.map((s) => [s.ticker, s.bucket]),
  );

  const positions: ExitPosition[] = holdings
    .filter((h) => h.ticker)
    .map((h) => ({
      ticker: h.ticker as string,
      bucket: bucketByTicker.get(h.ticker as string) ?? "mid",
      entryPrice: h.entryPrice,
      currentPrice: h.currentPrice,
      holdingDays: holdingDaysSinceMonth(h.month, now),
    }));

  const result = await runExitSignalEval(positions, {
    now,
    insertAlerts: (events) =>
      insertAlertEvents(events, { client: serviceRoleClient }),
    sendTelegram: (text) => sendTelegram({ text }),
  });

  return NextResponse.json({ ok: true, ...result });
}
