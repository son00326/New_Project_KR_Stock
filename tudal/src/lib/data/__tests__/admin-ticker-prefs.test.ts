// admin-ticker-prefs.test.ts — 58차 Mock cleanup Step 2.2
//
// ticker_alert_pref 테이블 SELECT helper 단위 테스트.
// - transformTickerAlertPrefRow: snake → camel + ticker/enabled 검증
// - getCurrentTickerAlertPrefs: empty / non-empty / order / limit / error

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getAllTickerAlertPrefs,
  getCurrentTickerAlertPrefs,
  transformTickerAlertPrefRow,
  type TickerAlertPrefDbRow,
} from "@/lib/data/admin-ticker-prefs";

interface SelectChain {
  select: (...args: unknown[]) => SelectChain;
  order: (...args: unknown[]) => SelectChain;
  limit: (...args: unknown[]) => SelectChain;
  then: <T>(
    onFulfilled: (value: {
      data: TickerAlertPrefDbRow[] | null;
      error: { code?: string; message?: string } | null;
    }) => T,
  ) => Promise<T>;
}

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  resolved: {
    data: null as TickerAlertPrefDbRow[] | null,
    error: null as { code?: string; message?: string } | null,
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: mocks.from,
  })),
}));

const baseRow: TickerAlertPrefDbRow = {
  id: "00000000-0000-0000-0000-000000000001",
  admin_id: "11111111-1111-1111-1111-111111111111",
  ticker: "005930",
  enabled: true,
  updated_at: "2026-05-27T04:00:00.000Z",
};

describe("transformTickerAlertPrefRow", () => {
  it("maps snake_case columns to camelCase TickerAlertPref", () => {
    const pref = transformTickerAlertPrefRow(baseRow);
    expect(pref.id).toBe(baseRow.id);
    expect(pref.adminId).toBe(baseRow.admin_id);
    expect(pref.ticker).toBe("005930");
    expect(pref.enabled).toBe(true);
    expect(pref.updatedAt).toBe(baseRow.updated_at);
  });

  it("preserves enabled=false", () => {
    const pref = transformTickerAlertPrefRow({ ...baseRow, enabled: false });
    expect(pref.enabled).toBe(false);
  });

  it("throws when enabled is not boolean", () => {
    expect(() =>
      transformTickerAlertPrefRow({
        ...baseRow,
        enabled: "true" as unknown as boolean,
      }),
    ).toThrow(/ticker_alert_pref_invalid_enabled/);
  });

  it("throws when ticker is not 6-digit", () => {
    expect(() =>
      transformTickerAlertPrefRow({ ...baseRow, ticker: "12345" }),
    ).toThrow(/ticker_alert_pref_invalid_ticker/);
    expect(() =>
      transformTickerAlertPrefRow({ ...baseRow, ticker: "abc456" }),
    ).toThrow(/ticker_alert_pref_invalid_ticker/);
    expect(() =>
      transformTickerAlertPrefRow({
        ...baseRow,
        ticker: null as unknown as string,
      }),
    ).toThrow(/ticker_alert_pref_invalid_ticker/);
  });
});

