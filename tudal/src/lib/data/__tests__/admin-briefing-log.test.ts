// admin-briefing-log.test.ts — TDD invariants for insertBriefingLog (60차 Step 2.7b.3)
//
// Reference: docs/superpowers/plans/2026-05-28-mock-cleanup-step-2-7b-3-cron-alert-briefing-insert.md §Task 2.
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BriefingLog } from "@/types/admin";

describe("insertBriefingLog", () => {
  const record: Omit<BriefingLog, "id" | "viewEvents"> = {
    date: "2026-05-28",
    contentSummary: "오늘의 브리핑 요약",
    generatedAt: "2026-05-28T23:00:00.000Z",
    sentChannels: ["dashboard", "email"],
    generationFailed: false,
  };

  beforeEach(() => {
    vi.resetModules();
  });

  it("camelCase → snake_case + upsert(date) DO UPDATE (exact object, omxy R1 LOW-1)", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    const fromMock = vi.fn().mockReturnValue({ upsert: upsertMock });
    const client = { from: fromMock } as unknown as SupabaseClient;

    const { insertBriefingLog } = await import("@/lib/data/admin-briefing-log");
    await insertBriefingLog(record, { client });

    expect(fromMock).toHaveBeenCalledWith("briefing_log");
    expect(upsertMock).toHaveBeenCalledWith(
      {
        date: "2026-05-28",
        content_summary: "오늘의 브리핑 요약",
        generated_at: "2026-05-28T23:00:00.000Z",
        sent_channels: ["dashboard", "email"],
        generation_failed: false,
      },
      { onConflict: "date" },
    );
  });

  it("error → throws briefing_log_insert_failed:<code>", async () => {
    const upsertMock = vi.fn().mockResolvedValue({
      error: { code: "23505", message: "dup" },
    });
    const fromMock = vi.fn().mockReturnValue({ upsert: upsertMock });
    const client = { from: fromMock } as unknown as SupabaseClient;

    const { insertBriefingLog } = await import("@/lib/data/admin-briefing-log");
    await expect(insertBriefingLog(record, { client })).rejects.toThrow(
      "briefing_log_insert_failed:23505",
    );
  });

  it("DI seam fallback (no client) uses session createClient", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    const fromMock = vi.fn().mockReturnValue({ upsert: upsertMock });
    vi.doMock("@/lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue({ from: fromMock }),
    }));

    const { insertBriefingLog } = await import("@/lib/data/admin-briefing-log");
    await insertBriefingLog(record);

    expect(fromMock).toHaveBeenCalledWith("briefing_log");
    expect(upsertMock).toHaveBeenCalledTimes(1);
  });
});
