// admin-heartbeat-log.test.ts — TDD invariants for insertHeartbeatLog (59차 Step 2.7b.2)
//
// Reference: docs/superpowers/plans/2026-05-28-mock-cleanup-step-2-7b-2-cron-insert.md §Task 1.
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { HeartbeatLog } from "@/types/admin";

describe("insertHeartbeatLog", () => {
  const validRecord: Omit<HeartbeatLog, "id"> = {
    date: "2026-05-27",
    status: "ok",
    generatedAt: "2026-05-28T15:00:00.000Z",
    pipelineSummary: [
      { pipeline: "dart", successRate: 1, severity: "info" },
    ],
    criticalAlertCount: 0,
    warningAlertCount: 0,
    sentChannels: ["dashboard", "telegram"],
    sendFailed: false,
    message: "✅ [주픽] 2026-05-27 — 오늘 이상 없음",
  };

  beforeEach(() => {
    vi.resetModules();
  });

  it("camelCase → snake_case mapping + upsert(date) ignoreDuplicates default false (DO UPDATE)", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    const fromMock = vi.fn().mockReturnValue({ upsert: upsertMock });
    const client = { from: fromMock } as unknown as SupabaseClient;

    const { insertHeartbeatLog } = await import("@/lib/data/admin-heartbeat-log");
    await insertHeartbeatLog(validRecord, { client });

    expect(fromMock).toHaveBeenCalledWith("heartbeat_log");
    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        date: "2026-05-27",
        status: "ok",
        generated_at: "2026-05-28T15:00:00.000Z",
        pipeline_summary: validRecord.pipelineSummary,
        critical_alert_count: 0,
        warning_alert_count: 0,
        sent_channels: ["dashboard", "telegram"],
        send_failed: false,
        message: validRecord.message,
      }),
      { onConflict: "date" },
    );
  });

  it("DI seam fallback (no client) uses session createClient (omxy R1 MED-1 fix)", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    const fromMock = vi.fn().mockReturnValue({ upsert: upsertMock });
    vi.doMock("@/lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue({ from: fromMock }),
    }));

    const { insertHeartbeatLog } = await import("@/lib/data/admin-heartbeat-log");
    await insertHeartbeatLog(validRecord);

    expect(fromMock).toHaveBeenCalledWith("heartbeat_log");
    expect(upsertMock).toHaveBeenCalledTimes(1);
  });

  it("error → throws heartbeat_log_insert_failed:<code>", async () => {
    const upsertMock = vi.fn().mockResolvedValue({
      error: { code: "23505", message: "duplicate" },
    });
    const fromMock = vi.fn().mockReturnValue({ upsert: upsertMock });
    const client = { from: fromMock } as unknown as SupabaseClient;

    const { insertHeartbeatLog } = await import("@/lib/data/admin-heartbeat-log");
    await expect(insertHeartbeatLog(validRecord, { client })).rejects.toThrow(
      "heartbeat_log_insert_failed:23505",
    );
  });

  it("status enum guard rejects unknown status", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    const fromMock = vi.fn().mockReturnValue({ upsert: upsertMock });
    const client = { from: fromMock } as unknown as SupabaseClient;

    const { insertHeartbeatLog } = await import("@/lib/data/admin-heartbeat-log");
    await expect(
      insertHeartbeatLog(
        { ...validRecord, status: "weird" as never },
        { client },
      ),
    ).rejects.toThrow("heartbeat_log_invalid_status:weird");
    expect(upsertMock).not.toHaveBeenCalled();
  });
});

describe("getLatestHeartbeatLog", () => {
  function makeClient(result: { data: unknown; error: unknown }) {
    const maybeSingle = vi.fn().mockResolvedValue(result);
    const chain = {
      select: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      maybeSingle,
    };
    const from = vi.fn(() => chain);
    return { client: { from } as unknown as SupabaseClient, from, chain };
  }

  const dbRow = {
    id: "hb-1",
    date: "2026-06-27",
    status: "red_alert",
    generated_at: "2026-06-27T15:00:00.000Z",
    pipeline_summary: [{ pipeline: "ai", successRate: 0.9, severity: "warning" }],
    critical_alert_count: "2",
    warning_alert_count: 1,
    sent_channels: ["dashboard"],
    send_failed: true,
    message: "적색 경보",
  };

  beforeEach(() => {
    vi.resetModules();
  });

  it("returns transformed latest row (string counts coerced, ordered by date desc)", async () => {
    const { client, from, chain } = makeClient({ data: dbRow, error: null });
    const { getLatestHeartbeatLog } = await import(
      "@/lib/data/admin-heartbeat-log"
    );
    const out = await getLatestHeartbeatLog({ client });
    expect(from).toHaveBeenCalledWith("heartbeat_log");
    expect(chain.order).toHaveBeenCalledWith("date", { ascending: false });
    expect(out).not.toBeNull();
    expect(out?.status).toBe("red_alert");
    expect(out?.criticalAlertCount).toBe(2);
    expect(out?.warningAlertCount).toBe(1);
    expect(out?.sendFailed).toBe(true);
  });

  it("unknown status → red_alert (fail-closed display)", async () => {
    const { client } = makeClient({
      data: { ...dbRow, status: "weird" },
      error: null,
    });
    const { getLatestHeartbeatLog } = await import(
      "@/lib/data/admin-heartbeat-log"
    );
    const out = await getLatestHeartbeatLog({ client });
    expect(out?.status).toBe("red_alert");
  });

  it("non-array pipeline_summary → [] (defensive)", async () => {
    const { client } = makeClient({
      data: { ...dbRow, pipeline_summary: null },
      error: null,
    });
    const { getLatestHeartbeatLog } = await import(
      "@/lib/data/admin-heartbeat-log"
    );
    const out = await getLatestHeartbeatLog({ client });
    expect(out?.pipelineSummary).toEqual([]);
  });

  it("returns null when no row", async () => {
    const { client } = makeClient({ data: null, error: null });
    const { getLatestHeartbeatLog } = await import(
      "@/lib/data/admin-heartbeat-log"
    );
    expect(await getLatestHeartbeatLog({ client })).toBeNull();
  });

  it("fail-soft to null on supabase error", async () => {
    const { client } = makeClient({ data: null, error: { code: "PGRST301" } });
    const { getLatestHeartbeatLog } = await import(
      "@/lib/data/admin-heartbeat-log"
    );
    expect(await getLatestHeartbeatLog({ client })).toBeNull();
  });

  it("fail-soft to null when session client creation throws", async () => {
    vi.doMock("@/lib/supabase/server", () => ({
      createClient: vi.fn().mockRejectedValue(new Error("no cookies")),
    }));
    const { getLatestHeartbeatLog } = await import(
      "@/lib/data/admin-heartbeat-log"
    );
    expect(await getLatestHeartbeatLog()).toBeNull();
  });
});
