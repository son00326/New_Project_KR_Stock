// PR-C — persona-panel-adapter 유닛테스트 (ADR 2026-05-31).
import { describe, it, expect, vi } from "vitest";
import {
  parsePersonaScore,
  makeCallPersonaPanel,
  makeCallDebatePanel,
} from "@/lib/screening/persona-panel-adapter";
import type { ResolvedRole } from "@/lib/ai/model-registry";
import type { PersonaScore } from "@/lib/screening/tier1-schema";
import type {
  CallPersonaInput,
  CallPersonaResult,
} from "@/lib/ai/anthropic-client";

const validJson = JSON.stringify({
  scores: { short: 80, mid: 60, long: 40 },
  winning_timeframe: "short",
  rationale_kr: "모멘텀 강함",
  conviction: 75,
});

function callResult(content: string): CallPersonaResult {
  return {
    content,
    usage: {
      input_tokens: 100,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      output_tokens: 50,
    },
    costKrw: 100,
    promptCacheEnabled: false,
  };
}

describe("parsePersonaScore — 파싱/검증", () => {
  it("정상 JSON → PersonaScore (persona_id authoritative 주입)", () => {
    const s = parsePersonaScore(validJson, "warren-buffett");
    expect(s.persona_id).toBe("warren-buffett"); // LLM이 echo 안 해도 주입됨
    expect(s.scores).toEqual({ short: 80, mid: 60, long: 40 });
    expect(s.winning_timeframe).toBe("short");
    expect(s.rationale_kr).toBe("모멘텀 강함");
    expect(s.conviction).toBe(75);
  });

  it("LLM이 persona_id를 틀리게 echo해도 input personaId가 우선", () => {
    const withWrongId = JSON.stringify({
      persona_id: "WRONG",
      scores: { short: 50, mid: 50, long: 50 },
      winning_timeframe: "mid",
      rationale_kr: "중립",
      conviction: 50,
    });
    expect(parsePersonaScore(withWrongId, "charlie-munger").persona_id).toBe(
      "charlie-munger",
    );
  });

  it("마크다운 ```json 펜스 + 앞뒤 텍스트 허용", () => {
    const fenced = "분석 결과입니다:\n```json\n" + validJson + "\n```\n감사합니다.";
    const s = parsePersonaScore(fenced, "peter-lynch");
    expect(s.scores.short).toBe(80);
  });

  it("앞뒤 텍스트에 중괄호가 있어도 첫 parse 가능한 JSON object를 추출", () => {
    const noisy = `참고: scores는 {short, mid, long} 구조입니다.\n${validJson}\n끝`;
    const s = parsePersonaScore(noisy, "peter-lynch");
    expect(s.persona_id).toBe("peter-lynch");
    expect(s.scores.short).toBe(80);
  });

  it("rationale_kr 80자 초과 → graceful truncate (ticker fail 방지)", () => {
    const long = "가".repeat(120);
    const s = parsePersonaScore(
      JSON.stringify({
        scores: { short: 10, mid: 10, long: 10 },
        winning_timeframe: "long",
        rationale_kr: long,
        conviction: 30,
      }),
      "phil-fisher",
    );
    expect(s.rationale_kr.length).toBe(80);
  });

  it("JSON 없음 → persona_score_parse_failed throw", () => {
    expect(() => parsePersonaScore("죄송합니다 평가 불가", "x")).toThrow(
      /persona_score_parse_failed/,
    );
  });

  it("score 범위 위반(0~100) → persona_score_validation_failed throw", () => {
    const bad = JSON.stringify({
      scores: { short: 150, mid: 60, long: 40 },
      winning_timeframe: "short",
      rationale_kr: "범위초과",
      conviction: 75,
    });
    expect(() => parsePersonaScore(bad, "x")).toThrow(/persona_score_validation_failed/);
  });

  it("winning_timeframe enum 위반 → validation throw", () => {
    const bad = JSON.stringify({
      scores: { short: 50, mid: 50, long: 50 },
      winning_timeframe: "weekly",
      rationale_kr: "잘못된 timeframe",
      conviction: 50,
    });
    expect(() => parsePersonaScore(bad, "x")).toThrow(/persona_score_validation_failed/);
  });

  it("필드 누락(conviction) → validation throw", () => {
    const bad = JSON.stringify({
      scores: { short: 50, mid: 50, long: 50 },
      winning_timeframe: "mid",
      rationale_kr: "누락",
    });
    expect(() => parsePersonaScore(bad, "x")).toThrow(/persona_score_validation_failed/);
  });
});