describe("getCurrentTickerAlertPrefs", () => {
  let orderSpy: ReturnType<typeof vi.fn>;
  let limitSpy: ReturnType<typeof vi.fn>;
  let selectSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolved = { data: null, error: null };
    const chain: SelectChain = {
      select: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      then: (onFulfilled) => Promise.resolve(mocks.resolved).then(onFulfilled),
    };
    selectSpy = chain.select as ReturnType<typeof vi.fn>;
    orderSpy = chain.order as ReturnType<typeof vi.fn>;
    limitSpy = chain.limit as ReturnType<typeof vi.fn>;
    mocks.from.mockImplementation(() => chain);
  });

  it("returns [] when 0 rows (empty data array)", async () => {
    mocks.resolved = { data: [], error: null };
    const result = await getCurrentTickerAlertPrefs();
    expect(result).toEqual([]);
  });

  it("returns [] when data is null (defensive)", async () => {
    mocks.resolved = { data: null, error: null };
    const result = await getCurrentTickerAlertPrefs();
    expect(result).toEqual([]);
  });

  it("returns transformed prefs when rows exist", async () => {
    mocks.resolved = {
      data: [
        baseRow,
        { ...baseRow, id: "id-2", ticker: "035720", enabled: false },
      ],
      error: null,
    };
    const result = await getCurrentTickerAlertPrefs();
    expect(result).toHaveLength(2);
    expect(result[0].ticker).toBe("005930");
    expect(result[0].enabled).toBe(true);
    expect(result[1].ticker).toBe("035720");
    expect(result[1].enabled).toBe(false);
  });

  it("orders by updated_at desc + limits to 200", async () => {
    mocks.resolved = { data: [], error: null };
    await getCurrentTickerAlertPrefs();
    expect(selectSpy).toHaveBeenCalledWith(
      "id, admin_id, ticker, enabled, updated_at",
    );
    expect(orderSpy).toHaveBeenCalledWith("updated_at", { ascending: false });
    expect(limitSpy).toHaveBeenCalledWith(200);
  });

  it("throws on DB error", async () => {
    mocks.resolved = {
      data: null,
      error: { code: "PGRST301", message: "permission denied" },
    };
    await expect(getCurrentTickerAlertPrefs()).rejects.toThrow(
      /ticker_alert_pref_select_failed/,
    );
  });
});

// S7c 워커 seam (2026-07-04): 주입 client로 전 어드민 row SELECT — createClient 미사용.
describe("getAllTickerAlertPrefs", () => {
  beforeEach(() => {
    // 앞 describe에서 세션 mock(from)에 누적된 호출 제거 — "미사용" 단언 정확화.
    mocks.from.mockClear();
  });

  interface InjectedResolved {
    data: TickerAlertPrefDbRow[] | null;
    error: { code?: string; message?: string } | null;
  }

  function makeInjectedClient(resolved: InjectedResolved) {
    const spies = {
      from: vi.fn(),
      select: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
    };
    const chain: SelectChain = {
      select: spies.select.mockImplementation(() => chain),
      order: spies.order.mockImplementation(() => chain),
      limit: spies.limit.mockImplementation(() => chain),
      then: (onFulfilled) => Promise.resolve(resolved).then(onFulfilled),
    };
    spies.from.mockImplementation(() => chain);
    const client = { from: spies.from } as unknown as SupabaseClient;
    return { client, spies };
  }

  it("주입 client 사용 (createClient fallback 없음) + limit 600", async () => {
    const { client, spies } = makeInjectedClient({
      data: [
        baseRow,
        {
          ...baseRow,
          id: "id-2",
          admin_id: "22222222-2222-2222-2222-222222222222",
          ticker: "005930",
          enabled: false,
        },
      ],
      error: null,
    });
    const result = await getAllTickerAlertPrefs({ client });
    expect(result).toHaveLength(2);
    expect(result[1].adminId).toBe("22222222-2222-2222-2222-222222222222");
    expect(spies.from).toHaveBeenCalledWith("ticker_alert_pref");
    expect(spies.limit).toHaveBeenCalledWith(600);
    // 세션 createClient 경로 미사용 — RLS self-only 오염 방지 pin.
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("0 rows → [] / DB error → throw", async () => {
    const empty = makeInjectedClient({ data: [], error: null });
    await expect(getAllTickerAlertPrefs({ client: empty.client })).resolves.toEqual([]);

    const failing = makeInjectedClient({
      data: null,
      error: { code: "PGRST301", message: "permission denied" },
    });
    await expect(
      getAllTickerAlertPrefs({ client: failing.client }),
    ).rejects.toThrow(/ticker_alert_pref_select_failed/);
  });
});
