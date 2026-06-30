// admin-news.test.ts — 58차 Mock cleanup Step 2.1
//
// news_event 테이블 SELECT helper 단위 테스트.
// - transformNewsEventRow: snake → camel 매핑 + severity 검증
// - getRecentNewsEvents: empty / severity filter / limit / error
// - getRecentNewsEventsForUniverse: per-ticker bounded read (tail starvation fix)

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getRecentNewsEvents,
  getRecentNewsEventsForUniverse,
  transformNewsEventRow,
  type NewsEventDbRow,
} from "@/lib/data/admin-news";

interface SelectResult {
  data: NewsEventDbRow[] | null;
  error: { code?: string; message?: string } | null;
}

interface SelectChain extends PromiseLike<SelectResult> {
  select: (...args: unknown[]) => SelectChain;
  order: (...args: unknown[]) => SelectChain;
  limit: (...args: unknown[]) => SelectChain;
  eq: (...args: unknown[]) => SelectChain;
  returns: () => SelectChain;
  then: <TResult1 = SelectResult, TResult2 = never>(
    onFulfilled?:
      | ((value: SelectResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onRejected?:
      | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
      | null,
  ) => Promise<TResult1 | TResult2>;
}

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  resolved: {
    data: null as NewsEventDbRow[] | null,
    error: null as { code?: string; message?: string } | null,
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: mocks.from,
  })),
}));

const baseRow: NewsEventDbRow = {
  id: "00000000-0000-0000-0000-000000001001",
  ticker: "005930",
  severity: "critical",
  title: "삼성전자, 美 파운드리 공장 가동 지연 발표",
  source: "연합뉴스",
  url: "https://example.com/news/sample",
  published_at: "2026-05-27T08:12:00.000Z",
  fetched_at: "2026-05-27T08:15:00.000Z",
  classification_reason: "핵심 사업 키워드 매칭",
};

describe("transformNewsEventRow", () => {
  it("maps snake_case columns to camelCase NewsEvent", () => {
    const event = transformNewsEventRow(baseRow);
    expect(event.id).toBe(baseRow.id);
    expect(event.ticker).toBe("005930");
    expect(event.severity).toBe("critical");
    expect(event.title).toBe(baseRow.title);
    expect(event.source).toBe(baseRow.source);
    expect(event.url).toBe(baseRow.url);
    expect(event.publishedAt).toBe(baseRow.published_at);
    expect(event.fetchedAt).toBe(baseRow.fetched_at);
    expect(event.classificationReason).toBe(baseRow.classification_reason);
  });

  it("supports null ticker (market-wide news)", () => {
    expect(transformNewsEventRow({ ...baseRow, ticker: null }).ticker).toBeNull();
  });

  it("supports null classification_reason", () => {
    expect(
      transformNewsEventRow({ ...baseRow, classification_reason: null })
        .classificationReason,
    ).toBeNull();
  });

  it("throws on invalid severity", () => {
    expect(() =>
      transformNewsEventRow({ ...baseRow, severity: "loud" }),
    ).toThrow(/news_event_invalid_severity/);
  });
});

function makeListChain(): SelectChain {
  const chain: SelectChain = {
    select: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    returns: vi.fn(() => chain),
    then: (onFulfilled, onRejected) =>
      Promise.resolve(mocks.resolved).then(onFulfilled, onRejected),
  };
  return chain;
}

