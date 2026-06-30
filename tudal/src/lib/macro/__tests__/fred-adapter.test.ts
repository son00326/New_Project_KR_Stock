import { describe, it, expect, vi } from "vitest";
import {
  fetchFredSeries,
  toMacroIndicator,
  buildFredMacroSource,
  type FredFetchImpl,
  type FredFetchResult,
} from "@/lib/macro/fred-adapter";
import { buildMacroContext, renderMacroContextString } from "@/lib/macro/context";

// ---------------------------------------------------------------------------
// G4 fred-adapter — fetchImpl 주입(실 FRED 호출 0). api_key 절대 로그/에러 미포함.
//   부분실패 → buildFredMacroSource null('' fail-safe). 9 series → MacroContextSource.
// ---------------------------------------------------------------------------

const PREDICTION_VOCAB =
  /상승 예측|하락 예측|상승할|하락할|목표가|매수 신호|매도 신호/;

const DUMMY_KEY = "dummy-fred-key-ABCDEF";

// FRED series/observations 응답(desc 정렬) 합성.
function obsResult(values: Array<{ date: string; value: string }>): FredFetchResult {
  return {
    ok: true,
    status: 200,
    json: async () => ({ observations: values }),
  };
}

// 9 series 전부 같은 단순 값을 주는 fetchImpl (series_id 무관 success).
function uniformFetch(
  per: (seriesId: string) => Array<{ date: string; value: string }>,
): FredFetchImpl {
  return async (url: string) => {
    const sid = new URL(url).searchParams.get("series_id") ?? "";
    return obsResult(per(sid));
  };
}

// 두 관측치(today, prev) 기본 — 모든 series에 동일하게 공급(개별 signal 검증은 별도).
const TWO_LEVEL = [
  { date: "2026-06-26", value: "10" },
  { date: "2026-06-25", value: "10" },
];

describe("fetchFredSeries", () => {
  it("success → observations[] 반환(desc, value 그대로)", async () => {
    const fetchImpl = uniformFetch(() => TWO_LEVEL);
    const obs = await fetchFredSeries({
      seriesId: "VIXCLS",
      apiKey: DUMMY_KEY,
      fetchImpl,
    });
    expect(obs).toEqual(TWO_LEVEL);
  });

  it("api_key는 thrown error 메시지에 절대 포함되지 않음 (4xx)", async () => {
    const fetchImpl: FredFetchImpl = async () => ({
      ok: false,
      status: 400,
      json: async () => ({}),
    });
    await expect(
      fetchFredSeries({ seriesId: "VIXCLS", apiKey: DUMMY_KEY, fetchImpl }),
    ).rejects.toThrow(/fred_fetch_failed:400:VIXCLS/);
    try {
      await fetchFredSeries({ seriesId: "VIXCLS", apiKey: DUMMY_KEY, fetchImpl });
      throw new Error("should have thrown");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      expect(msg).not.toContain(DUMMY_KEY);
      expect(msg).not.toContain("api_key");
      expect(msg).not.toContain("stlouisfed");
    }
  });

  it("4xx → 즉시 throw (재시도 없음)", async () => {
    let calls = 0;
    const fetchImpl: FredFetchImpl = async () => {
      calls++;
      return { ok: false, status: 403, json: async () => ({}) };
    };
    await expect(
      fetchFredSeries({ seriesId: "DGS10", apiKey: DUMMY_KEY, fetchImpl }),
    ).rejects.toThrow(/fred_fetch_failed:403:DGS10/);
    expect(calls).toBe(1);
  });

  it("5xx → backoff 재시도 후 retries_exhausted throw", async () => {
    let calls = 0;
    const fetchImpl: FredFetchImpl = async () => {
      calls++;
      return { ok: false, status: 500, json: async () => ({}) };
    };
    const sleepImpl = vi.fn(async () => {});
    await expect(
      fetchFredSeries({
        seriesId: "FEDFUNDS",
        apiKey: DUMMY_KEY,
        fetchImpl,
        sleepImpl,
      }),
    ).rejects.toThrow(/fred_fetch_failed:retries_exhausted:500:FEDFUNDS/);
    expect(calls).toBeGreaterThan(1);
  });

  it("fetch reject(네트워크) → backoff 재시도 후 throw", async () => {
    const fetchImpl: FredFetchImpl = async () => {
      throw new Error("network down");
    };
    const sleepImpl = vi.fn(async () => {});
    await expect(
      fetchFredSeries({
        seriesId: "UNRATE",
        apiKey: DUMMY_KEY,
        fetchImpl,
        sleepImpl,
      }),
    ).rejects.toThrow(/fred_fetch_failed:retries_exhausted/);
  });

  it("api_key 부재(빈 문자열) → 즉시 throw (값 미노출)", async () => {
    const fetchImpl = uniformFetch(() => TWO_LEVEL);
    await expect(
      fetchFredSeries({ seriesId: "VIXCLS", apiKey: "", fetchImpl }),
    ).rejects.toThrow(/fred_api_key_missing/);
  });
});

