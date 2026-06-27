import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isExitOutcomeEnabled,
  isExitSignalEnabled,
  isIntradayMonitorEnabled,
} from "@/lib/intraday/flags";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("S7c shadow-first flags (default off)", () => {
  it("isIntradayMonitorEnabled defaults off (env unset)", () => {
    vi.stubEnv("INTRADAY_MONITOR_ENABLED", "");
    expect(isIntradayMonitorEnabled()).toBe(false);
  });

  it("isIntradayMonitorEnabled true only for literal 'true'", () => {
    vi.stubEnv("INTRADAY_MONITOR_ENABLED", "1");
    expect(isIntradayMonitorEnabled()).toBe(false);
    vi.stubEnv("INTRADAY_MONITOR_ENABLED", "TRUE");
    expect(isIntradayMonitorEnabled()).toBe(false);
    vi.stubEnv("INTRADAY_MONITOR_ENABLED", "true");
    expect(isIntradayMonitorEnabled()).toBe(true);
  });

  it("isExitSignalEnabled defaults off, true only for 'true'", () => {
    vi.stubEnv("EXIT_SIGNAL_ENABLED", "");
    expect(isExitSignalEnabled()).toBe(false);
    vi.stubEnv("EXIT_SIGNAL_ENABLED", "yes");
    expect(isExitSignalEnabled()).toBe(false);
    vi.stubEnv("EXIT_SIGNAL_ENABLED", "true");
    expect(isExitSignalEnabled()).toBe(true);
  });

  it("isExitOutcomeEnabled defaults off, true only for 'true' (truthy non-'true' stays off)", () => {
    vi.stubEnv("EXIT_OUTCOME_ENABLED", "");
    expect(isExitOutcomeEnabled()).toBe(false);
    vi.stubEnv("EXIT_OUTCOME_ENABLED", "yes"); // truthy but not "true" → false (=== mutation pin)
    expect(isExitOutcomeEnabled()).toBe(false);
    vi.stubEnv("EXIT_OUTCOME_ENABLED", "1");
    expect(isExitOutcomeEnabled()).toBe(false);
    vi.stubEnv("EXIT_OUTCOME_ENABLED", "true");
    expect(isExitOutcomeEnabled()).toBe(true);
  });
});
