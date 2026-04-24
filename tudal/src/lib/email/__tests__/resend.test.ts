import { afterEach, describe, expect, it, vi } from "vitest";
import { sendEmail } from "../resend";

describe("sendEmail", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps missing RESEND_API_KEY as mock success outside production", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("RESEND_API_KEY", "");

    const result = await sendEmail({
      to: "admin@example.com",
      subject: "테스트",
      text: "hello",
    });

    expect(result).toMatchObject({ success: true, mockMode: true });
  });

  it("fails closed when RESEND_API_KEY is missing in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "");

    const result = await sendEmail({
      to: "admin@example.com",
      subject: "테스트",
      text: "hello",
    });

    expect(result.success).toBe(false);
    expect(result.mockMode).toBe(true);
    expect(result.error).toMatch(/RESEND_API_KEY/);
  });
});
