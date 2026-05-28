// tudal/src/lib/data/__tests__/admin-pipeline-health.test.ts
// Mock cleanup Step 2.5 — getRecentPipelineHealth 실 pipeline_health SELECT invariants.
// Step 2.3/2.4 cost-logger/admin-cost-log 패턴 정합 + Supabase chain mock typing.
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRecentPipelineHealth } from "../admin-pipeline-health";

interface SelectChain {
  select: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
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
    gte: vi.fn(() => chain),
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

function makeDbRow(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: "uuid-1",
    run_id: null,
    pipeline: "dart",
    status: "success",
    started_at: "2026-05-28T10:00:00Z",
    finished_at: "2026-05-28T10:00:01Z",
    latency_ms: 420,
    error: null,
    ...overrides,
  };
}

describe("admin-pipeline-health (Mock cleanup Step 2.5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("empty rows → returns []", async () => {
    const { client } = buildChain([{ data: [], error: null }]);
    const result = await getRecentPipelineHealth({
      client: client as unknown as SupabaseClient,
    });
    expect(result).toEqual([]);
  });

  it("single page → transforms snake_case to camelCase", async () => {
    const dbRow = makeDbRow({
      id: "uuid-1",
      run_id: "run-abc",
      pipeline: "news",
      status: "warning",
      started_at: "2026-05-28T10:00:00Z",
      finished_at: "2026-05-28T10:00:02Z",
      latency_ms: 680,
      error: null,
    });
    const { client } = buildChain([{ data: [dbRow], error: null }]);
    const result = await getRecentPipelineHealth({
      client: client as unknown as SupabaseClient,
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "uuid-1",
      runId: "run-abc",
      pipeline: "news",
      status: "warning",
      startedAt: "2026-05-28T10:00:00Z",
      finishedAt: "2026-05-28T10:00:02Z",
      latencyMs: 680,
      error: null,
    });
  });

  it("pagination — 2 pages (1000 + 300 rows) → fetches both", async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) =>
      makeDbRow({
        id: `uuid-p1-${i}`,
        started_at: `2026-05-28T${String(i % 24).padStart(2, "0")}:00:00Z`,
      }),
    );
    const page2 = Array.from({ length: 300 }, (_, i) =>
      makeDbRow({
        id: `uuid-p2-${i}`,
        started_at: `2026-05-27T${String(i % 24).padStart(2, "0")}:00:00Z`,
      }),
    );
    const { client, chain } = buildChain([
      { data: page1, error: null },
      { data: page2, error: null },
    ]);
    const result = await getRecentPipelineHealth({
      client: client as unknown as SupabaseClient,
    });
    expect(result).toHaveLength(1300);
    expect(chain.range).toHaveBeenCalledTimes(2);
    expect(chain.range).toHaveBeenNthCalledWith(1, 0, 999);
    expect(chain.range).toHaveBeenNthCalledWith(2, 1000, 1999);
  });

  it("RLS deny / DB error → throws pipeline_health_select_failed:<code>", async () => {
    const { client } = buildChain([
      { data: null, error: { message: "RLS violation", code: "42501" } },
    ]);
    await expect(
      getRecentPipelineHealth({
        client: client as unknown as SupabaseClient,
      }),
    ).rejects.toThrow("pipeline_health_select_failed:42501");
  });

  it("error code missing → throws pipeline_health_select_failed:unknown", async () => {
    const { client } = buildChain([
      { data: null, error: { message: "transient" } },
    ]);
    await expect(
      getRecentPipelineHealth({
        client: client as unknown as SupabaseClient,
      }),
    ).rejects.toThrow("pipeline_health_select_failed:unknown");
  });

  it("invalid pipeline enum → throws invalid_pipeline (fail-closed)", async () => {
    const dbRow = makeDbRow({ pipeline: "unknown_pipeline" });
    const { client } = buildChain([{ data: [dbRow], error: null }]);
    await expect(
      getRecentPipelineHealth({
        client: client as unknown as SupabaseClient,
      }),
    ).rejects.toThrow("pipeline_health_select_failed:invalid_pipeline");
  });

  it("invalid status enum → throws invalid_status (fail-closed)", async () => {
    const dbRow = makeDbRow({ status: "pending" });
    const { client } = buildChain([{ data: [dbRow], error: null }]);
    await expect(
      getRecentPipelineHealth({
        client: client as unknown as SupabaseClient,
      }),
    ).rejects.toThrow("pipeline_health_select_failed:invalid_status");
  });

  it("non-finite latency_ms → throws non_finite_latency", async () => {
    const dbRow = makeDbRow({ latency_ms: "not-a-number" });
    const { client } = buildChain([{ data: [dbRow], error: null }]);
    await expect(
      getRecentPipelineHealth({
        client: client as unknown as SupabaseClient,
      }),
    ).rejects.toThrow("pipeline_health_select_failed:non_finite_latency");
  });

  it("negative latency_ms → throws negative_latency (fail-closed)", async () => {
    const dbRow = makeDbRow({ latency_ms: -1 });
    const { client } = buildChain([{ data: [dbRow], error: null }]);
    await expect(
      getRecentPipelineHealth({
        client: client as unknown as SupabaseClient,
      }),
    ).rejects.toThrow("pipeline_health_select_failed:negative_latency");
  });

  it("null latency_ms → passes through as null (not throw)", async () => {
    const dbRow = makeDbRow({ latency_ms: null, finished_at: null });
    const { client } = buildChain([{ data: [dbRow], error: null }]);
    const result = await getRecentPipelineHealth({
      client: client as unknown as SupabaseClient,
    });
    expect(result[0].latencyMs).toBeNull();
    expect(result[0].finishedAt).toBeNull();
  });

  it("known pipelines — all 5 (dart/news/price/ai/alert) pass validation", async () => {
    const cases = ["dart", "news", "price", "ai", "alert"];
    const rows = cases.map((p, i) =>
      makeDbRow({ id: `uuid-${i}`, pipeline: p }),
    );
    const { client } = buildChain([{ data: rows, error: null }]);
    const result = await getRecentPipelineHealth({
      client: client as unknown as SupabaseClient,
    });
    expect(result).toHaveLength(cases.length);
    cases.forEach((p, i) => {
      expect(result[i].pipeline).toBe(p);
    });
  });

  it("known statuses — all 3 (success/warning/failed) pass validation", async () => {
    const cases = ["success", "warning", "failed"];
    const rows = cases.map((s, i) =>
      makeDbRow({ id: `uuid-${i}`, status: s }),
    );
    const { client } = buildChain([{ data: rows, error: null }]);
    const result = await getRecentPipelineHealth({
      client: client as unknown as SupabaseClient,
    });
    expect(result).toHaveLength(cases.length);
    cases.forEach((s, i) => {
      expect(result[i].status).toBe(s);
    });
  });

  it("server-side cutoff filter — windowDays applied via .gte('started_at', cutoff)", async () => {
    const { client, chain } = buildChain([{ data: [], error: null }]);
    const refNow = new Date("2026-05-28T00:00:00Z");
    await getRecentPipelineHealth({
      client: client as unknown as SupabaseClient,
      refNow,
      windowDays: 7,
    });
    expect(chain.gte).toHaveBeenCalledTimes(1);
    const [col, val] = chain.gte.mock.calls[0];
    expect(col).toBe("started_at");
    // 7 days = 168h before refNow → 2026-05-21T00:00:00Z
    expect(val).toBe("2026-05-21T00:00:00.000Z");
  });

  it("ordering — started_at ASC + id ASC tiebreak (Step 2.3 정합)", async () => {
    const { client, chain } = buildChain([{ data: [], error: null }]);
    await getRecentPipelineHealth({
      client: client as unknown as SupabaseClient,
    });
    expect(chain.order).toHaveBeenCalledTimes(2);
    expect(chain.order).toHaveBeenNthCalledWith(1, "started_at", {
      ascending: true,
    });
    expect(chain.order).toHaveBeenNthCalledWith(2, "id", { ascending: true });
  });

  it("DI seam — options.client override → createClient short-circuit", async () => {
    const { client } = buildChain([{ data: [], error: null }]);
    await getRecentPipelineHealth({
      client: client as unknown as SupabaseClient,
    });
    const serverModule = await import("@/lib/supabase/server");
    expect(serverModule.createClient).not.toHaveBeenCalled();
  });

  it("PostgREST numeric string coerce — latency_ms='1234' parses correctly", async () => {
    const dbRow = makeDbRow({ latency_ms: "1234" });
    const { client } = buildChain([{ data: [dbRow], error: null }]);
    const result = await getRecentPipelineHealth({
      client: client as unknown as SupabaseClient,
    });
    expect(result[0].latencyMs).toBe(1234);
  });
});
