import { describe, expect, it } from "vitest";
import { buildIntradayMonitorOutput } from "@/lib/intraday/monitor";
import type {
  IntradayContext,
  IntradayTick,
} from "@/lib/intraday/anomaly-detect";

function tick(overrides: Partial<IntradayTick> = {}): IntradayTick {
  return {
    ticker: "005930",
    lastPrice: 100_000,
    timestamp: "2026-06-27T01:00:00Z",
    sessionVolume: 1_000_000,
    ...overrides,
  };
}

const ctx: IntradayContext = { referencePrice: 100_000, avg20dVolume: 1_000_000 };

function contexts(entries: Array<[string, IntradayContext]>): Map<string, IntradayContext> {
  return new Map(entries);
}

describe("buildIntradayMonitorOutput", () => {
  it("emits anomaly + alert + telegram on price spike", () => {
    const out = buildIntradayMonitorOutput({
      ticks: [tick({ lastPrice: 106_000 })], // +6%
      contexts: contexts([["005930", ctx]]),
      prefs: new Map(),
    });
    expect(out.evaluated).toBe(1);
    expect(out.detected).toBe(1);
    expect(out.anomalies).toHaveLength(1);
    expect(out.alerts).toHaveLength(1);
    expect(out.telegramTexts).toHaveLength(1);
    expect(out.anomalies[0].triggerType).toBe("price_spike");
    expect(out.alerts[0].alertType).toBe("intraday_anomaly");
    expect(out.telegramTexts[0]).toContain("장중 이상 감지");
  });

  it("M14 toggle OFF → ticker skipped (not evaluated, no detection)", () => {
    const out = buildIntradayMonitorOutput({
      ticks: [tick({ lastPrice: 106_000 })],
      contexts: contexts([["005930", ctx]]),
      prefs: new Map([["005930", false]]),
    });
    expect(out.skipped).toBe(1);
    expect(out.evaluated).toBe(0);
    expect(out.detected).toBe(0);
    expect(out.alerts).toHaveLength(0);
  });

  it("M14 default ON (pref unset) → evaluated", () => {
    const out = buildIntradayMonitorOutput({
      ticks: [tick({ lastPrice: 106_000 })],
      contexts: contexts([["005930", ctx]]),
      prefs: new Map(),
    });
    expect(out.evaluated).toBe(1);
  });

  it("missing context → fail-soft skip (no throw)", () => {
    const out = buildIntradayMonitorOutput({
      ticks: [tick({ lastPrice: 106_000 })],
      contexts: contexts([]), // no context for 005930
      prefs: new Map(),
    });
    expect(out.skipped).toBe(1);
    expect(out.evaluated).toBe(0);
    expect(out.detected).toBe(0);
  });

  it("no anomaly → evaluated but 0 detected", () => {
    const out = buildIntradayMonitorOutput({
      ticks: [tick({ lastPrice: 101_000 })], // +1%
      contexts: contexts([["005930", ctx]]),
      prefs: new Map(),
    });
    expect(out.evaluated).toBe(1);
    expect(out.detected).toBe(0);
    expect(out.alerts).toHaveLength(0);
  });

  it("custom threshold override lowers price trigger", () => {
    const out = buildIntradayMonitorOutput({
      ticks: [tick({ lastPrice: 102_000 })], // +2%
      contexts: contexts([["005930", ctx]]),
      prefs: new Map(),
      customThresholds: new Map([["005930", { priceChange: 0.015 }]]), // 1.5%
    });
    expect(out.detected).toBe(1);
    expect(out.anomalies[0].triggerType).toBe("price_spike");
  });

  it("mixed batch: one detected, one toggled-off, one clean", () => {
    const out = buildIntradayMonitorOutput({
      ticks: [
        tick({ ticker: "005930", lastPrice: 106_000 }), // spike
        tick({ ticker: "000660", lastPrice: 94_000 }), // drop but toggled off
        tick({ ticker: "035720", lastPrice: 100_500 }), // clean
      ],
      contexts: contexts([
        ["005930", ctx],
        ["000660", ctx],
        ["035720", ctx],
      ]),
      prefs: new Map([["000660", false]]),
    });
    expect(out.detected).toBe(1);
    expect(out.skipped).toBe(1); // 000660 toggled off
    expect(out.evaluated).toBe(2); // 005930 + 035720
    expect(out.anomalies[0].ticker).toBe("005930");
  });

  it("anomaly record carries dedup_key for DB unique enforcement", () => {
    const out = buildIntradayMonitorOutput({
      ticks: [tick({ lastPrice: 106_000 })],
      contexts: contexts([["005930", ctx]]),
      prefs: new Map(),
    });
    expect(out.anomalies[0].dedupKey).toMatch(/^005930:price_spike:\d{12}$/);
  });
});
