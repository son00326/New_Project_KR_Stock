import { describe, it, expect } from "vitest";
import { buildM12aLedgerRow } from "@/lib/news/m12a/ledger";
import type { CashoutRecord, PerTickerAssessment } from "@/lib/news/m12a/types";

// 기본 assessment 픽스처 (회사 단위 thesis-break, 가격 채움 케이스용).
const baseAssessment: PerTickerAssessment = {
  ticker: "005930",
  surface: "list",
  track: "short",
  scope: "company",
  severity: "critical",
  confidence: "high",
  materiality: "high",
  directness: "direct",
  thesisBreak: true,
  thesisBreakReason: "분식회계 적발",
  affectedTickers: ["005930", "000660"],
  newsEventId: "evt-1",
  newsTitle: "삼성전자 분식회계 의혹",
  newsUrl: "https://example.com/news/1",
};

const cashout: CashoutRecord = {
  ticker: "005930",
  price: 70000,
  priceBasisDate: "20260626",
  priceSource: "KRX_EOD",
  executionAssumption: "virtual_eod",
};

describe("buildM12aLedgerRow", () => {
  it("removed + cashout → price 3필드 채움 (전체 row 구조 핀)", () => {
    const row = buildM12aLedgerRow({
      assessment: baseAssessment,
      runId: "run-42",
      month: "2026-06-01",
      recommendedAction: "auto_remove",
      actionTaken: "removed",
      heldByBrake: false,
      cashout,
      alertEventId: "alert-9",
    });
    // ledger row는 정확히 M12aTickerLedgerRow 형태 (affectedTickers/newsTitle/newsUrl 미포함).
    expect(row).toEqual({
      newsEventId: "evt-1",
      runId: "run-42",
      month: "2026-06-01",
      ticker: "005930",
      surface: "list",
      scope: "company",
      severity: "critical",
      confidence: "high",
      materiality: "high",
      directness: "direct",
      thesisBreak: true,
      thesisBreakReason: "분식회계 적발",
      recommendedAction: "auto_remove",
      actionTaken: "removed",
      heldByBrake: false,
      priceBasisDate: "20260626",
      priceSource: "KRX_EOD",
      executionAssumption: "virtual_eod",
      alertEventId: "alert-9",
    });
  });

  it("shadowed (cashout 없음) → price 3필드 null", () => {
    const row = buildM12aLedgerRow({
      assessment: baseAssessment,
      runId: "run-42",
      month: "2026-06-01",
      recommendedAction: "auto_remove",
      actionTaken: "shadowed",
      heldByBrake: false,
    });
    expect(row.actionTaken).toBe("shadowed");
    expect(row.priceBasisDate).toBeNull();
    expect(row.priceSource).toBeNull();
    expect(row.executionAssumption).toBeNull();
  });

  it("held_by_brake → price 3필드 null + heldByBrake true (cashout 있어도 removed 아니면 null)", () => {
    const row = buildM12aLedgerRow({
      assessment: baseAssessment,
      runId: "run-42",
      month: "2026-06-01",
      recommendedAction: "auto_remove",
      actionTaken: "held_by_brake",
      heldByBrake: true,
      cashout, // cashout 존재해도 actionTaken !== 'removed' → null 이어야 함
    });
    expect(row.heldByBrake).toBe(true);
    expect(row.actionTaken).toBe("held_by_brake");
    expect(row.priceBasisDate).toBeNull();
    expect(row.priceSource).toBeNull();
    expect(row.executionAssumption).toBeNull();
  });

  it("removed인데 cashout 없음 (defensive) → price 3필드 null", () => {
    const row = buildM12aLedgerRow({
      assessment: baseAssessment,
      runId: "run-42",
      month: "2026-06-01",
      recommendedAction: "auto_remove",
      actionTaken: "removed",
      heldByBrake: false,
      cashout: null,
    });
    expect(row.actionTaken).toBe("removed");
    expect(row.priceBasisDate).toBeNull();
    expect(row.priceSource).toBeNull();
    expect(row.executionAssumption).toBeNull();
  });

  it("alertEventId 미지정 → null 기본값", () => {
    const row = buildM12aLedgerRow({
      assessment: baseAssessment,
      runId: "run-42",
      month: "2026-06-01",
      recommendedAction: "alert_only",
      actionTaken: "shadowed",
      heldByBrake: false,
    });
    expect(row.alertEventId).toBeNull();
  });

  it("assessment 필드 verbatim 복사 (다른 enum 값으로 하드코딩 방지)", () => {
    const alt: PerTickerAssessment = {
      ticker: "000660",
      surface: "portfolio",
      scope: "sector",
      severity: "warning",
      confidence: "low",
      materiality: "medium",
      directness: "indirect",
      thesisBreak: false,
      thesisBreakReason: null,
      affectedTickers: [],
      newsEventId: "evt-77",
      newsTitle: "SK하이닉스 섹터 뉴스",
      newsUrl: "https://example.com/news/77",
    };
    const row = buildM12aLedgerRow({
      assessment: alt,
      runId: "run-1",
      month: "2026-05-01",
      recommendedAction: "hold_for_review",
      actionTaken: "shadowed",
      heldByBrake: false,
    });
    expect(row.ticker).toBe("000660");
    expect(row.surface).toBe("portfolio");
    expect(row.scope).toBe("sector");
    expect(row.severity).toBe("warning");
    expect(row.confidence).toBe("low");
    expect(row.materiality).toBe("medium");
    expect(row.directness).toBe("indirect");
    expect(row.thesisBreak).toBe(false);
    expect(row.thesisBreakReason).toBeNull();
    expect(row.newsEventId).toBe("evt-77");
    expect(row.recommendedAction).toBe("hold_for_review");
    expect(row.actionTaken).toBe("shadowed");
    expect(row.runId).toBe("run-1");
    expect(row.month).toBe("2026-05-01");
  });
});
