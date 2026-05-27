// admin-news.test.ts — 58차 Mock cleanup Step 2.1
//
// news_event 테이블 SELECT helper 단위 테스트.
// - transformNewsEventRow: snake → camel 매핑 + severity 검증
// - getRecentNewsEvents: empty / severity filter / limit / error

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getRecentNewsEvents,
  transformNewsEventRow,
  type NewsEventDbRow,
} from "@/lib/data/admin-news";

interface SelectChain {
  select: (...args: unknown[]) => SelectChain;
  order: (...args: unknown[]) => SelectChain;
  limit: (...args: unknown[]) => SelectChain;
  eq: (...args: unknown[]) => SelectChain;
  then: <T>(
    onFulfilled: (value: {
      data: NewsEventDbRow[] | null;
      error: { code?: string; message?: string } | null;
    }) => T,
  ) => Promise<T>;
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
    then: (onFulfilled) => Promise.resolve(mocks.resolved).then(onFulfilled),
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
