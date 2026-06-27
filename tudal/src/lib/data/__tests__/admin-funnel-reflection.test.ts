import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  decideFunnelReflection,
  getFunnelReflectionProposals,
  insertFunnelReflectionProposal,
} from "@/lib/data/admin-funnel-reflection";
import type { FunnelReflectionOutput } from "@/lib/reflection/funnel-reflection";

const mocks = vi.hoisted(() => ({ from: vi.fn(), getUser: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: mocks.from,
    auth: { getUser: mocks.getUser },
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
});

const proposal: FunnelReflectionOutput = {
  periodKey: "2026-06",
  championConfig: { trend: 0.5 },
  challengerConfig: { trend: 0.55 },
  rationale: "diagnostic · 자동 적용 금지 · 예측 아님 · forward-validate",
  evidence: { pricedCount: 30, factorReturnRankCorr: { trend: 0.4 } },
};

describe("insertFunnelReflectionProposal", () => {
  it("upserts with reflection_kind retro + status proposed + onConflict period_key", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    mocks.from.mockReturnValue({ upsert });
    await insertFunnelReflectionProposal(proposal);
    expect(mocks.from).toHaveBeenCalledWith("tier0_funnel_reflection");
    const [payload, opts] = upsert.mock.calls[0];
    expect(payload.reflection_kind).toBe("funnel_weight_retro");
    expect(payload.status).toBe("proposed");
    expect(payload.period_key).toBe("2026-06");
    expect(payload.challenger_config).toEqual({ trend: 0.55 });
    expect(opts).toEqual({ onConflict: "period_key" });
  });

  it("throws wrapped error on supabase error", async () => {
    mocks.from.mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: { code: "23505" } }),
    });
    await expect(insertFunnelReflectionProposal(proposal)).rejects.toThrow(
      /funnel_reflection_insert_failed/,
    );
  });
});

describe("getFunnelReflectionProposals", () => {
  function chain(result: { data: unknown; error: unknown }) {
    const c: Record<string, unknown> = {};
    c.select = vi.fn(() => c);
    c.order = vi.fn(() => c);
    c.limit = vi.fn(() => c);
    c.then = (f: (v: unknown) => unknown) => Promise.resolve(result).then(f);
    return c;
  }

  it("maps rows", async () => {
    mocks.from.mockReturnValue(
      chain({
        data: [
          {
            id: "r1",
            period_key: "2026-06",
            created_at: "2026-06-30T00:00:00Z",
            champion_config: { trend: 0.5 },
            challenger_config: { trend: 0.55 },
            rationale: "x",
            evidence: {},
            status: "proposed",
          },
        ],
        error: null,
      }),
    );
    const out = await getFunnelReflectionProposals({ limit: 50 });
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe("proposed");
    expect(out[0].challengerConfig).toEqual({ trend: 0.55 });
  });

  it("throws on supabase error", async () => {
    mocks.from.mockReturnValue(chain({ data: null, error: { code: "PGRST301" } }));
    await expect(getFunnelReflectionProposals()).rejects.toThrow(
      /funnel_reflection_select_failed/,
    );
  });
});

describe("decideFunnelReflection (record-only, no auto-apply)", () => {
  function updateChain(result: { data: unknown; error: unknown }) {
    const c: Record<string, unknown> = {};
    c.update = vi.fn(() => c);
    c.eq = vi.fn(() => c);
    c.select = vi.fn(async () => result);
    return c;
  }

  it("rejects invalid decision", async () => {
    const res = await decideFunnelReflection("r1", "applied" as never);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe("invalid_decision");
  });

  it("rejects empty id", async () => {
    const res = await decideFunnelReflection("", "approved");
    expect(res.success).toBe(false);
  });

  it("updates status only (proposed → approved), gated on status=proposed", async () => {
    const c = updateChain({ data: [{ id: "r1" }], error: null });
    mocks.from.mockReturnValue(c);
    const res = await decideFunnelReflection("r1", "approved");
    expect(res.success).toBe(true);
    const payload = (c.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(payload.status).toBe("approved");
    expect(payload.decided_by).toBe("admin-1");
    // record-only: payload는 status/decided_* 만 — funnel config 등 미포함.
    expect(Object.keys(payload).sort()).toEqual(
      ["decided_at", "decided_by", "status"].sort(),
    );
    // status=proposed 전이 가드.
    expect((c.eq as ReturnType<typeof vi.fn>).mock.calls).toContainEqual([
      "status",
      "proposed",
    ]);
  });

  it("not_found when no row transitioned (already decided)", async () => {
    mocks.from.mockReturnValue(updateChain({ data: [], error: null }));
    const res = await decideFunnelReflection("r1", "approved");
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe("funnel_reflection_not_found_or_decided");
  });

  it("decide_failed on supabase error", async () => {
    mocks.from.mockReturnValue(updateChain({ data: null, error: { code: "X" } }));
    const res = await decideFunnelReflection("r1", "rejected");
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe("funnel_reflection_decide_failed");
  });
});
