// admin-alerts-insert-batch.test.ts — TDD invariants for insertAlertEvents (60차 Step 2.7b.3)
//
// Reference: docs/superpowers/plans/2026-05-28-mock-cleanup-step-2-7b-3-cron-alert-briefing-insert.md §Task 1.
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AlertEvent } from "@/types/admin";

describe("insertAlertEvents", () => {
  const events: Array<Omit<AlertEvent, "id" | "isRead">> = [
    {
      alertType: "news_critical",
      ticker: "005930",
      severity: "critical",
      triggerReason: "삼성전자 매출 급락 — critical (Naver)",
      signalSentAt: "2026-05-28T00:00:00.000Z",
      outcomeAt: null,
      t7PriceChange: null,
      decisionRecorded: null,
      decisionMemo: null,
    },
    {
      alertType: "heartbeat_missing",
      ticker: null,
      severity: "critical",
      triggerReason: "일간 하트비트 발송 실패",
      signalSentAt: "2026-05-28T15:00:00.000Z",
      outcomeAt: null,
      t7PriceChange: null,
      decisionRecorded: null,
      decisionMemo: null,
    },
  ];

  beforeEach(() => {
    vi.resetModules();
  });

  it("batch insert + camelCase → snake_case (9 columns)", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const fromMock = vi.fn().mockReturnValue({ insert: insertMock });
    const client = { from: fromMock } as unknown as SupabaseClient;

    const { insertAlertEvents } = await import("@/lib/data/admin-alerts-insert");
    await insertAlertEvents(events, { client });

    expect(fromMock).toHaveBeenCalledWith("alert_event");
    expect(insertMock).toHaveBeenCalledTimes(1);
    const [rows] = insertMock.mock.calls[0];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      alert_type: "news_critical",
      ticker: "005930",
      severity: "critical",
      trigger_reason: "삼성전자 매출 급락 — critical (Naver)",
      signal_sent_at: "2026-05-28T00:00:00.000Z",
      outcome_at: null,
      t7_price_change: null,
      decision_recorded: null,
      decision_memo: null,
    });
    expect(rows[1].alert_type).toBe("heartbeat_missing");
  });

  it("empty array → no DB call, no throw", async () => {
    const insertMock = vi.fn();
    const fromMock = vi.fn().mockReturnValue({ insert: insertMock });
    const client = { from: fromMock } as unknown as SupabaseClient;

    const { insertAlertEvents } = await import("@/lib/data/admin-alerts-insert");
    await insertAlertEvents([], { client });

    expect(fromMock).not.toHaveBeenCalled();
  });

  it("alert_type enum guard rejects invalid type", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const fromMock = vi.fn().mockReturnValue({ insert: insertMock });
    const client = { from: fromMock } as unknown as SupabaseClient;

    const { insertAlertEvents } = await import("@/lib/data/admin-alerts-insert");
    await expect(
      insertAlertEvents(
        [{ ...events[0], alertType: "weird" as never }],
        { client },
      ),
    ).rejects.toThrow("alert_event_invalid_type:weird");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("severity enum guard rejects invalid severity (omxy R1 MED-5)", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const fromMock = vi.fn().mockReturnValue({ insert: insertMock });
    const client = { from: fromMock } as unknown as SupabaseClient;

    const { insertAlertEvents } = await import("@/lib/data/admin-alerts-insert");
    await expect(
      insertAlertEvents(
        [{ ...events[0], severity: "weird" as never }],
        { client },
      ),
    ).rejects.toThrow("alert_event_invalid_severity:weird");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("ALERT_TYPE_SET = exact 12-type invariant (omxy R1 MED-4)", async () => {
    const { ALERT_TYPE_SET } = await import("@/lib/data/admin-alerts-insert");
    expect([...ALERT_TYPE_SET].sort()).toEqual(
      [
        "briefing",
        "briefing_failed",
        "cost_hardcap",
        "cost_warning",
        "exit_signal",
        "gating_auto_relief",
        "heartbeat_missing",
        "intraday_anomaly",
        "news_critical",
        "news_warning",
        "price_anomaly",
        "scheduler_fail",
      ].sort(),
    );
  });

  it("error → throws alert_event_insert_failed:<code>", async () => {
    const insertMock = vi.fn().mockResolvedValue({
      error: { code: "23514", message: "check violation" },
    });
    const fromMock = vi.fn().mockReturnValue({ insert: insertMock });
    const client = { from: fromMock } as unknown as SupabaseClient;

    const { insertAlertEvents } = await import("@/lib/data/admin-alerts-insert");
    await expect(insertAlertEvents(events, { client })).rejects.toThrow(
      "alert_event_insert_failed:23514",
    );
  });

  it("DI seam fallback (no client) uses session createClient", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const fromMock = vi.fn().mockReturnValue({ insert: insertMock });
    vi.doMock("@/lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue({ from: fromMock }),
    }));

    const { insertAlertEvents } = await import("@/lib/data/admin-alerts-insert");
    await insertAlertEvents(events);

    expect(fromMock).toHaveBeenCalledWith("alert_event");
  });
});
