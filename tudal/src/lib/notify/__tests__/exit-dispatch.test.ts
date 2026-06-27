import { describe, expect, it, vi } from "vitest";
import {
  buildExitTelegramText,
  dispatchExitSignal,
} from "@/lib/notify/exit-dispatch";
import type { AlertEvent } from "@/types/admin";

function makeAlert(
  overrides: Partial<Omit<AlertEvent, "id" | "isRead">> = {},
): Omit<AlertEvent, "id" | "isRead"> {
  return {
    alertType: "exit_signal",
    ticker: "005930",
    severity: "critical",
    triggerReason: "목표가 근접 + 모멘텀 꺾임",
    signalSentAt: "2026-04-19T05:30:00Z",
    outcomeAt: null,
    t7PriceChange: null,
    decisionRecorded: null,
    decisionMemo: null,
    ...overrides,
  };
}

describe("dispatchExitSignal (telegram best-effort + durable-always, 이메일 제거)", () => {
  it("marks telegram delivered when send succeeds (real)", async () => {
    const tel = vi.fn().mockResolvedValue({ success: true, mockMode: false });
    const outcome = await dispatchExitSignal({
      telegramText: "x",
      sendTelegram: tel,
    });
    expect(outcome.telegram.success).toBe(true);
    expect(outcome.telegramDelivered).toBe(true);
    expect(outcome.durableRequired).toBe(true);
    expect(tel).toHaveBeenCalledTimes(1);
  });

  it("mock-mode success is NOT counted as delivered (durable still required)", async () => {
    const tel = vi.fn().mockResolvedValue({ success: true, mockMode: true });
    const outcome = await dispatchExitSignal({
      telegramText: "x",
      sendTelegram: tel,
    });
    expect(outcome.telegram.success).toBe(true);
    expect(outcome.telegram.mockMode).toBe(true);
    expect(outcome.telegramDelivered).toBe(false);
    expect(outcome.durableRequired).toBe(true);
  });

  it("telegram failure is best-effort — durable still required, no throw", async () => {
    const tel = vi
      .fn()
      .mockResolvedValue({ success: false, mockMode: false, error: "HTTP 429" });
    const outcome = await dispatchExitSignal({
      telegramText: "x",
      sendTelegram: tel,
    });
    expect(outcome.telegram.success).toBe(false);
    expect(outcome.telegram.error).toBe("HTTP 429");
    expect(outcome.telegramDelivered).toBe(false);
    expect(outcome.durableRequired).toBe(true);
  });

  it("telegram exception is swallowed (best-effort) — durable still required", async () => {
    const tel = vi.fn().mockRejectedValue(new Error("socket reset"));
    const outcome = await dispatchExitSignal({
      telegramText: "x",
      sendTelegram: tel,
    });
    expect(outcome.telegram.success).toBe(false);
    expect(outcome.telegram.error).toContain("socket reset");
    expect(outcome.telegramDelivered).toBe(false);
    expect(outcome.durableRequired).toBe(true);
  });
});

describe("buildExitTelegramText", () => {
  it("includes ticker, severity, reason, and prompts for decision", () => {
    const text = buildExitTelegramText(makeAlert());
    expect(text).toContain("Exit 시그널");
    expect(text).toContain("005930");
    expect(text).toContain("CRITICAL");
    expect(text).toContain("목표가 근접 + 모멘텀 꺾임");
    expect(text).toContain("결정 기록");
  });

  it("falls back to market-wide label when ticker is null", () => {
    expect(buildExitTelegramText(makeAlert({ ticker: null }))).toContain(
      "시장 전체",
    );
  });

  it("does not reference email/Resend (72차 전역 제거)", () => {
    const text = buildExitTelegramText(makeAlert());
    expect(text).not.toMatch(/이메일|email|resend/i);
  });
});