describe("toMacroIndicator — value '.' / 부족 관측치 skip", () => {
  it("latest value '.' (FRED missing) → 최신 non-dot 2개로 계산", () => {
    const r = toMacroIndicator("VIXCLS", [
      { date: "2026-06-26", value: "." },
      { date: "2026-06-25", value: "18.0" },
      { date: "2026-06-24", value: "16.0" },
    ]);
    expect(r).not.toBeNull();
    expect(r).toMatchObject({
      value: 18,
      previousValue: 16,
      updatedAt: "2026-06-25T00:00:00Z",
    });
  });

  it("non-dot 관측치 < 2 → null (change 계산 불가)", () => {
    const r = toMacroIndicator("VIXCLS", [
      { date: "2026-06-26", value: "." },
      { date: "2026-06-25", value: "18.0" },
    ]);
    expect(r).toBeNull();
  });

  it("관측치 < 2 → null (change 계산 불가)", () => {
    const r = toMacroIndicator("VIXCLS", [{ date: "2026-06-26", value: "18.0" }]);
    expect(r).toBeNull();
  });

  it("정상 → MacroIndicator(updatedAt Z-qualified)", () => {
    const r = toMacroIndicator("VIXCLS", [
      { date: "2026-06-26", value: "22.5" },
      { date: "2026-06-25", value: "20.1" },
    ]);
    expect(r).not.toBeNull();
    expect(r!.id).toBe("vix");
    expect(r!.value).toBe(22.5);
    expect(r!.updatedAt).toBe("2026-06-26T00:00:00Z");
    expect(r!.updatedAt.endsWith("Z")).toBe(true);
  });
});

describe("toMacroIndicator — signal threshold 경계", () => {
  it("VIX >= 20 → bearish", () => {
    const r = toMacroIndicator("VIXCLS", [
      { date: "2026-06-26", value: "20" },
      { date: "2026-06-25", value: "18" },
    ]);
    expect(r!.signal).toBe("bearish");
  });
  it("VIX <= 15 → bullish", () => {
    const r = toMacroIndicator("VIXCLS", [
      { date: "2026-06-26", value: "15" },
      { date: "2026-06-25", value: "16" },
    ]);
    expect(r!.signal).toBe("bullish");
  });
  it("VIX 17 (15<x<20) → neutral", () => {
    const r = toMacroIndicator("VIXCLS", [
      { date: "2026-06-26", value: "17" },
      { date: "2026-06-25", value: "16" },
    ]);
    expect(r!.signal).toBe("neutral");
  });

  it("DGS10 change < 0 → bullish (금리 하락=성장주 밸류 개선)", () => {
    const r = toMacroIndicator("DGS10", [
      { date: "2026-06-26", value: "4.10" },
      { date: "2026-06-25", value: "4.22" },
    ]);
    expect(r!.signal).toBe("bullish");
  });
  it("DGS10 change > 0 → bearish", () => {
    const r = toMacroIndicator("DGS10", [
      { date: "2026-06-26", value: "4.30" },
      { date: "2026-06-25", value: "4.10" },
    ]);
    expect(r!.signal).toBe("bearish");
  });
  it("DGS10 |change| < 0.02 → neutral", () => {
    const r = toMacroIndicator("DGS10", [
      { date: "2026-06-26", value: "4.110" },
      { date: "2026-06-25", value: "4.100" },
    ]);
    expect(r!.signal).toBe("neutral");
  });

  it("T10Y2Y value < 0 → bearish (역전)", () => {
    const r = toMacroIndicator("T10Y2Y", [
      { date: "2026-06-26", value: "-0.20" },
      { date: "2026-06-25", value: "-0.10" },
    ]);
    expect(r!.signal).toBe("bearish");
  });
  it("T10Y2Y value >= 0 & change > 0 → bullish (가팔라짐)", () => {
    const r = toMacroIndicator("T10Y2Y", [
      { date: "2026-06-26", value: "0.20" },
      { date: "2026-06-25", value: "0.10" },
    ]);
    expect(r!.signal).toBe("bullish");
  });

  it("CPIAUCSL YoY 둔화(change<0) → bullish", () => {
    // idx[0]/idx[12]-1 = YoY now; idx[1]/idx[13]-1 = YoY prev.
    // now YoY 작게, prev YoY 크게 → change < 0.
    const series: Array<{ date: string; value: string }> = [];
    // 14개 desc. now=315 (12개월 전=310 → 1.61%), prev(idx1)=314.5 (idx13=308 → 2.11%).
    const vals = [
      315, 314.5, 314, 313.5, 313, 312.5, 312, 311.5, 311, 310.5, 310.2, 310.1,
      310, 308,
    ];
    for (let i = 0; i < vals.length; i++) {
      series.push({ date: `2026-06-${String(26 - i).padStart(2, "0")}`, value: String(vals[i]) });
    }
    const r = toMacroIndicator("CPIAUCSL", series);
    expect(r).not.toBeNull();
    expect(r!.id).toBe("us-cpi");
    expect(r!.signal).toBe("bullish");
  });
});

