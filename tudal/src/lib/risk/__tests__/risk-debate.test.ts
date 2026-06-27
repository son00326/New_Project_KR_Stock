import { describe, expect, it } from "vitest";
import {
  aggregateRiskVerdict,
  buildRiskDebatePrompt,
  parseRiskJudgment,
  type RiskJudgment,
} from "@/lib/risk/risk-debate";

function j(stance: RiskJudgment["stance"], vote: RiskJudgment["verdictVote"]): RiskJudgment {
  return { stance, verdictVote: vote, concernLevel: "medium", keyRisks: [] };
}

describe("aggregateRiskVerdict (deterministic, advisory)", () => {
  it("2+ reject → reject", () => {
    expect(
      aggregateRiskVerdict([j("aggressive", "reject"), j("conservative", "reject"), j("neutral", "pass")]),
    ).toBe("reject");
  });

  it("majority pass + 0 reject → pass", () => {
    expect(
      aggregateRiskVerdict([j("aggressive", "pass"), j("conservative", "pass"), j("neutral", "conditional")]),
    ).toBe("pass");
  });

  it("2 pass + 1 reject → conditional (reject present blocks pass)", () => {
    expect(
      aggregateRiskVerdict([j("aggressive", "pass"), j("conservative", "pass"), j("neutral", "reject")]),
    ).toBe("conditional");
  });

  it("mixed conditional → conditional", () => {
    expect(
      aggregateRiskVerdict([j("aggressive", "conditional"), j("conservative", "pass"), j("neutral", "conditional")]),
    ).toBe("conditional");
  });

  it("all pass → pass", () => {
    expect(
      aggregateRiskVerdict([j("aggressive", "pass"), j("conservative", "pass"), j("neutral", "pass")]),
    ).toBe("pass");
  });

  it("empty → conditional (보수적)", () => {
    expect(aggregateRiskVerdict([])).toBe("conditional");
  });
});

describe("parseRiskJudgment", () => {
  it("parses valid LLM JSON", () => {
    const out = parseRiskJudgment("aggressive", {
      concern_level: "high",
      key_risks: ["섹터 집중", "유동성"],
      verdict_vote: "reject",
    });
    expect(out).toEqual({
      stance: "aggressive",
      concernLevel: "high",
      keyRisks: ["섹터 집중", "유동성"],
      verdictVote: "reject",
    });
  });

  it("invalid values → conservative fallback (high concern, conditional vote)", () => {
    const out = parseRiskJudgment("neutral", { concern_level: "x", verdict_vote: "block" });
    expect(out.concernLevel).toBe("high");
    expect(out.verdictVote).toBe("conditional");
    expect(out.keyRisks).toEqual([]);
  });

  it("non-object raw → fallback", () => {
    const out = parseRiskJudgment("conservative", null);
    expect(out.verdictVote).toBe("conditional");
    expect(out.concernLevel).toBe("high");
  });

  it("caps keyRisks at 5 + drops non-strings", () => {
    const out = parseRiskJudgment("neutral", {
      concern_level: "low",
      verdict_vote: "pass",
      key_risks: ["a", 1, "b", "c", "d", "e", "f"],
    });
    expect(out.keyRisks).toEqual(["a", "b", "c", "d", "e"]);
  });
});

describe("buildRiskDebatePrompt", () => {
  it("includes stance frame + portfolio composition + advisory note", () => {
    const p = buildRiskDebatePrompt("conservative", {
      month: "2026-06-01",
      holdings: [{ ticker: "005930", sector: "반도체", weight: 0.1 }],
      cashWeight: 0.15,
      bucketMix: { short: 10, mid: 10, long: 10 },
    });
    expect(p).toContain("보존적 관점");
    expect(p).toContain("005930");
    expect(p).toContain("advisory");
    expect(p).toContain("verdict_vote");
  });
});
