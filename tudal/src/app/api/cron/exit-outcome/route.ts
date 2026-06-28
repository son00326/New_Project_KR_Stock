import { NextResponse, type NextRequest } from "next/server";
import { getDueExitOutcomeAlerts } from "@/lib/data/admin-alerts";
import { resolveEntryPricesKrw } from "@/lib/data/krx-eod";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isExitOutcomeEnabled } from "@/lib/intraday/flags";
import {
  candidateBasDdsBackFrom,
  computeT7PriceChangePct,
  isT7AnchorReady,
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
const DUE_LIMIT = 500; // DB-level exit_signal∧outcome-null oldest-first (starvation 방지)

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
  // DB-level: exit_signal ∧ outcome_at null ∧ oldest-first (전체 알림 newest-N 대신 due만).
  const candidates = await getDueExitOutcomeAlerts({
    client: serviceRoleClient,
    limit: DUE_LIMIT,
  });
  const due = selectAlertsNeedingOutcome(candidates, now);
  if (due.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, due: 0 });
  }

  const allTickers = Array.from(new Set(due.map((a) => a.ticker!)));

  // basDd별 전종목 종가 Map 캐시 (날짜당 1회 KOSPI+KOSDAQ fetch — per-ticker 재조회 방지).
  const closeCache = new Map<string, Map<string, number>>();
  async function closeMapFor(basDd: string): Promise<Map<string, number>> {
    const cached = closeCache.get(basDd);
    if (cached) return cached;
    let map: Map<string, number>;
    try {
      map = await resolveEntryPricesKrw(allTickers, { authKey: authKey!, basDd });
    } catch {
      map = new Map(); // 휴장/조회 실패 → 빈 결과 (walk-back이 다음 후보로 진행).
    }
    closeCache.set(basDd, map);
    return map;
  }

  // walk-back: anchor부터 과거로 훑어 첫 종가 채택(휴장 보정).
  async function resolveClose(
    ticker: string,
    anchorBasDd: string | null,
  ): Promise<number | null> {
    for (const basDd of candidateBasDdsBackFrom(anchorBasDd, MAX_BACK_DAYS)) {
      const map = await closeMapFor(basDd);
      const close = map.get(ticker);
      if (close !== undefined) return close;
    }
    return null;
  }

  let processed = 0;
  let skipped = 0;
  let notReady = 0;
  let rpcFailed = 0;
  const rpcErrorCodes = new Set<string>();
  for (const alert of due) {
    const ticker = alert.ticker!;
    const t7Anchor = t7TargetBasDd(alert.signalSentAt, now);
    // 종가 미확정(T+7 당일 cutoff 전) → skip, 다음 cron 재시도 (T+6 종가 오적재 방지).
    if (!isT7AnchorReady(t7Anchor, now)) {
      notReady += 1;
      continue;
    }
    const signalClose = await resolveClose(
      ticker,
      signalDateToBasDd(alert.signalSentAt),
    );
    const t7Close = await resolveClose(ticker, t7Anchor);
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
      rpcFailed += 1;
      rpcErrorCodes.add(error.code ?? "unknown");
      continue;
    }
    processed += 1;
  }

  const ok = rpcFailed === 0;
  return NextResponse.json({
    ok,
    due: due.length,
    processed,
    skipped,
    notReady,
    rpcFailed,
    rpcErrorCodes: [...rpcErrorCodes],
  }, { status: ok ? 200 : 500 });
}
