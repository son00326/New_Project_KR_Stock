import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getRiskDebateForMonth,
  hasRiskDebateAssessment,
  insertRiskDebateAssessment,
} from "@/lib/data/admin-risk-debate";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: mocks.from })),
}));

beforeEach(() => vi.clearAllMocks());

describe("insertRiskDebateAssessment", () => {
  it("inserts month + final_verdict + votes without overwriting an existing advisory", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    mocks.from.mockReturnValue({ insert });
    await insertRiskDebateAssessment({
      month: "2026-06-01",
      finalVerdict: "conditional",
      votes: [{ stance: "aggressive", verdictVote: "pass", concernLevel: "low", keyRisks: [] }],
      summary: "s",
    });
    expect(mocks.from).toHaveBeenCalledWith("risk_debate_assessment");
    const [payload] = insert.mock.calls[0];
    expect(payload.month).toBe("2026-06-01");
    expect(payload.final_verdict).toBe("conditional");
    expect(payload).not.toHaveProperty("is_advisory"); // default true (CHECK 박제), 클라이언트 미지정.
  });

  it("treats duplicate month as idempotent no-op (does not overwrite prior cost-capped result)", async () => {
    mocks.from.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: { code: "23505" } }),
    });
    await expect(
      insertRiskDebateAssessment({ month: "2026-06-01", finalVerdict: "pass", votes: [], summary: "" }),
    ).resolves.toBeUndefined();
  });

  it("throws wrapped non-duplicate error", async () => {
    mocks.from.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: { code: "42501" } }),
    });
    await expect(
      insertRiskDebateAssessment({ month: "2026-06-01", finalVerdict: "pass", votes: [], summary: "" }),
    ).rejects.toThrow(/risk_debate_insert_failed/);
  });
});

describe("getRiskDebateForMonth", () => {
  function chain(result: { data: unknown; error: unknown }) {
    const c: Record<string, unknown> = {};
    c.select = vi.fn(() => c);
    c.eq = vi.fn(() => c);
    c.maybeSingle = vi.fn(async () => result);
    return c;
  }

  it("maps row", async () => {
    mocks.from.mockReturnValue(
      chain({
        data: {
          id: "r1",
          month: "2026-06-01",
          created_at: "2026-06-12T00:00:00Z",
          final_verdict: "reject",
          votes: [{ stance: "conservative", verdictVote: "reject", concernLevel: "high", keyRisks: ["x"] }],
          summary: "s",
          is_advisory: true,
        },
        error: null,
      }),
    );
    const out = await getRiskDebateForMonth("2026-06-01");
    expect(out?.finalVerdict).toBe("reject");
    expect(out?.votes).toHaveLength(1);
  });

  it("fail-soft null on error (Accept page 비차단)", async () => {
    mocks.from.mockReturnValue(chain({ data: null, error: { code: "PGRST301" } }));
    expect(await getRiskDebateForMonth("2026-06-01")).toBeNull();
  });

  it("fail-soft null when absent", async () => {
    mocks.from.mockReturnValue(chain({ data: null, error: null }));
    expect(await getRiskDebateForMonth("2026-06-01")).toBeNull();
  });
});

describe("hasRiskDebateAssessment", () => {
  function chain(result: { data: unknown; error: unknown }) {
    const c: Record<string, unknown> = {};
    c.select = vi.fn(() => c);
    c.eq = vi.fn(() => c);
    c.limit = vi.fn(() => c);
    c.maybeSingle = vi.fn(async () => result);
    return c;
  }

  it("returns true when a month row exists", async () => {
    mocks.from.mockReturnValue(chain({ data: { id: "r1" }, error: null }));
    await expect(hasRiskDebateAssessment("2026-06-01")).resolves.toBe(true);
  });

  it("returns false when absent", async () => {
    mocks.from.mockReturnValue(chain({ data: null, error: null }));
    await expect(hasRiskDebateAssessment("2026-06-01")).resolves.toBe(false);
  });

  it("throws on select error so caller skips before AI", async () => {
    mocks.from.mockReturnValue(chain({ data: null, error: { code: "42P01" } }));
    await expect(hasRiskDebateAssessment("2026-06-01")).rejects.toThrow(
      "risk_debate_select_failed:42P01",
    );
  });
});
