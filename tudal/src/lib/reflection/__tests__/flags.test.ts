import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  isReflectionEnabled,
  isReflectionLlmSummaryEnabled,
} from "@/lib/reflection/flags";

describe("reflection flags", () => {
  const saved = {
    enabled: process.env.REFLECTION_ENABLED,
    llm: process.env.REFLECTION_LLM_SUMMARY_ENABLED,
  };
  beforeEach(() => {
    delete process.env.REFLECTION_ENABLED;
    delete process.env.REFLECTION_LLM_SUMMARY_ENABLED;
  });
  afterEach(() => {
    if (saved.enabled === undefined) delete process.env.REFLECTION_ENABLED;
    else process.env.REFLECTION_ENABLED = saved.enabled;
    if (saved.llm === undefined) delete process.env.REFLECTION_LLM_SUMMARY_ENABLED;
    else process.env.REFLECTION_LLM_SUMMARY_ENABLED = saved.llm;
  });

  it("REFLECTION_ENABLED default false (dormant)", () => {
    expect(isReflectionEnabled()).toBe(false);
  });

  it("REFLECTION_ENABLED=true → on", () => {
    process.env.REFLECTION_ENABLED = "true";
    expect(isReflectionEnabled()).toBe(true);
  });

  it("non-'true' 값은 off (오탐 방지)", () => {
    process.env.REFLECTION_ENABLED = "1";
    expect(isReflectionEnabled()).toBe(false);
  });

  it("REFLECTION_LLM_SUMMARY_ENABLED default false", () => {
    expect(isReflectionLlmSummaryEnabled()).toBe(false);
  });

  it("REFLECTION_LLM_SUMMARY_ENABLED=true → on", () => {
    process.env.REFLECTION_LLM_SUMMARY_ENABLED = "true";
    expect(isReflectionLlmSummaryEnabled()).toBe(true);
  });
});
