import { NextResponse, type NextRequest } from "next/server";
import { getRecentAlertEvents } from "@/lib/data/admin-alerts";
import { resolveEntryPricesKrw } from "@/lib/data/krx-eod";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isExitOutcomeEnabled } from "@/lib/intraday/flags";
import {
  candidateBasDdsBackFrom,
  computeT7PriceChangePct,
  selectAlertsNeedingOutcome,
  signalDateToBasDd,
  t7TargetBasDd,
} from "@/lib/intraday/exit-outcome";

// M15 T+7 Exit outcome 적재 cron (S7c, 2026-06-27).
// Vercel Cron daily — exit_signal alert(발송 ≥7d, outcome 미적재)에 KRX EOD 기반 t7_price_change 적재.
// shadow-first: EXIT_OUTCOME_ENABLED off(default) → 200 skip·writes 0. KRX_OPENAPI_KEY 부재 → skip.
// ref: ServicePlan-Admin §3.10 R3.10-12 · spec 2026-06-27-s7c-s7d §1.5.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BACK_DAYS = 5; // 휴장/주말 walk-back 상한
const ALERT_LIMIT = 500;

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

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // shadow-first 게이트 — flag off → 미실행·writes 0 (byte-identical 의미).
  if (!isExitOutcomeEnabled()) {
    return NextResponse.json({ ok: true, skipped: "flag_off", processed: 0 });
  }
  const authKey = process.env.KRX_OPENAPI_KEY?.trim();
  if (!authKey) {
    return NextResponse.json({ ok: true, skipped: "no_krx_key", processed: 0 });
  }

  const now = new Date();
  const serviceRoleClient = createServiceRoleClient();
  const alerts = await getRecentAlertEvents({
    client: serviceRoleClient,
    limit: ALERT_LIMIT,
  });
  const due = selectAlertsNeedingOutcome(alerts, now);
  if (due.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, due: 0 });
  }

  // basDd별 KRX 종가 Map 캐시 (동일 날짜 중복 조회 방지). null = 휴장/조회 실패(빈 결과).
  const closeCache = new Map<string, Map<string, number>>();
  async function closeFor(ticker: string, basDd: string): Promise<number | null> {
    let map = closeCache.get(basDd);
    if (!map) {
      try {
        map = await resolveEntryPricesKrw([ticker], { authKey: authKey!, basDd });
      } catch {
        map = new Map();
      }
      closeCache.set(basDd, map);
    } else if (!map.has(ticker)) {
      // 다른 ticker로 캐시된 날짜 — 이 ticker 재조회(병합 캐시 정확도).
      try {
        const extra = await resolveEntryPricesKrw([ticker], { authKey: authKey!, basDd });
        for (const [k, v] of extra) map.set(k, v);
      } catch {
        /* keep cached */
      }
    }
    return map.get(ticker) ?? null;
  }

  // walk-back: basDd 후보를 과거로 훑어 첫 종가 채택(휴장 보정).
  async function resolveClose(
    ticker: string,
    anchorBasDd: string | null,
  ): Promise<number | null> {
    for (const basDd of candidateBasDdsBackFrom(anchorBasDd, MAX_BACK_DAYS)) {
      const close = await closeFor(ticker, basDd);
      if (close !== null) return close;
    }
    return null;
  }

  let processed = 0;
  let skipped = 0;
  for (const alert of due) {
    const ticker = alert.ticker!;
    const signalClose = await resolveClose(
      ticker,
      signalDateToBasDd(alert.signalSentAt),
    );
    const t7Close = await resolveClose(
      ticker,
      t7TargetBasDd(alert.signalSentAt, now),
    );
    const t7Pct =
      signalClose !== null && t7Close !== null
        ? computeT7PriceChangePct(signalClose, t7Close)
        : null;
    if (t7Pct === null) {
      // 가격 누락 — fail-soft skip (다음 cron 재시도).
      skipped += 1;
      continue;
    }
    const { error } = await serviceRoleClient.rpc("record_alert_exit_outcome", {
      p_alert_id: alert.id,
      p_t7_price_change: t7Pct,
      p_outcome_at: now.toISOString(),
    });
    if (error) {
      skipped += 1;
      continue;
    }
    processed += 1;
  }

  return NextResponse.json({ ok: true, due: due.length, processed, skipped });
}
