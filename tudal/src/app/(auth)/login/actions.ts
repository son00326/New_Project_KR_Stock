"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Login Server Action (22차 후속 · /login Supabase 연동)
// ref: middleware.ts ADMIN_EMAILS allowlist.
//
// 플로우: signInWithPassword → 세션 쿠키 설정 → email allowlist 재검증 → redirect.
// 오류 코드: "invalid_credentials" · "not_admin" · "auth_error".
// ---------------------------------------------------------------------------

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function sanitizeNext(raw: string | null | undefined): string {
  if (!raw) return "/admin";
  // open-redirect 방어 — 루트 상대경로만 허용
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/admin";
  return raw;
}

export async function signInAction(input: {
  email: string;
  password: string;
  next?: string | null;
}): Promise<
  | { success: true; redirectTo: string }
  | { success: false; error: "invalid_credentials" | "not_admin" | "auth_error"; message?: string }
> {
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (!email || !password) {
    return { success: false, error: "invalid_credentials" };
  }

  // ADMIN_EMAILS 선제 체크 — Supabase 호출 전 거부하여 불필요한 세션 생성 방지
  if (!ADMIN_EMAILS.includes(email)) {
    return { success: false, error: "not_admin" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const code = error.message.toLowerCase().includes("invalid")
      ? "invalid_credentials"
      : "auth_error";
    return {
      success: false,
      error: code as "invalid_credentials" | "auth_error",
      message: error.message,
    };
  }

  return { success: true, redirectTo: sanitizeNext(input.next) };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// ---------------------------------------------------------------------------
// sendMagicLinkAction — passwordless 이메일 링크 (GitHub OAuth 사용자용 대체)
// Supabase signInWithOtp → 이메일 링크 → /auth/callback?code=XXX → session.
// ---------------------------------------------------------------------------

function resolveSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000"
  );
}

export async function sendMagicLinkAction(input: {
  email: string;
  next?: string | null;
}): Promise<
  | { success: true }
  | { success: false; error: "not_admin" | "auth_error"; message?: string }
> {
  const email = input.email.trim().toLowerCase();
  if (!email) {
    return { success: false, error: "auth_error", message: "email_required" };
  }

  if (!ADMIN_EMAILS.includes(email)) {
    return { success: false, error: "not_admin" };
  }

  const nextParam = sanitizeNext(input.next);
  const redirectTo = `${resolveSiteUrl()}/auth/callback?next=${encodeURIComponent(nextParam)}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: false, // 신규 가입 방지 — ADMIN_EMAILS 허용 목록에 있어도 이미 계정 존재 전제
    },
  });

  if (error) {
    console.error("[magic-link] supabase signInWithOtp failed:", {
      name: error.name,
      status: error.status,
      message: error.message,
    });
    return {
      success: false,
      error: "auth_error",
      message: error.message,
    };
  }

  return { success: true };
}
