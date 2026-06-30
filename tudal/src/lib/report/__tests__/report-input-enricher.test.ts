// PR-H scope 2 — report input enrich helper (placeholder → 실 DART/배지/Tier0).
// SoT spec: tasks/w99tzsvzw.output §2 + §5.1.
//
// 핵심 invariant:
//   - LLM 호출 0 (DART/Supabase SELECT만) = cost 0.
//   - mapAiScoreToVerdict 임계값(≥70 BUY / ≤30 SELL / null·else HOLD).
//   - toPromptBadge: short_list_30 5종(⚪ 포함) → prompt-valid 4종(⚪→🟡 fallback).
//   - financials 미캐시 graceful, corp/fin SELECT 에러는 throw 전파(silent degrade 방지).
//   - macroSummary는 S7b 전까지 항상 "근거 부족".

import { describe, expect, it, vi } from "vitest";
import type { ShortListItem } from "@/types/admin";
import {
  mapAiScoreToVerdict,
  toPromptBadge,
  formatTechnicalsSummary,
  formatSectorReference,
  deriveEnrichFromShortlist,
  enrichReportInput,
} from "../report-input-enricher";

function makeItem(overrides: Partial<ShortListItem> = {}): ShortListItem {
  return {
    id: "sl-1",
    month: "2026-04-01",
    ticker: "005930",
    name: "삼성전자",
    sector: "반도체",
    bucket: "short",
    rank: 1,
    compositeScore: 80,
    trendScore: 75,
    momentumScore: 70,
    volatilityScore: 30,
    divergencePct: 1.2,
    sparkline7d: [],
    signalLabel: "추세 상향",
    deltaStatus: "hold",
    deltaReason: "",
    summary3Line: "",
    suggestedWeight: 0.034,
    createdAt: "2026-04-01T00:00:00Z",
    consensusBadge: "🟢",
    aiScore: 82,
    aiCommentKr: null,
    winningTimeframe: "short",
    conviction: 70,
    ...overrides,
  };
}

describe("mapAiScoreToVerdict", () => {
  it("null/undefined → HOLD (보수적 default)", () => {
    expect(mapAiScoreToVerdict(null)).toBe("HOLD");
    expect(mapAiScoreToVerdict(undefined)).toBe("HOLD");
  });
  it(">= 70 → BUY (경계 포함)", () => {
    expect(mapAiScoreToVerdict(70)).toBe("BUY");
    expect(mapAiScoreToVerdict(85)).toBe("BUY");
  });
  it("<= 30 → SELL (경계 포함)", () => {
    expect(mapAiScoreToVerdict(30)).toBe("SELL");
    expect(mapAiScoreToVerdict(15)).toBe("SELL");
  });
  it("31~69 → HOLD", () => {
    expect(mapAiScoreToVerdict(50)).toBe("HOLD");
    expect(mapAiScoreToVerdict(69)).toBe("HOLD");
    expect(mapAiScoreToVerdict(31)).toBe("HOLD");
  });
});

describe("toPromptBadge", () => {
  it("null/undefined/⚪ → 🟡 fallback (prompt 계약은 ⚪ 불허)", () => {
    expect(toPromptBadge(null)).toBe("🟡");
    expect(toPromptBadge(undefined)).toBe("🟡");
    expect(toPromptBadge("⚪")).toBe("🟡");
  });
  it("🟢/🔵/🟣/🟡 그대로 통과", () => {
    expect(toPromptBadge("🟢")).toBe("🟢");
    expect(toPromptBadge("🔵")).toBe("🔵");
    expect(toPromptBadge("🟣")).toBe("🟣");
    expect(toPromptBadge("🟡")).toBe("🟡");
  });
});

describe("formatTechnicalsSummary", () => {
  it("Tier0 점수 1줄 요약 (composite/trend/momentum/volatility/signalLabel 포함)", () => {
    const summary = formatTechnicalsSummary(makeItem());
    expect(summary).toContain("80"); // composite
    expect(summary).toContain("75"); // trend
    expect(summary).toContain("70"); // momentum
    expect(summary).toContain("30"); // volatility
    expect(summary).toContain("추세 상향"); // signalLabel
  });
});

describe("formatSectorReference", () => {
  it("Level A 본문 보유 sector(바이오/반도체) → 1줄 ref (근거 부족 아님)", () => {
    expect(formatSectorReference("바이오")).not.toBe("근거 부족");
    expect(formatSectorReference("반도체")).not.toBe("근거 부족");
    expect(formatSectorReference("바이오")).toContain("바이오");
  });
  it("Level A 미보유 canonical sector → 근거 부족", () => {
    expect(formatSectorReference("건설")).toBe("근거 부족");
    expect(formatSectorReference("금융")).toBe("근거 부족");
  });
  it("비canonical sector → 근거 부족", () => {
    expect(formatSectorReference("미분류")).toBe("근거 부족");
    expect(formatSectorReference("")).toBe("근거 부족");
  });
});

