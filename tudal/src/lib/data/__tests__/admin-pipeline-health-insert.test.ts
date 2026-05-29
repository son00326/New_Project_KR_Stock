import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { insertPipelineHealth } from "@/lib/data/admin-pipeline-health-insert";

const createClientMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => createClientMock(),
}));

interface InsertTable {
  insert: ReturnType<typeof vi.fn>;
}

function buildInsertClient(): {
  client: SupabaseClient;
  from: ReturnType<typeof vi.fn>;
  table: InsertTable;
} {
  const table: InsertTable = {
    insert: vi.fn(async () => ({ error: null })),
  };
  const rawClient = {
    from: vi.fn(() => table),
  };
  return {
    client: rawClient as unknown as SupabaseClient,
    from: rawClient.from,
    table,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("insertPipelineHealth", () => {
  it("rejects invalid pipeline enum before insert", async () => {
    const { client, from } = buildInsertClient();

    await expect(
      insertPipelineHealth(
        {
          pipeline: "unknown" as never,
          status: "success",
        },
        { client },
      ),
    ).rejects.toThrow("pipeline_health_invalid_pipeline:unknown");
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects invalid status enum before insert", async () => {
    const { client, from } = buildInsertClient();

    await expect(
      insertPipelineHealth(
        {
          pipeline: "ai",
          status: "pending" as never,
        },
        { client },
      ),
    ).rejects.toThrow("pipeline_health_invalid_status:pending");
    expect(from).not.toHaveBeenCalled();
  });

  it("forwards snake_case insert payload through options.client", async () => {
    const { client, from, table } = buildInsertClient();

    await insertPipelineHealth(
      {
        runId: "11111111-1111-4111-8111-111111111111",
        pipeline: "ai",
        status: "failed",
        finishedAt: "2026-06-01T00:00:00.000Z",
        latencyMs: 123,
        error: "1 failed",
      },
      { client },
    );

    expect(createClientMock).not.toHaveBeenCalled();
    expect(from).toHaveBeenCalledWith("pipeline_health");
    expect(table.insert).toHaveBeenCalledWith({
      run_id: "11111111-1111-4111-8111-111111111111",
      pipeline: "ai",
      status: "failed",
      finished_at: "2026-06-01T00:00:00.000Z",
      latency_ms: 123,
      error: "1 failed",
    });
  });
});
