// regen-cap.test.ts — S4 M9 재생성 cap 가드 단위 테스트
import { describe, it, expect } from "vitest";
import {
  findRegenCounter,
  manualRemaining,
  isManualRegenAllowed,
  MANUAL_REGEN_CAP,
} from "../regen-cap";
import type { RegenCounter } from "@/types/admin";

// ---------------------------------------------------------------------------
// 픽스처
// ---------------------------------------------------------------------------

function makeCounter(
  ticker: string,
  manualCount: number,
  autoCount = 0,
): RegenCounter {
  return {
    id: `regen-${ticker}`,
    ticker,
    month: "2026-04-01",
    autoCount,
    manualCount,
    resetAt: "2026-05-01T00:00:00+09:00",
  };
}

const COUNTERS: RegenCounter[] = [
  makeCounter("005930", 0), // 신규 — 수동 2회 남음
  makeCounter("000660", 1, 1), // 부분 — 수동 1회 남음
  makeCounter("207940", 2), // 소진 — 수동 0회 남음
];

// ---------------------------------------------------------------------------
// findRegenCounter
// ---------------------------------------------------------------------------

describe("findRegenCounter", () => {
  it("일치하는 ticker+month가 있으면 해당 counter를 반환한다", () => {
    const result = findRegenCounter(COUNTERS, "005930", "2026-04-01");
    expect(result).not.toBeNull();
    expect(result?.ticker).toBe("005930");
  });

  it("일치하는 ticker가 없으면 null을 반환한다", () => {
    const result = findRegenCounter(COUNTERS, "999999", "2026-04-01");
    expect(result).toBeNull();
  });

  it("month가 다르면 null을 반환한다", () => {
    const result = findRegenCounter(COUNTERS, "005930", "2026-03-01");
    expect(result).toBeNull();
  });

  it("빈 배열이면 null을 반환한다", () => {
    const result = findRegenCounter([], "005930", "2026-04-01");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// manualRemaining
// ---------------------------------------------------------------------------

describe("manualRemaining", () => {
  it("counter가 null이면 MANUAL_REGEN_CAP(2)을 반환한다", () => {
    expect(manualRemaining(null)).toBe(MANUAL_REGEN_CAP);
  });

  it("manualCount=0이면 2를 반환한다", () => {
    const counter = makeCounter("005930", 0);
    expect(manualRemaining(counter)).toBe(2);
  });

  it("manualCount=1이면 1을 반환한다", () => {
    const counter = makeCounter("000660", 1);
    expect(manualRemaining(counter)).toBe(1);
  });

  it("manualCount=2(소진)이면 0을 반환한다", () => {
    const counter = makeCounter("207940", 2);
    expect(manualRemaining(counter)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// isManualRegenAllowed
// ---------------------------------------------------------------------------

describe("isManualRegenAllowed", () => {
  it("counter가 null이면 허용된다", () => {
    expect(isManualRegenAllowed(null)).toBe(true);
  });

  it("manualCount=0이면 허용된다", () => {
    expect(isManualRegenAllowed(makeCounter("005930", 0))).toBe(true);
  });

  it("manualCount=1이면 허용된다", () => {
    expect(isManualRegenAllowed(makeCounter("000660", 1))).toBe(true);
  });

  it("manualCount=2(소진)이면 허용되지 않는다", () => {
    expect(isManualRegenAllowed(makeCounter("207940", 2))).toBe(false);
  });
});
