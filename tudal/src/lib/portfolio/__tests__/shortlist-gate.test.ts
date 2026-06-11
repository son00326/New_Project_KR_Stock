import { describe, it, expect } from "vitest";
import type { ShortListItem } from "@/types/admin";
import {
  filterActiveShortlist,
  resolveShortlistGeneratedAt,
  getGateTickers,
  computeMinimumViewerCount,
} from "../shortlist-gate";

// 최소 fixture — 게이트 로직이 보는 필드(ticker/deltaStatus/createdAt)만 의미. 나머지는 형식 충족용.
function item(
  ticker: string,
  deltaStatus: ShortListItem["deltaStatus"],
  createdAt: string | undefined,
): ShortListItem {
  return {
    id: ticker,
    month: "2026-06-01",
    ticker,
    name: ticker,
    sector: "",
    bucket: "short",
    rank: 1,
    compositeScore: 0,
    trendScore: 0,
    momentumScore: 0,
    volatilityScore: 0,
    divergencePct: 0,
    sparkline7d: [],
    deltaStatus,
    createdAt,
  } as unknown as ShortListItem;
}

describe("shortlist-gate (77차 Accept-gate 공유 로직)", () => {
  it("filterActiveShortlist: removed 제외", () => {
    const sl = [item("A", "new", "2026-06-09T00:00:00Z"), item("B", "removed", "2026-06-09T00:00:00Z")];
    expect(filterActiveShortlist(sl).map((s) => s.ticker)).toEqual(["A"]);
  });

  it("resolveShortlistGeneratedAt: active 중 MAX created_at (mixed cadence anchor)", () => {
    const sl = [
      item("OLD", "hold", "2026-06-01T00:00:00Z"),
      item("NEW", "new", "2026-06-09T12:00:00Z"), // 최신 short refresh
      item("REMOVED_NEWER", "removed", "2026-06-30T00:00:00Z"), // removed는 무시
    ];
    expect(resolveShortlistGeneratedAt(sl)?.toISOString()).toBe("2026-06-09T12:00:00.000Z");
  });

  it("resolveShortlistGeneratedAt: active 없거나 createdAt 전무 → null", () => {
    expect(resolveShortlistGeneratedAt([])).toBeNull();
    expect(resolveShortlistGeneratedAt([item("A", "removed", "2026-06-09T00:00:00Z")])).toBeNull();
    expect(resolveShortlistGeneratedAt([item("A", "new", undefined)])).toBeNull();
  });

  it("getGateTickers: active 전 종목 (legacy mock 하드코딩 제거 — 결정론)", () => {
    const sl = [
      item("005930", "new", "2026-06-09T00:00:00Z"),
      item("999999", "new", "2026-06-09T00:00:00Z"), // legacy mock set에 없던 티커도 포함
      item("111111", "removed", "2026-06-09T00:00:00Z"),
    ];
    expect(getGateTickers(sl)).toEqual(["005930", "999999"]);
  });

  it("computeMinimumViewerCount: 대상 중 최소 viewer (하나라도 2 미만이면 미달)", () => {
    const vc = new Map([
      ["A", 2],
      ["B", 1],
    ]);
    expect(computeMinimumViewerCount(["A", "B"], vc)).toBe(1); // B가 1 → min 1
    expect(computeMinimumViewerCount(["A"], vc)).toBe(2);
    expect(computeMinimumViewerCount(["A", "C"], vc)).toBe(0); // C 미기록 → 0
    expect(computeMinimumViewerCount([], vc)).toBe(0);
  });

  it("실 열람 반영: 게이트 대상에 없던 티커 열람은 무관, 대상 티커 열람만 반영", () => {
    // 구버그(legacy mock 무시)와 달리, 게이트 대상=active 전 종목이므로 실제 열람한 대상만 카운트.
    const sl = [item("A", "new", "2026-06-09T00:00:00Z"), item("B", "new", "2026-06-09T00:00:00Z")];
    const tickers = getGateTickers(sl);
    const vc = new Map([["A", 2], ["B", 2]]);
    expect(computeMinimumViewerCount(tickers, vc)).toBe(2); // 둘 다 2 → 통과
  });
});
