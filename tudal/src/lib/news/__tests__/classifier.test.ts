// classifier.test.ts — M12 뉴스 심각도 분류기 단위 테스트 (S5a T5a.3)
import { describe, it, expect } from "vitest";
import {
  classifyNews,
  dedupeByUrl,
  toNewsEvent,
  type NewsCandidate,
} from "../classifier";

describe("classifyNews", () => {
  it("가동 지연 키워드 → critical", () => {
    const r = classifyNews("삼성전자 美 파운드리 공장 가동 지연 발표");
    expect(r.severity).toBe("critical");
    expect(r.reason).toMatch(/Exit 트리거/);
  });

  it("과징금 키워드 → critical", () => {
    const r = classifyNews("NAVER, 공정위 과징금 3,200억원 부과 결정");
    expect(r.severity).toBe("critical");
    expect(r.reason).toMatch(/규제/);
  });

  it("연준 50bp 인상 → critical (매크로)", () => {
    const r = classifyNews("美 연준, 6월 기준금리 0.5%p 인상 시그널");
    expect(r.severity).toBe("critical");
  });

  it("경영진 부적절 발언 → critical", () => {
    const r = classifyNews(
      "SK하이닉스 CFO, 자금 사정 관련 부적절 발언 논란",
    );
    expect(r.severity).toBe("critical");
    expect(r.reason).toMatch(/경영진/);
  });

  it("전망 하향 키워드 → warning", () => {
    const r = classifyNews("LG화학, 배터리 수주 전망 하향 조정");
    expect(r.severity).toBe("warning");
  });

  it("외국인 순매도 → warning", () => {
    const r = classifyNews("KOSPI, 외국인 4거래일 연속 순매도");
    expect(r.severity).toBe("warning");
  });

  it("리콜 키워드 → warning", () => {
    const r = classifyNews("현대차, 美 전기차 리콜 범위 확대 검토");
    expect(r.severity).toBe("warning");
  });

  it("중립 보도 → info", () => {
    const r = classifyNews("삼성전자, 신규 메모리 기술 컨퍼런스 개최 예정");
    expect(r.severity).toBe("info");
  });

  it("일상 실적 보도 → info", () => {
    const r = classifyNews("현대차, 1분기 국내 판매 소폭 증가");
    expect(r.severity).toBe("info");
  });
});

describe("toNewsEvent", () => {
  it("후보 → NewsEvent 변환 · classification 결과 포함", () => {
    const candidate: NewsCandidate = {
      ticker: "005930",
      title: "삼성전자 美 파운드리 가동 지연",
      source: "example.com",
      url: "https://example.com/a",
      publishedAt: "2026-04-19T08:00:00+09:00",
    };
    const ev = toNewsEvent(candidate, "id-1");
    expect(ev.id).toBe("id-1");
    expect(ev.ticker).toBe("005930");
    expect(ev.severity).toBe("critical");
    expect(ev.classificationReason).toMatch(/Exit/);
    expect(ev.fetchedAt).toBeTruthy();
  });
});

describe("dedupeByUrl", () => {
  it("동일 URL 중복 제거 · 최초 등장 순서 유지", () => {
    const items = [
      { url: "https://a", title: "1" },
      { url: "https://b", title: "2" },
      { url: "https://a", title: "1-dup" },
      { url: "https://c", title: "3" },
    ];
    const out = dedupeByUrl(items);
    expect(out).toHaveLength(3);
    expect(out.map((i) => i.title)).toEqual(["1", "2", "3"]);
  });

  it("빈 배열 → 빈 배열", () => {
    expect(dedupeByUrl([])).toEqual([]);
  });
});
