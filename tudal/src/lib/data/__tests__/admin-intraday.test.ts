import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { insertIntradayAnomalies } from "@/lib/data/admin-intraday";
import type { IntradayAnomalyEvent } from "@/types/admin";

function record(
  overrides: Partial<Omit<IntradayAnomalyEvent, "id">> = {},
): Omit<IntradayAnomalyEvent, "id"> {
  return {
    ticker: "005930",
    triggerType: "price_spike",
    priceChangePct: 6.12,
    volumeRatio: null,
    lastPrice: 106_000,
    detectedAt: "2026-06-27T01:00:00Z",
    dedupKey: "005930:price_spike:202606271000",
    ...overrides,
  };
}

describe("insertIntradayAnomalies", () => {
  let upsert: ReturnType<typeof vi.fn>;
  let from: ReturnType<typeof vi.fn>;
  let client: SupabaseClient;

  beforeEach(() => {
    upsert = vi.fn().mockResolvedValue({ error: null });
    from = vi.fn().mockReturnValue({ upsert });
    client = { from } as unknown as SupabaseClient;
  });

  it("maps camelCase → snake_case and upserts with dedup_key ignoreDuplicates", async () => {
    await insertIntradayAnomalies([record()], { client });
    expect(from).toHaveBeenCalledWith("intraday_anomaly_event");
    expect(upsert).toHaveBeenCalledWith(
      [
        {
          ticker: "005930",
          trigger_type: "price_spike",
          price_change_pct: 6.12,
          volume_ratio: null,
          last_price: 106_000,
          detected_at: "2026-06-27T01:00:00Z",
          dedup_key: "005930:price_spike:202606271000",
        },
      ],
      { onConflict: "dedup_key", ignoreDuplicates: true },
    );
  });

  it("empty array short-circuits (no supabase call)", async () => {
    await insertIntradayAnomalies([], { client });
    expect(from).not.toHaveBeenCalled();
  });

  it("throws wrapped error on supabase error", async () => {
    upsert.mockResolvedValue({ error: { code: "23502" } });
    await expect(
      insertIntradayAnomalies([record()], { client }),
    ).rejects.toThrow(/intraday_anomaly_insert_failed:23502/);
  });
});