describe("buildFredMacroSource — 9 series parallel", () => {
  it("전 series success → MacroContextSource (verdict 합성 + render)", async () => {
    const fetchImpl = uniformFetch((sid) => {
      if (sid === "CPIAUCSL") {
        // 14 관측치 필요.
        return Array.from({ length: 14 }, (_, i) => ({
          date: `2026-06-${String(26 - i).padStart(2, "0")}`,
          value: String(300 - i * 0.1),
        }));
      }
      return [
        { date: "2026-06-26", value: "10" },
        { date: "2026-06-25", value: "10" },
      ];
    });
    const src = await buildFredMacroSource({ apiKey: DUMMY_KEY, fetchImpl });
    expect(src).not.toBeNull();
    expect(src!.source).toContain("fred");
    expect(src!.indicators.length).toBeGreaterThan(0);
    expect(src!.verdict.updatedAt.endsWith("Z")).toBe(true);

    // render → disclaimer + 카테고리 동인 + 예측어휘 0.
    const ctx = buildMacroContext(src!);
    const rendered = renderMacroContextString(ctx);
    expect(rendered).toContain("예측 아님");
    expect(rendered).toContain("Tier0 스크리닝 팩터 아님");
    expect(rendered).not.toMatch(PREDICTION_VOCAB);
  });

  it("1 series fetch 실패 → per-series degrade, 나머지 지표로 source 유지", async () => {
    const fetchImpl: FredFetchImpl = async (url) => {
      const sid = new URL(url).searchParams.get("series_id") ?? "";
      if (sid === "DGS10") {
        return { ok: false, status: 500, json: async () => ({}) };
      }
      if (sid === "CPIAUCSL") {
        return obsResult(Array.from({ length: 14 }, (_, i) => ({
          date: `2026-06-${String(26 - i).padStart(2, "0")}`,
          value: String(300 - i * 0.1),
        })));
      }
      return obsResult(TWO_LEVEL);
    };
    const src = await buildFredMacroSource({
      apiKey: DUMMY_KEY,
      fetchImpl,
      sleepImpl: async () => {}, // backoff 즉시(실 대기 0).
    });
    expect(src).not.toBeNull();
    expect(src?.indicators.some((i) => i.id === "us-10y")).toBe(false);
    expect(src?.indicators.length).toBe(8);
  });

  it("api_key 부재 → null (fail-safe, throw 아님)", async () => {
    const fetchImpl = uniformFetch(() => TWO_LEVEL);
    const src = await buildFredMacroSource({ apiKey: "", fetchImpl });
    expect(src).toBeNull();
  });

  it("latest missing-value('.')는 window 안 최신 non-dot로 대체해 source 유지", async () => {
    const fetchImpl = uniformFetch((sid) => {
      if (sid === "DEXKOUS" || sid === "DCOILWTICO" || sid === "T10Y2Y") {
        return [
          { date: "2026-06-26", value: "." },
          { date: "2026-06-25", value: "10" },
          { date: "2026-06-24", value: "9" },
        ];
      }
      if (sid === "CPIAUCSL") {
        return Array.from({ length: 14 }, (_, i) => ({
          date: `2026-06-${String(26 - i).padStart(2, "0")}`,
          value: String(300 - i * 0.1),
        }));
      }
      return TWO_LEVEL;
    });
    const src = await buildFredMacroSource({ apiKey: DUMMY_KEY, fetchImpl });
    expect(src).not.toBeNull();
    const usdKrw = src?.indicators.find((i) => i.id === "usd-krw");
    expect(usdKrw?.updatedAt).toBe("2026-06-25T00:00:00Z");
  });

  it("FRED 요청 limit은 missing-value 회피용 window로 확대됨", async () => {
    const limits = new Map<string, string>();
    const fetchImpl: FredFetchImpl = async (url) => {
      const u = new URL(url);
      const sid = u.searchParams.get("series_id") ?? "";
      limits.set(sid, u.searchParams.get("limit") ?? "");
      if (sid === "CPIAUCSL") {
        return obsResult(Array.from({ length: 14 }, (_, i) => ({
          date: `2026-06-${String(26 - i).padStart(2, "0")}`,
          value: String(300 - i * 0.1),
        })));
      }
      return obsResult(TWO_LEVEL);
    };
    await expect(buildFredMacroSource({ apiKey: DUMMY_KEY, fetchImpl })).resolves.not.toBeNull();
    expect(limits.get("DEXKOUS")).toBe("7");
    expect(limits.get("DCOILWTICO")).toBe("7");
    expect(limits.get("T10Y2Y")).toBe("7");
    expect(limits.get("CPIAUCSL")).toBe("20");
  });

  it("유효 지표가 최소치 미만이면 null (too-sparse full fail-safe)", async () => {
    const validSeries = new Set(["VIXCLS", "DGS10", "CPIAUCSL", "DEXKOUS", "DCOILWTICO"]);
    const fetchImpl = uniformFetch((sid) => {
      if (!validSeries.has(sid)) {
        return [
          { date: "2026-06-26", value: "." },
          { date: "2026-06-25", value: "." },
        ];
      }
      if (sid === "CPIAUCSL") {
        return Array.from({ length: 14 }, (_, i) => ({
          date: `2026-06-${String(26 - i).padStart(2, "0")}`,
          value: String(300 - i * 0.1),
        }));
      }
      return TWO_LEVEL;
    });
    const src = await buildFredMacroSource({ apiKey: DUMMY_KEY, fetchImpl });
    expect(src).toBeNull();
  });

  it("slow/hung FRED fetch는 overall budget에서 null fail-safe", async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl: FredFetchImpl = async () =>
        new Promise<FredFetchResult>(() => {});
      const pending = buildFredMacroSource({
        apiKey: DUMMY_KEY,
        fetchImpl,
        overallTimeoutMs: 250,
      });
      await vi.advanceTimersByTimeAsync(250);
      await expect(pending).resolves.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("buildFredMacroSource — 예측 어휘 금지 (guardrail)", () => {
  it("모든 indicator.description / verdict 에 예측 어휘 없음", async () => {
    const fetchImpl = uniformFetch((sid) => {
      if (sid === "CPIAUCSL") {
        return Array.from({ length: 14 }, (_, i) => ({
          date: `2026-06-${String(26 - i).padStart(2, "0")}`,
          value: String(300 - i * 0.1),
        }));
      }
      return TWO_LEVEL;
    });
    const src = await buildFredMacroSource({ apiKey: DUMMY_KEY, fetchImpl });
    expect(src).not.toBeNull();
    expect(src!.verdict.summary).not.toMatch(PREDICTION_VOCAB);
    for (const d of src!.verdict.details) {
      expect(d.reason).not.toMatch(PREDICTION_VOCAB);
    }
    for (const ind of src!.indicators) {
      expect(ind.description).not.toMatch(PREDICTION_VOCAB);
    }
  });
});
