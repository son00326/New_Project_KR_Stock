// A (R31 합의) — screening/tier2-gate.ts shouldRunTier2 env-flag 게이트 전수 검증 (test-only).
import { describe, it, expect, afterEach, vi } from "vitest";
import { shouldRunTier2 } from "../tier2-gate";
import type { ConsensusBadge } from "@/lib/screening/consensus";

const NON_WHITE: ConsensusBadge[] = ["🟢", "🔵", "🟣", "🟡"];

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("shouldRunTier2", () => {
  it("⚪(AI 분석 대기)는 env 무관 항상 false", () => {
    vi.stubEnv("AI_COST_LOG_REAL_INSERT_ENABLED", "true");
    expect(shouldRunTier2("⚪")).toBe(false);
  });

  it("비-⚪ 배지 + flag='true' → true", () => {
    vi.stubEnv("AI_COST_LOG_REAL_INSERT_ENABLED", "true");
    for (const b of NON_WHITE) expect(shouldRunTier2(b)).toBe(true);
  });

  it("비-⚪ 배지 + flag 미설정 → false (behavior-neutral default)", () => {
    vi.stubEnv("AI_COST_LOG_REAL_INSERT_ENABLED", "");
    for (const b of NON_WHITE) expect(shouldRunTier2(b)).toBe(false);
  });

  it("strict 'true' 리터럴만 — 'TRUE'/'1'/'yes'/' true '(대소문자·공백) 전부 false", () => {
    for (const v of ["TRUE", "True", "1", "yes", " true ", "true ", "TruE"]) {
      vi.stubEnv("AI_COST_LOG_REAL_INSERT_ENABLED", v);
      for (const b of NON_WHITE) expect(shouldRunTier2(b)).toBe(false);
    }
  });
});
