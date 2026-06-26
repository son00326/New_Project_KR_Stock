import { describe, it, expect } from "vitest";
import type { MacroIndicator, MarketVerdict } from "@/types/macro";
import {
  buildMacroContext,
  renderMacroContextString,
  EMPTY_MACRO_CONTEXT,
  type MacroContext,
} from "@/lib/macro/context";

const VERDICT: MarketVerdict = {
  overallSignal: "bullish",
  score: 62,
  summary:
    "현재 시장은 '조심스러운 낙관' 구간입니다.\n  CPI/PPI 둔화로 금리 인하 기대가 높아지고 있습니다.",
  details: [
    { category: "물가/인플레이션", signal: "bullish", reason: "CPI 둔화." },
    { category: "금리 환경", signal: "bullish", reason: "인하 진행." },
    { category: "시장 심리", signal: "bearish", reason: "VIX 상승." },
    { category: "원자재/환율", signal: "bullish", reason: "유가 하락." },
    { category: "이벤트 리스크", signal: "neutral", reason: "FOMC 대기." },
    { category: "여섯번째", signal: "neutral", reason: "초과 항목." },
  ],
  updatedAt: "2026-04-11T10:00:00",
};

const INDICATORS: MacroIndicator[] = [
  {
    id: "fed-rate",
    name: "Fed Funds Rate",
    nameKo: "미국 기준금리",
    category: "rates",
    value: 4.75,
    previousValue: 5.0,
    change: -0.25,
    changePercent: -5,
    unit: "%",
    updatedAt: "2026-04-12T03:00:00", // newer than verdict
    signal: "bullish",
    description: "연준 인하.",
  },
];

describe("buildMacroContext (pure distill)", () => {
  it("maps regime/score from verdict", () => {
    const ctx = buildMacroContext({ indicators: INDICATORS, verdict: VERDICT, source: "mock" });
    expect(ctx.regime).toBe("bullish");
    expect(ctx.score).toBe(62);
    expect(ctx.source).toBe("mock");
  });

  it("collapses headline to a single line", () => {
    const ctx = buildMacroContext({ indicators: INDICATORS, verdict: VERDICT });
    expect(ctx.headline).not.toContain("\n");
    expect(ctx.headline.length).toBeGreaterThan(0);
  });

  it("caps drivers at 5 from verdict.details", () => {
    const ctx = buildMacroContext({ indicators: INDICATORS, verdict: VERDICT });
    expect(ctx.drivers).toHaveLength(5);
    expect(ctx.drivers[0]).toEqual({
      category: "물가/인플레이션",
      signal: "bullish",
      reason: "CPI 둔화.",
    });
  });

  it("asOf = max(verdict.updatedAt, latest indicator.updatedAt)", () => {
    const ctx = buildMacroContext({ indicators: INDICATORS, verdict: VERDICT });
    expect(ctx.asOf).toBe("2026-04-12T03:00:00"); // indicator newer
  });

  it("asOf falls back to verdict when no indicators", () => {
    const ctx = buildMacroContext({ indicators: [], verdict: VERDICT });
    expect(ctx.asOf).toBe("2026-04-11T10:00:00");
  });

  it("uses the latest valid indicator asOf when verdict.updatedAt is invalid", () => {
    const ctx = buildMacroContext({
      indicators: INDICATORS,
      verdict: { ...VERDICT, updatedAt: "not-a-date" },
    });
    expect(ctx.asOf).toBe("2026-04-12T03:00:00");
  });

  it("trims headline to 160 characters", () => {
    const ctx = buildMacroContext({
      indicators: [],
      verdict: { ...VERDICT, summary: "가".repeat(180) },
    });
    expect(ctx.headline.length).toBeLessThanOrEqual(160);
    expect(ctx.headline.endsWith("…")).toBe(true);
  });

  it("is deterministic (same input → same output)", () => {
    const a = buildMacroContext({ indicators: INDICATORS, verdict: VERDICT, source: "mock" });
    const b = buildMacroContext({ indicators: INDICATORS, verdict: VERDICT, source: "mock" });
    expect(a).toEqual(b);
  });
});

describe("renderMacroContextString (forward-validate framing)", () => {
  const ctx: MacroContext = buildMacroContext({
    indicators: INDICATORS,
    verdict: VERDICT,
    source: "mock",
  });

  it("includes the asOf date", () => {
    expect(renderMacroContextString(ctx)).toContain("2026-04-12");
  });

  it("includes the forward-validate disclaimers (가드레일)", () => {
    const s = renderMacroContextString(ctx);
    expect(s).toContain("예측 아님");
    expect(s).toContain("Tier0 스크리닝 팩터 아님");
  });

  it("does not render upward/downward prediction wording", () => {
    const s = renderMacroContextString(ctx);
    expect(s).not.toMatch(/상승 예측|하락 예측|상승할|하락할|목표가|매수 신호|매도 신호/);
  });

  it("renders a Korean regime label, not the raw enum", () => {
    const s = renderMacroContextString(ctx);
    expect(s).toContain("강세");
    expect(s).not.toContain("bullish");
  });

  it("is deterministic", () => {
    expect(renderMacroContextString(ctx)).toBe(renderMacroContextString(ctx));
  });

  it("renders empty-driver context without throwing", () => {
    const noDrivers = buildMacroContext({
      indicators: [],
      verdict: { ...VERDICT, details: [] },
    });
    expect(() => renderMacroContextString(noDrivers)).not.toThrow();
  });
});

describe("guardrails", () => {
  it("EMPTY_MACRO_CONTEXT is an empty string (no-op default)", () => {
    expect(EMPTY_MACRO_CONTEXT).toBe("");
  });
});
