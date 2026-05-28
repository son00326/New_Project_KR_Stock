// admin-alerts.test.ts — 58차 Mock cleanup Step 2.1
//
// alert_event 테이블 SELECT helper 단위 테스트.
// - transformAlertEventRow: snake → camel 매핑 + enum 검증 + numeric 처리
// - getRecentAlertEvents: empty / non-empty / limit / order / error
// - getAlertEventById: hit / miss (PGRST116 / maybeSingle null) / error

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAlertEventById,
  getRecentAlertEvents,
  transformAlertEventRow,
  type AlertEventDbRow,
} from "@/lib/data/admin-alerts";

interface SelectChain {
  select: (...args: unknown[]) => SelectChain;
  order: (...args: unknown[]) => SelectChain;
  limit: (...args: unknown[]) => SelectChain;
  eq: (...args: unknown[]) => SelectChain;
  maybeSingle: () => Promise<{
    data: AlertEventDbRow | null;
    error: { code?: string; message?: string } | null;
  }>;
  then: <T>(
    onFulfilled: (value: {
      data: AlertEventDbRow[] | null;
      error: { code?: string; message?: string } | null;
    }) => T,
  ) => Promise<T>;
}

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  order: vi.fn(),
  limit: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
  resolved: {
    data: null as AlertEventDbRow[] | null,
    error: null as { code?: string; message?: string } | null,
  },
  resolvedSingle: {
    data: null as AlertEventDbRow | null,
    error: null as { code?: string; message?: string } | null,
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: mocks.from,
  })),
}));

const baseRow: AlertEventDbRow = {
  id: "00000000-0000-0000-0000-000000000001",
  alert_type: "exit_signal",
  ticker: "005930",
  severity: "critical",
  trigger_reason: "삼성전자 목표가 근접 + 모멘텀 꺾임",
  signal_sent_at: "2026-05-27T04:45:22.000Z",
  outcome_at: null,
  t7_price_change: null,
  decision_recorded: null,
  decision_memo: null,
  is_read: false,
};

describe("transformAlertEventRow", () => {
  it("maps snake_case columns to camelCase AlertEvent", () => {
    const event = transformAlertEventRow(baseRow);
    expect(event.id).toBe(baseRow.id);
    expect(event.alertType).toBe("exit_signal");
    expect(event.ticker).toBe("005930");
    expect(event.severity).toBe("critical");
    expect(event.triggerReason).toBe(baseRow.trigger_reason);
    expect(event.signalSentAt).toBe(baseRow.signal_sent_at);
    expect(event.outcomeAt).toBeNull();
    expect(event.t7PriceChange).toBeNull();
    expect(event.decisionRecorded).toBeNull();
    expect(event.decisionMemo).toBeNull();
    expect(event.isRead).toBe(false);
  });

  it("parses numeric t7_price_change from string OR number", () => {
    expect(
      transformAlertEventRow({ ...baseRow, t7_price_change: "-8.2" })
        .t7PriceChange,
    ).toBe(-8.2);
    expect(
      transformAlertEventRow({ ...baseRow, t7_price_change: 3.5 })
        .t7PriceChange,
    ).toBe(3.5);
  });

  it("maps decision_recorded enum + decision_memo when set", () => {
    const row: AlertEventDbRow = {
      ...baseRow,
      decision_recorded: "sell_all",
      decision_memo: "공정위 과징금 — 전량 매도",
      is_read: true,
    };
    const event = transformAlertEventRow(row);
    expect(event.decisionRecorded).toBe("sell_all");
    expect(event.decisionMemo).toBe("공정위 과징금 — 전량 매도");
    expect(event.isRead).toBe(true);
  });

  it("supports null ticker (market-wide alert)", () => {
    expect(
      transformAlertEventRow({ ...baseRow, ticker: null }).ticker,
    ).toBeNull();
  });

  it("throws on invalid alert_type", () => {
    expect(() =>
      transformAlertEventRow({ ...baseRow, alert_type: "bogus" }),
    ).toThrow(/alert_event_invalid_alert_type/);
  });

  it("throws on invalid severity", () => {
    expect(() =>
      transformAlertEventRow({ ...baseRow, severity: "danger" }),
    ).toThrow(/alert_event_invalid_severity/);
  });

  it("throws on invalid decision_recorded", () => {
    expect(() =>
      transformAlertEventRow({
        ...baseRow,
        decision_recorded: "buy_more",
      }),
    ).toThrow(/alert_event_invalid_decision/);
  });
});

