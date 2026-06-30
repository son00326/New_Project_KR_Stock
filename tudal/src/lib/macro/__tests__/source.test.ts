import { describe, it, expect, vi, afterEach } from "vitest";
import type { MarketVerdict } from "@/types/macro";
import type { MacroContextSource } from "@/lib/macro/context";

// flag-off 시 FRED 경로(buildFredMacroSource → fetch)가 호출되지 않음을 검증하기 위해
//   fred-adapter를 mock한다. source.ts는 이 모듈의 buildFredMacroSource를 import해 호출.
const buildFredMacroSourceMock = vi.fn<() => Promise<MacroContextSource | null>>();
vi.mock("@/lib/macro/fred-adapter", () => ({
  buildFredMacroSource: () => buildFredMacroSourceMock(),
}));

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
  buildFredMacroSourceMock.mockReset();
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

describe("getMacroContextString — flag + stale fail-safe (async)", () => {
  it("returns '' when flag off (dormant default) — no fetch/source call", async () => {
    vi.stubEnv("MACRO_CONTEXT_ENABLED", "");
    // opts.source 미주입 → flag on이면 getMacroContextSource()→buildFredMacroSource()를 탔을 것.
    //   flag off는 isMacroContextEnabled() 첫줄 return이므로 FRED 경로(fetch) 호출 0.
    buildFredMacroSourceMock.mockResolvedValue(sourceWithAsOf("2026-04-19T00:00:00Z"));
    expect(await getMacroContextString({ now: NOW })).toBe("");
    expect(buildFredMacroSourceMock).not.toHaveBeenCalled();
  });

  it("returns rendered context with disclaimers when flag on + fresh", async () => {
    vi.stubEnv("MACRO_CONTEXT_ENABLED", "true");
    const s = await getMacroContextString({
      now: NOW,
      maxStaleDays: 7,
      source: sourceWithAsOf("2026-04-18T00:00:00Z"), // 2 days old
    });
    expect(s).toContain("예측 아님");
    expect(s).toContain("Tier0 스크리닝 팩터 아님");
  });

  it("returns '' when flag on but source is stale (> maxStaleDays)", async () => {
    vi.stubEnv("MACRO_CONTEXT_ENABLED", "true");
    const s = await getMacroContextString({
      now: NOW,
      maxStaleDays: 7,
      source: sourceWithAsOf("2026-04-01T00:00:00Z"), // 19 days old
    });
    expect(s).toBe("");
  });

  it("treats exactly maxStaleDays as fresh (boundary)", async () => {
    vi.stubEnv("MACRO_CONTEXT_ENABLED", "true");
    const s = await getMacroContextString({
      now: NOW,
      maxStaleDays: 7,
      source: sourceWithAsOf("2026-04-13T00:00:00Z"), // exactly 7 days
    });
    expect(s).not.toBe("");
  });

  it("parses non-Z ISO asOf and respects injected now at the stale boundary", async () => {
    vi.stubEnv("MACRO_CONTEXT_ENABLED", "true");
    const boundaryMs = Date.parse("2026-04-18T10:00:00");
    expect(
      await getMacroContextString({
        now: new Date(boundaryMs),
        maxStaleDays: 7,
        source: sourceWithAsOf("2026-04-11T10:00:00"),
      }),
    ).not.toBe("");
    expect(
      await getMacroContextString({
        now: new Date(boundaryMs + 1),
        maxStaleDays: 7,
        source: sourceWithAsOf("2026-04-11T10:00:00"),
      }),
    ).toBe("");
  });

  it("returns '' when source asOf cannot be parsed", async () => {
    vi.stubEnv("MACRO_CONTEXT_ENABLED", "true");
    expect(
      await getMacroContextString({
        now: NOW,
        maxStaleDays: 7,
        source: sourceWithAsOf("not-a-date"),
      }),
    ).toBe("");
  });

  it("flag on + injected source==null → '' (fail-safe null-guard)", async () => {
    vi.stubEnv("MACRO_CONTEXT_ENABLED", "true");
    // opts.source 미주입 + FRED_API_KEY 부재 → getMacroContextSource() null → "".
    delete process.env.FRED_API_KEY;
    buildFredMacroSourceMock.mockResolvedValue(null);
    expect(await getMacroContextString({ now: NOW, maxStaleDays: 7 })).toBe("");
  });
});

describe("getMacroContextSource (FRED seam, async)", () => {
  it("returns null when buildFredMacroSource yields null (fail-safe, no throw)", async () => {
    // FRED_API_KEY 부재 시 buildFredMacroSource는 null을 돌려준다(어댑터 단위 테스트가 보증).
    //   seam은 그 null을 그대로 통과시킨다.
    delete process.env.FRED_API_KEY;
    buildFredMacroSourceMock.mockResolvedValue(null);
    const src = await getMacroContextSource();
    expect(src).toBeNull();
    expect(buildFredMacroSourceMock).toHaveBeenCalledTimes(1);
  });

  it("buildFredMacroSource throw → seam이 흡수해 null 반환 (throw 0)", async () => {
    buildFredMacroSourceMock.mockRejectedValue(new Error("fred_fetch_failed:500:DGS10"));
    const src = await getMacroContextSource();
    expect(src).toBeNull();
  });
});
