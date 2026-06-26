import { describe, expect, it, vi } from "vitest";
import {
  aggregateNewsAssessment,
  makeM12aNewsEvaluator,
  parseNewsPersonaJudgment,
  type M12aNewsEvaluatorDeps,
  type NewsPersonaJudgment,
} from "@/lib/news/m12a/evaluator";
import type { CallPersonaResult } from "@/lib/ai/anthropic-client";

type CallPersonaFn = M12aNewsEvaluatorDeps["callPersona"];

function judgment(over: Partial<NewsPersonaJudgment> = {}): NewsPersonaJudgment {
  return {
    scope: "company",
    severity: "critical",
    confidence: "high",
    materiality: "high",
    directness: "direct",
    thesisBreak: true,
    thesisBreakReason: "실적 쇼크",
    affectedTickers: ["005930"],
    ...over,
  };
}

function personaResult(j: NewsPersonaJudgment): CallPersonaResult {
  return {
    content: JSON.stringify({
      scope: j.scope,
      severity: j.severity,
      confidence: j.confidence,
      materiality: j.materiality,
      directness: j.directness,
      thesis_break: j.thesisBreak,
      thesis_break_reason: j.thesisBreakReason,
      affected_tickers: j.affectedTickers,
    }),
    usage: { input_tokens: 10, output_tokens: 10 } as never,
    costKrw: 0,
    promptCacheEnabled: false,
  };
}

describe("parseNewsPersonaJudgment", () => {
  it("plain JSON → 파싱", () => {
    const r = parseNewsPersonaJudgment(personaResult(judgment()).content);
    expect(r.thesisBreak).toBe(true);
    expect(r.confidence).toBe("high");
    expect(r.affectedTickers).toEqual(["005930"]);
  });

  it("코드펜스 + 주변 텍스트 → JSON 추출", () => {
    const fenced = "분석 결과:\n```json\n" + personaResult(judgment()).content + "\n```\n끝.";
    const r = parseNewsPersonaJudgment(fenced);
    expect(r.scope).toBe("company");
  });

  it("invalid JSON → throw", () => {
    expect(() => parseNewsPersonaJudgment("not json at all")).toThrow(
      /m12a_news_judgment_parse_failed/,
    );
  });

  it("schema mismatch(잘못된 enum) → throw", () => {
    expect(() =>
      parseNewsPersonaJudgment('{"scope":"galaxy","severity":"critical"}'),
    ).toThrow(/m12a_news_judgment_parse_failed/);
  });
});

describe("aggregateNewsAssessment — 보수적 consensus", () => {
  const base = {
    ticker: "005930",
    surface: "list" as const,
    track: "short" as const,
    newsEventId: "evt-1",
    newsTitle: "삼성전자 실적 쇼크",
    newsUrl: "https://news/1",
  };

  it("전원 high/direct/break/affected → high·direct·thesisBreak·affected=[ticker]", () => {
    const a = aggregateNewsAssessment({
      ...base,
      judgments: Array.from({ length: 11 }, () => judgment()),
    });
    expect(a.confidence).toBe("high");
    expect(a.materiality).toBe("high");
    expect(a.directness).toBe("direct");
    expect(a.thesisBreak).toBe(true);
    expect(a.affectedTickers).toEqual(["005930"]);
  });

  it("과반 6 high → consensus high(과반 도달)", () => {
    const js = [
      ...Array.from({ length: 6 }, () => judgment({ confidence: "high" })),
      ...Array.from({ length: 5 }, () => judgment({ confidence: "low" })),
    ];
    expect(aggregateNewsAssessment({ ...base, judgments: js }).confidence).toBe(
      "high",
    );
  });

  it("과반 미달 5 high / 6 low → high 아님(low로 강등)", () => {
    const js = [
      ...Array.from({ length: 5 }, () => judgment({ confidence: "high" })),
      ...Array.from({ length: 6 }, () => judgment({ confidence: "low" })),
    ];
    expect(aggregateNewsAssessment({ ...base, judgments: js }).confidence).toBe(
      "low",
    );
  });

  it("thesisBreak/directness 과반 규칙 + affected 과반 미달이면 [] (auto_remove 차단)", () => {
    const js = [
      ...Array.from({ length: 5 }, () =>
        judgment({ thesisBreak: true, directness: "direct", affectedTickers: ["005930"] }),
      ),
      ...Array.from({ length: 6 }, () =>
        judgment({ thesisBreak: false, directness: "indirect", affectedTickers: [] }),
      ),
    ];
    const a = aggregateNewsAssessment({ ...base, judgments: js });
    expect(a.thesisBreak).toBe(false);
    expect(a.directness).toBe("indirect");
    expect(a.affectedTickers).toEqual([]);
  });

  it("빈 judgments → throw", () => {
    expect(() => aggregateNewsAssessment({ ...base, judgments: [] })).toThrow(
      /m12a_aggregate_empty_judgments/,
    );
  });
});

