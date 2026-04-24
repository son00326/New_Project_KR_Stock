import { afterEach, describe, expect, it, vi } from "vitest";
import { isTelegramConfigured, sendTelegram } from "../telegram";

describe("telegram adapter", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts TELEGRAM_CHAT_IDS by using the first configured chat id", () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "token");
    vi.stubEnv("TELEGRAM_CHAT_IDS", "123,456");
    vi.stubEnv("TELEGRAM_CHAT_ID", "");

    expect(isTelegramConfigured()).toBe(true);
  });

  it("fails closed when Telegram env is missing in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    vi.stubEnv("TELEGRAM_CHAT_ID", "");
    vi.stubEnv("TELEGRAM_CHAT_IDS", "");

    const result = await sendTelegram({ text: "하트비트" });

    expect(result.success).toBe(false);
    expect(result.mockMode).toBe(true);
    expect(result.error).toMatch(/TELEGRAM/);
  });
});
