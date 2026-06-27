import { describe, it, expect, vi, beforeEach } from "vitest";

const providerCall = vi.fn();
const resolveRoleMock = vi.fn();
vi.mock("@/lib/ai/model-registry", () => ({
  resolveRole: (role: string) => resolveRoleMock(role),
}));
vi.mock("@/lib/cost/cost-logger", () => ({
  insertCostLog: vi.fn(),
}));

import { insertCostLog } from "@/lib/cost/cost-logger";
import { summarizeReflection } from "@/lib/reflection/summarizer";
import type { ReflectionMetrics } from "@/lib/reflection/types";

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
      adminUserId: "cron-uuid",
    });
    expect(resolveRoleMock).toHaveBeenCalledWith("critic");
    expect(providerCall).toHaveBeenCalledTimes(1);
    expect(out).toContain("p1");
    expect(insertCostLog).toHaveBeenCalledTimes(1);
    const [row] = (insertCostLog as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    expect((row as { month: string }).month).toBe("2026-06");
    expect((row as { persona_id: string }).persona_id).toBe("reflection-summary");
    expect((row as { called_by: string }).called_by).toBe("cron-uuid");
  });

  it("ANTHROPIC_API_KEY 부재 → ai_key_unavailable throw (Claude 필수 primary)", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(
      summarizeReflection({ metrics, track: "short", month: "2026-06", adminUserId: "x" }),
    ).rejects.toThrow("ai_key_unavailable");
    expect(providerCall).not.toHaveBeenCalled();
  });

  it("provider 429 → transient 분류 보존(worker 재시도 판단)", async () => {
    providerCall.mockRejectedValueOnce(Object.assign(new Error("rate limit"), { status: 429 }));
    await expect(
      summarizeReflection({ metrics, track: "short", month: "2026-06", adminUserId: "x" }),
    ).rejects.toThrow(/ai_call_failed:transient/);
  });

  it("요약은 ≤300자 graceful truncate", async () => {
    providerCall.mockResolvedValueOnce({
      text: "가".repeat(500),
      usage: { input_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 1 },
    });
    const out = await summarizeReflection({ metrics, track: "short", month: "2026-06", adminUserId: "x" });
    expect(out.length).toBeLessThanOrEqual(300);
  });
});
