import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { IntradayAnomalyEvent } from "@/types/admin";

// intraday_anomaly_event INSERT helper (S7c, 2026-06-27).
// SoT migration: 0007_s5b_notifications.sql §intraday_anomaly_event (dedup_key UNIQUE).
// dedup_key UNIQUE(ticker·trigger·1분 bucket) → 동일 1분 중복은 ignoreDuplicates로 흡수.
// service-role client 주입 시 RLS using(is_admin()) 우회 (cron/worker context).

export async function insertIntradayAnomalies(
  events: Array<Omit<IntradayAnomalyEvent, "id">>,
  options: { client?: SupabaseClient } = {},
): Promise<void> {
  if (events.length === 0) return;
  const supabase = options.client ?? (await createClient());
  const rows = events.map((e) => ({
    ticker: e.ticker,
    trigger_type: e.triggerType,
    price_change_pct: e.priceChangePct,
    volume_ratio: e.volumeRatio,
    last_price: e.lastPrice,
    detected_at: e.detectedAt,
    dedup_key: e.dedupKey,
  }));
  // dedup_key UNIQUE 충돌(같은 1분 중복)은 무시 — append-only, ignoreDuplicates.
  const { error } = await supabase
    .from("intraday_anomaly_event")
    .upsert(rows, { onConflict: "dedup_key", ignoreDuplicates: true });
  if (error) {
    throw new Error(`intraday_anomaly_insert_failed:${error.code ?? "unknown"}`);
  }
}
