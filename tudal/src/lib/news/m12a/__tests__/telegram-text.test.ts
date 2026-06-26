import { describe, it, expect } from "vitest";
import {
  buildM12aTelegramText,
  type M12aTelegramInput,
} from "@/lib/news/m12a/telegram-text";

// ---------------------------------------------------------------------------
// M12a 텔레그램 알림 본문 빌더 (R3.10-7d, telegram-only) 유닛 테스트.
//   - plain text(마크다운 금지) · 한국어 · 이메일 어휘 금지.
//   - 출력 라인 구조를 정확히 핀(mutation-resistant)한다.
// ---------------------------------------------------------------------------

function baseInput(over: Partial<M12aTelegramInput> = {}): M12aTelegramInput {
  return {
    ticker: "005930",
    newsTitle: "삼성전자 신규 라인 가동",
    reason: "반도체 업황 급랭으로 투자 논거 훼손",
    action: "auto_remove",
    shadow: false,
    ...over,
  };
}

describe("buildM12aTelegramText", () => {
  it("auto_remove 액션 헤더 라벨", () => {
    const text = buildM12aTelegramText(baseInput({ action: "auto_remove" }));
    expect(text.split("\n")[0]).toBe("🚫 뉴스 자동제외");
  });

  it("alert_only 액션 헤더 라벨", () => {
    const text = buildM12aTelegramText(baseInput({ action: "alert_only" }));
    expect(text.split("\n")[0]).toBe("⚠️ 뉴스 경보");
  });

  it("hold_for_review 액션 헤더 라벨", () => {
    const text = buildM12aTelegramText(baseInput({ action: "hold_for_review" }));
    expect(text.split("\n")[0]).toBe("🛑 대량 제외 감지·검토 요망");
  });

  it("shadow=true → 헤더에 (shadow) 접미", () => {
    const text = buildM12aTelegramText(
      baseInput({ action: "alert_only", shadow: true }),
    );
    expect(text.split("\n")[0]).toBe("⚠️ 뉴스 경보 (shadow)");
    expect(text).toContain("(shadow)");
  });

  it("shadow=false → (shadow) 미포함", () => {
    const text = buildM12aTelegramText(baseInput({ shadow: false }));
    expect(text).not.toContain("(shadow)");
  });

  it("ticker 비-null → 종목 라인에 티커", () => {
    const text = buildM12aTelegramText(baseInput({ ticker: "005930" }));
    expect(text.split("\n")[1]).toBe("종목: 005930");
  });

  it("ticker=null → '시장 전체'", () => {
    const text = buildM12aTelegramText(baseInput({ ticker: null }));
    expect(text.split("\n")[1]).toBe("종목: 시장 전체");
  });

  it("35자 제목 → 30자 + '…' 절단", () => {
    const longTitle = "가".repeat(35);
    const text = buildM12aTelegramText(baseInput({ newsTitle: longTitle }));
    expect(text.split("\n")[2]).toBe("가".repeat(30) + "…");
    expect(text).toContain("…");
  });

  it("30자 이하 제목 → 절단/말줄임 없음", () => {
    const shortTitle = "짧은 제목";
    const text = buildM12aTelegramText(baseInput({ newsTitle: shortTitle }));
    expect(text.split("\n")[2]).toBe(shortTitle);
    expect(text).not.toContain("…");
  });

  it("정확히 30자 제목 → 절단 없음 (경계)", () => {
    const exactTitle = "나".repeat(30);
    const text = buildM12aTelegramText(baseInput({ newsTitle: exactTitle }));
    expect(text.split("\n")[2]).toBe(exactTitle);
    expect(text).not.toContain("…");
  });

  it("reason 라인 verbatim 포함", () => {
    const reason = "반도체 업황 급랭으로 투자 논거 훼손";
    const text = buildM12aTelegramText(baseInput({ reason }));
    expect(text.split("\n")[3]).toBe(reason);
    expect(text).toContain(reason);
  });

  it("alertsUrl 기본값 = /admin/alerts", () => {
    const text = buildM12aTelegramText(baseInput({ alertsUrl: undefined }));
    const lines = text.split("\n");
    expect(lines[lines.length - 1]).toBe("상세: /admin/alerts");
  });

  it("alertsUrl 지정 시 해당 URL 사용", () => {
    const text = buildM12aTelegramText(
      baseInput({ alertsUrl: "https://x.example/admin/alerts/42" }),
    );
    const lines = text.split("\n");
    expect(lines[lines.length - 1]).toBe(
      "상세: https://x.example/admin/alerts/42",
    );
  });

  it("마크다운 미사용 ('*' 및 '](' 없음)", () => {
    const text = buildM12aTelegramText(baseInput());
    expect(text).not.toContain("*");
    expect(text).not.toContain("](");
  });

  it("이메일/email 어휘 미포함", () => {
    const text = buildM12aTelegramText(baseInput());
    expect(text).not.toContain("이메일");
    expect(text.toLowerCase()).not.toContain("email");
  });

  it("멀티라인 plain string 5줄 구조", () => {
    const text = buildM12aTelegramText(baseInput());
    expect(text.split("\n")).toHaveLength(5);
  });
});