describe("makeCallPersonaPanel — 11 페르소나 → PersonaScore[]", () => {
  const personas = Array.from({ length: 11 }, (_, i) => ({ id: `core-${i + 1}` }));

  it("11 페르소나 전원 성공 → 11 PersonaScore + persona_id 정합 + 호출 인자 검증", async () => {
    const callPersona = vi.fn(async () => callResult(validJson));
    const panel = makeCallPersonaPanel({
      callPersona,
      personas,
      reflectionContext: "",
      adminUserId: "cron-system-uuid",
    });
    const scores = await panel({ ticker: "005930", financials: "재무 요약" });
    expect(scores).toHaveLength(11);
    expect(scores.map((s) => s.persona_id).sort()).toEqual(
      personas.map((p) => p.id).sort(),
    );
    expect(callPersona).toHaveBeenCalledTimes(11);
    // PersonaScore 출력 템플릿 + financials/adminUserId 전파 검증
    expect(callPersona).toHaveBeenCalledWith(
      expect.objectContaining({
        personaId: "core-1",
        ticker: "005930",
        financials: "재무 요약",
        adminUserId: "cron-system-uuid",
        userPromptTemplate: expect.stringContaining("winning_timeframe"),
      }),
    );
  });

  it("costClient를 callPersona로 전파 (cron service-role cost-log DI)", async () => {
    const callPersona = vi.fn(async () => callResult(validJson));
    const fakeClient = { __serviceRole: true } as never;
    const panel = makeCallPersonaPanel({
      callPersona,
      personas,
      reflectionContext: "",
      adminUserId: "00000000-0000-4000-8000-000000000000",
      costClient: fakeClient,
    });
    await panel({ ticker: "005930", financials: "f" });
    expect(callPersona).toHaveBeenCalledWith(
      expect.objectContaining({ costClient: fakeClient }),
    );
  });

  it("costClient 미지정 → callPersona에 costClient undefined (admin session path)", async () => {
    const callPersona = vi.fn(async () => callResult(validJson));
    const panel = makeCallPersonaPanel({
      callPersona,
      personas,
      reflectionContext: "",
      adminUserId: "u",
    });
    await panel({ ticker: "005930", financials: "f" });
    expect(callPersona).toHaveBeenCalledWith(
      expect.objectContaining({ costClient: undefined }),
    );
  });

  it("cluster D — costLogMonth를 callPersona로 전파 (preflight month == insert month)", async () => {
    const callPersona = vi.fn(async () => callResult(validJson));
    const panel = makeCallPersonaPanel({
      callPersona,
      personas,
      reflectionContext: "",
      adminUserId: "u",
      costLogMonth: "2026-06",
    });
    await panel({ ticker: "005930", financials: "f" });
    expect(callPersona).toHaveBeenCalledWith(
      expect.objectContaining({ costLogMonth: "2026-06" }),
    );
  });

  it("cluster D — costLogMonth 미지정 → callPersona에 undefined (callPersona가 UTC월 fallback)", async () => {
    const callPersona = vi.fn(async () => callResult(validJson));
    const panel = makeCallPersonaPanel({
      callPersona,
      personas,
      reflectionContext: "",
      adminUserId: "u",
    });
    await panel({ ticker: "005930", financials: "f" });
    expect(callPersona).toHaveBeenCalledWith(
      expect.objectContaining({ costLogMonth: undefined }),
    );
  });

  it("G4 — macroContextString을 callPersona로 전파 (live Tier1 selection 컨텍스트)", async () => {
    const callPersona = vi.fn(async () => callResult(validJson));
    const panel = makeCallPersonaPanel({
      callPersona,
      personas,
      reflectionContext: "",
      adminUserId: "u",
      macroContextString: "[거시 컨텍스트] 강세(예측 아님)",
    });
    await panel({ ticker: "005930", financials: "f" });
    expect(callPersona).toHaveBeenCalledWith(
      expect.objectContaining({ macroContextString: "[거시 컨텍스트] 강세(예측 아님)" }),
    );
  });

  it("G4 — macroContextString 미지정 → callPersona에 undefined (dormant)", async () => {
    const callPersona = vi.fn(async () => callResult(validJson));
    const panel = makeCallPersonaPanel({
      callPersona,
      personas,
      reflectionContext: "",
      adminUserId: "u",
    });
    await panel({ ticker: "005930", financials: "f" });
    expect(callPersona).toHaveBeenCalledWith(
      expect.objectContaining({ macroContextString: undefined }),
    );
  });

  it("한 페르소나 parse 실패 → panel 전체 reject (ticker ⚪)", async () => {
    const callPersona = vi.fn(async (input: { personaId: string }) =>
      callResult(input.personaId === "core-5" ? "평가 불가" : validJson),
    );
    const panel = makeCallPersonaPanel({
      callPersona,
      personas,
      reflectionContext: "",
      adminUserId: "u",
    });
    await expect(panel({ ticker: "005930", financials: "f" })).rejects.toThrow(
      /persona_score_parse_failed/,
    );
  });

  it("callPersona reject(ai_key_unavailable) → panel reject 전파", async () => {
    const callPersona = vi.fn(async () => {
      throw new Error("ai_key_unavailable");
    });
    const panel = makeCallPersonaPanel({
      callPersona,
      personas,
      reflectionContext: "",
      adminUserId: "u",
    });
    await expect(panel({ ticker: "005930", financials: "f" })).rejects.toThrow(
      /ai_key_unavailable/,
    );
  });

  it("PR-E review fix: parallel panel invocations share a persona-call concurrency cap", async () => {
    let active = 0;
    let observedMax = 0;
    const callPersona = vi.fn(async () => {
      active += 1;
      observedMax = Math.max(observedMax, active);
      await Promise.resolve();
      active -= 1;
      return callResult(validJson);
    });
    const panel = makeCallPersonaPanel({
      callPersona,
      personas,
      reflectionContext: "",
      adminUserId: "u",
      maxConcurrentCalls: 3,
    });

    const [a, b] = await Promise.all([
      panel({ ticker: "005930", financials: "f" }),
      panel({ ticker: "000660", financials: "f" }),
    ]);

    expect(a).toHaveLength(11);
    expect(b).toHaveLength(11);
    expect(callPersona).toHaveBeenCalledTimes(22);
    expect(observedMax).toBeLessThanOrEqual(3);
  });

  // W2b (D27 Q5) — per-call reflectionContext override (incumbent thesis context 주입 seam).
  it("per-call reflectionContext가 deps default를 override해 callPersona에 전달", async () => {
    const callPersona = vi.fn<
      (input: CallPersonaInput) => Promise<CallPersonaResult>
    >(async () => callResult(validJson));
    const panel = makeCallPersonaPanel({
      callPersona,
      personas,
      reflectionContext: "",
      adminUserId: "u",
    });
    await panel({
      ticker: "000001",
      financials: "f",
      reflectionContext: "[재점검] 직전 논거...",
    });
    expect(callPersona).toHaveBeenCalledTimes(11);
    for (const call of callPersona.mock.calls) {
      expect(call[0]).toMatchObject({ reflectionContext: "[재점검] 직전 논거..." });
    }
  });

  // W1a (D28 ①) — slot binding 주입
  it("R1: persona idx별 slotResolver binding이 callPersona modelBinding으로 전달", async () => {
    const callPersona = vi.fn<
      (input: CallPersonaInput) => Promise<CallPersonaResult>
    >(async () => callResult(validJson));
    const fakeSlot = (i: number): ResolvedRole =>
      ({
        role: "tier1_panel",
        provider: { id: i % 2 === 1 ? "openai" : "anthropic", isAvailable: () => true, call: vi.fn() },
        model: i % 2 === 1 ? "gpt-5.4" : "claude-sonnet-4-6",
        pricingKey: i % 2 === 1 ? "gpt-5.4" : "claude-sonnet-4-6",
        maxTokens: 1024,
      }) as ResolvedRole;
    const panel = makeCallPersonaPanel({
      callPersona,
      personas,
      reflectionContext: "",
      adminUserId: "u",
      slotResolver: fakeSlot,
    });
    await panel({ ticker: "005930", financials: "f" });
    const models = callPersona.mock.calls.map((c) => c[0].modelBinding?.model);
    expect(models.filter((m) => m === "claude-sonnet-4-6")).toHaveLength(6);
    expect(models.filter((m) => m === "gpt-5.4")).toHaveLength(5);
    expect(callPersona.mock.calls[0][0].modelBinding?.model).toBe("claude-sonnet-4-6");
    expect(callPersona.mock.calls[1][0].modelBinding?.model).toBe("gpt-5.4");
  });

  it("R1: slotResolver 미주입(legacy deps) → modelBinding undefined 무회귀", async () => {
    const callPersona = vi.fn<
      (input: CallPersonaInput) => Promise<CallPersonaResult>
    >(async () => callResult(validJson));
    const panel = makeCallPersonaPanel({
      callPersona,
      personas,
      reflectionContext: "",
      adminUserId: "u",
    });
    await panel({ ticker: "005930", financials: "f" });
    expect(callPersona.mock.calls.every((c) => c[0].modelBinding === undefined)).toBe(true);
  });
});

