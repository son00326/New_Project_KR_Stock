// admin-news-insert.test.ts — TDD invariants for insertNewsEvents (59차 Step 2.7b.2)
//
// Reference: docs/superpowers/plans/2026-05-28-mock-cleanup-step-2-7b-2-cron-insert.md §Task 2.
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NewsEvent } from "@/types/admin";

describe("insertNewsEvents", () => {
  const events: NewsEvent[] = [
    {
      id: "sweep-1",
      ticker: "005930",
      severity: "critical",
      title: "삼성전자 매출 급락",
      source: "Naver",
      url: "https://news.naver.com/a",
      publishedAt: "2026-05-28T00:00:00.000Z",
      fetchedAt: "2026-05-28T00:01:00.000Z",
      classificationReason: "매출 급락 → critical",
    },
    {
      id: "sweep-2",
      ticker: null,
      severity: "info",
      title: "시장 보합",
      source: "Naver",
      url: "https://news.naver.com/b",
      publishedAt: "2026-05-28T00:00:00.000Z",
      fetchedAt: "2026-05-28T00:01:00.000Z",
      classificationReason: null,
    },
  ];

  beforeEach(() => {
    vi.resetModules();
  });

  it("batch upsert(url) ignoreDuplicates=true + camelCase → snake_case", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    const fromMock = vi.fn().mockReturnValue({ upsert: upsertMock });
    const client = { from: fromMock } as unknown as SupabaseClient;

    const { insertNewsEvents } = await import("@/lib/data/admin-news");
    await insertNewsEvents(events, { client });

    expect(fromMock).toHaveBeenCalledWith("news_event");
    expect(upsertMock).toHaveBeenCalledTimes(1);
    const [rows, opts] = upsertMock.mock.calls[0];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        ticker: "005930",
        severity: "critical",
        title: "삼성전자 매출 급락",
        source: "Naver",
        url: "https://news.naver.com/a",
        published_at: "2026-05-28T00:00:00.000Z",
        fetched_at: "2026-05-28T00:01:00.000Z",
        classification_reason: "매출 급락 → critical",
      }),
    );
    expect(rows[1]).toEqual(
      expect.objectContaining({ ticker: null, classification_reason: null }),
    );
    expect(opts).toEqual({ onConflict: "url", ignoreDuplicates: true });
  });

  it("empty array → no DB call, no throw", async () => {
    const upsertMock = vi.fn();
    const fromMock = vi.fn().mockReturnValue({ upsert: upsertMock });
    const client = { from: fromMock } as unknown as SupabaseClient;

    const { insertNewsEvents } = await import("@/lib/data/admin-news");
    await insertNewsEvents([], { client });

    expect(fromMock).not.toHaveBeenCalled();
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("severity enum guard rejects invalid row", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    const fromMock = vi.fn().mockReturnValue({ upsert: upsertMock });
    const client = { from: fromMock } as unknown as SupabaseClient;

    const { insertNewsEvents } = await import("@/lib/data/admin-news");
    await expect(
      insertNewsEvents(
        [{ ...events[0], severity: "weird" as never }],
        { client },
      ),
    ).rejects.toThrow("news_event_invalid_severity:weird");
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("error → throws news_event_insert_failed:<code>", async () => {
    const upsertMock = vi.fn().mockResolvedValue({
      error: { code: "23502", message: "null violates" },
    });
    const fromMock = vi.fn().mockReturnValue({ upsert: upsertMock });
    const client = { from: fromMock } as unknown as SupabaseClient;

    const { insertNewsEvents } = await import("@/lib/data/admin-news");
    await expect(insertNewsEvents(events, { client })).rejects.toThrow(
      "news_event_insert_failed:23502",
    );
  });

  it("DI seam fallback (no client) uses session createClient", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    const fromMock = vi.fn().mockReturnValue({ upsert: upsertMock });
    vi.doMock("@/lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue({ from: fromMock }),
    }));

    const { insertNewsEvents } = await import("@/lib/data/admin-news");
    await insertNewsEvents(events);

    expect(fromMock).toHaveBeenCalledWith("news_event");
    expect(upsertMock).toHaveBeenCalledTimes(1);
  });
});
