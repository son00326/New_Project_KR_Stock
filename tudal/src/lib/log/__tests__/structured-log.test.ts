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

  it("does not let caller toJSON spoof reserved keys", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

    logStructured("warn", "real_event", {
      toJSON: () => ({ level: "spoofed", event: "spoofed" }),
      ok: true,
    });

    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.level).toBe("warn");
    expect(parsed.event).toBe("real_event");
    expect(parsed.ok).toBe(true);
    expect(parsed).not.toHaveProperty("toJSON");
  });

  it("serializes non-JSON-safe fields without throwing", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const circular: Record<string, unknown> = { name: "root" };
    circular.self = circular;

    expect(() =>
      logStructured("warn", "safe_event", {
        count: BigInt(3),
        missing: undefined,
        circular,
      }),
    ).not.toThrow();

    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.count).toBe("3");
    expect(parsed.missing).toBeNull();
    expect(parsed.circular).toEqual({
      name: "root",
      self: "[Circular]",
    });
  });

  it("does not invoke nested caller toJSON functions", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(() =>
      logStructured("warn", "nested_event", {
        nested: {
          ok: true,
          toJSON: () => {
            throw new Error("caller toJSON should not be invoked");
          },
        },
      }),
    ).not.toThrow();

    expect(JSON.parse(spy.mock.calls[0][0] as string)).toMatchObject({
      level: "warn",
      event: "nested_event",
      nested: { ok: true },
    });
  });

  it("does not throw when console emission fails", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {
      throw new Error("console unavailable");
    });

    expect(() => logStructured("warn", "sink_fails")).not.toThrow();
  });

  it("falls back to a minimal JSON line when field enumeration fails", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fields = new Proxy<Record<string, unknown>>(
      {},
      {
        ownKeys: () => {
          throw new Error("cannot enumerate");
        },
      },
    );

    expect(() => logStructured("warn", "proxy_event", fields)).not.toThrow();

    expect(JSON.parse(spy.mock.calls[0][0] as string)).toEqual({
      level: "warn",
      event: "proxy_event",
    });
  });

  it("does not throw when a field value is hostile (revoked Proxy throws on instanceof)", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { proxy, revoke } = Proxy.revocable<Record<string, unknown>>({}, {});
    revoke();

    expect(() =>
      logStructured("warn", "revoked_proxy_event", { bad: proxy }),
    ).not.toThrow();

    // 빌드 단계 throw도 caller resilience를 깨지 않고 최소 라인을 emit해야 함.
    expect(spy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.level).toBe("warn");
    expect(parsed.event).toBe("revoked_proxy_event");
  });
});
