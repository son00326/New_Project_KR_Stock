import { afterEach, describe, expect, it, vi } from "vitest";
import { runRiskDebate } from "@/lib/risk/risk-debate-orchestrator";
import type { RiskPortfolioInput } from "@/lib/risk/risk-debate";

function portfolio(): RiskPortfolioInput {
  return {
    month: "2026-06-01",
    holdings: [{ ticker: "005930", sector: "반도체", weight: 0.1 }],
    cashWeight: 0.15,
    bucketMix: { short: 10, mid: 10, long: 10 },
  };
}

afterEach(() => vi.unstubAllEnvs());

describe("runRiskDebate (shadow-first advisory gate)", () => {
  it("flag off → skip, no LLM call, no insert (AI 0·mutation 0)", async () => {
    vi.stubEnv("RISK_DEBATE_ENABLED", "");
    const callRiskDebator = vi.fn();
    const insert = vi.fn();
    const res = await runRiskDebate(portfolio(), { callRiskDebator, insert });
    expect(res.skipped).toBe("flag_off");
    expect(callRiskDebator).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("flag on → 3 stance LLM calls + aggregated verdict + insert(advisory)", async () => {
    vi.stubEnv("RISK_DEBATE_ENABLED", "true");
    const callRiskDebator = vi
      .fn()
      .mockResolvedValue({ concern_level: "low", key_risks: [], verdict_vote: "pass" });
    const insert = vi.fn().mockResolvedValue(undefined);
    const res = await runRiskDebate(portfolio(), { callRiskDebator, insert });
    expect(callRiskDebator).toHaveBeenCalledTimes(3); // aggressive/conservative/neutral
    expect(res.voteCount).toBe(3);
    expect(res.finalVerdict).toBe("pass");
    expect(insert).toHaveBeenCalledTimes(1);
    const payload = insert.mock.calls[0][0];
    expect(payload.month).toBe("2026-06-01");
    expect(payload.finalVerdict).toBe("pass");
    expect(payload.votes).toHaveLength(3);
  });

  it("LLM failure on a stance → conservative fallback(conditional), still inserts (advisory non-blocking)", async () => {
    vi.stubEnv("RISK_DEBATE_ENABLED", "true");
    const callRiskDebator = vi
      .fn()
      .mockResolvedValueOnce({ concern_level: "low", verdict_vote: "pass" })
      .mockRejectedValueOnce(new Error("LLM 5xx"))
      .mockResolvedValueOnce({ concern_level: "low", verdict_vote: "pass" });
    const insert = vi.fn().mockResolvedValue(undefined);
    const res = await runRiskDebate(portfolio(), { callRiskDebator, insert });
    expect(res.voteCount).toBe(3); // failed stance → fallback vote, still counted
    // 2 pass + 1 conditional(fallback) → pass (majority pass, 0 reject)
    expect(res.finalVerdict).toBe("pass");
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("truthy non-'true' flag stays off (=== pin)", async () => {
    vi.stubEnv("RISK_DEBATE_ENABLED", "1");
    const res = await runRiskDebate(portfolio(), {
      callRiskDebator: vi.fn(),
      insert: vi.fn(),
    });
    expect(res.skipped).toBe("flag_off");
  });
});