function makeListChain(): SelectChain {
  const chain: SelectChain = {
    select: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => mocks.resolvedSingle),
    // PostgREST builder는 await 시 thenable — order/limit 후 await로 결과 resolve.
    then: (onFulfilled) => Promise.resolve(mocks.resolved).then(onFulfilled),
  };
  return chain;
}

describe("getRecentAlertEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolved = { data: [], error: null };
    mocks.from.mockReturnValue(makeListChain());
  });

  it("returns empty array when DB returns 0 rows", async () => {
    mocks.resolved = { data: [], error: null };
    const out = await getRecentAlertEvents();
    expect(out).toEqual([]);
  });

  it("uses injected client without creating a session client", async () => {
    const chain = makeListChain();
    const injectedFrom = vi.fn(() => chain);
    const { createClient } = await import("@/lib/supabase/server");

    const out = await getRecentAlertEvents({
      client: { from: injectedFrom } as never,
    });

    expect(out).toEqual([]);
    expect(createClient).not.toHaveBeenCalled();
    expect(injectedFrom).toHaveBeenCalledWith("alert_event");
  });

  it("falls back to session client when no client is injected", async () => {
    const { createClient } = await import("@/lib/supabase/server");

    await getRecentAlertEvents();

    expect(createClient).toHaveBeenCalledTimes(1);
    expect(mocks.from).toHaveBeenCalledWith("alert_event");
  });

  it("maps non-empty rows to AlertEvent[]", async () => {
    mocks.resolved = {
      data: [
        baseRow,
        {
          ...baseRow,
          id: "00000000-0000-0000-0000-000000000002",
          alert_type: "scheduler_fail",
          severity: "warning",
          ticker: null,
          signal_sent_at: "2026-05-26T10:00:00.000Z",
        },
      ],
      error: null,
    };
    const out = await getRecentAlertEvents();
    expect(out).toHaveLength(2);
    expect(out[0].alertType).toBe("exit_signal");
    expect(out[1].alertType).toBe("scheduler_fail");
    expect(out[1].ticker).toBeNull();
  });

  it("applies limit option when positive", async () => {
    const chain = makeListChain();
    mocks.from.mockReturnValue(chain);
    mocks.resolved = { data: [], error: null };
    await getRecentAlertEvents({ limit: 50 });
    expect(chain.limit).toHaveBeenCalledWith(50);
  });

  it("ignores limit when non-positive", async () => {
    const chain = makeListChain();
    mocks.from.mockReturnValue(chain);
    mocks.resolved = { data: [], error: null };
    await getRecentAlertEvents({ limit: 0 });
    expect(chain.limit).not.toHaveBeenCalled();
  });

  it("throws wrapped error with table prefix on supabase error", async () => {
    mocks.resolved = {
      data: null,
      error: { code: "PGRST301", message: "rls denied" },
    };
    await expect(getRecentAlertEvents()).rejects.toThrow(
      /alert_event_select_failed/,
    );
  });
});

describe("getAlertEventById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolvedSingle = { data: null, error: null };
    mocks.from.mockReturnValue(makeListChain());
  });

  it("returns null for empty id without hitting Supabase", async () => {
    const out = await getAlertEventById("");
    expect(out).toBeNull();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("returns null when maybeSingle yields no row", async () => {
    mocks.resolvedSingle = { data: null, error: null };
    const out = await getAlertEventById("00000000-0000-0000-0000-deadbeef0000");
    expect(out).toBeNull();
  });

  it("maps the single row to AlertEvent on hit", async () => {
    mocks.resolvedSingle = { data: baseRow, error: null };
    const out = await getAlertEventById(baseRow.id);
    expect(out).not.toBeNull();
    expect(out?.alertType).toBe("exit_signal");
    expect(out?.ticker).toBe("005930");
  });

  it("throws wrapped error on supabase error", async () => {
    mocks.resolvedSingle = {
      data: null,
      error: { code: "PGRST116", message: "denied" },
    };
    await expect(getAlertEventById("any-id")).rejects.toThrow(
      /alert_event_lookup_failed/,
    );
  });
});
