import { describe, expect, it } from "vitest";
import { formatPortfolioActionError } from "../portfolio-panel";

describe("formatPortfolioActionError", () => {
  it("maps portfolio action errors to Korean operator messages", () => {
    expect(formatPortfolioActionError("already_finalized")).toBe(
      "이미 이번 달 포트가 확정되어 있습니다.",
    );
    expect(formatPortfolioActionError("entry_price_unavailable")).toBe(
      "실 가격 소스 미연동 — T7e.6/T7e.8 후 활성",
    );
    expect(formatPortfolioActionError("approval_write_failed")).toBe(
      "승인 저장 실패 — 다시 시도하세요",
    );
    expect(formatPortfolioActionError("reanalysis_limit_reached")).toBe(
      "재분석 2회를 초과했습니다 — 전월 포트 유지",
    );
  });

  it("keeps an explicit fallback for unknown server errors", () => {
    expect(formatPortfolioActionError("unexpected_error")).toBe(
      "오류: unexpected_error",
    );
  });
});
