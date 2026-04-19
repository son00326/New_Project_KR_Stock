"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  sendMagicLinkAction,
  signInAction,
} from "@/app/(auth)/login/actions";

const ERROR_MESSAGE: Record<string, string> = {
  invalid_credentials: "이메일 또는 비밀번호가 올바르지 않습니다.",
  not_admin: "어드민 허용 목록에 없는 계정입니다.",
  auth_error: "로그인 중 오류가 발생했습니다. 다시 시도해주세요.",
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");

  const [mode, setMode] = useState<"password" | "magic">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  function handleLogin(e: { preventDefault: () => void }) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const res = await signInAction({ email, password, next });
      if (res.success) {
        router.replace(res.redirectTo);
        router.refresh();
      } else {
        setError(
          ERROR_MESSAGE[res.error] ?? res.message ?? "로그인에 실패했습니다.",
        );
      }
    });
  }

  function handleMagicLink(e: { preventDefault: () => void }) {
    e.preventDefault();
    setError("");
    setMagicLinkSent(false);
    startTransition(async () => {
      const res = await sendMagicLinkAction({ email, next });
      if (res.success) {
        setMagicLinkSent(true);
      } else if (res.error === "not_admin") {
        setError(ERROR_MESSAGE.not_admin);
      } else {
        // Supabase 원 메시지가 있으면 그대로 노출 (디버깅 편의)
        setError(
          res.message
            ? `${ERROR_MESSAGE.auth_error} (${res.message})`
            : ERROR_MESSAGE.auth_error,
        );
      }
    });
  }

  function handleSocialLogin(provider: "google" | "kakao") {
    alert(`${provider} 로그인은 Supabase OAuth 연동 후 활성화됩니다.`);
  }

  return (
    <>
      <div className="space-y-3">
        <Button
          variant="outline"
          className="w-full h-11"
          onClick={() => handleSocialLogin("google")}
        >
          <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Google로 계속하기
        </Button>
        <Button
          variant="outline"
          className="w-full h-11"
          onClick={() => handleSocialLogin("kakao")}
        >
          <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="#3C1E1E">
            <path d="M12 3C6.48 3 2 6.48 2 10.5c0 2.58 1.64 4.85 4.13 6.15l-1.07 3.92c-.07.26.22.47.44.32L9.6 18.2c.78.13 1.58.2 2.4.2 5.52 0 10-3.48 10-7.5S17.52 3 12 3z" />
          </svg>
          카카오로 계속하기
        </Button>
      </div>

      <div className="relative my-6">
        <Separator />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
          또는 이메일로 로그인
        </span>
      </div>

      <div
        role="tablist"
        aria-label="로그인 방식"
        className="mb-4 inline-flex rounded-md border p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "password"}
          onClick={() => {
            setMode("password");
            setError("");
            setMagicLinkSent(false);
          }}
          className={`rounded-sm px-3 py-1 text-xs ${mode === "password" ? "bg-foreground text-background" : "text-muted-foreground"}`}
        >
          비밀번호
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "magic"}
          onClick={() => {
            setMode("magic");
            setError("");
          }}
          className={`rounded-sm px-3 py-1 text-xs ${mode === "magic" ? "bg-foreground text-background" : "text-muted-foreground"}`}
        >
          이메일 링크
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {mode === "password" ? (
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">이메일</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-11"
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">비밀번호</Label>
              <Link
                href="#"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                비밀번호를 잊으셨나요?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="비밀번호를 입력하세요"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11 pr-10"
                disabled={isPending}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full h-11" disabled={isPending}>
            {isPending ? "로그인 중..." : "로그인"}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleMagicLink} className="space-y-4">
          {magicLinkSent ? (
            <div className="rounded-md border border-[var(--color-market-up)]/40 bg-[var(--color-market-up)]/10 p-3 text-sm text-[var(--color-market-up)]">
              이메일로 로그인 링크를 보냈습니다. 받은편지함을 확인한 뒤 링크를 클릭하세요.
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="magic-email">이메일</Label>
                <Input
                  id="magic-email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11"
                  disabled={isPending}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                비밀번호 없이 이메일로 1회용 로그인 링크를 받습니다. GitHub OAuth로 가입한 계정도 사용 가능합니다.
              </p>
              <Button type="submit" className="w-full h-11" disabled={isPending}>
                {isPending ? "링크 발송 중..." : "로그인 링크 받기"}
              </Button>
            </>
          )}
        </form>
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        아직 계정이 없으신가요?{" "}
        <Link
          href="/signup"
          className="font-medium text-foreground hover:underline"
        >
          무료 회원가입
        </Link>
      </p>
    </>
  );
}
