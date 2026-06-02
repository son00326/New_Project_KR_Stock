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

// PR-fix1 (E) — date-scoped briefing reader. morning-briefing cron이 briefing_log INSERT하나
//   읽는 reader가 없어 /admin 홈 BriefingCard가 briefing={undefined} 하드코딩(영구 빈칸)이었다.
//   omxy 락: "latest" 무조건 표시 금지(stale 부활 위험) → 특정 date(오늘 KST) row만, 없으면 undefined.
describe("getBriefingLogForDate", () => {
  // from('briefing_log').select(...).eq('date', date).maybeSingle() chain mock (typed, any 금지).
  interface MaybeSingleResult {
    data: Record<string, unknown> | null;
    error: { code?: string } | null;
  }
  function makeClient(result: MaybeSingleResult) {
    const maybeSingleMock = vi.fn().mockResolvedValue(result);
    const eqMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    const fromMock = vi.fn().mockReturnValue({ select: selectMock });
    return {
      client: { from: fromMock } as unknown as SupabaseClient,
      fromMock,
      selectMock,
      eqMock,
      maybeSingleMock,
    };
  }

  beforeEach(() => {
    vi.resetModules();
  });

  it("row 존재 → BriefingLog 매핑 (snake→camel, viewEvents [])", async () => {
    const { client, fromMock, eqMock } = makeClient({
      data: {
        id: "b-1",
        date: "2026-06-02",
        content_summary: "오늘 브리핑",
        generated_at: "2026-06-02T23:00:00.000Z",
        sent_channels: ["dashboard", "email"],
        generation_failed: false,
      },
      error: null,
    });

    const { getBriefingLogForDate } = await import(
      "@/lib/data/admin-briefing-log"
    );
    const result = await getBriefingLogForDate("2026-06-02", { client });

    expect(fromMock).toHaveBeenCalledWith("briefing_log");
    expect(eqMock).toHaveBeenCalledWith("date", "2026-06-02");
    expect(result).toEqual({
      id: "b-1",
      date: "2026-06-02",
      contentSummary: "오늘 브리핑",
      generatedAt: "2026-06-02T23:00:00.000Z",
      sentChannels: ["dashboard", "email"],
      viewEvents: [],
      generationFailed: false,
    });
  });

  it("해당 date row 없음(data null) → undefined (latest fallback 금지)", async () => {
    const { client } = makeClient({ data: null, error: null });
    const { getBriefingLogForDate } = await import(
      "@/lib/data/admin-briefing-log"
    );
    const result = await getBriefingLogForDate("2026-06-02", { client });
    expect(result).toBeUndefined();
  });

  it("error → throws briefing_log_read_failed:<code>", async () => {
    const { client } = makeClient({
      data: null,
      error: { code: "42501" },
    });
    const { getBriefingLogForDate } = await import(
      "@/lib/data/admin-briefing-log"
    );
    await expect(
      getBriefingLogForDate("2026-06-02", { client }),
    ).rejects.toThrow("briefing_log_read_failed:42501");
  });

  it("DI seam fallback (no client) uses session createClient", async () => {
    const maybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const eqMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    const fromMock = vi.fn().mockReturnValue({ select: selectMock });
    vi.doMock("@/lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue({ from: fromMock }),
    }));

    const { getBriefingLogForDate } = await import(
      "@/lib/data/admin-briefing-log"
    );
    await getBriefingLogForDate("2026-06-02");
    expect(fromMock).toHaveBeenCalledWith("briefing_log");
  });
});
