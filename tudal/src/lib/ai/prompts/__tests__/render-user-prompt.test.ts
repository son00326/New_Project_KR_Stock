import { describe, it, expect } from "vitest";
import { renderUserPrompt } from "@/lib/ai/prompts/render-user-prompt";

const TEMPLATE =
  "종목 {{TICKER}}\n재무: {{FINANCIALS}}\n회고: {{REFLECTION_CONTEXT}}\n출력: JSON";

const BASE = {
  ticker: "005930",
  financials: "매출 100억",
  reflectionContext: "",
};

describe("renderUserPrompt — base token replacement (회귀)", () => {
  it("replaces TICKER/FINANCIALS/REFLECTION_CONTEXT", () => {
    const out = renderUserPrompt(TEMPLATE, BASE);
    expect(out).toContain("종목 005930");
    expect(out).toContain("재무: 매출 100억");
    expect(out).not.toContain("{{");
  });
});

describe("renderUserPrompt — G4 macroContext (dormant append)", () => {
  it("no macroContext → byte-identical (현행)", () => {
    const out = renderUserPrompt(TEMPLATE, BASE);
    expect(out).toBe(renderUserPrompt(TEMPLATE, { ...BASE, macroContext: "" }));
    // 끝이 'JSON'으로 끝나야 함 (추가 블록 없음)
    expect(out.endsWith("출력: JSON")).toBe(true);
  });

  it("empty/whitespace macroContext → no append (byte-identical)", () => {
    const out = renderUserPrompt(TEMPLATE, BASE);
    expect(renderUserPrompt(TEMPLATE, { ...BASE, macroContext: "   " })).toBe(out);
  });

  it("non-empty macroContext → appended at end", () => {
    const macro = "[거시 컨텍스트 · asOf 2026-04-11 ...]\n시장 국면: 강세";
    const out = renderUserPrompt(TEMPLATE, { ...BASE, macroContext: macro });
    expect(out).toContain(macro);
    expect(out.startsWith("종목 005930")).toBe(true);
    expect(out.endsWith(macro)).toBe(true); // 끝에 붙음
  });
});

describe("renderUserPrompt — M12a negativeNewsContext (dormant append)", () => {
  it("no/empty/whitespace negativeNewsContext → byte-identical (dormant)", () => {
    const out = renderUserPrompt(TEMPLATE, BASE);
    expect(
      renderUserPrompt(TEMPLATE, { ...BASE, negativeNewsContext: "" }),
    ).toBe(out);
    expect(
      renderUserPrompt(TEMPLATE, { ...BASE, negativeNewsContext: "  " }),
    ).toBe(out);
    expect(out.endsWith("출력: JSON")).toBe(true);
  });

  it("non-empty negativeNewsContext → appended at end", () => {
    const neg = "[최근 부정 뉴스 컨텍스트 · AI 컨텍스트 입력...]\n005930: 실적 쇼크";
    const out = renderUserPrompt(TEMPLATE, { ...BASE, negativeNewsContext: neg });
    expect(out).toContain(neg);
    expect(out.endsWith(neg)).toBe(true);
  });

  it("macro + negative 둘 다 → macro 먼저, negative 끝 (별개 블록·순서 고정)", () => {
    const macro = "[거시 컨텍스트]\n시장 국면: 강세";
    const neg = "[최근 부정 뉴스 컨텍스트]\n005930: 실적 쇼크";
    const out = renderUserPrompt(TEMPLATE, {
      ...BASE,
      macroContext: macro,
      negativeNewsContext: neg,
    });
    expect(out).toContain(macro);
    expect(out).toContain(neg);
    expect(out.indexOf(macro)).toBeLessThan(out.indexOf(neg)); // macro 먼저
    expect(out.endsWith(neg)).toBe(true);
  });
});

describe("renderUserPrompt — PR-K reflectionLearningContext (dormant append)", () => {
  it("no/empty/whitespace reflectionLearningContext → byte-identical (dormant)", () => {
    const out = renderUserPrompt(TEMPLATE, BASE);
    expect(
      renderUserPrompt(TEMPLATE, { ...BASE, reflectionLearningContext: "" }),
    ).toBe(out);
    expect(
      renderUserPrompt(TEMPLATE, { ...BASE, reflectionLearningContext: "  " }),
    ).toBe(out);
    expect(out.endsWith("출력: JSON")).toBe(true);
  });

  it("non-empty reflectionLearningContext → appended at end (3번째 supplementary)", () => {
    const refl = "[직전 사이클 회고 · 예측 아님]\n직전 사이클 실현 성과: 평균 +3.2%";
    const out = renderUserPrompt(TEMPLATE, { ...BASE, reflectionLearningContext: refl });
    expect(out).toContain(refl);
    expect(out.endsWith(refl)).toBe(true);
  });

  it("3-block 순서 고정: macro → negative → reflection", () => {
    const macro = "[거시 컨텍스트]\n강세";
    const neg = "[부정 뉴스 컨텍스트]\n005930";
    const refl = "[직전 사이클 회고]\n평균 +3.2%";
    const out = renderUserPrompt(TEMPLATE, {
      ...BASE,
      macroContext: macro,
      negativeNewsContext: neg,
      reflectionLearningContext: refl,
    });
    expect(out.indexOf(macro)).toBeLessThan(out.indexOf(neg));
    expect(out.indexOf(neg)).toBeLessThan(out.indexOf(refl));
    expect(out.endsWith(refl)).toBe(true);
  });

  it("Q5 seam 분리 회귀: reflectionContext(per-ticker)와 reflectionLearningContext(run-level) 동시 → 별개 블록·상호 무간섭", () => {
    const q5 = "기존 선정 종목 재점검: 직전 논거 유효성";
    const refl = "[직전 사이클 회고]\n평균 +3.2%";
    const out = renderUserPrompt(TEMPLATE, {
      ...BASE,
      reflectionContext: q5, // {{REFLECTION_CONTEXT}} placeholder(D27 Q5)
      reflectionLearningContext: refl, // 3번째 supplementary block(PR-K)
    });
    // Q5는 본문 placeholder에, PR-K는 끝 블록에 — 둘 다 존재, 별개 위치.
    expect(out).toContain(`회고: ${q5}`); // placeholder 자리
    expect(out).toContain(refl);
    expect(out.endsWith(refl)).toBe(true);
    expect(out.indexOf(q5)).toBeLessThan(out.indexOf(refl)); // 본문(Q5) 먼저, 끝블록(PR-K) 나중
  });
});
