// W3b-3 (T1) — format-portfolio pure 디스플레이 헬퍼.
import { describe, it, expect } from "vitest";
import { formatProposalWeightPct, formatTimeframeLabel } from "../format-portfolio";

describe("formatProposalWeightPct", () => {
  it("비중(0~1) → 소수1자리 % 문자열", () => {
    expect(formatProposalWeightPct(0.3)).toBe("30.0%");
    expect(formatProposalWeightPct(0.055)).toBe("5.5%");
    expect(formatProposalWeightPct(0)).toBe("0.0%");
    expect(formatProposalWeightPct(1)).toBe("100.0%");
  });
  it("반올림 1자리", () => {
    expect(formatProposalWeightPct(0.12345)).toBe("12.3%");
  });
});

describe("formatTimeframeLabel", () => {
  it("short/mid/long → 한국어", () => {
    expect(formatTimeframeLabel("short")).toBe("단기");
    expect(formatTimeframeLabel("mid")).toBe("중기");
    expect(formatTimeframeLabel("long")).toBe("장기");
  });
});
