import { afterEach, describe, expect, it, vi } from "vitest";
import { runFunnelReflectionJob } from "@/lib/reflection/funnel-reflection-job";
import type { FunnelReflectionInput } from "@/lib/reflection/funnel-reflection";

function input(): FunnelReflectionInput {
  return {
    periodKey: "2026-06",
    championConfig: { trend: 0.5 },
    candidates: [
      { ticker: "001", factorExposures: { trend: 1 } },
      { ticker: "002", factorExposures: { trend: 2 } },
    ],
    realizedReturns: new Map([
      ["001", 1],
      ["002", 9],
    ]),
  };
}

afterEach(() => vi.unstubAllEnvs());

describe("runFunnelReflectionJob (shadow-first gate)", () => {
  it("flag off → skip, no insert (mutation 0)", async () => {
    vi.stubEnv("FUNNEL_REFLECTION_ENABLED", "");
    const insert = vi.fn();
    const res = await runFunnelReflectionJob(input(), { insert });
    expect(res.skipped).toBe("flag_off");
    expect(insert).not.toHaveBeenCalled();
  });

  it("flag on → builds proposal + inserts", async () => {
    vi.stubEnv("FUNNEL_REFLECTION_ENABLED", "true");
    const insert = vi.fn().mockResolvedValue(undefined);
    const res = await runFunnelReflectionJob(input(), { insert });
    expect(res.skipped).toBeUndefined();
    expect(res.pricedCount).toBe(2);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0][0].periodKey).toBe("2026-06");
  });

  it("flag on but truthy non-'true' stays off (=== pin)", async () => {
    vi.stubEnv("FUNNEL_REFLECTION_ENABLED", "yes");
    const insert = vi.fn();
    const res = await runFunnelReflectionJob(input(), { insert });
    expect(res.skipped).toBe("flag_off");
    expect(insert).not.toHaveBeenCalled();
  });
});
