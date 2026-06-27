import { describe, expect, it, vi } from "vitest";
import { runExitSignalEval } from "@/lib/notify/run-exit-eval";
import type { ExitPosition } from "@/lib/notify/exit-signal";

function pos(overrides: Partial<ExitPosition> = {}): ExitPosition {
  return {
    ticker: "005930",
    bucket: "mid",
    entryPrice: 100_000,
    currentPrice: 100_000,
    holdingDays: 1,
    ...overrides,
  };
}

const NOW = new Date("2026-06-27T01:00:00Z");

describe("runExitSignalEval", () => {
  it("evaluates positions, inserts durable exit alerts, dispatches telegram", async () => {
    const insertAlerts = vi.fn().mockResolvedValue(undefined);
    const sendTelegram = vi
      .fn()
      .mockResolvedValue({ success: true, mockMode: false });
    const res = await runExitSignalEval(
      [pos({ currentPrice: 80_000 }), pos({ ticker: "000660", currentPrice: 101_000 })],
      { now: NOW, insertAlerts, sendTelegram },
    );
    expect(res.evaluated).toBe(2);
    expect(res.signals).toBe(1); // only the -20% one triggers momentum_break
    expect(res.inserted).toBe(1);
    expect(res.telegramDelivered).toBe(1);
    expect(insertAlerts).toHaveBeenCalledTimes(1);
    expect(insertAlerts.mock.calls[0][0][0].alertType).toBe("exit_signal");
    expect(sendTelegram).toHaveBeenCalledTimes(1);
  });

  it("no signals → no insert, no dispatch", async () => {
    const insertAlerts = vi.fn().mockResolvedValue(undefined);
    const sendTelegram = vi.fn();
    const res = await runExitSignalEval([pos({ currentPrice: 101_000 })], {
      now: NOW,
      insertAlerts,
      sendTelegram,
    });
    expect(res.signals).toBe(0);
    expect(res.inserted).toBe(0);
    expect(insertAlerts).not.toHaveBeenCalled();
    expect(sendTelegram).not.toHaveBeenCalled();
  });

  it("durable insert happens even if telegram is mock-mode (not delivered)", async () => {
    const insertAlerts = vi.fn().mockResolvedValue(undefined);
    const sendTelegram = vi
      .fn()
      .mockResolvedValue({ success: true, mockMode: true });
    const res = await runExitSignalEval([pos({ currentPrice: 80_000 })], {
      now: NOW,
      insertAlerts,
      sendTelegram,
    });
    expect(res.inserted).toBe(1);
    expect(res.telegramDelivered).toBe(0); // mock-mode ≠ delivered
    expect(insertAlerts).toHaveBeenCalledTimes(1);
  });

  it("durable insert precedes telegram (safety net ordering)", async () => {
    const order: string[] = [];
    const insertAlerts = vi.fn().mockImplementation(async () => {
      order.push("insert");
    });
    const sendTelegram = vi.fn().mockImplementation(async () => {
      order.push("telegram");
      return { success: true, mockMode: false };
    });
    await runExitSignalEval([pos({ currentPrice: 80_000 })], {
      now: NOW,
      insertAlerts,
      sendTelegram,
    });
    expect(order[0]).toBe("insert");
  });
});