describe("makeM12aNewsEvaluator — Core 11 패널 + 유니버스 필터", () => {
  const personas = Array.from({ length: 11 }, (_, i) => ({ id: `p${i}` }));

  function evalDeps(callPersona: ReturnType<typeof vi.fn>): M12aNewsEvaluatorDeps {
    return {
      callPersona: callPersona as unknown as CallPersonaFn,
      personas,
      adminUserId: "admin-1",
    };
  }

  it("list ticker 뉴스 → surface=list assessment 1개 (track 보존)", async () => {
    const callPersona = vi.fn(async () => personaResult(judgment()));
    const evaluate = makeM12aNewsEvaluator(evalDeps(callPersona));
    const out = await evaluate({
      newsItems: [
        { newsEventId: "evt-1", ticker: "005930", title: "실적 쇼크", url: "u" },
      ],
      listTracks: new Map([["005930", "short"]]),
      portfolioTickers: new Set(),
    });
    expect(out).toHaveLength(1);
    expect(out[0].surface).toBe("list");
    expect(out[0].track).toBe("short");
    expect(callPersona).toHaveBeenCalledTimes(11); // Core 11
  });

  it("list+portfolio 둘 다면 surface 2개", async () => {
    const callPersona = vi.fn(async () => personaResult(judgment()));
    const evaluate = makeM12aNewsEvaluator(evalDeps(callPersona));
    const out = await evaluate({
      newsItems: [
        { newsEventId: "evt-1", ticker: "005930", title: "실적 쇼크", url: "u" },
      ],
      listTracks: new Map([["005930", "midlong"]]),
      portfolioTickers: new Set(["005930"]),
    });
    expect(out.map((a) => a.surface).sort()).toEqual(["list", "portfolio"]);
  });

  it("유니버스 밖 ticker → skip(callPersona 미호출)", async () => {
    const callPersona = vi.fn(async () => personaResult(judgment()));
    const evaluate = makeM12aNewsEvaluator(evalDeps(callPersona));
    const out = await evaluate({
      newsItems: [
        { newsEventId: "evt-1", ticker: "999999", title: "무관 뉴스", url: "u" },
      ],
      listTracks: new Map([["005930", "short"]]),
      portfolioTickers: new Set(),
    });
    expect(out).toHaveLength(0);
    expect(callPersona).not.toHaveBeenCalled();
  });

  it("전원 파싱 실패 → 그 쌍 skip(graceful)", async () => {
    const callPersona = vi.fn(async () => ({
      content: "쓰레기 응답",
      usage: { input_tokens: 1, output_tokens: 1 } as never,
      costKrw: 0,
      promptCacheEnabled: false,
    }));
    const evaluate = makeM12aNewsEvaluator(evalDeps(callPersona));
    const out = await evaluate({
      newsItems: [
        { newsEventId: "evt-1", ticker: "005930", title: "t", url: "u" },
      ],
      listTracks: new Map([["005930", "short"]]),
      portfolioTickers: new Set(),
    });
    expect(out).toHaveLength(0);
  });

  it("부분 실패(일부 reject) → 성공분으로 aggregate", async () => {
    let n = 0;
    const callPersona = vi.fn(async () => {
      n += 1;
      if (n <= 3) throw new Error("ai_call_failed:transient:429");
      return personaResult(judgment());
    });
    const evaluate = makeM12aNewsEvaluator(evalDeps(callPersona));
    const out = await evaluate({
      newsItems: [
        { newsEventId: "evt-1", ticker: "005930", title: "t", url: "u" },
      ],
      listTracks: new Map([["005930", "short"]]),
      portfolioTickers: new Set(),
    });
    expect(out).toHaveLength(1); // 8명 성공분으로 aggregate
    expect(out[0].thesisBreak).toBe(true);
  });
});
