import { afterEach, describe, expect, it, vi } from "vitest";
import { runIntradayMonitorPass } from "@/lib/intraday/run-monitor";
import type {
  IntradayContext,
  IntradayTick,
} from "@/lib/intraday/anomaly-detect";

function tick(overrides: Partial<IntradayTick> = {}): IntradayTick {
  return {
    ticker: "005930",
    lastPrice: 106_000,
    timestamp: "2026-06-27T01:00:00Z",
    sessionVolume: 1_000_000,
    ...overrides,
  };
}

const ctx: IntradayContext = { referencePrice: 100_000, avg20dVolume: 1_000_000 };

function deps() {
  return {
    insertAnomalies: vi.fn().mockResolvedValue(undefined),
    insertAlerts: vi.fn().mockResolvedValue(undefined),
    sendTelegram: vi.fn().mockResolvedValue({ success: true, mockMode: false }),
  };
}

function input() {
  return {
    ticks: [tick()],
    contexts: new Map([["005930", ctx]]),
    prefs: new Map<string, boolean>(),
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("runIntradayMonitorPass (shadow-first gate)", () => {
  it("flag off → skip, zero I/O", async () => {
    vi.stubEnv("INTRADAY_MONITOR_ENABLED", "");
    const d = deps();
    const res = await runIntradayMonitorPass(input(), d);
    expect(res.skipped).toBe("flag_off");
    expect(res.inserted).toBe(0);
    expect(d.insertAnomalies).not.toHaveBeenCalled();
    expect(d.insertAlerts).not.toHaveBeenCalled();
    expect(d.sendTelegram).not.toHaveBeenCalled();
  });

  it("flag on → detects, inserts anomaly + alert, dispatches telegram", async () => {
    vi.stubEnv("INTRADAY_MONITOR_ENABLED", "true");
    const d = deps();
    const res = await runIntradayMonitorPass(input(), d);
    expect(res.skipped).toBeUndefined();
    expect(res.detected).toBe(1);
    expect(res.inserted).toBe(1);
    expect(res.telegramDelivered).toBe(1);
    expect(d.insertAnomalies).toHaveBeenCalledTimes(1);
    expect(d.insertAnomalies.mock.calls[0][0][0].dedupKey).toMatch(
      /^005930:price_spike:/,
    );
    expect(d.insertAlerts).toHaveBeenCalledTimes(1);
    expect(d.insertAlerts.mock.calls[0][0][0].alertType).toBe("intraday_anomaly");
  });

  it("flag on but no detection → no inserts (clean tick)", async () => {
    vi.stubEnv("INTRADAY_MONITOR_ENABLED", "true");
    const d = deps();
    const res = await runIntradayMonitorPass(
      {
        ticks: [tick({ lastPrice: 101_000 })], // +1%, no anomaly
        contexts: new Map([["005930", ctx]]),
        prefs: new Map(),
      },
      d,
    );
    expect(res.detected).toBe(0);
    expect(d.insertAnomalies).not.toHaveBeenCalled();
    expect(d.insertAlerts).not.toHaveBeenCalled();
  });

  it("mock-mode telegram is not counted as delivered", async () => {
    vi.stubEnv("INTRADAY_MONITOR_ENABLED", "true");
    const d = deps();
    d.sendTelegram.mockResolvedValue({ success: true, mockMode: true });
    const res = await runIntradayMonitorPass(input(), d);
    expect(res.telegramDelivered).toBe(0);
  });
});
