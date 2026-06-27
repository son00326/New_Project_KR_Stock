import { describe, expect, it } from "vitest";
import {
  buildExitAlternatives,
  buildExitSignalAlert,
  evaluateExitSignal,
  type ExitPosition,
} from "@/lib/notify/exit-signal";

function pos(overrides: Partial<ExitPosition> = {}): ExitPosition {
  return {
    ticker: "005930",
    bucket: "mid",
    entryPrice: 100_000,
    currentPrice: 100_000,
    holdingDays: 1,
    ...overrides,
  };
}

describe("evaluateExitSignal — trigger priority", () => {
  it("returns null when no trigger fires", () => {
    expect(evaluateExitSignal(pos({ currentPrice: 102_000 }))).toBeNull();
  });

  it("target_reached: currentPrice >= targetPrice (warning)", () => {
    const s = evaluateExitSignal(
      pos({ currentPrice: 120_000, targetPrice: 118_000 }),
    );
    expect(s?.trigger).toBe("target_reached");
    expect(s?.severity).toBe("warning");
    expect(s?.returnPct).toBe(20);
  });

  it("target takes priority over time_expired", () => {
    const s = evaluateExitSignal(
      pos({
        bucket: "short",
        currentPrice: 130_000,
        targetPrice: 125_000,
        holdingDays: 999,
      }),
    );
    expect(s?.trigger).toBe("target_reached");
  });

  it("momentum_break via stop loss (-15% default) is critical", () => {
    const s = evaluateExitSignal(pos({ currentPrice: 84_000 })); // -16%
    expect(s?.trigger).toBe("momentum_break");
    expect(s?.severity).toBe("critical");
    expect(s?.returnPct).toBe(-16);
  });

  it("stop loss boundary: exactly -15% fires (>= threshold)", () => {
    const s = evaluateExitSignal(pos({ currentPrice: 85_000 })); // -15%
    expect(s?.trigger).toBe("momentum_break");
  });

  it("stop loss boundary: -14.9% does NOT fire", () => {
    const s = evaluateExitSignal(pos({ currentPrice: 85_100 })); // -14.9%
    expect(s).toBeNull();
  });

  it("momentum_break via trailing drawdown from peak (-12% default)", () => {
    // entry 100k, current 90k (-10%, no stop), peak 110k → drawdown -18% from peak
    const s = evaluateExitSignal(pos({ currentPrice: 90_000, peakPrice: 110_000 }));
    expect(s?.trigger).toBe("momentum_break");
    expect(s?.reason).toContain("고점 대비");
  });

  it("no trailing drawdown trigger when peakPrice absent", () => {
    const s = evaluateExitSignal(pos({ currentPrice: 90_000 })); // -10%, no peak
    expect(s).toBeNull();
  });

  it("momentum_break priority over target when both could match (loss can't reach target)", () => {
    // loss scenario: stop hit AND time expired → momentum_break wins over time
    const s = evaluateExitSignal(
      pos({ bucket: "short", currentPrice: 80_000, holdingDays: 999 }),
    );
    expect(s?.trigger).toBe("momentum_break");
  });

  it("time_expired when horizon exceeded (warning)", () => {
    const s = evaluateExitSignal(
      pos({ bucket: "short", currentPrice: 101_000, holdingDays: 30 }),
    );
    expect(s?.trigger).toBe("time_expired");
    expect(s?.severity).toBe("warning");
    expect(s?.reason).toContain("30일");
  });

  it("time_expired boundary: short horizon 30 fires at exactly 30", () => {
    expect(
      evaluateExitSignal(pos({ bucket: "short", currentPrice: 100_500, holdingDays: 29 })),
    ).toBeNull();
    expect(
      evaluateExitSignal(pos({ bucket: "short", currentPrice: 100_500, holdingDays: 30 }))
        ?.trigger,
    ).toBe("time_expired");
  });

  it("bucket horizon differs (long 365 not expired at 100d)", () => {
    expect(
      evaluateExitSignal(pos({ bucket: "long", currentPrice: 100_500, holdingDays: 100 })),
    ).toBeNull();
  });

  it("fail-soft: entryPrice <= 0 → null", () => {
    expect(evaluateExitSignal(pos({ entryPrice: 0, currentPrice: 50 }))).toBeNull();
  });

  it("fail-soft: currentPrice <= 0 → null", () => {
    expect(evaluateExitSignal(pos({ currentPrice: 0 }))).toBeNull();
  });

  it("config overrides stopLossPct", () => {
    const s = evaluateExitSignal(pos({ currentPrice: 95_000 }), {
      stopLossPct: 0.04,
    });
    expect(s?.trigger).toBe("momentum_break");
  });
});

describe("buildExitAlternatives", () => {
  it("returns 3 alternatives in canonical order", () => {
    const s = evaluateExitSignal(pos({ currentPrice: 80_000 }))!;
    const alts = buildExitAlternatives(s);
    expect(alts.map((a) => a.key)).toEqual(["sell_all", "partial_sell", "hold"]);
    expect(alts.every((a) => a.body.length > 0)).toBe(true);
  });

  it("rationale differs by trigger (deterministic)", () => {
    const mom = buildExitAlternatives(evaluateExitSignal(pos({ currentPrice: 80_000 }))!);
    const tgt = buildExitAlternatives(
      evaluateExitSignal(pos({ currentPrice: 130_000, targetPrice: 125_000 }))!,
    );
    expect(mom[0].body).not.toBe(tgt[0].body);
  });
});

describe("buildExitSignalAlert", () => {
  it("maps signal → exit_signal alert payload", () => {
    const s = evaluateExitSignal(pos({ currentPrice: 80_000 }))!;
    const now = new Date("2026-06-27T01:00:00Z");
    const alert = buildExitSignalAlert(s, now);
    expect(alert.alertType).toBe("exit_signal");
    expect(alert.ticker).toBe("005930");
    expect(alert.severity).toBe("critical");
    expect(alert.signalSentAt).toBe(now.toISOString());
    expect(alert.outcomeAt).toBeNull();
    expect(alert.t7PriceChange).toBeNull();
    expect(alert.decisionRecorded).toBeNull();
    expect(alert.triggerReason).toBe(s.reason);
  });
});
