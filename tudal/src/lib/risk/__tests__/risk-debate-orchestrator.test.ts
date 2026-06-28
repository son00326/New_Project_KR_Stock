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

function deps() {
  return {
    hasExistingAssessment: vi.fn().mockResolvedValue(false),
    preflightCost: vi.fn().mockResolvedValue(true),
    callRiskDebator: vi
      .fn()
      .mockResolvedValue({ concern_level: "low", key_risks: [], verdict_vote: "pass" }),
    insert: vi.fn().mockResolvedValue(undefined),
  };
}

afterEach(() => vi.unstubAllEnvs());

describe("runRiskDebate (shadow-first advisory gate)", () => {
  it("flag off → skip, no LLM call, no insert (AI 0·mutation 0)", async () => {
    vi.stubEnv("RISK_DEBATE_ENABLED", "");
    const d = deps();
    const res = await runRiskDebate(portfolio(), d);
    expect(res.skipped).toBe("flag_off");
    expect(d.hasExistingAssessment).not.toHaveBeenCalled();
    expect(d.preflightCost).not.toHaveBeenCalled();
    expect(d.callRiskDebator).not.toHaveBeenCalled();
    expect(d.insert).not.toHaveBeenCalled();
  });

  it("existing month assessment → skip before preflight/LLM/insert (cost cap)", async () => {
    vi.stubEnv("RISK_DEBATE_ENABLED", "true");
    const d = deps();
    d.hasExistingAssessment.mockResolvedValue(true);
    const res = await runRiskDebate(portfolio(), d);
    expect(res.skipped).toBe("already_assessed");
    expect(d.preflightCost).not.toHaveBeenCalled();
    expect(d.callRiskDebator).not.toHaveBeenCalled();
    expect(d.insert).not.toHaveBeenCalled();
  });

  it("cost preflight false → fail-closed before LLM/insert", async () => {
    vi.stubEnv("RISK_DEBATE_ENABLED", "true");
    const d = deps();
    d.preflightCost.mockResolvedValue(false);
    const res = await runRiskDebate(portfolio(), d);
    expect(res.skipped).toBe("cost_gate_failed");
    expect(d.callRiskDebator).not.toHaveBeenCalled();
    expect(d.insert).not.toHaveBeenCalled();
  });

  it("flag on → 3 stance LLM calls + aggregated verdict + insert(advisory)", async () => {
    vi.stubEnv("RISK_DEBATE_ENABLED", "true");
    const d = deps();
    const res = await runRiskDebate(portfolio(), d);
    expect(d.preflightCost).toHaveBeenCalledTimes(1);
    expect(d.callRiskDebator).toHaveBeenCalledTimes(3); // aggressive/conservative/neutral
    expect(res.voteCount).toBe(3);
    expect(res.finalVerdict).toBe("pass");
    expect(d.insert).toHaveBeenCalledTimes(1);
    const payload = d.insert.mock.calls[0][0];
    expect(payload.month).toBe("2026-06-01");
    expect(payload.finalVerdict).toBe("pass");
    expect(payload.votes).toHaveLength(3);
  });

  it("starts all stance calls before awaiting any single stance (parallel cost-bounded fanout)", async () => {
    vi.stubEnv("RISK_DEBATE_ENABLED", "true");
    const d = deps();
    let resolveAll: (value: unknown) => void = () => undefined;
    const pending = new Promise((resolve) => {
      resolveAll = resolve;
    });
    d.callRiskDebator.mockReturnValue(pending);
    const run = runRiskDebate(portfolio(), d);
    await new Promise((resolve) => setImmediate(resolve));
    expect(d.callRiskDebator).toHaveBeenCalledTimes(3);
    resolveAll({ concern_level: "low", verdict_vote: "pass" });
    await run;
  });

  it("LLM failure on a stance → failure evidence + forced conditional, still inserts (advisory non-blocking)", async () => {
    vi.stubEnv("RISK_DEBATE_ENABLED", "true");
    const d = deps();
    d.callRiskDebator
      .mockResolvedValueOnce({ concern_level: "low", verdict_vote: "pass" })
      .mockRejectedValueOnce(new Error("LLM 5xx"))
      .mockResolvedValueOnce({ concern_level: "low", verdict_vote: "pass" });
    const res = await runRiskDebate(portfolio(), d);
    expect(res.voteCount).toBe(3); // failed stance → fallback vote, still counted
    expect(res.finalVerdict).toBe("conditional");
    expect(d.insert).toHaveBeenCalledTimes(1);
    const payload = d.insert.mock.calls[0][0];
    expect(payload.finalVerdict).toBe("conditional");
    expect(payload.summary).toContain("conditional");
    expect(payload.votes[1].keyRisks[0]).toContain("LLM 호출 실패");
  });

  it("truthy non-'true' flag stays off (=== pin)", async () => {
    vi.stubEnv("RISK_DEBATE_ENABLED", "1");
    const res = await runRiskDebate(portfolio(), deps());
    expect(res.skipped).toBe("flag_off");
  });
});
