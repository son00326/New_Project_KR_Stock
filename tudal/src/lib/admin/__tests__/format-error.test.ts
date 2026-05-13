import { afterEach, describe, expect, it, vi } from "vitest";
import { formatErrorMessage } from "@/lib/admin/format-error";

// 46차 기준 서버 액션 코드 inventory snapshot.
// 신규 액션 코드 추가 시 KOREAN_MAPPINGS + 본 list 같이 갱신.
const KNOWN_ACTION_CODES = [
  // 인증·세션
  "auth_unavailable",
  // 입력 검증
  "invalid_input",
  "invalid_month",
  "invalid_ticker",
  "invalid_decision",
  "invalid_memo",
  "invalid_reason",
  "invalid_intraday_mode",
  "invalid_ticker_alert_enabled",
  "ticker_required",
  "reason_too_short",
  // regenerate
  "cost_hardcap_40man",
  "manual_cap_exhausted",
  "report_lookup_failed",
  "report_not_found",
  "regen_counter_lookup_failed",
  "regen_counter_write_failed",
  "regen_counter_write_conflict",
  // portfolio
  "already_finalized",
  "approval_write_failed",
  "approval_lookup_failed",
  "approval_not_found",
  "shortlist_lookup_failed",
  "shortlist_month_not_found",
  "entry_price_unavailable",
  "reanalysis_limit_reached",
  "already_disputed",
  // alerts
  "alert_not_found",
  "already_decided",
  "not_exit_signal",
  // mock-only fallback
  "real_persistence_not_configured",
  "unknown_error",
  // credentials 방어 매핑
  "Invalid id format",
  "pending-s8",
];

describe("formatErrorMessage", () => {
  describe("known action codes are mapped to Korean", () => {
    for (const code of KNOWN_ACTION_CODES) {
      it(`maps "${code}" to Korean`, () => {
        const msg = formatErrorMessage(code);
        // 한국어 글자 포함 확인 (raw code가 그대로 노출되지 않음 검증)
        expect(/[가-힣]/.test(msg)).toBe(true);
        // raw 코드 그대로 노출 안 함
        expect(msg).not.toBe(code);
      });
    }
  });

  describe("specific mapping outputs", () => {
    it("auth_unavailable", () => {
      expect(formatErrorMessage("auth_unavailable")).toBe(
        "로그인이 필요합니다",
      );
    });

    it("entry_price_unavailable (omxy round 6 정정 문구)", () => {
      expect(formatErrorMessage("entry_price_unavailable")).toBe(
        "실 가격 소스 미연동 — 현재는 승인할 수 없습니다",
      );
    });

    it("manual_cap_exhausted", () => {
      expect(formatErrorMessage("manual_cap_exhausted")).toBe(
        "수동 재생성 한도(월 2회)를 모두 사용했습니다",
      );
    });

    it("Invalid id format (credentials 방어 매핑)", () => {
      expect(formatErrorMessage("Invalid id format")).toBe(
        "잘못된 ID 형식입니다",
      );
    });

    it("pending-s8 (credentials 방어 매핑)", () => {
      expect(formatErrorMessage("pending-s8")).toBe(
        "Binance 키 저장은 S8 자동매매에서 활성화됩니다",
      );
    });
  });

  describe("accept_gate_blocked:* prefix handler", () => {
    it("maps hold_24h suffix", () => {
      expect(formatErrorMessage("accept_gate_blocked:hold_24h")).toBe(
        "승인 조건을 충족하지 못했습니다",
      );
    });

    it("maps viewers_insufficient suffix", () => {
      expect(
        formatErrorMessage("accept_gate_blocked:viewers_insufficient"),
      ).toBe("승인 조건을 충족하지 못했습니다");
    });

    it("maps unknown suffix to same generic message", () => {
      expect(formatErrorMessage("accept_gate_blocked:something_new")).toBe(
        "승인 조건을 충족하지 못했습니다",
      );
    });
  });

  describe("Korean passthrough", () => {
    it("passes through credentials lib Korean strings unchanged", () => {
      const koreanMessages = [
        "로그인이 필요합니다",
        "실계좌 등록은 대표만 가능합니다",
        "이미 등록된 계좌입니다",
        "저장소 처리 중 오류가 발생했습니다",
      ];
      for (const msg of koreanMessages) {
        expect(formatErrorMessage(msg)).toBe(msg);
      }
    });
  });

  describe("unmapped fallback", () => {
    it("wraps unknown English code as 오류: ${code}", () => {
      expect(formatErrorMessage("future_unknown_code")).toBe(
        "오류: future_unknown_code",
      );
    });

    it("wraps DB-like raw error", () => {
      const raw = "relation does not exist";
      expect(formatErrorMessage(raw)).toBe(`오류: ${raw}`);
    });
  });

  // G-FE-map (48차) — specific output assertions for high-importance codes that
  // were only covered by the inventory loop. Locks user-facing copy so changes
  // require explicit test update.
  describe("high-importance specific outputs (G-FE-map)", () => {
    it("cost_hardcap_40man — 월 비용 한도 운영자 메시지", () => {
      expect(formatErrorMessage("cost_hardcap_40man")).toBe(
        "월 AI 비용 한도(40만원)를 초과했습니다",
      );
    });

    it("already_finalized — 확정 포트 중복 시도", () => {
      expect(formatErrorMessage("already_finalized")).toBe(
        "이미 이번 달 포트가 확정되어 있습니다",
      );
    });

    it("real_persistence_not_configured — production mock 분기 노출", () => {
      expect(formatErrorMessage("real_persistence_not_configured")).toBe(
        "이 기능은 production 실 저장이 아직 연결되지 않았습니다",
      );
    });

    it("regen_counter_write_conflict — CAS 동시 재생성 안내", () => {
      expect(formatErrorMessage("regen_counter_write_conflict")).toBe(
        "다른 어드민이 동시에 재생성 중입니다. 잠시 후 다시 시도하세요",
      );
    });

    it("reanalysis_limit_reached — Reject 3회 차단", () => {
      expect(formatErrorMessage("reanalysis_limit_reached")).toBe(
        "재분석 2회를 초과했습니다 — 전월 포트 유지",
      );
    });
  });

  describe("accept_gate_blocked edge cases (G-FE-map)", () => {
    it("accept_gate_blocked with empty suffix still maps to generic message", () => {
      expect(formatErrorMessage("accept_gate_blocked:")).toBe(
        "승인 조건을 충족하지 못했습니다",
      );
    });

    it("accept_gate_blocked without colon does NOT trigger prefix handler", () => {
      // 'accept_gate_blocked' (no colon) is not a known code and not Korean,
      // so it falls through to the generic 오류: ${code} fallback.
      expect(formatErrorMessage("accept_gate_blocked")).toBe(
        "오류: accept_gate_blocked",
      );
    });
  });

  describe("dev-only console.warn (G-FE-map)", () => {
    afterEach(() => {
      vi.restoreAllMocks();
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    });

    it("warns in development browser when an unmapped code falls through", () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubGlobal("window", {});
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

      formatErrorMessage("definitely_not_mapped_code");

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][1]).toBe("definitely_not_mapped_code");
    });

    it("does NOT warn in production even for unmapped codes", () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubGlobal("window", {});
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

      formatErrorMessage("also_unmapped");

      expect(warn).not.toHaveBeenCalled();
    });
  });
});
