// sector-distribution.test.ts — 항목4(b) 홈 "추천 30 섹터 분포" 집계 단위 테스트.
import { describe, it, expect } from "vitest";
import { aggregateSectorDistribution } from "../sector-distribution";

describe("aggregateSectorDistribution", () => {
  it("빈 입력이면 top=[], otherCount=0, total=0", () => {
    const dist = aggregateSectorDistribution([]);
    expect(dist.top).toEqual([]);
    expect(dist.otherCount).toBe(0);
    expect(dist.total).toBe(0);
  });

  it("섹터를 세고 count 내림차순으로 정렬한다", () => {
    const dist = aggregateSectorDistribution([
      "반도체",
      "반도체",
      "방산",
      "반도체",
      "방산",
      "바이오",
    ]);
    expect(dist.top).toEqual([
      { sector: "반도체", count: 3 },
      { sector: "방산", count: 2 },
      { sector: "바이오", count: 1 },
    ]);
    expect(dist.total).toBe(6);
    expect(dist.otherCount).toBe(0);
  });

  it("동점 섹터는 이름 오름차순으로 결정적 정렬한다", () => {
    const dist = aggregateSectorDistribution(["나", "가", "다"]);
    expect(dist.top.map((s) => s.sector)).toEqual(["가", "나", "다"]);
  });

  it("상위 5개 + 기타로 압축한다", () => {
    // 7개 섹터: 상위 5개는 top, 나머지 2개(각 1)는 otherCount=2.
    const sectors = [
      ...Array(8).fill("반도체"),
      ...Array(5).fill("방산"),
      ...Array(4).fill("바이오"),
      ...Array(3).fill("2차전지"),
      ...Array(2).fill("금융"),
      "유통",
      "건설",
    ];
    const dist = aggregateSectorDistribution(sectors, 5);
    expect(dist.top).toEqual([
      { sector: "반도체", count: 8 },
      { sector: "방산", count: 5 },
      { sector: "바이오", count: 4 },
      { sector: "2차전지", count: 3 },
      { sector: "금융", count: 2 },
    ]);
    expect(dist.otherCount).toBe(2);
    expect(dist.total).toBe(24);
  });

  it("빈/공백/null sector는 미분류로 귀속한다", () => {
    const dist = aggregateSectorDistribution(["반도체", "", "  ", null, undefined]);
    const unclassified = dist.top.find((s) => s.sector === "미분류");
    expect(unclassified?.count).toBe(4);
    expect(dist.total).toBe(5);
  });
});