describe("W1a makeCallDebatePanel — R2 반박 라운드", () => {
  const personas = Array.from({ length: 11 }, (_, i) => ({
    id: `core-${i + 1}`,
    label: `위원${i + 1}`,
  }));
  function r1Score(personaId: string): PersonaScore {
    return {
      persona_id: personaId,
      scores: { short: 70, mid: 60, long: 50 },
      winning_timeframe: "short",
      rationale_kr: `근거-${personaId}`,
      conviction: 65,
    };
  }
  const r1Panel = personas.map((p) => r1Score(p.id));

  it("R2: 각 persona에 OWN_PRIOR=본인 R1 + PEER_ARGUMENTS=타 위원 10명 R1 요약 + R2 템플릿 주입", async () => {
    const callPersona = vi.fn<
      (input: CallPersonaInput) => Promise<CallPersonaResult>
    >(async () => callResult(validJson));
    const debate = makeCallDebatePanel({
      callPersona,
      personas,
      reflectionContext: "",
      adminUserId: "u",
    });
    const scores = await debate({ ticker: "005930", financials: "f", r1Panel });
    expect(scores).toHaveLength(11);
    expect(callPersona).toHaveBeenCalledTimes(11);
    const first = callPersona.mock.calls.find((c) => c[0].personaId === "core-1")![0];
    expect(first.ownPrior).toMatch(/근거-core-1(?!\d)/);
    expect(first.peerArguments).toMatch(/근거-core-2(?!\d)/);
    expect(first.peerArguments).not.toMatch(/근거-core-1(?!\d)/); // 본인 제외 (core-10/11과 구분)
    expect(first.peerArguments!.split("\n")).toHaveLength(10);
    expect(first.userPromptTemplate).toContain("반박 라운드");
  });

  it("R2: incumbent reflectionContext 동반 주입 + slotResolver binding 전달", async () => {
    const callPersona = vi.fn<
      (input: CallPersonaInput) => Promise<CallPersonaResult>
    >(async () => callResult(validJson));
    const fakeSlot = (i: number): ResolvedRole =>
      ({ role: "tier1_panel", provider: { id: "anthropic", isAvailable: () => true, call: vi.fn() }, model: `m-${i}`, pricingKey: "claude-sonnet-4-6", maxTokens: 1024 }) as ResolvedRole;
    const debate = makeCallDebatePanel({
      callPersona,
      personas,
      reflectionContext: "",
      adminUserId: "u",
      slotResolver: fakeSlot,
    });
    await debate({
      ticker: "005930",
      financials: "f",
      reflectionContext: "[재점검] 직전 논거",
      r1Panel,
    });
    for (const call of callPersona.mock.calls) {
      expect(call[0].reflectionContext).toBe("[재점검] 직전 논거");
    }
    expect(callPersona.mock.calls[3][0].modelBinding?.model).toBe("m-3");
  });

  it("cluster D — R2 패널도 costLogMonth를 callPersona로 전파", async () => {
    const callPersona = vi.fn<
      (input: CallPersonaInput) => Promise<CallPersonaResult>
    >(async () => callResult(validJson));
    const debate = makeCallDebatePanel({
      callPersona,
      personas,
      reflectionContext: "",
      adminUserId: "u",
      costLogMonth: "2026-07",
    });
    await debate({ ticker: "005930", financials: "f", r1Panel });
    for (const call of callPersona.mock.calls) {
      expect(call[0].costLogMonth).toBe("2026-07");
    }
  });

  it("G4 — R2 패널도 macroContextString을 callPersona로 전파", async () => {
    const callPersona = vi.fn<
      (input: CallPersonaInput) => Promise<CallPersonaResult>
    >(async () => callResult(validJson));
    const debate = makeCallDebatePanel({
      callPersona,
      personas,
      reflectionContext: "",
      adminUserId: "u",
      macroContextString: "[거시 컨텍스트] 강세(예측 아님)",
    });
    await debate({ ticker: "005930", financials: "f", r1Panel });
    for (const call of callPersona.mock.calls) {
      expect(call[0].macroContextString).toBe("[거시 컨텍스트] 강세(예측 아님)");
    }
  });

  it("R2: r1Panel에 본인 R1 부재 → reject (panel 계약 위반)", async () => {
    const callPersona = vi.fn<
      (input: CallPersonaInput) => Promise<CallPersonaResult>
    >(async () => callResult(validJson));
    const debate = makeCallDebatePanel({
      callPersona,
      personas,
      reflectionContext: "",
      adminUserId: "u",
    });
    await expect(
      debate({ ticker: "005930", financials: "f", r1Panel: r1Panel.slice(0, 10) }),
    ).rejects.toThrow("debate_r1_prior_missing");
  });

  it("per-call reflectionContext 미지정 시 deps default 사용 (W2a 무회귀)", async () => {
    const callPersona = vi.fn<
      (input: CallPersonaInput) => Promise<CallPersonaResult>
    >(async () => callResult(validJson));
    const panel = makeCallPersonaPanel({
      callPersona,
      personas,
      reflectionContext: "기본 컨텍스트",
      adminUserId: "u",
    });
    await panel({ ticker: "000001", financials: "f" });
    for (const call of callPersona.mock.calls) {
      expect(call[0]).toMatchObject({ reflectionContext: "기본 컨텍스트" });
    }
  });
});
