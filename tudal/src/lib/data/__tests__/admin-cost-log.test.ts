// tudal/src/lib/data/__tests__/admin-cost-log.test.ts
// Mock cleanup Step 2.4 — getMonthlyCostLog 실 cost_log SELECT helper invariants.
// Step 2.3 cost-logger.test.ts pagination 패턴 정합 + feedback_test_mock_typing.md
// Supabase chain mock 타입 인터페이스 적용.
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getMonthlyCostLog } from "../admin-cost-log";

interface SelectChain {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
}
interface QueryResult<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

function buildChain(results: QueryResult<unknown>[]): {
  client: { from: ReturnType<typeof vi.fn> };
  chain: SelectChain;
} {
  let call = 0;
  const range = vi.fn(() => results[call++] ?? results[results.length - 1]);
  const chain: SelectChain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    range,
  };
  return {
    client: { from: vi.fn(() => chain) },
    chain,
  };
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

function makeDbRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "uuid-1",
    month: "2026-05",
    ticker: "005930",
    persona_id: "core-buffett",
    prompt_version: "v1",
    model: "claude-opus-4-7",
    input_tokens: 100,
    cache_creation_input_tokens: 10,
    cache_read_input_tokens: 5,
    output_tokens: 50,
    cost_krw: 1234.56,
    prompt_cache_enabled: false,
    called_at: "2026-05-15T10:00:00Z",
    ...overrides,
  };
}

