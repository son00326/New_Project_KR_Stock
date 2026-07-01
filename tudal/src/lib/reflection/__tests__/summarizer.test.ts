import { describe, it, expect, vi, beforeEach } from "vitest";

const providerCall = vi.fn();
const resolveRoleMock = vi.fn();
// 항목1 — resolveRole만 stub, isRoleProviderAvailable 등 나머지는 실제 유지(env 기반 게이트 판정 보존).
vi.mock("@/lib/ai/model-registry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/model-registry")>();
  return {
    ...actual,
    resolveRole: (role: string) => resolveRoleMock(role),
  };
});
vi.mock("@/lib/cost/cost-logger", () => ({
  insertCostLog: vi.fn(),
}));

import { insertCostLog } from "@/lib/cost/cost-logger";
import { summarizeReflection } from "@/lib/reflection/summarizer";
import type { ReflectionMetrics } from "@/lib/reflection/types";

const VALID_UUID = "11111111-2222-3333-4444-555555555555";
const metrics: ReflectionMetrics = {
  selectedCount: 3,
  pricedCount: 3,
  overallHitCount: 2,
  overallHitRate: 0.67,
  overallAvgRealizedReturn: 0.04,
  perPersona: [
    { personaId: "p1", sampleSize: 3, hitRate: 1, convictionWeightedReturn: 0.08, avgConviction: 78 },
  ],
  tickerReturns: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = "sk-test";
  // Option A(2026-07-01): critic 게이트 = GPT primary / GLM fallback (ANTHROPIC 비의존).
  //   GPT off 기본이므로 OPENROUTER(GLM fallback)를 세팅해 isRoleProviderAvailable('critic') 통과.
  process.env.OPENROUTER_API_KEY = "test-or-key";
  process.env.AI_COST_LOG_REAL_INSERT_ENABLED = "true";
  providerCall.mockResolvedValue({
    text: "회고: p1의 확신이 결과와 잘 정렬됨.",
    usage: {
      input_tokens: 200,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      output_tokens: 40,
    },
  });
  resolveRoleMock.mockReturnValue({
    role: "critic",
    provider: { id: "openai", isAvailable: () => true, call: providerCall },
    model: "gpt-5.4",
    pricingKey: "gpt-5.4",
    maxTokens: 2048,
  });
});

