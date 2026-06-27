import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getRiskDebateForMonth,
  insertRiskDebateAssessment,
} from "@/lib/data/admin-risk-debate";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: mocks.from })),
}));

beforeEach(() => vi.clearAllMocks());

describe("insertRiskDebateAssessment", () => {
  it("upserts with onConflict month + final_verdict + votes (is_advisory omitted = default true)", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    mocks.from.mockReturnValue({ upsert });
    await insertRiskDebateAssessment({
      month: "2026-06-01",
      finalVerdict: "conditional",
      votes: [{ stance: "aggressive", verdictVote: "pass", concernLevel: "low", keyRisks: [] }],
      summary: "s",
    });
    expect(mocks.from).toHaveBeenCalledWith("risk_debate_assessment");
    const [payload, opts] = upsert.mock.calls[0];
    expect(payload.month).toBe("2026-06-01");
    expect(payload.final_verdict).toBe("conditional");
    expect(payload).not.toHaveProperty("is_advisory"); // default true (CHECK 박제), 클라이언트 미지정.
    expect(opts).toEqual({ onConflict: "month" });
  });

  it("throws wrapped error", async () => {
    mocks.from.mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: { code: "23505" } }),
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
