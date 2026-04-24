import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signInWithOtp: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      signInWithOtp: mocks.signInWithOtp,
    },
  }),
}));

describe("sendMagicLinkAction", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.ADMIN_EMAILS = "admin@example.com";
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_VERCEL_URL;
    mocks.signInWithOtp.mockResolvedValue({ error: null });
  });

  it("uses NEXT_PUBLIC_SITE_URL when configured", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://tudal.example.com/";
    const { sendMagicLinkAction } = await import("../actions");

    const result = await sendMagicLinkAction({
      email: "admin@example.com",
      next: "/admin/settings",
    });

    expect(result.success).toBe(true);
    expect(mocks.signInWithOtp).toHaveBeenCalledWith({
      email: "admin@example.com",
      options: {
        emailRedirectTo:
          "https://tudal.example.com/auth/callback?next=%2Fadmin%2Fsettings",
        shouldCreateUser: false,
      },
    });
  });

  it("uses Vercel deployment host before localhost fallback", async () => {
    process.env.NEXT_PUBLIC_VERCEL_URL = "tudal-tawny.vercel.app";
    const { sendMagicLinkAction } = await import("../actions");

    await sendMagicLinkAction({ email: "admin@example.com", next: "/admin" });

    expect(mocks.signInWithOtp).toHaveBeenCalledWith({
      email: "admin@example.com",
      options: {
        emailRedirectTo: "https://tudal-tawny.vercel.app/auth/callback?next=%2Fadmin",
        shouldCreateUser: false,
      },
    });
  });
});
