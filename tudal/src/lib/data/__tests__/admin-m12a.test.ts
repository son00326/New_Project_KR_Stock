import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { insertM12aAssessments } from "@/lib/data/admin-m12a";
import type { M12aTickerLedgerRow } from "@/lib/news/m12a/types";

function row(over: Partial<M12aTickerLedgerRow> = {}): M12aTickerLedgerRow {
  return {
    newsEventId: "evt-1",
    runId: "run-1",
    month: "2026-06-01",
    ticker: "005930",
    surface: "list",
    scope: "company",
    severity: "critical",
    confidence: "high",
    materiality: "high",
    directness: "direct",
    thesisBreak: true,
    thesisBreakReason: "실적 쇼크",
    recommendedAction: "auto_remove",
    actionTaken: "shadowed",
    heldByBrake: false,
    priceBasisDate: null,
    priceSource: null,
    executionAssumption: null,
    alertEventId: null,
    ...over,
  };
}

describe("insertM12aAssessments", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("batch insert + camelCase → snake_case 매핑", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const fromMock = vi.fn().mockReturnValue({ insert: insertMock });
    const client = { from: fromMock } as unknown as SupabaseClient;

    await insertM12aAssessments(
      [
        row(),
        row({
          ticker: "000660",
          actionTaken: "removed",
          priceBasisDate: "20260625",
          priceSource: "KRX_EOD",
          executionAssumption: "virtual_eod",
          alertEventId: "alert-9",
        }),
      ],
      { client },
    );

    expect(fromMock).toHaveBeenCalledWith("m12a_ticker_assessment");
    const [rows] = insertMock.mock.calls[0];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        news_event_id: "evt-1",
        run_id: "run-1",
        ticker: "005930",
        recommended_action: "auto_remove",
        action_taken: "shadowed",
        thesis_break: true,
        held_by_brake: false,
        price_basis_date: null,
      }),
    );
    expect(rows[1]).toEqual(
      expect.objectContaining({
        action_taken: "removed",
        price_basis_date: "20260625",
        price_source: "KRX_EOD",
        execution_assumption: "virtual_eod",
        alert_event_id: "alert-9",
      }),
    );
  });

  it("empty → no DB call, no throw", async () => {
    const insertMock = vi.fn();
    const fromMock = vi.fn().mockReturnValue({ insert: insertMock });
    const client = { from: fromMock } as unknown as SupabaseClient;
    await insertM12aAssessments([], { client });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("ticker 6자리 위반 → throw (DB INSERT 미진입)", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const fromMock = vi.fn().mockReturnValue({ insert: insertMock });
    const client = { from: fromMock } as unknown as SupabaseClient;
    await expect(
      insertM12aAssessments([row({ ticker: "12345" })], { client }),
    ).rejects.toThrow("m12a_assessment_invalid_ticker:12345");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("month YYYY-MM-01 위반 → throw (ledger/cost 월 정합 가드)", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const fromMock = vi.fn().mockReturnValue({ insert: insertMock });
    const client = { from: fromMock } as unknown as SupabaseClient;
    await expect(
      insertM12aAssessments([row({ month: "2026-06" })], { client }),
    ).rejects.toThrow("m12a_assessment_invalid_month:2026-06");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("removed priceBasisDate YYYYMMDD 위반 → throw", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const fromMock = vi.fn().mockReturnValue({ insert: insertMock });
    const client = { from: fromMock } as unknown as SupabaseClient;
    await expect(
      insertM12aAssessments(
        [
          row({
            actionTaken: "removed",
            priceBasisDate: "2026-06-25",
            priceSource: "KRX_EOD",
            executionAssumption: "virtual_eod",
          }),
        ],
        { client },
      ),
    ).rejects.toThrow(
      "m12a_assessment_invalid_price_basis_date:2026-06-25",
    );
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("action_taken enum 위반 → throw", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const fromMock = vi.fn().mockReturnValue({ insert: insertMock });
    const client = { from: fromMock } as unknown as SupabaseClient;
    await expect(
      insertM12aAssessments(
        [row({ actionTaken: "deleted" as never })],
        { client },
      ),
    ).rejects.toThrow("m12a_assessment_invalid_action_taken:deleted");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("DB error → throw m12a_assessment_insert_failed:<code>", async () => {
    const insertMock = vi
      .fn()
      .mockResolvedValue({ error: { code: "23503", message: "fk" } });
    const fromMock = vi.fn().mockReturnValue({ insert: insertMock });
    const client = { from: fromMock } as unknown as SupabaseClient;
    await expect(
      insertM12aAssessments([row()], { client }),
    ).rejects.toThrow("m12a_assessment_insert_failed:23503");
  });
});
