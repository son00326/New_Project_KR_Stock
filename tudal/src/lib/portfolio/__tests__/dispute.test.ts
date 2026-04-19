// dispute.test.ts — 이의 제기 순수 함수 단위 테스트 (S3 US-T3.7)
import { describe, it, expect } from "vitest";
import {
  validateDisputeReason,
  canRaiseDispute,
  isDisputeHoldExpired,
  isAcceptBlockedByDispute,
} from "../dispute";

describe("validateDisputeReason", () => {
  // 케이스 1: 19자 → invalid
  it("케이스 1 — 19자(< 20): valid=false, error=reason_too_short", () => {
    const result = validateDisputeReason("a".repeat(19));
    expect(result.valid).toBe(false);
    expect(result.error).toBe("reason_too_short");
  });

  // 케이스 2: 정확히 20자 → valid
  it("케이스 2 — 정확히 20자: valid=true", () => {
    const result = validateDisputeReason("a".repeat(20));
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  // 케이스 3: 공백만 20자 → invalid (trim 적용)
  it("케이스 3 — 공백만 20자: valid=false (trim 적용)", () => {
    const result = validateDisputeReason(" ".repeat(20));
    expect(result.valid).toBe(false);
    expect(result.error).toBe("reason_too_short");
  });

  // 케이스 4: 30자 → valid
  it("케이스 4 — 30자(> 20): valid=true", () => {
    const result = validateDisputeReason("a".repeat(30));
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  // 케이스 14 (trim): 앞뒤 공백 + 20자 본문 → valid, trimmed=20자
  it("케이스 14 — 앞뒤 공백 포함 총 26자, 본문 20자: valid=true, trimmed.length=20", () => {
    const body = "a".repeat(20);
    const result = validateDisputeReason("   " + body + "   ");
    expect(result.valid).toBe(true);
    expect(result.trimmed).toBe(body);
    expect(result.trimmed.length).toBe(20);
  });

  // 케이스 15 (trim): 앞뒤 공백만 포함된 짧은 문자열 → invalid
  it("케이스 15 — 앞뒤 공백 제거 후 3자: valid=false", () => {
    const result = validateDisputeReason("  부족 ");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("reason_too_short");
    expect(result.trimmed.length).toBeLessThan(20);
  });

  // 케이스 16 (trim): 개행·탭 포함, trim 후 20자 이상 → valid
  it("케이스 16 — 개행·탭 포함, trim 후 20자 이상: valid=true", () => {
    const body = "이의제기사유가충분히길어야한다"; // 15자 한국어 = 15 chars
    const long = body + "추가사유더작성함"; // 15+8=23자
    const result = validateDisputeReason("\n\t " + long + "\n");
    expect(result.valid).toBe(true);
    expect(result.trimmed).toBe(long);
  });
});

describe("canRaiseDispute", () => {
  // 케이스 5: raisedAt=null → valid (처음 이의 제기 가능)
  it("케이스 5 — raisedAt=null: valid=true", () => {
    const result = canRaiseDispute({
      disputeRaisedAt: null,
      disputeResolvedAt: null,
    });
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  // 케이스 6: raisedAt set · resolvedAt=null → already_disputed
  it("케이스 6 — raisedAt 존재·resolvedAt=null: valid=false, error=already_disputed", () => {
    const result = canRaiseDispute({
      disputeRaisedAt: "2026-04-17T00:00:00.000Z",
      disputeResolvedAt: null,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("already_disputed");
  });

  // 케이스 7: raisedAt set · resolvedAt set → valid (해결됐으므로 재이의 가능)
  it("케이스 7 — raisedAt 존재·resolvedAt 존재: valid=true (재이의 가능)", () => {
    const result = canRaiseDispute({
      disputeRaisedAt: "2026-04-17T00:00:00.000Z",
      disputeResolvedAt: "2026-04-18T00:00:00.000Z",
    });
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });
});

describe("isDisputeHoldExpired", () => {
  const raisedAt = new Date("2026-04-17T00:00:00.000Z");

  // 케이스 8: 48h 미경과(47h59m) → false
  it("케이스 8 — 48h 미경과(47h59m): false", () => {
    const now = new Date(
      raisedAt.getTime() + 47 * 60 * 60 * 1000 + 59 * 60 * 1000,
    );
    expect(isDisputeHoldExpired(raisedAt, now)).toBe(false);
  });

  // 케이스 9: 48h 경과(+1ms) → true
  it("케이스 9 — 48h 경과(+1ms): true", () => {
    const now = new Date(raisedAt.getTime() + 48 * 60 * 60 * 1000 + 1);
    expect(isDisputeHoldExpired(raisedAt, now)).toBe(true);
  });
});

describe("isAcceptBlockedByDispute", () => {
  const raisedAt = "2026-04-17T00:00:00.000Z";
  const resolvedAt = "2026-04-18T00:00:00.000Z";

  // 케이스 10: raisedAt=null → false
  it("케이스 10 — raisedAt=null: false", () => {
    const now = new Date("2026-04-18T00:00:00.000Z");
    expect(isAcceptBlockedByDispute(null, null, now)).toBe(false);
  });

  // 케이스 11: raisedAt set · resolvedAt=null · 48h 미경과 → true
  it("케이스 11 — raisedAt set·resolvedAt=null·48h 미경과: true", () => {
    const now = new Date(
      new Date(raisedAt).getTime() + 24 * 60 * 60 * 1000, // 24h 경과 → 아직 48h 미도달
    );
    expect(isAcceptBlockedByDispute(raisedAt, null, now)).toBe(true);
  });

  // 케이스 12: raisedAt set · resolvedAt=null · 48h 경과 → true (resolved 없으면 여전히 차단)
  it("케이스 12 — raisedAt set·resolvedAt=null·48h 경과: true (명시적 resolve 필요)", () => {
    const now = new Date(
      new Date(raisedAt).getTime() + 49 * 60 * 60 * 1000, // 49h 경과
    );
    expect(isAcceptBlockedByDispute(raisedAt, null, now)).toBe(true);
  });

  // 케이스 13: raisedAt set · resolvedAt set · 48h 경과 → false
  it("케이스 13 — raisedAt set·resolvedAt set·48h 경과: false", () => {
    const now = new Date(
      new Date(raisedAt).getTime() + 49 * 60 * 60 * 1000, // 49h 경과
    );
    expect(isAcceptBlockedByDispute(raisedAt, resolvedAt, now)).toBe(false);
  });
});
