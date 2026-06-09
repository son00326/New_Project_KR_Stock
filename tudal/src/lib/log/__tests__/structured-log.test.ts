import { afterEach, describe, expect, it, vi } from "vitest";
import { logStructured } from "@/lib/log/structured-log";

describe("logStructured", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits a single machine-parseable JSON line to console.warn for warn level", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

    logStructured("warn", "some_event", { ticker: "005930", count: 3 });

    expect(spy).toHaveBeenCalledTimes(1);
    const arg = spy.mock.calls[0][0];
    expect(typeof arg).toBe("string");
    expect(JSON.parse(arg as string)).toEqual({
      level: "warn",
      event: "some_event",
      ticker: "005930",
      count: 3,
    });
  });

  it("routes error level to console.error (not console.warn)", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    logStructured("error", "boom", { reason: "x" });

    expect(warnSpy).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(errSpy.mock.calls[0][0] as string)).toEqual({
      level: "error",
      event: "boom",
      reason: "x",
    });
  });

  it("emits only level+event when no extra fields given", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

    logStructured("warn", "bare");

    expect(JSON.parse(spy.mock.calls[0][0] as string)).toEqual({
      level: "warn",
      event: "bare",
    });
  });

  it("does not let reserved keys be overridden by caller fields", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

    logStructured("warn", "real_event", {
      level: "spoofed",
      event: "spoofed",
      ok: true,
    });

    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.level).toBe("warn");
    expect(parsed.event).toBe("real_event");
    expect(parsed.ok).toBe(true);
  });
});