describe("getRecentNewsEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolved = { data: [], error: null };
    mocks.from.mockReturnValue(makeListChain());
  });

  it("returns empty array when DB returns 0 rows", async () => {
    mocks.resolved = { data: [], error: null };
    const out = await getRecentNewsEvents();
    expect(out).toEqual([]);
  });

  it("uses injected client without creating a session client", async () => {
    const chain = makeListChain();
    const injectedFrom = vi.fn(() => chain);
    const { createClient } = await import("@/lib/supabase/server");

    const out = await getRecentNewsEvents({
      client: { from: injectedFrom } as never,
    });

    expect(out).toEqual([]);
    expect(createClient).not.toHaveBeenCalled();
    expect(injectedFrom).toHaveBeenCalledWith("news_event");
  });

  it("falls back to session client when no client is injected", async () => {
    const { createClient } = await import("@/lib/supabase/server");

    await getRecentNewsEvents();

    expect(createClient).toHaveBeenCalledTimes(1);
    expect(mocks.from).toHaveBeenCalledWith("news_event");
  });

  it("maps non-empty rows to NewsEvent[]", async () => {
    mocks.resolved = {
      data: [
        baseRow,
        {
          ...baseRow,
          id: "00000000-0000-0000-0000-000000001002",
          severity: "warning",
          ticker: null,
        },
      ],
      error: null,
    };
    const out = await getRecentNewsEvents();
    expect(out).toHaveLength(2);
    expect(out[0].severity).toBe("critical");
    expect(out[1].severity).toBe("warning");
    expect(out[1].ticker).toBeNull();
  });

  it("applies eq(severity) when severity filter provided", async () => {
    const chain = makeListChain();
    mocks.from.mockReturnValue(chain);
    mocks.resolved = { data: [], error: null };
    await getRecentNewsEvents({ severity: "warning" });
    expect(chain.eq).toHaveBeenCalledWith("severity", "warning");
  });

  it("rejects invalid severity filter value before hitting DB", async () => {
    await expect(
      getRecentNewsEvents({ severity: "loud" as never }),
    ).rejects.toThrow(/news_event_invalid_severity_filter/);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("applies limit when positive", async () => {
    const chain = makeListChain();
    mocks.from.mockReturnValue(chain);
    mocks.resolved = { data: [], error: null };
    await getRecentNewsEvents({ limit: 25 });
    expect(chain.limit).toHaveBeenCalledWith(25);
  });

  it("throws wrapped error on supabase error", async () => {
    mocks.resolved = {
      data: null,
      error: { code: "PGRST301", message: "rls denied" },
    };
    await expect(getRecentNewsEvents()).rejects.toThrow(
      /news_event_select_failed/,
    );
  });
});

// ---------------------------------------------------------------------------
// getRecentNewsEventsForUniverse — per-ticker bounded read (tail starvation fix).
//
// 결함: getRecentNewsEvents({limit:50})은 전역 published_at desc top-50 1윈도라
//   hot 종목(005930 등)이 윈도를 잠식 → quiet 종목 28종은 0건으로 굶음(tail starvation).
// fix: 종목별로 .eq('ticker',t).limit(per) 독립 쿼리 → 한 종목이 다른 종목 슬롯을 못 먹음.
//
// 종목별 row map을 resolve하는 per-ticker mock(SelectChain.eq('ticker',...)로 종목 캡처).
// ---------------------------------------------------------------------------

// 종목별 row 집합을 .eq('ticker',t) 인자로 분기 resolve하는 chain.
//   - eq('ticker', t)면 현재 종목 캡처
//   - eq('severity', s)면 severity 필터 캡처(쿼리 분기 없음 — fixture는 이미 종목별로 분리)
//   - then: 캡처된 종목의 rows를 per-ticker limit으로 잘라 resolve.
//     errorTickers에 속한 종목은 error를 반환(graceful skip 검증용).
// ※ 종목별 독립 쿼리를 정확히 모델링하려면 각 .from() 호출이 distinct chain을 반환해야 한다
//   (공유 chain은 병렬 .eq('ticker') 캡처가 서로 덮어써 마지막 종목으로 수렴). 아래는 한 chain 인스턴스.
function makeUniverseChain(opts: {
  rowsByTicker: Record<string, NewsEventDbRow[]>;
  errorTickers?: ReadonlySet<string>;
  rejectTickers?: ReadonlySet<string>;
}): SelectChain {
  let capturedTicker: string | null = null;
  let capturedLimit = Number.POSITIVE_INFINITY;
  const chain: SelectChain = {
    select: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn((n: unknown) => {
      if (typeof n === "number") capturedLimit = n;
      return chain;
    }),
    eq: vi.fn((col: unknown, val: unknown) => {
      if (col === "ticker" && typeof val === "string") capturedTicker = val;
      return chain;
    }),
    returns: vi.fn(() => chain),
    then: (onFulfilled, onRejected) => {
      const t = capturedTicker ?? "";
      if (opts.rejectTickers?.has(t)) {
        return Promise.reject(new Error("ticker query rejected")).then(
          onFulfilled,
          onRejected,
        );
      }
      if (opts.errorTickers?.has(t)) {
        return Promise.resolve({
          data: null,
          error: { code: "PGRST500", message: "ticker query failed" },
        }).then(onFulfilled, onRejected);
      }
      const all = opts.rowsByTicker[t] ?? [];
      const sliced = all.slice(0, capturedLimit);
      return Promise.resolve({ data: sliced, error: null }).then(
        onFulfilled,
        onRejected,
      );
    },
  };
  return chain;
}