describe("deriveEnrichFromShortlist (pure — financials 제외)", () => {
  it("full row → verdict/badge/technicals/sectorRef/macro", () => {
    const r = deriveEnrichFromShortlist(makeItem());
    expect(r.tier1Verdict).toBe("BUY"); // aiScore 82 >= 70
    expect(r.consensusBadge).toBe("🟢");
    expect(r.technicalsSummary).toContain("추세 상향");
    expect(r.sectorReference).toContain("반도체"); // Level A
    expect(r.macroSummary).toBe("근거 부족"); // S7b 전까지
  });
  it("aiScore null + badge ⚪ → HOLD + 🟡 fallback", () => {
    const r = deriveEnrichFromShortlist(makeItem({ aiScore: null, consensusBadge: "⚪" }));
    expect(r.tier1Verdict).toBe("HOLD");
    expect(r.consensusBadge).toBe("🟡");
  });
});

describe("enrichReportInput (async DB-read, cost 0)", () => {
  it("financials 캐시 있음 → 실 요약 주입 + LLM 0회", async () => {
    const summarySpy = vi.fn().mockResolvedValue("[005930 2024 연간] 매출 100억 · ROE 12.0%");
    const client = {} as never;
    const result = await enrichReportInput(makeItem(), {
      client,
      fetchFinancials: summarySpy,
    });
    expect(summarySpy).toHaveBeenCalledWith("005930", { client });
    expect(result.financialsSummary).toContain("ROE");
    expect(result.tier1Verdict).toBe("BUY");
    expect(result.consensusBadge).toBe("🟢");
    expect(result.macroSummary).toBe("근거 부족");
  });

  it("financials 미캐시 → graceful '재무 데이터 없음' (throw 안 함)", async () => {
    // fetchFinancialsSummary는 미캐시 ticker에 graceful 문자열 반환 (throw 아님).
    const summarySpy = vi.fn().mockResolvedValue("[999999] 재무 데이터 없음");
    const result = await enrichReportInput(makeItem({ ticker: "999999" }), {
      client: {} as never,
      fetchFinancials: summarySpy,
    });
    expect(result.financialsSummary).toContain("재무 데이터 없음");
  });

  it("financials SELECT 에러(corp_lookup_failed) → throw 전파 (silent degrade 방지)", async () => {
    const summarySpy = vi
      .fn()
      .mockRejectedValue(new Error("financials_corp_lookup_failed:PGRST301"));
    await expect(
      enrichReportInput(makeItem(), { client: {} as never, fetchFinancials: summarySpy }),
    ).rejects.toThrow("financials_corp_lookup_failed");
  });

  it("aiScore null row → tier1Verdict HOLD + badge 🟡 (fallback 보존)", async () => {
    const result = await enrichReportInput(
      makeItem({ aiScore: null, consensusBadge: null }),
      { client: {} as never, fetchFinancials: vi.fn().mockResolvedValue("[005930] 재무 데이터 없음") },
    );
    expect(result.tier1Verdict).toBe("HOLD");
    expect(result.consensusBadge).toBe("🟡");
  });
});

describe("enrichReportInput — G4 macroSummary seam (dormant default)", () => {
  it("default(flag off) → macroSummary === '근거 부족' (현행 회귀)", async () => {
    // 테스트 env는 MACRO_CONTEXT_ENABLED 미설정 → getMacroContextString() === '' → NO_BASIS.
    const result = await enrichReportInput(makeItem(), {
      client: {} as never,
      fetchFinancials: vi.fn().mockResolvedValue("[005930] 재무 데이터 없음"),
    });
    expect(result.macroSummary).toBe("근거 부족");
  });

  it("buildMacroSummary 주입 시 macroSummary 대체 (DI seam)", async () => {
    const result = await enrichReportInput(makeItem(), {
      client: {} as never,
      fetchFinancials: vi.fn().mockResolvedValue("[005930] 재무 데이터 없음"),
      buildMacroSummary: () => "거시 컨텍스트: 강세(예측 아님)",
    });
    expect(result.macroSummary).toBe("거시 컨텍스트: 강세(예측 아님)");
  });

  it("buildMacroSummary가 '' 반환 시 NO_BASIS 폴백", async () => {
    const result = await enrichReportInput(makeItem(), {
      client: {} as never,
      fetchFinancials: vi.fn().mockResolvedValue("[005930] 재무 데이터 없음"),
      buildMacroSummary: () => "",
    });
    expect(result.macroSummary).toBe("근거 부족");
  });

  it("async buildMacroSummary(Promise<string>) 주입 → await 후 macroSummary 대체 (batch 1회 fetch 패턴)", async () => {
    const result = await enrichReportInput(makeItem(), {
      client: {} as never,
      fetchFinancials: vi.fn().mockResolvedValue("[005930] 재무 데이터 없음"),
      buildMacroSummary: async () => "[거시 컨텍스트] 중립(예측 아님)",
    });
    expect(result.macroSummary).toBe("[거시 컨텍스트] 중립(예측 아님)");
  });
});
