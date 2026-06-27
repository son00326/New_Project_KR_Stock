import { describe, expect, it } from "vitest";
import {
  candidateBasDdsBackFrom,
  computeT7PriceChangePct,
  isT7AnchorReady,
  nowKstBasDd,
  selectAlertsNeedingOutcome,
  shiftBasDd,
  signalDateToBasDd,
  t7TargetBasDd,
} from "@/lib/intraday/exit-outcome";
import type { AlertEvent } from "@/types/admin";

function alert(overrides: Partial<AlertEvent> = {}): AlertEvent {
  return {
    id: "a1",
    alertType: "exit_signal",
    ticker: "005930",
    severity: "critical",
    triggerReason: "exit",
    signalSentAt: "2026-06-01T00:00:00Z",
    outcomeAt: null,
    t7PriceChange: null,
    decisionRecorded: null,
    decisionMemo: null,
    isRead: false,
    ...overrides,
  };
}

const NOW = new Date("2026-06-20T05:00:00Z");

describe("selectAlertsNeedingOutcome", () => {
  it("selects exit_signal with null outcome older than 7d", () => {
    const due = selectAlertsNeedingOutcome([alert()], NOW);
    expect(due).toHaveLength(1);
  });

  it("excludes alerts younger than 7d", () => {
    const due = selectAlertsNeedingOutcome(
      [alert({ signalSentAt: "2026-06-18T00:00:00Z" })],
      NOW,
    );
    expect(due).toHaveLength(0);
  });

  it("excludes alerts that already have outcome", () => {
    const due = selectAlertsNeedingOutcome(
      [alert({ outcomeAt: "2026-06-10T00:00:00Z", t7PriceChange: 3.2 })],
      NOW,
    );
    expect(due).toHaveLength(0);
  });

  it("excludes non exit_signal alerts", () => {
    const due = selectAlertsNeedingOutcome(
      [alert({ alertType: "intraday_anomaly" })],
      NOW,
    );
    expect(due).toHaveLength(0);
  });

  it("excludes null/blank ticker (no price target)", () => {
    expect(selectAlertsNeedingOutcome([alert({ ticker: null })], NOW)).toHaveLength(0);
    expect(selectAlertsNeedingOutcome([alert({ ticker: "  " })], NOW)).toHaveLength(0);
  });

  it("boundary: exactly 7d old is due", () => {
    const due = selectAlertsNeedingOutcome(
      [alert({ signalSentAt: "2026-06-13T05:00:00Z" })],
      NOW,
    );
    expect(due).toHaveLength(1);
  });

  it("excludes malformed signalSentAt", () => {
    expect(selectAlertsNeedingOutcome([alert({ signalSentAt: "not-a-date" })], NOW)).toHaveLength(0);
  });
});

describe("computeT7PriceChangePct", () => {
  it("computes percentage points", () => {
    expect(computeT7PriceChangePct(100, 107)).toBe(7);
    expect(computeT7PriceChangePct(100, 90)).toBe(-10);
  });

  it("rounds to 3 decimals (mutation-pin: toFixed(2) would give 3.33)", () => {
    // (31000-30000)/30000*100 = 3.33333… → toFixed(3)=3.333 (toFixed(2)=3.33 mutant dies).
    expect(computeT7PriceChangePct(30000, 31000)).toBe(3.333);
  });

  it("fail-soft on non-positive prices → null", () => {
    expect(computeT7PriceChangePct(0, 100)).toBeNull();
    expect(computeT7PriceChangePct(100, 0)).toBeNull();
    expect(computeT7PriceChangePct(-1, 100)).toBeNull();
  });
});

describe("date helpers", () => {
  it("signalDateToBasDd converts ISO → KST YYYYMMDD", () => {
    // 2026-06-01T20:00:00Z = 2026-06-02 05:00 KST
    expect(signalDateToBasDd("2026-06-01T20:00:00Z")).toBe("20260602");
    expect(signalDateToBasDd("not-a-date")).toBeNull();
  });

  it("nowKstBasDd uses KST date", () => {
    expect(nowKstBasDd(new Date("2026-06-20T20:00:00Z"))).toBe("20260621");
  });

  it("shiftBasDd shifts across month/year boundaries", () => {
    expect(shiftBasDd("20260601", 7)).toBe("20260608");
    expect(shiftBasDd("20260101", -1)).toBe("20251231");
    expect(shiftBasDd("bad", 1)).toBeNull();
  });

  it("t7TargetBasDd = signal+7 capped at now", () => {
    // signal 2026-06-01 (KST), +7 = 2026-06-08, now 2026-06-20 → 20260608
    expect(t7TargetBasDd("2026-06-01T00:00:00Z", NOW)).toBe("20260608");
  });

  it("t7TargetBasDd caps at now when +7 exceeds now", () => {
    // signal 2026-06-18 (KST), +7 = 2026-06-25, now KST 2026-06-20 → cap 20260620
    expect(t7TargetBasDd("2026-06-18T00:00:00Z", NOW)).toBe("20260620");
  });

  it("candidateBasDdsBackFrom walks back maxBack days inclusive", () => {
    expect(candidateBasDdsBackFrom("20260608", 3)).toEqual([
      "20260608",
      "20260607",
      "20260606",
      "20260605",
    ]);
    expect(candidateBasDdsBackFrom(null, 3)).toEqual([]);
    expect(candidateBasDdsBackFrom("bad", 3)).toEqual([]);
  });
});

describe("isT7AnchorReady (T+6/T+7 race guard)", () => {
  it("past anchor (< today KST) → ready", () => {
    // now KST 2026-06-20, anchor 2026-06-19 (yesterday) → ready regardless of hour
    expect(isT7AnchorReady("20260619", new Date("2026-06-20T05:00:00Z"))).toBe(true);
  });

  it("anchor == today KST + before cutoff (18 KST) → NOT ready", () => {
    // 2026-06-20T05:00Z = 14:00 KST < 18 → close 미확정
    expect(isT7AnchorReady("20260620", new Date("2026-06-20T05:00:00Z"))).toBe(false);
  });

  it("anchor == today KST + after cutoff (18 KST) → ready", () => {
    // 2026-06-20T10:00Z = 19:00 KST >= 18 → close 확정
    expect(isT7AnchorReady("20260620", new Date("2026-06-20T10:00:00Z"))).toBe(true);
  });

  it("cutoff boundary: exactly 18:00 KST → ready", () => {
    // 2026-06-20T09:00Z = 18:00 KST
    expect(isT7AnchorReady("20260620", new Date("2026-06-20T09:00:00Z"))).toBe(true);
  });

  it("null anchor → not ready", () => {
    expect(isT7AnchorReady(null, new Date("2026-06-20T10:00:00Z"))).toBe(false);
  });
});
