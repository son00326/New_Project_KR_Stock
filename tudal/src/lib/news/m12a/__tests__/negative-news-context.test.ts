import { describe, it, expect } from "vitest";
import {
  buildNegativeNewsContext,
  type NegativeNewsItem,
} from "@/lib/news/m12a/negative-news-context";

// R3.10-7c — 부정 뉴스 재진입 컨텍스트 빌더 (additive · forward-validate · ₩0 · pure).
// 헤더 문자열은 모듈과 정확히 일치해야 한다(mutation-pin).
const HEADER =
  "[최근 부정 뉴스 컨텍스트 · AI 컨텍스트 입력(예측 아님 · Tier0 스크리닝 팩터 아님)]";

// 예측 어휘 금지 집합(R3.10-7c): context이지 forecast가 아니다.
const FORBIDDEN_PREDICTION = /상승|하락|오를|떨어질|목표가|전망/;

describe("buildNegativeNewsContext", () => {
  it("빈 입력 → 빈 문자열(dormant, byte-identical append)", () => {
    expect(buildNegativeNewsContext([])).toBe("");
  });

  it("2건 → 헤더 + 2줄, 정확한 포맷", () => {
    const items: NegativeNewsItem[] = [
      {
        ticker: "005930",
        thesisBreakReason: "실적 부진 공시",
        newsTitle: "삼성전자 분기 보고",
        actionTaken: "shadowed",
        asOf: "2026-06-26",
      },
      {
        ticker: "000660",
        thesisBreakReason: null,
        newsTitle: "SK하이닉스 공급 차질",
        actionTaken: "removed",
        asOf: "2026-06-25T09:30:00Z",
      },
    ];
    expect(buildNegativeNewsContext(items)).toBe(
      [
        HEADER,
        "005930: 실적 부진 공시 (shadowed, asOf 2026-06-26)",
        "000660: SK하이닉스 공급 차질 (removed, asOf 2026-06-25)",
      ].join("\n"),
    );
  });

  it("기본 maxItems=10 — 12건 입력 → 헤더 1 + 본문 10줄, 11~12번째 종목 제외", () => {
    const items: NegativeNewsItem[] = Array.from({ length: 12 }, (_, i) => ({
      ticker: String(100000 + i),
      thesisBreakReason: `사유${i}`,
      newsTitle: `제목${i}`,
      actionTaken: "shadowed" as const,
      asOf: "2026-06-26",
    }));
    const out = buildNegativeNewsContext(items);
    const lines = out.split("\n");
    expect(lines).toHaveLength(11); // 1 header + 10 body
    expect(lines[0]).toBe(HEADER);
    expect(lines[1]).toBe("100000: 사유0 (shadowed, asOf 2026-06-26)");
    expect(lines[10]).toBe("100009: 사유9 (shadowed, asOf 2026-06-26)");
    expect(out).not.toContain("100010");
    expect(out).not.toContain("100011");
  });

  it("opts.maxItems 오버라이드 — 5건·cap 2 → 헤더 1 + 본문 2줄", () => {
    const items: NegativeNewsItem[] = Array.from({ length: 5 }, (_, i) => ({
      ticker: String(200000 + i),
      thesisBreakReason: `사유${i}`,
      newsTitle: `제목${i}`,
      actionTaken: "removed" as const,
      asOf: "2026-06-26",
    }));
    const lines = buildNegativeNewsContext(items, { maxItems: 2 }).split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe("200000: 사유0 (removed, asOf 2026-06-26)");
    expect(lines[2]).toBe("200001: 사유1 (removed, asOf 2026-06-26)");
  });

  it("reason 폴백 — thesisBreakReason null이면 newsTitle 사용(?? 시맨틱)", () => {
    const items: NegativeNewsItem[] = [
      {
        ticker: "035720",
        thesisBreakReason: null,
        newsTitle: "카카오 규제 이슈",
        actionTaken: "held_by_brake",
        asOf: "2026-06-26",
      },
    ];
    expect(buildNegativeNewsContext(items)).toBe(
      `${HEADER}\n035720: 카카오 규제 이슈 (held_by_brake, asOf 2026-06-26)`,
    );
  });

  it("30자 정확히 = 절단 안 함 / 31자 이상 = 앞 30자 + …", () => {
    // 정확히 30자 → 그대로
    const exactly30: NegativeNewsItem[] = [
      {
        ticker: "123456",
        thesisBreakReason: "가".repeat(30),
        newsTitle: "무시",
        actionTaken: "held_by_brake",
        asOf: "2026-06-26",
      },
    ];
    expect(buildNegativeNewsContext(exactly30)).toBe(
      `${HEADER}\n123456: ${"가".repeat(30)} (held_by_brake, asOf 2026-06-26)`,
    );

    // 35자 → 앞 30자 + …
    const over30: NegativeNewsItem[] = [
      {
        ticker: "123456",
        thesisBreakReason: "가".repeat(35),
        newsTitle: "무시",
        actionTaken: "held_by_brake",
        asOf: "2026-06-26",
      },
    ];
    expect(buildNegativeNewsContext(over30)).toBe(
      `${HEADER}\n123456: ${"가".repeat(30)}… (held_by_brake, asOf 2026-06-26)`,
    );
  });

  it("asOf는 YYYY-MM-DD로 절단(시간 성분 제거)", () => {
    const items: NegativeNewsItem[] = [
      {
        ticker: "051910",
        thesisBreakReason: "공장 가동 중단",
        newsTitle: "LG화학 사고",
        actionTaken: "removed",
        asOf: "2026-06-26T23:59:59.999Z",
      },
    ];
    const out = buildNegativeNewsContext(items);
    expect(out).toBe(
      `${HEADER}\n051910: 공장 가동 중단 (removed, asOf 2026-06-26)`,
    );
    expect(out).not.toContain("T23:59:59");
  });

  it("출력에 예측 어휘(상승/하락/오를/떨어질/목표가/전망) 없음", () => {
    const items: NegativeNewsItem[] = [
      {
        ticker: "005930",
        thesisBreakReason: "실적 부진 공시",
        newsTitle: "삼성전자 분기 보고",
        actionTaken: "shadowed",
        asOf: "2026-06-26",
      },
      {
        ticker: "000660",
        thesisBreakReason: null,
        newsTitle: "공급 차질 보도",
        actionTaken: "removed",
        asOf: "2026-06-25",
      },
    ];
    const out = buildNegativeNewsContext(items);
    expect(out.length).toBeGreaterThan(0); // 비-vacuous: 실제 본문 존재
    expect(FORBIDDEN_PREDICTION.test(out)).toBe(false);
  });
});
