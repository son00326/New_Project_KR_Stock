import { describe, expect, it } from "vitest";
import {
  buildDedupKey,
  buildIntradayAnomalyAlert,
  computePriceChangePct,
  computeVolumeRatio,
  detectIntradayAnomaly,
  isTickerEnabledForIntraday,
  toIntradayAnomalyRecord,
  type IntradayContext,
  type IntradayTick,
} from "@/lib/intraday/anomaly-detect";

const BASE_CTX: IntradayContext = {
  referencePrice: 100_000,
  avg20dVolume: 1_000_000,
};

function tick(overrides: Partial<IntradayTick> = {}): IntradayTick {
  return {
    ticker: "005930",
    lastPrice: 100_000,
    timestamp: "2026-04-19T05:30:00Z",
    sessionVolume: 1_000_000,
    ...overrides,
  };
}

describe("computePriceChangePct", () => {
  it("returns 0 when referencePrice is 0", () => {
    expect(computePriceChangePct(tick(), { ...BASE_CTX, referencePrice: 0 })).toBe(
      0,
    );
  });

  it("computes positive delta", () => {
    const result = computePriceChangePct(tick({ lastPrice: 105_000 }), BASE_CTX);
    expect(result).toBeCloseTo(0.05, 5);
  });

  it("computes negative delta", () => {
    const result = computePriceChangePct(tick({ lastPrice: 94_000 }), BASE_CTX);
    expect(result).toBeCloseTo(-0.06, 5);
  });
});

describe("computeVolumeRatio", () => {
  it("returns 0 when avg20dVolume is 0", () => {
    expect(
      computeVolumeRatio(tick(), { ...BASE_CTX, avg20dVolume: 0 }),
    ).toBe(0);
  });

  it("computes ratio", () => {
    const result = computeVolumeRatio(
      tick({ sessionVolume: 3_200_000 }),
      BASE_CTX,
    );
    expect(result).toBeCloseTo(3.2, 5);
  });
});

describe("detectIntradayAnomaly", () => {
  it("returns null when no trigger is met", () => {
    expect(
      detectIntradayAnomaly(tick({ lastPrice: 102_000 }), BASE_CTX),
    ).toBeNull();
  });

  it("detects price_spike at exactly 5%", () => {
    const result = detectIntradayAnomaly(tick({ lastPrice: 105_000 }), BASE_CTX);
    expect(result?.triggerType).toBe("price_spike");
  });

  it("detects price_drop at -5%", () => {
    const result = detectIntradayAnomaly(tick({ lastPrice: 95_000 }), BASE_CTX);
    expect(result?.triggerType).toBe("price_drop");
    expect(result?.priceChangePct).toBeCloseTo(-0.05, 5);
  });

  it("detects volume_spike when price stable", () => {
    const result = detectIntradayAnomaly(
      tick({ sessionVolume: 3_100_000 }),
      BASE_CTX,
    );
    expect(result?.triggerType).toBe("volume_spike");
    expect(result?.priceChangePct).toBeNull();
    expect(result?.volumeRatio).toBeCloseTo(3.1, 5);
  });

  it("prioritizes price_spike over volume_spike when both met", () => {
    const result = detectIntradayAnomaly(
      tick({ lastPrice: 106_000, sessionVolume: 3_500_000 }),
      BASE_CTX,
    );
    expect(result?.triggerType).toBe("price_spike");
    expect(result?.volumeRatio).toBeCloseTo(3.5, 5);
  });

  it("prioritizes price_drop over volume_spike when both met", () => {
    const result = detectIntradayAnomaly(
      tick({ lastPrice: 94_000, sessionVolume: 3_500_000 }),
      BASE_CTX,
    );
    expect(result?.triggerType).toBe("price_drop");
  });

  it("respects custom thresholds", () => {
    const result = detectIntradayAnomaly(
      tick({ lastPrice: 103_000 }),
      BASE_CTX,
      { priceChange: 0.03 },
    );
    expect(result?.triggerType).toBe("price_spike");
  });
});

describe("buildDedupKey", () => {
  it("buckets timestamps into 1-minute slots", () => {
    const a = buildDedupKey(
      "005930",
      "price_spike",
      "2026-04-19T05:30:05.123Z",
    );
    const b = buildDedupKey(
      "005930",
      "price_spike",
      "2026-04-19T05:30:59.999Z",
    );
    expect(a).toBe(b);
  });

  it("creates different keys for different minutes", () => {
    const a = buildDedupKey("005930", "price_spike", "2026-04-19T05:30:00Z");
    const b = buildDedupKey("005930", "price_spike", "2026-04-19T05:31:00Z");
    expect(a).not.toBe(b);
  });

  it("creates different keys for different triggers", () => {
    const a = buildDedupKey("005930", "price_spike", "2026-04-19T05:30:00Z");
    const b = buildDedupKey("005930", "price_drop", "2026-04-19T05:30:00Z");
    expect(a).not.toBe(b);
  });
});

describe("toIntradayAnomalyRecord", () => {
  it("serializes percent with 3 decimals and ratio with 2 decimals", () => {
    const record = toIntradayAnomalyRecord(
      tick({ lastPrice: 95_123 }),
      {
        triggerType: "price_drop",
        priceChangePct: (95_123 - 100_000) / 100_000,
        volumeRatio: 3.1234567,
      },
    );
    expect(record.priceChangePct).toBe(-4.877);
    expect(record.volumeRatio).toBe(3.12);
    expect(record.lastPrice).toBe(95_123);
    expect(record.dedupKey).toMatch(/005930:price_drop:/);
  });
});

describe("buildIntradayAnomalyAlert", () => {
  it("maps volume_spike to warning severity", () => {
    const alert = buildIntradayAnomalyAlert(
      tick({ sessionVolume: 3_100_000 }),
      { triggerType: "volume_spike", priceChangePct: null, volumeRatio: 3.1 },
    );
    expect(alert.severity).toBe("warning");
    expect(alert.alertType).toBe("intraday_anomaly");
    expect(alert.triggerReason).toContain("거래량 폭증");
    expect(alert.triggerReason).toContain("3.10×");
  });

  it("maps price spike to critical severity", () => {
    const alert = buildIntradayAnomalyAlert(
      tick({ lastPrice: 106_000 }),
      {
        triggerType: "price_spike",
        priceChangePct: 0.06,
        volumeRatio: null,
      },
    );
    expect(alert.severity).toBe("critical");
    expect(alert.triggerReason).toContain("급등");
    expect(alert.triggerReason).toContain("6.00%");
  });
});

describe("isTickerEnabledForIntraday", () => {
  const map = new Map<string, boolean>([
    ["005930", true],
    ["035720", false],
  ]);

  it("defaults to enabled when ticker missing from map", () => {
    expect(isTickerEnabledForIntraday("000660", map)).toBe(true);
  });

  it("respects explicit true", () => {
    expect(isTickerEnabledForIntraday("005930", map)).toBe(true);
  });

  it("respects explicit false", () => {
    expect(isTickerEnabledForIntraday("035720", map)).toBe(false);
  });
});
