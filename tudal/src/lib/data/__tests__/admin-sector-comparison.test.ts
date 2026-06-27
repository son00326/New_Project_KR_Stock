import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getShadowArmTop,
  monthToPeriodKey,
} from "@/lib/data/admin-sector-comparison";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: mocks.rpc })),
}));

const validRow = {
  ticker: "005930",
  name: "삼성전자",
  sector: "반도체",
  bucket: "short",
  rank: 1,
  tier0_score: 88.5,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rpc.mockResolvedValue({ data: [validRow], error: null });
});

describe("monthToPeriodKey", () => {
  it("YYYY-MM-01 → YYYY-MM", () => {
    expect(monthToPeriodKey("2026-06-01")).toBe("2026-06");
  });
});

describe("getShadowArmTop", () => {
  it("calls RPC with arm/period/limit and maps all fields", async () => {
    const out = await getShadowArmTop("sector-soft-tilt", "2026-06", {
      limitPerBucket: 10,
    });
    expect(mocks.rpc).toHaveBeenCalledWith("get_tier0_shadow_arm_top", {
      p_arm: "sector-soft-tilt",
      p_period_key: "2026-06",
      p_limit_per_bucket: 10,
    });
    expect(out).toHaveLength(1);
    expect(out[0].ticker).toBe("005930");
    expect(out[0].name).toBe("삼성전자");
    expect(out[0].sector).toBe("반도체");
    expect(out[0].rank).toBe(1);
    expect(out[0].tier0Score).toBe(88.5);
    expect(out[0].bucket).toBe("short");
  });

  it("defaults limitPerBucket to 10 when omitted", async () => {
    await getShadowArmTop("sector-soft-tilt", "2026-06");
    expect(mocks.rpc).toHaveBeenCalledWith("get_tier0_shadow_arm_top", {
      p_arm: "sector-soft-tilt",
      p_period_key: "2026-06",
      p_limit_per_bucket: 10,
    });
  });

  it("fail-soft to [] on RPC error (menu empty, not throw)", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "admin_required" } });
    expect(await getShadowArmTop("sector-soft-tilt", "2026-06")).toEqual([]);
  });

  it("fail-soft to [] when data not an array", async () => {
    mocks.rpc.mockResolvedValue({ data: { not: "array" }, error: null });
    expect(await getShadowArmTop("sector-soft-tilt", "2026-06")).toEqual([]);
  });

  it("drops malformed rows (bad ticker / bucket / rank)", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        validRow,
        { ...validRow, ticker: "12345" }, // not 6-digit
        { ...validRow, bucket: "weekly" }, // invalid bucket
        { ...validRow, rank: "x" }, // non-numeric
      ],
      error: null,
    });
    const out = await getShadowArmTop("sector-soft-tilt", "2026-06");
    expect(out).toHaveLength(1);
  });

  it("null tier0_score preserved as null", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ ...validRow, tier0_score: null }],
      error: null,
    });
    const out = await getShadowArmTop("sector-soft-tilt", "2026-06");
    expect(out[0].tier0Score).toBeNull();
  });

  it("fail-soft to [] when client throws", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockRejectedValueOnce(new Error("no cookies"));
    expect(await getShadowArmTop("sector-soft-tilt", "2026-06")).toEqual([]);
  });
});
