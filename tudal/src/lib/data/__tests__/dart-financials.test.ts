// PR-B — dart-financials 순수 파생 로직 유닛테스트 (ADR 2026-05-31 PR-B).
import { describe, it, expect } from "vitest";
import {
  deriveFinancials,
  formatFinancialsSummary,
  type AnnualFinancials,
} from "@/lib/data/dart-financials";

// 실 production 데이터 (004150, 2025 latest / 2024 prior — DB 검증값).
const LATEST_2025: AnnualFinancials = {
  periodKey: "2025",
  revenue: 1098306886000,
  opIncome: 22608692000,
  netIncome: 8896778000,
  totalEquity: 645179036000,
  totalDebt: 243814015000,
};
const PRIOR_2024: AnnualFinancials = {
  periodKey: "2024",
  revenue: 791639938000,
  opIncome: 7479492000,
  netIncome: 1583567000,
  totalEquity: 673357379000,
  totalDebt: 259801490000,
};

describe("deriveFinancials — 실 데이터 파생", () => {
  it("ROE = net_income / total_equity", () => {
    const d = deriveFinancials(LATEST_2025, PRIOR_2024);
    expect(d.roe).toBeCloseTo(8896778000 / 645179036000, 6); // ≈ 0.01379
  });

  it("영업이익률 = op_income / revenue", () => {
    const d = deriveFinancials(LATEST_2025, PRIOR_2024);
    expect(d.opMargin).toBeCloseTo(22608692000 / 1098306886000, 6); // ≈ 0.02059
  });

  it("부채비율 = total_debt / total_equity", () => {
    const d = deriveFinancials(LATEST_2025, PRIOR_2024);
    expect(d.debtToEquity).toBeCloseTo(243814015000 / 645179036000, 6); // ≈ 0.3779
  });

  it("매출 YoY = (당기 - 전기) / 전기", () => {
    const d = deriveFinancials(LATEST_2025, PRIOR_2024);
    expect(d.revenueYoy).toBeCloseTo(
      (1098306886000 - 791639938000) / 791639938000,
      6,
    ); // ≈ 0.3874
  });

  it("영업이익 YoY", () => {
    const d = deriveFinancials(LATEST_2025, PRIOR_2024);
    expect(d.opIncomeYoy).toBeCloseTo(
      (22608692000 - 7479492000) / 7479492000,
      6,
    ); // ≈ 2.0228
  });

  it("passthrough: periodKey/revenue/opIncome/netIncome 보존", () => {
    const d = deriveFinancials(LATEST_2025, PRIOR_2024);
    expect(d.periodKey).toBe("2025");
    expect(d.revenue).toBe(1098306886000);
    expect(d.opIncome).toBe(22608692000);
    expect(d.netIncome).toBe(8896778000);
  });
});

describe("deriveFinancials — 엣지케이스 (safe-div / null guard)", () => {
  it("total_equity = 0 → ROE/부채비율 null (div-by-zero 방지)", () => {
    const d = deriveFinancials({ ...LATEST_2025, totalEquity: 0 }, PRIOR_2024);
    expect(d.roe).toBeNull();
    expect(d.debtToEquity).toBeNull();
  });

  it("total_equity 음수 → ROE/부채비율 null (자본잠식, dart_signals.py equity>0 정합)", () => {
    const d = deriveFinancials({ ...LATEST_2025, totalEquity: -1000 }, PRIOR_2024);
    expect(d.roe).toBeNull();
    expect(d.debtToEquity).toBeNull();
  });

  it("prior null → 모든 YoY null", () => {
    const d = deriveFinancials(LATEST_2025, null);
    expect(d.revenueYoy).toBeNull();
    expect(d.opIncomeYoy).toBeNull();
  });

  it("prior revenue = 0 → 매출 YoY null (div-by-zero)", () => {
    const d = deriveFinancials(LATEST_2025, { ...PRIOR_2024, revenue: 0 });
    expect(d.revenueYoy).toBeNull();
  });

  it("revenue null → 영업이익률 null", () => {
    const d = deriveFinancials({ ...LATEST_2025, revenue: null }, PRIOR_2024);
    expect(d.opMargin).toBeNull();
  });

  it("netIncome null → ROE null", () => {
    const d = deriveFinancials({ ...LATEST_2025, netIncome: null }, PRIOR_2024);
    expect(d.roe).toBeNull();
  });
});

describe("formatFinancialsSummary", () => {
  it("정상 데이터 → 한국어 1줄 (모든 지표 포함, 종목·연도)", () => {
    const s = formatFinancialsSummary("004150", deriveFinancials(LATEST_2025, PRIOR_2024));
    expect(s).toContain("[004150 2025 연간]");
    expect(s).toContain("ROE");
    expect(s).toContain("영업이익률");
    expect(s).toContain("부채비율");
    expect(s).toContain("매출YoY");
    expect(s).toContain("억");
  });

  it("derived null → 명시적 '재무 데이터 없음' (throw 아님)", () => {
    expect(formatFinancialsSummary("999999", null)).toBe("[999999] 재무 데이터 없음");
  });

  it("일부 지표 null → N/A 표기 (전체 문자열은 유지)", () => {
    const d = deriveFinancials({ ...LATEST_2025, totalEquity: 0 }, null);
    const s = formatFinancialsSummary("004150", d);
    expect(s).toContain("ROE N/A");
    expect(s).toContain("매출YoY N/A");
    expect(s).toContain("부채비율 N/A");
  });
});