describe("admin-cost-log (Mock cleanup Step 2.4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("empty rows → returns []", async () => {
    const { client } = buildChain([{ data: [], error: null }]);
    const result = await getMonthlyCostLog("2026-05", {
      client: client as unknown as SupabaseClient,
    });
    expect(result).toEqual([]);
  });

  it("single page (< 1000 rows) → returns transformed CostLog with derived purpose + summed tokens", async () => {
    const dbRow = makeDbRow();
    const { client } = buildChain([{ data: [dbRow], error: null }]);
    const result = await getMonthlyCostLog("2026-05-01", {
      client: client as unknown as SupabaseClient,
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "uuid-1",
      ts: "2026-05-15T10:00:00Z",
      month: "2026-05",
      model: "claude-opus-4-7",
      purpose: "committee", // core-* prefix
      ticker: "005930",
      personaId: "core-buffett",
      section: null,
      tokensPrompt: 115, // input(100) + cache_creation(10) + cache_read(5)
      tokensCompletion: 50,
      costKrw: 1234.56,
    });
  });

  it("pagination — 2 pages (1000 + 500) → fetches both with correct range offsets", async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) =>
      makeDbRow({ id: `uuid-p1-${i}`, called_at: `2026-05-15T10:00:${String(i % 60).padStart(2, "0")}Z` }),
    );
    const page2 = Array.from({ length: 500 }, (_, i) =>
      makeDbRow({ id: `uuid-p2-${i}`, called_at: `2026-05-16T10:00:${String(i % 60).padStart(2, "0")}Z` }),
    );
    const { client, chain } = buildChain([
      { data: page1, error: null },
      { data: page2, error: null },
    ]);
    const result = await getMonthlyCostLog("2026-05", {
      client: client as unknown as SupabaseClient,
    });
    expect(result).toHaveLength(1500);
    expect(chain.range).toHaveBeenCalledTimes(2);
    expect(chain.range).toHaveBeenNthCalledWith(1, 0, 999);
    expect(chain.range).toHaveBeenNthCalledWith(2, 1000, 1999);
  });

  it("RLS deny / DB error → throws cost_log_select_failed:<code>", async () => {
    const { client } = buildChain([
      { data: null, error: { message: "RLS violation", code: "42501" } },
    ]);
    await expect(
      getMonthlyCostLog("2026-05", {
        client: client as unknown as SupabaseClient,
      }),
    ).rejects.toThrow("cost_log_select_failed:42501");
  });

  it("error code missing → throws cost_log_select_failed:unknown", async () => {
    const { client } = buildChain([
      { data: null, error: { message: "transient" } },
    ]);
    await expect(
      getMonthlyCostLog("2026-05", {
        client: client as unknown as SupabaseClient,
      }),
    ).rejects.toThrow("cost_log_select_failed:unknown");
  });

  it("non-finite cost_krw → throws non_finite_cost_krw (Step 2.3 hardening 정합)", async () => {
    const dbRow = makeDbRow({ cost_krw: "not-a-number" });
    const { client } = buildChain([{ data: [dbRow], error: null }]);
    await expect(
      getMonthlyCostLog("2026-05", {
        client: client as unknown as SupabaseClient,
      }),
    ).rejects.toThrow("cost_log_select_failed:non_finite_cost_krw");
  });

  it("negative cost_krw → throws negative_cost_krw (financial integrity fail-closed)", async () => {
    const dbRow = makeDbRow({ cost_krw: -100 });
    const { client } = buildChain([{ data: [dbRow], error: null }]);
    await expect(
      getMonthlyCostLog("2026-05", {
        client: client as unknown as SupabaseClient,
      }),
    ).rejects.toThrow("cost_log_select_failed:negative_cost_krw");
  });

  it("purpose derivation — production caller patterns + snake_case/kebab-case 양쪽", async () => {
    const cases: Array<{ persona_id: string; purpose: string }> = [
      { persona_id: "full_report_writer", purpose: "report" },
      { persona_id: "critic", purpose: "report" },
      { persona_id: "revise", purpose: "regenerate" },
      { persona_id: "core-buffett", purpose: "committee" },
      { persona_id: "core_buffett", purpose: "committee" },
      { persona_id: "sector-construction-buffett", purpose: "committee" },
      { persona_id: "sector_construction_buffett", purpose: "committee" },
      { persona_id: "shortlist", purpose: "shortlist" },
      { persona_id: "shortlist-screener", purpose: "shortlist" },
      { persona_id: "briefing", purpose: "briefing" },
      { persona_id: "briefing-morning", purpose: "briefing" },
      { persona_id: "unknown-xyz", purpose: "other" },
    ];
    const rows = cases.map((c, i) =>
      makeDbRow({
        id: `uuid-${i}`,
        persona_id: c.persona_id,
        called_at: `2026-05-15T10:00:${String(i).padStart(2, "0")}Z`,
      }),
    );
    const { client } = buildChain([{ data: rows, error: null }]);
    const result = await getMonthlyCostLog("2026-05", {
      client: client as unknown as SupabaseClient,
    });
    expect(result).toHaveLength(cases.length);
    cases.forEach((c, i) => {
      expect(result[i].purpose).toBe(c.purpose);
    });
  });

  it("month format normalization — 'YYYY-MM-01' → 'YYYY-MM' DB query", async () => {
    const { client, chain } = buildChain([{ data: [], error: null }]);
    await getMonthlyCostLog("2026-05-01", {
      client: client as unknown as SupabaseClient,
    });
    expect(client.from).toHaveBeenCalledWith("cost_log");
    expect(chain.eq).toHaveBeenCalledWith("month", "2026-05");
  });

  it("month format normalization — 'YYYY-MM' pass-through (insertCostLog SoT 정합)", async () => {
    const { client, chain } = buildChain([{ data: [], error: null }]);
    await getMonthlyCostLog("2026-05", {
      client: client as unknown as SupabaseClient,
    });
    expect(chain.eq).toHaveBeenCalledWith("month", "2026-05");
  });

  it("ordering invariant — called_at ASC primary + id ASC tiebreak (Step 2.3 R4 정합)", async () => {
    const { client, chain } = buildChain([{ data: [], error: null }]);
    await getMonthlyCostLog("2026-05", {
      client: client as unknown as SupabaseClient,
    });
    expect(chain.order).toHaveBeenCalledTimes(2);
    expect(chain.order).toHaveBeenNthCalledWith(1, "called_at", {
      ascending: true,
    });
    expect(chain.order).toHaveBeenNthCalledWith(2, "id", { ascending: true });
  });

  it("DI seam — options.client override → createClient short-circuit", async () => {
    const { client } = buildChain([{ data: [], error: null }]);
    await getMonthlyCostLog("2026-05", {
      client: client as unknown as SupabaseClient,
    });
    const serverModule = await import("@/lib/supabase/server");
    expect(serverModule.createClient).not.toHaveBeenCalled();
  });

  it("PostgREST numeric string coerce — cost_krw='5000.50' parses correctly", async () => {
    const dbRow = makeDbRow({ cost_krw: "5000.50" });
    const { client } = buildChain([{ data: [dbRow], error: null }]);
    const result = await getMonthlyCostLog("2026-05", {
      client: client as unknown as SupabaseClient,
    });
    expect(result[0].costKrw).toBe(5000.5);
  });

  it("safeInt fallback — non-finite token values → 0 (page render 우선)", async () => {
    const dbRow = makeDbRow({
      input_tokens: "NaN",
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      output_tokens: "bad",
    });
    const { client } = buildChain([{ data: [dbRow], error: null }]);
    const result = await getMonthlyCostLog("2026-05", {
      client: client as unknown as SupabaseClient,
    });
    expect(result[0].tokensPrompt).toBe(0);
    expect(result[0].tokensCompletion).toBe(0);
  });
});