describe("summarizeReflection", () => {
  it("critic 역할로 LLM 호출 + cost_log INSERT(month/persona_id reflection-summary) + 요약 반환", async () => {
    const out = await summarizeReflection({
      metrics,
      track: "short",
      month: "2026-06",
      adminUserId: VALID_UUID,
      costPreflightReserved: true,
    });
    expect(resolveRoleMock).toHaveBeenCalledWith("critic");
    expect(providerCall).toHaveBeenCalledTimes(1);
    expect(out).toContain("p1");
    expect(insertCostLog).toHaveBeenCalledTimes(1);
    const [row] = (insertCostLog as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    expect((row as { month: string }).month).toBe("2026-06");
    expect((row as { persona_id: string }).persona_id).toBe("reflection-summary");
    expect((row as { called_by: string }).called_by).toBe(VALID_UUID);
  });

  it("AI_COST_LOG_REAL_INSERT_ENABLED off → provider 호출 전 fail-closed", async () => {
    delete process.env.AI_COST_LOG_REAL_INSERT_ENABLED;
    await expect(
      summarizeReflection({
        metrics,
        track: "short",
        month: "2026-06",
        adminUserId: VALID_UUID,
        costPreflightReserved: true,
      }),
    ).rejects.toThrow("reflection_summary_cost_logging_required");
    expect(providerCall).not.toHaveBeenCalled();
  });

  it("adminUserId invalid → provider 호출 전 fail-closed", async () => {
    await expect(
      summarizeReflection({
        metrics,
        track: "short",
        month: "2026-06",
        adminUserId: "x",
        costPreflightReserved: true,
      }),
    ).rejects.toThrow("reflection_summary_admin_user_id_invalid");
    expect(providerCall).not.toHaveBeenCalled();
  });

  it("costPreflightReserved 누락 → provider 호출 전 fail-closed", async () => {
    await expect(
      summarizeReflection({
        metrics,
        track: "short",
        month: "2026-06",
        adminUserId: VALID_UUID,
      }),
    ).rejects.toThrow("reflection_summary_preflight_required");
    expect(providerCall).not.toHaveBeenCalled();
  });

  it("critic provider 전부 부재(GPT/Claude/OpenRouter) → ai_key_unavailable throw", async () => {
    // 항목1 — 게이트는 critic 역할 provider-agnostic(GPT primary/Claude fallback). ANTHROPIC 하나만
    //   삭제하면 다른 provider 키 유무에 따라 비결정 → critic이 쓸 수 있는 provider 키를 전부 제거해
    //   "provider 전무 → throw" 불변식을 명시 검증(vacuous 방지).
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    await expect(
      summarizeReflection({
        metrics,
        track: "short",
        month: "2026-06",
        adminUserId: VALID_UUID,
        costPreflightReserved: true,
      }),
    ).rejects.toThrow("ai_key_unavailable");
    expect(providerCall).not.toHaveBeenCalled();
  });

  it("provider 429 → transient 분류 보존(worker 재시도 판단)", async () => {
    providerCall.mockRejectedValueOnce(Object.assign(new Error("rate limit"), { status: 429 }));
    await expect(
      summarizeReflection({
        metrics,
        track: "short",
        month: "2026-06",
        adminUserId: VALID_UUID,
        costPreflightReserved: true,
      }),
    ).rejects.toThrow(/ai_call_failed:transient/);
  });

  it("요약은 ≤300자 graceful truncate", async () => {
    providerCall.mockResolvedValueOnce({
      text: `회고: p1의 확신이 과거 실현 결과와 잘 정렬됨. ${"과거 정렬 ".repeat(80)}`,
      usage: { input_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 1 },
    });
    const out = await summarizeReflection({
      metrics,
      track: "short",
      month: "2026-06",
      adminUserId: VALID_UUID,
      costPreflightReserved: true,
    });
    expect(out.length).toBeLessThanOrEqual(300);
  });

  it("LLM 출력에 미래 예측 claim이 섞이면 반환하지 않고 throw(컨텍스트 주입 차단)", async () => {
    providerCall.mockResolvedValueOnce({
      text: "다음 사이클에는 p1 비중을 높이면 수익률이 상승할 전망입니다.",
      usage: { input_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 1 },
    });
    await expect(
      summarizeReflection({
        metrics,
        track: "short",
        month: "2026-06",
        adminUserId: VALID_UUID,
        costPreflightReserved: true,
      }),
    ).rejects.toThrow("reflection_summary_prediction_claim");
    expect(insertCostLog).toHaveBeenCalledTimes(1);
  });

  it("미래 우회 표현도 throw: 다음 사이클/should improve", async () => {
    for (const text of [
      "다음 사이클에는 p1 비중을 늘리면 더 좋은 결과가 날 것입니다.",
      "Next cycle should improve if p1 weight is higher.",
    ]) {
      vi.clearAllMocks();
      process.env.ANTHROPIC_API_KEY = "sk-test";
      process.env.OPENROUTER_API_KEY = "test-or-key";
      process.env.AI_COST_LOG_REAL_INSERT_ENABLED = "true";
      resolveRoleMock.mockReturnValue({
        role: "critic",
        provider: { id: "openai", isAvailable: () => true, call: providerCall },
        model: "gpt-5.4",
        pricingKey: "gpt-5.4",
        maxTokens: 2048,
      });
      providerCall.mockResolvedValueOnce({
        text,
        usage: { input_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 1 },
      });
      await expect(
        summarizeReflection({
          metrics,
          track: "short",
          month: "2026-06",
          adminUserId: VALID_UUID,
          costPreflightReserved: true,
        }),
      ).rejects.toThrow("reflection_summary_prediction_claim");
    }
  });
});
