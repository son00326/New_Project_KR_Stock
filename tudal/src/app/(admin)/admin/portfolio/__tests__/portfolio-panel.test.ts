import { describe, expect, it } from "vitest";
import { formatPortfolioActionError } from "../portfolio-panel";

// 46차 FixPlan-46 §P1.1 — formatPortfolioActionError는 이제 src/lib/admin/format-error.ts의
// formatErrorMessage alias. 한국어 매핑은 통합 helper에서 관리하며 본 테스트는 portfolio re-export
// 호환성 + 핵심 4 코드 회귀 방지용으로 유지.
describe("formatPortfolioActionError", () => {
  it("maps portfolio action errors to Korean operator messages", () => {
    expect(formatPortfolioActionError("already_finalized")).toBe(
      "이미 이번 달 포트가 확정되어 있습니다",
    );
    expect(formatPortfolioActionError("entry_price_unavailable")).toBe(
      "실 가격 소스 미연동 — 현재는 승인할 수 없습니다",
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
