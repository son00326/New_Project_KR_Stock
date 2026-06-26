import { describe, it, expect, vi, afterEach } from "vitest";
import type { MarketVerdict } from "@/types/macro";
import type { MacroContextSource } from "@/lib/macro/context";
import {
  getMacroContextSource,
  isMacroContextEnabled,
  getMacroContextString,
} from "@/lib/macro/source";

const NOW = new Date("2026-04-20T00:00:00Z");

function sourceWithAsOf(asOf: string): MacroContextSource {
  const verdict: MarketVerdict = {
    overallSignal: "bullish",
    score: 60,
    summary: "테스트 요약.",
    details: [{ category: "금리", signal: "bullish", reason: "인하." }],
    updatedAt: asOf,
  };
  return { indicators: [], verdict, source: "test" };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isMacroContextEnabled", () => {
  it("is false unless MACRO_CONTEXT_ENABLED === 'true'", () => {
    vi.stubEnv("MACRO_CONTEXT_ENABLED", "");
    expect(isMacroContextEnabled()).toBe(false);
    vi.stubEnv("MACRO_CONTEXT_ENABLED", "1");
    expect(isMacroContextEnabled()).toBe(false);
    vi.stubEnv("MACRO_CONTEXT_ENABLED", "true");
    expect(isMacroContextEnabled()).toBe(true);
  });
});

describe("getMacroContextString — flag + stale fail-safe", () => {
  it("returns '' when flag off (dormant default)", () => {
    vi.stubEnv("MACRO_CONTEXT_ENABLED", "");
    expect(
      getMacroContextString({ now: NOW, source: sourceWithAsOf("2026-04-19T00:00:00Z") }),
    ).toBe("");
  });

  it("returns rendered context with disclaimers when flag on + fresh", () => {
    vi.stubEnv("MACRO_CONTEXT_ENABLED", "true");
    const s = getMacroContextString({
      now: NOW,
      maxStaleDays: 7,
      source: sourceWithAsOf("2026-04-18T00:00:00Z"), // 2 days old
    });
    expect(s).toContain("예측 아님");
    expect(s).toContain("Tier0 스크리닝 팩터 아님");
  });

  it("returns '' when flag on but source is stale (> maxStaleDays)", () => {
    vi.stubEnv("MACRO_CONTEXT_ENABLED", "true");
    const s = getMacroContextString({
      now: NOW,
      maxStaleDays: 7,
      source: sourceWithAsOf("2026-04-01T00:00:00Z"), // 19 days old
    });
    expect(s).toBe("");
  });

  it("treats exactly maxStaleDays as fresh (boundary)", () => {
    vi.stubEnv("MACRO_CONTEXT_ENABLED", "true");
    const s = getMacroContextString({
      now: NOW,
      maxStaleDays: 7,
      source: sourceWithAsOf("2026-04-13T00:00:00Z"), // exactly 7 days
    });
    expect(s).not.toBe("");
  });

  it("parses non-Z ISO asOf and respects injected now at the stale boundary", () => {
    vi.stubEnv("MACRO_CONTEXT_ENABLED", "true");
    const boundaryMs = Date.parse("2026-04-18T10:00:00");
    expect(
      getMacroContextString({
        now: new Date(boundaryMs),
        maxStaleDays: 7,
        source: sourceWithAsOf("2026-04-11T10:00:00"),
      }),
    ).not.toBe("");
    expect(
      getMacroContextString({
        now: new Date(boundaryMs + 1),
        maxStaleDays: 7,
        source: sourceWithAsOf("2026-04-11T10:00:00"),
      }),
    ).toBe("");
  });

  it("returns '' when source asOf cannot be parsed", () => {
    vi.stubEnv("MACRO_CONTEXT_ENABLED", "true");
    expect(
      getMacroContextString({
        now: NOW,
        maxStaleDays: 7,
        source: sourceWithAsOf("not-a-date"),
      }),
    ).toBe("");
  });
});

describe("getMacroContextSource (default mock seam)", () => {
  it("returns a usable indicators + verdict source", () => {
    const src = getMacroContextSource();
    expect(Array.isArray(src.indicators)).toBe(true);
    expect(src.indicators.length).toBeGreaterThan(0);
    expect(src.verdict.overallSignal).toBeTruthy();
    expect(src.source).toBe("mock");
  });
});
