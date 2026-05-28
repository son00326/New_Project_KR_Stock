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
