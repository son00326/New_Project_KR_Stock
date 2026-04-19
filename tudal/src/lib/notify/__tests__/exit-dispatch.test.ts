import { describe, expect, it, vi } from "vitest";
import {
  buildExitEmailSubject,
  buildExitEmailText,
  buildExitTelegramText,
  dispatchExitSignal,
  type ExitDispatchInput,
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

function buildInput(
  sendTelegram: ExitDispatchInput["sendTelegram"],
  sendEmail: ExitDispatchInput["sendEmail"],
): ExitDispatchInput {
  const alert = makeAlert();
  return {
    alert,
    telegramText: buildExitTelegramText(alert),
    emailSubject: buildExitEmailSubject(alert),
    emailText: buildExitEmailText(alert),
    recipients: ["admin1@example.com", "admin2@example.com"],
    sendTelegram,
    sendEmail,
  };
}

describe("dispatchExitSignal", () => {
  it("marks both channels success when both succeed", async () => {
    const tel = vi.fn().mockResolvedValue({ success: true, mockMode: true });
    const mail = vi.fn().mockResolvedValue({ success: true, mockMode: true });

    const outcome = await dispatchExitSignal(buildInput(tel, mail));
    expect(outcome.telegram.success).toBe(true);
    expect(outcome.email.success).toBe(true);
    expect(outcome.email.attempts).toBe(1);
    expect(outcome.d10Triggered).toBe(false);
    expect(outcome.allFailed).toBe(false);
    expect(outcome.badgeRequired).toBe(false);
    expect(tel).toHaveBeenCalledTimes(1);
    expect(mail).toHaveBeenCalledTimes(1);
  });

  it("skips D10 retry when only telegram fails (email catches up)", async () => {
    const tel = vi
      .fn()
      .mockResolvedValue({ success: false, mockMode: false, error: "timeout" });
    const mail = vi.fn().mockResolvedValue({ success: true, mockMode: false });

    const outcome = await dispatchExitSignal(buildInput(tel, mail));
    expect(outcome.telegram.success).toBe(false);
    expect(outcome.email.success).toBe(true);
    expect(outcome.d10Triggered).toBe(false);
    expect(outcome.allFailed).toBe(false);
    expect(outcome.email.attempts).toBe(1);
    expect(mail).toHaveBeenCalledTimes(1);
  });

  it("skips D10 retry when only email fails (telegram catches up)", async () => {
    const tel = vi.fn().mockResolvedValue({ success: true, mockMode: false });
    const mail = vi
      .fn()
      .mockResolvedValue({ success: false, mockMode: false, error: "quota" });

    const outcome = await dispatchExitSignal(buildInput(tel, mail));
    expect(outcome.telegram.success).toBe(true);
    expect(outcome.email.success).toBe(false);
    expect(outcome.d10Triggered).toBe(false);
    expect(outcome.allFailed).toBe(false);
    expect(mail).toHaveBeenCalledTimes(1);
  });

  it("triggers D10 retry when both fail initially (retry succeeds)", async () => {
    const tel = vi
      .fn()
      .mockResolvedValue({ success: false, mockMode: false, error: "timeout" });
    const mail = vi
      .fn()
      .mockResolvedValueOnce({ success: false, mockMode: false, error: "5xx" })
      .mockResolvedValueOnce({ success: true, mockMode: false });

    const outcome = await dispatchExitSignal(buildInput(tel, mail));
    expect(outcome.d10Triggered).toBe(true);
    expect(outcome.allFailed).toBe(false);
    expect(outcome.email.success).toBe(true);
    expect(outcome.email.attempts).toBe(2);
    expect(mail).toHaveBeenCalledTimes(2);
  });

  it("marks allFailed and badgeRequired when retry also fails", async () => {
    const tel = vi
      .fn()
      .mockResolvedValue({ success: false, mockMode: false, error: "timeout" });
    const mail = vi
      .fn()
      .mockResolvedValue({ success: false, mockMode: false, error: "5xx" });

    const outcome = await dispatchExitSignal(buildInput(tel, mail));
    expect(outcome.d10Triggered).toBe(true);
    expect(outcome.allFailed).toBe(true);
    expect(outcome.badgeRequired).toBe(true);
    expect(outcome.email.attempts).toBe(2);
    expect(mail).toHaveBeenCalledTimes(2);
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
});

describe("buildExitEmailSubject", () => {
  it("prefixes Critical for critical severity", () => {
    expect(buildExitEmailSubject(makeAlert())).toMatch(/^\[Critical\]/);
  });

  it("prefixes Warning for warning severity", () => {
    expect(
      buildExitEmailSubject(makeAlert({ severity: "warning" })),
    ).toMatch(/^\[Warning\]/);
  });
});
