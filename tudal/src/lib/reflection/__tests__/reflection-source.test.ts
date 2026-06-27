import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getReflectionLearningContextString } from "@/lib/reflection/reflection-source";

describe("getReflectionLearningContextString", () => {
  const saved = process.env.REFLECTION_ENABLED;
  beforeEach(() => {
    delete process.env.REFLECTION_ENABLED;
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.REFLECTION_ENABLED;
    else process.env.REFLECTION_ENABLED = saved;
  });

  it("flag off → '' 이고 fetchLatest 미호출(DB read 0 → byte-identical)", async () => {
    const fetchLatest = vi.fn();
    const out = await getReflectionLearningContextString({
      track: "short",
      fetchLatest,
    });
    expect(out).toBe("");
    expect(fetchLatest).not.toHaveBeenCalled();
  });

  it("flag on + fetchLatest 미주입 → '' (dormant 안전, dangling 금지지만 fail-safe)", async () => {
    process.env.REFLECTION_ENABLED = "true";
    const out = await getReflectionLearningContextString({ track: "short" });
    expect(out).toBe("");
  });

  it("flag on + row 부재 → '' (회고 미발생 fail-soft)", async () => {
    process.env.REFLECTION_ENABLED = "true";
    const out = await getReflectionLearningContextString({
      track: "short",
      fetchLatest: async () => null,
    });
    expect(out).toBe("");
  });

  it("flag on + row 존재 → 저장된 snapshot 반환(track 전달 확인)", async () => {
    process.env.REFLECTION_ENABLED = "true";
    const fetchLatest = vi.fn(async (track: string) => ({
      injectedContextSnapshot: `ctx-for-${track}`,
    }));
    const out = await getReflectionLearningContextString({
      track: "midlong",
      fetchLatest,
    });
    expect(out).toBe("ctx-for-midlong");
    expect(fetchLatest).toHaveBeenCalledWith("midlong");
  });

  it("snapshot이 빈 문자열이면 '' (no-op)", async () => {
    process.env.REFLECTION_ENABLED = "true";
    const out = await getReflectionLearningContextString({
      track: "short",
      fetchLatest: async () => ({ injectedContextSnapshot: "" }),
    });
    expect(out).toBe("");
  });
});