// from()이 호출마다 distinct chain을 반환하도록 mock(종목별 독립 쿼리 정확 모델링).
function mockUniverseFrom(opts: {
  rowsByTicker: Record<string, NewsEventDbRow[]>;
  errorTickers?: ReadonlySet<string>;
  rejectTickers?: ReadonlySet<string>;
}): void {
  mocks.from.mockImplementation(() => makeUniverseChain(opts));
}

function row(over: Partial<NewsEventDbRow> & { id: string }): NewsEventDbRow {
  return { ...baseRow, ...over };
}

describe("getRecentNewsEventsForUniverse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns [] without any DB round-trip when tickers is empty", async () => {
    const out = await getRecentNewsEventsForUniverse([], {
      client: { from: mocks.from } as never,
    });
    expect(out).toEqual([]);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("does not starve a quiet ticker even when a hot ticker has 50 rows in-store", async () => {
    // hot 종목 005930은 50건, quiet 종목 000660은 1건 — 전역 top-50 윈도였다면 굶었을 것.
    const hot: NewsEventDbRow[] = Array.from({ length: 50 }, (_, i) =>
      row({
        id: `hot-${i}`,
        ticker: "005930",
        url: `https://news/hot/${i}`,
        published_at: `2026-05-27T${String(10 + (i % 12)).padStart(2, "0")}:00:00.000Z`,
      }),
    );
    const quiet: NewsEventDbRow[] = [
      row({
        id: "quiet-1",
        ticker: "000660",
        title: "SK하이닉스 단신",
        url: "https://news/quiet/1",
        published_at: "2026-05-26T00:00:00.000Z",
      }),
    ];
    mockUniverseFrom({ rowsByTicker: { "005930": hot, "000660": quiet } });
    const out = await getRecentNewsEventsForUniverse(["005930", "000660"], {
      perTickerLimit: 2,
      client: { from: mocks.from } as never,
    });
    const tickers = out.map((n) => n.ticker);
    // hot은 perTickerLimit=2로 캡, quiet은 그대로 1건 — quiet이 살아남음.
    expect(tickers.filter((t) => t === "005930")).toHaveLength(2);
    expect(tickers).toContain("000660"); // 굶지 않음
  });

  it("dedupes a duplicate ticker in input (queried once)", async () => {
    mocks.from.mockReturnValue(
      makeUniverseChain({
        rowsByTicker: { "005930": [row({ id: "a", ticker: "005930" })] },
      }),
    );
    const out = await getRecentNewsEventsForUniverse(
      ["005930", "005930", "005930"],
      { client: { from: mocks.from } as never },
    );
    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(out).toHaveLength(1);
  });

  it("applies default perTickerLimit=2 when option omitted", async () => {
    const chain = makeUniverseChain({
      rowsByTicker: { "005930": [row({ id: "a", ticker: "005930" })] },
    });
    mocks.from.mockReturnValue(chain);
    await getRecentNewsEventsForUniverse(["005930"], {
      client: { from: mocks.from } as never,
    });
    expect(chain.limit).toHaveBeenCalledWith(2);
  });

  it("passes severity through (eq) and rejects invalid severity before any DB hit", async () => {
    const chain = makeUniverseChain({
      rowsByTicker: { "005930": [row({ id: "a", ticker: "005930" })] },
    });
    mocks.from.mockReturnValue(chain);
    await getRecentNewsEventsForUniverse(["005930"], {
      severity: "warning",
      client: { from: mocks.from } as never,
    });
    expect(chain.eq).toHaveBeenCalledWith("severity", "warning");

    mocks.from.mockClear();
    await expect(
      getRecentNewsEventsForUniverse(["005930"], {
        severity: "loud" as never,
        client: { from: mocks.from } as never,
      }),
    ).rejects.toThrow(/news_event_invalid_severity_filter/);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("gracefully skips a ticker whose query errors; other tickers still return", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockUniverseFrom({
      rowsByTicker: {
        "005930": [row({ id: "ok", ticker: "005930" })],
        "000660": [row({ id: "err", ticker: "000660" })],
      },
      errorTickers: new Set(["000660"]),
    });
    const out = await getRecentNewsEventsForUniverse(["005930", "000660"], {
      client: { from: mocks.from } as never,
    });
    const tickers = out.map((n) => n.ticker);
    expect(tickers).toContain("005930");
    expect(tickers).not.toContain("000660"); // errored ticker skipped, no global throw
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("news_event_universe_ticker_query_failed"),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("\"ticker\":\"000660\""),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("\"kind\":\"error\""),
    );
    warnSpy.mockRestore();
  });

  it("gracefully skips a ticker whose query rejects and warns with ticker context", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockUniverseFrom({
      rowsByTicker: {
        "005930": [row({ id: "ok", ticker: "005930" })],
        "000660": [row({ id: "reject", ticker: "000660" })],
      },
      rejectTickers: new Set(["000660"]),
    });
    const out = await getRecentNewsEventsForUniverse(["005930", "000660"], {
      client: { from: mocks.from } as never,
    });
    expect(out.map((n) => n.ticker)).toEqual(["005930"]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("\"ticker\":\"000660\""),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("\"kind\":\"rejected\""),
    );
    warnSpy.mockRestore();
  });

  it("re-sorts the merged multi-ticker result by publishedAt desc", async () => {
    mockUniverseFrom({
      rowsByTicker: {
        "005930": [
          row({
            id: "old",
            ticker: "005930",
            published_at: "2026-05-20T00:00:00.000Z",
          }),
        ],
        "000660": [
          row({
            id: "new",
            ticker: "000660",
            published_at: "2026-05-28T00:00:00.000Z",
          }),
        ],
      },
    });
    const out = await getRecentNewsEventsForUniverse(["005930", "000660"], {
      perTickerLimit: 2,
      client: { from: mocks.from } as never,
    });
    expect(out.map((n) => n.id)).toEqual(["new", "old"]); // desc
  });

  it("sorts offset ISO timestamps by actual time rather than string order", async () => {
    mockUniverseFrom({
      rowsByTicker: {
        "005930": [
          row({
            id: "utc-later",
            ticker: "005930",
            published_at: "2026-05-27T01:00:00.000Z",
          }),
        ],
        "000660": [
          row({
            id: "offset-earlier",
            ticker: "000660",
            published_at: "2026-05-27T09:30:00.000+09:00",
          }),
        ],
      },
    });
    const out = await getRecentNewsEventsForUniverse(["005930", "000660"], {
      client: { from: mocks.from } as never,
    });
    expect(out.map((n) => n.id)).toEqual(["utc-later", "offset-earlier"]);
  });

  it("returns only ticker-attributed rows (null-ticker market news never queried)", async () => {
    mocks.from.mockReturnValue(
      makeUniverseChain({
        rowsByTicker: { "005930": [row({ id: "a", ticker: "005930" })] },
      }),
    );
    const out = await getRecentNewsEventsForUniverse(["005930"], {
      client: { from: mocks.from } as never,
    });
    expect(out.every((n) => n.ticker !== null)).toBe(true);
  });

  it("warns and skips an unexpected null-ticker row if a client returns one", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.from.mockReturnValue(
      makeUniverseChain({
        rowsByTicker: {
          "005930": [row({ id: "market", ticker: null })],
        },
      }),
    );
    const out = await getRecentNewsEventsForUniverse(["005930"], {
      client: { from: mocks.from } as never,
    });
    expect(out).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("news_event_universe_ticker_mismatch"),
    );
    warnSpy.mockRestore();
  });

  it("falls back to session client when no client is injected", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    mocks.from.mockReturnValue(
      makeUniverseChain({
        rowsByTicker: { "005930": [row({ id: "a", ticker: "005930" })] },
      }),
    );
    await getRecentNewsEventsForUniverse(["005930"]);
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(mocks.from).toHaveBeenCalledWith("news_event");
  });
});
