import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  computeNextMonthResetAt,
  getRegenCounter,
  incrementManualRegenCount,
  transformRegenCounterRow,
  type RegenCounterDbRow,
} from "@/lib/data/admin-regen-counters";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: mocks.from,
  })),
}));

const baseRow: RegenCounterDbRow = {
  id: "regen-uuid-001",
  ticker: "005930",
  month: "2026-04-01",
  auto_count: 0,
  manual_count: 0,
  reset_at: "2026-05-01T00:00:00+09:00",
  updated_at: "2026-04-15T10:00:00.000Z",
};

interface QueryResult {
  data: unknown;
  error: unknown;
}

interface SelectChain {
  select: (columns: string) => SelectChain;
  eq: (column: string, value: string | number) => SelectChain;
  single: () => Promise<QueryResult>;
  maybeSingle: () => Promise<QueryResult>;
}

interface UpdateChain {
  eq: (column: string, value: string | number) => UpdateChain;
  select: (columns: string) => UpdateChain;
  maybeSingle: () => Promise<QueryResult>;
}

function makeSelectChain(
  terminal: { single?: QueryResult; maybeSingle?: QueryResult },
) {
  // chainable: select.eq.eq.single() / select.eq.eq.maybeSingle()
  const builder = {} as SelectChain;
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.single = vi.fn(async () => terminal.single ?? { data: null, error: null });
  builder.maybeSingle = vi.fn(async () =>
    terminal.maybeSingle ?? { data: null, error: null },
  );
  return builder;
}

function makeUpdateChain(terminal: QueryResult) {
  // chainable: update().eq().eq().select().maybeSingle()
  const builder = {} as UpdateChain;
  builder.eq = vi.fn(() => builder);
  builder.select = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => terminal);
  return builder;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("transformRegenCounterRow", () => {
  it("maps snake_case DB columns to camelCase RegenCounter", () => {
    const counter = transformRegenCounterRow(baseRow);
    expect(counter).toEqual({
      id: baseRow.id,
      ticker: baseRow.ticker,
      month: baseRow.month,
      autoCount: 0,
      manualCount: 0,
      resetAt: baseRow.reset_at,
    });
  });
});

describe("computeNextMonthResetAt", () => {
  it("rolls month over to first day of next month at +09:00", () => {
    expect(computeNextMonthResetAt("2026-04-01")).toBe(
      "2026-05-01T00:00:00+09:00",
    );
  });

  it("wraps December to January of next year", () => {
    expect(computeNextMonthResetAt("2026-12-01")).toBe(
      "2027-01-01T00:00:00+09:00",
    );
  });

  it("zero-pads single-digit next month", () => {
    expect(computeNextMonthResetAt("2026-08-01")).toBe(
      "2026-09-01T00:00:00+09:00",
    );
  });
});

describe("getRegenCounter", () => {
  it("returns null when row does not exist", async () => {
    const chain = makeSelectChain({ maybeSingle: { data: null, error: null } });
    mocks.from.mockReturnValue({
      select: chain.select,
    });

    const result = await getRegenCounter("005930", "2026-04-01");

    expect(mocks.from).toHaveBeenCalledWith("regen_counter");
    expect(result).toBeNull();
  });

  it("returns transformed row when found", async () => {
    const chain = makeSelectChain({ maybeSingle: { data: baseRow, error: null } });
    mocks.from.mockReturnValue({ select: chain.select });

    const result = await getRegenCounter("005930", "2026-04-01");

    expect(result).toEqual(transformRegenCounterRow(baseRow));
  });

  it("throws when supabase returns an error", async () => {
    const chain = makeSelectChain({
      maybeSingle: { data: null, error: { message: "rls denied" } },
    });
    mocks.from.mockReturnValue({ select: chain.select });

    await expect(getRegenCounter("005930", "2026-04-01")).rejects.toThrow(
      /regen_counter/,
    );
  });
});

describe("incrementManualRegenCount", () => {
  it("inserts a new row then increments to 1 when no counter existed", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const selectChain = makeSelectChain({
      single: {
        data: { ...baseRow, manual_count: 0 },
        error: null,
      },
    });
    const updateChain = makeUpdateChain({
      data: { ...baseRow, manual_count: 1 },
      error: null,
    });
    mocks.from.mockReturnValue({
      insert: insertMock,
      select: selectChain.select,
      update: vi.fn(() => updateChain),
    });

    const result = await incrementManualRegenCount("005930", "2026-04-01");

    expect(insertMock).toHaveBeenCalledWith({
      ticker: "005930",
      month: "2026-04-01",
      auto_count: 0,
      manual_count: 0,
      reset_at: "2026-05-01T00:00:00+09:00",
    });
    expect(result).toEqual({ ok: true, manualCount: 1 });
  });

  it("treats UNIQUE violation 23505 on insert as benign and proceeds", async () => {
    const insertMock = vi
      .fn()
      .mockResolvedValue({ error: { code: "23505", message: "duplicate" } });
    const selectChain = makeSelectChain({
      single: {
        data: { ...baseRow, manual_count: 1 },
        error: null,
      },
    });
    const updateChain = makeUpdateChain({
      data: { ...baseRow, manual_count: 2 },
      error: null,
    });
    mocks.from.mockReturnValue({
      insert: insertMock,
      select: selectChain.select,
      update: vi.fn(() => updateChain),
    });

    const result = await incrementManualRegenCount("005930", "2026-04-01");

    expect(result).toEqual({ ok: true, manualCount: 2 });
  });

  it("returns cap_exhausted without writing when manual_count already at cap", async () => {
    const insertMock = vi
      .fn()
      .mockResolvedValue({ error: { code: "23505", message: "duplicate" } });
    const selectChain = makeSelectChain({
      single: {
        data: { ...baseRow, manual_count: 2 },
        error: null,
      },
    });
    const updateMock = vi.fn();
    mocks.from.mockReturnValue({
      insert: insertMock,
      select: selectChain.select,
      update: updateMock,
    });

    const result = await incrementManualRegenCount("005930", "2026-04-01");

    expect(result).toEqual({ ok: false, reason: "cap_exhausted", manualCount: 2 });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("throws lookup error when SELECT fails", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const selectChain = makeSelectChain({
      single: { data: null, error: { message: "rls denied" } },
    });
    mocks.from.mockReturnValue({
      insert: insertMock,
      select: selectChain.select,
      update: vi.fn(),
    });

    await expect(
      incrementManualRegenCount("005930", "2026-04-01"),
    ).rejects.toThrow(/lookup/);
  });

  it("throws insert error when non-23505 INSERT failure occurs", async () => {
    const insertMock = vi
      .fn()
      .mockResolvedValue({ error: { code: "42501", message: "rls denied" } });
    mocks.from.mockReturnValue({
      insert: insertMock,
      select: vi.fn(),
      update: vi.fn(),
    });

    await expect(
      incrementManualRegenCount("005930", "2026-04-01"),
    ).rejects.toThrow(/insert/);
  });

  it("throws conflict error when CAS UPDATE returns no row (race lost)", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const selectChain = makeSelectChain({
      single: { data: { ...baseRow, manual_count: 0 }, error: null },
    });
    // CAS missed: another concurrent request bumped manual_count to 1 first
    const updateChain = makeUpdateChain({ data: null, error: null });
    mocks.from.mockReturnValue({
      insert: insertMock,
      select: selectChain.select,
      update: vi.fn(() => updateChain),
    });

    await expect(
      incrementManualRegenCount("005930", "2026-04-01"),
    ).rejects.toThrow(/conflict/);
  });
});
