import fs from "node:fs";
import path from "node:path";
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


describe("PortfolioPanel dispute bridge", () => {
  it("exposes resolveDispute in the 48h Hold UI and does not send client adminId", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "..", "portfolio-panel.tsx"),
      "utf8",
    );

    expect(source).toContain("resolveDispute({ approvalId: finalApproval.id })");
    expect(source).toContain("이의 해결");
    expect(source).not.toContain('adminId: "admin-001"');
  });

  // PR-H scope 1a — reject-trigger wire. 30 재선정(triggerMonthlyBatch)이 명시 버튼으로 배선됨.
  //   stale "큐 미연결" honesty 문구 제거 + reject 자동 재선정 트리거 금지(silent cost burn 방지) 검증.
  it("wires an explicit 30-reselect button (triggerMonthlyBatch) without auto-triggering on Reject", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "..", "portfolio-panel.tsx"),
      "utf8",
    );

    // stale dangling 문구 제거 (queue 미연결 주장 금지 — 이제 배선됨).
    expect(source).not.toContain("재분석 큐 미연결");
    expect(source).not.toContain("실 재분석 큐 연결 전까지 전월 포트 유지 상태입니다");

    // 30 재선정 단발 버튼은 남아도 서버 액션이 fail-closed한다 (reject와 분리, silent burn 방지).
    expect(source).toContain("triggerMonthlyBatch({ month: month.slice(0, 7) })");
    expect(source).toContain("30 재선정 — 청크 경로 사용 필요");
    expect(source).toContain("triggerReportWorkerChunk({ month: month.slice(0, 7) })");
    expect(source).toContain("리포트 배치 생성 (1 chunk)");
    expect(source).toContain("report_worker_not_ready");
    expect(source).toContain("Short List가 아직 30종목이 아닙니다");

    // reject 핸들러는 rejectShortList만 호출 — AI 비용 트리거를 자동 호출하지 않는다.
    const handleRejectBody = source.slice(
      source.indexOf("function handleReject()"),
      source.indexOf("function handleReanalyze()"),
    );
    expect(handleRejectBody).toContain("rejectShortList");
    expect(handleRejectBody).not.toContain("triggerMonthlyBatch");
    expect(handleRejectBody).not.toContain("triggerReportWorkerChunk");
  });
});
