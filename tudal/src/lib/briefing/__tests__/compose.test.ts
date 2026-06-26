// compose.test.ts — M11 모닝 브리핑 컴포저 단위 테스트 (S5a T5a.2)
import { describe, it, expect } from "vitest";
import { composeBriefing, toBriefingLogRecord } from "../compose";
import type { NewsEvent, PortfolioSnapshot } from "@/types/admin";

function snap(
  totalReturn: number,
  kospiReturn: number,
  alpha: number,
): PortfolioSnapshot {
  return {
    id: "s1",
    date: "2026-04-18",
    month: "2026-04-01",
    ticker: null,
    entryPrice: 0,
    currentPrice: 0,
    weight: 0,
    isCash: false,
    dailyReturn: 0,
    totalReturn,
    kospiReturn,
    alpha,
    sharpe: 1.0,
  };
}

function news(title: string): NewsEvent {
  return {
    id: title,
    ticker: null,
    severity: "critical",
    title,
    source: "test.com",
    url: `https://test.com/${encodeURIComponent(title)}`,
    publishedAt: "2026-04-18T08:00:00+09:00",
    fetchedAt: "2026-04-18T08:05:00+09:00",
    classificationReason: "test",
  };
}

describe("composeBriefing", () => {
  it("3줄 요약(포트·주의·뉴스) 모두 포함", () => {
    const out = composeBriefing({
      date: "2026-04-19",
      portfolioSnapshot: snap(0.0042, 0.0018, 0.0024),
      attentionTickers: [
        { ticker: "005930", name: "삼성전자", reason: "실적 발표 전 변동성" },
      ],
      topNews: [news("뉴스1"), news("뉴스2"), news("뉴스3")],
    });

    expect(out.contentSummary).toMatch(/어제 포트 \+0\.42%/);
    expect(out.contentSummary).toMatch(/주의 종목 1건/);
    expect(out.contentSummary).toMatch(/뉴스1/);
    expect(out.contentSummary).toMatch(/뉴스2/);
    expect(out.contentSummary).toMatch(/뉴스3/);
  });

  it("음수 수익률 포맷 '-' 부호 사용", () => {
    const out = composeBriefing({
      date: "2026-04-19",
      portfolioSnapshot: snap(-0.0008, 0.0021, -0.0029),
      attentionTickers: [],
      topNews: [],
    });
    expect(out.contentSummary).toMatch(/-0\.08%/);
    expect(out.contentSummary).toMatch(/alpha -0\.29pp/);
  });

  it("snapshot=null → 데이터 없음 문구", () => {
    const out = composeBriefing({
      date: "2026-04-19",
      portfolioSnapshot: null,
      attentionTickers: [],
      topNews: [],
    });
    expect(out.contentSummary).toMatch(/어제 포트 데이터 없음/);
  });

  it("주의 종목 0건 → '주의 종목 0건' 표기", () => {
    const out = composeBriefing({
      date: "2026-04-19",
      portfolioSnapshot: snap(0.001, 0.001, 0),
      attentionTickers: [],
      topNews: [],
    });
    expect(out.contentSummary).toMatch(/주의 종목 0건/);
  });

  it("뉴스 4건 이상이면 상위 3건만 노출 + 전체 건수 유지", () => {
    const out = composeBriefing({
      date: "2026-04-19",
      portfolioSnapshot: snap(0, 0, 0),
      attentionTickers: [],
      topNews: [news("A"), news("B"), news("C"), news("D"), news("E")],
    });
    expect(out.contentSummary).toMatch(/뉴스 3건/);
    expect(out.contentSummary).toMatch(/A/);
    expect(out.contentSummary).toMatch(/B/);
    expect(out.contentSummary).toMatch(/C/);
    expect(out.contentSummary).not.toMatch(/ D\b/); // D는 미포함
  });

  it("G4: macroContext 미지정 → macro 라인 없음 (현행 회귀)", () => {
    const out = composeBriefing({
      date: "2026-04-19",
      portfolioSnapshot: snap(0.001, 0.001, 0),
      attentionTickers: [],
      topNews: [],
    });
    expect(out.contentSummary).not.toMatch(/거시/);
  });

  it("G4: macroContext 지정 → contentSummary·telegram에 macro 라인 삽입", () => {
    const out = composeBriefing({
      date: "2026-04-19",
      portfolioSnapshot: snap(0.001, 0.001, 0),
      attentionTickers: [],
      topNews: [],
      macroContext: "거시: 강세(예측 아님)",
    });
    expect(out.contentSummary).toContain("거시: 강세(예측 아님)");
    expect(out.telegram).toContain("거시: 강세(예측 아님)");
  });

  it("G4: multiline macroContext → briefing macro 라인 1줄로 정규화", () => {
    const out = composeBriefing({
      date: "2026-04-19",
      portfolioSnapshot: snap(0.001, 0.001, 0),
      attentionTickers: [],
      topNews: [],
      macroContext: "[거시 컨텍스트 · asOf 2026-04-11]\n시장 국면: 강세\n주요 동인: 금리.",
    });
    const macroLine = out.telegram
      .split("\n")
      .find((line) => line.includes("[거시 컨텍스트"));
    expect(macroLine).toBe(
      "[거시 컨텍스트 · asOf 2026-04-11] 시장 국면: 강세 주요 동인: 금리.",
    );
  });

  it("telegram 본문에 3줄 모두 포함 + 제목 굵기", () => {
    const out = composeBriefing({
      date: "2026-04-19",
      portfolioSnapshot: snap(0.01, 0.005, 0.005),
      attentionTickers: [],
      topNews: [news("T")],
    });
    expect(out.telegram).toMatch(/^\*/); // asterisk bold 시작
    expect(out.telegram.split("\n").length).toBeGreaterThanOrEqual(4);
  });
});

describe("toBriefingLogRecord", () => {
  it("composed → BriefingLog 페이로드 변환 · 채널·실패 플래그 보존", () => {
    const out = composeBriefing({
      date: "2026-04-19",
      portfolioSnapshot: snap(0, 0, 0),
      attentionTickers: [],
      topNews: [],
    });
    const rec = toBriefingLogRecord(out, ["telegram", "dashboard"], false);
    expect(rec.date).toBe("2026-04-19");
    expect(rec.sentChannels).toEqual(["telegram", "dashboard"]);
    expect(rec.generationFailed).toBe(false);
    expect(rec.contentSummary).toContain("포트");
  });

  it("generationFailed=true 전파", () => {
    const out = composeBriefing({
      date: "2026-04-19",
      portfolioSnapshot: null,
      attentionTickers: [],
      topNews: [],
    });
    const rec = toBriefingLogRecord(out, [], true);
    expect(rec.generationFailed).toBe(true);
    expect(rec.sentChannels).toEqual([]);
  });
});
