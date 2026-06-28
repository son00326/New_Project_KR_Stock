"use client";

import Link from "next/link";
import { useState } from "react";
import { Eye, EyeOff, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { JoopickLogo } from "@/components/layout/logo";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const passwordChecks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    match: password === passwordConfirm && passwordConfirm.length > 0,
  };

  const isFormValid =
    name.trim() &&
    email.trim() &&
    passwordChecks.length &&
    passwordChecks.number &&
    passwordChecks.match &&
    agreeTerms &&
    agreePrivacy;

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!isFormValid) return;

    setIsLoading(true);
    setError("");

    try {
      await new Promise((r) => setTimeout(r, 1000));
      // TODO: Supabase auth.signUp 연동
      alert("Supabase 연동 후 회원가입이 활성화됩니다.");
    } catch {
      setError("회원가입에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSocialSignup(provider: "google" | "kakao") {
    alert(`${provider} 회원가입은 Supabase 연동 후 활성화됩니다.`);
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-8 px-8">
          {/* 로고 */}
          <div className="flex flex-col items-center mb-8">
            <Link href="/" className="mb-2">
              <JoopickLogo size="lg" />
            </Link>
            <p className="text-sm text-muted-foreground">
              무료로 시작하고, 필요할 때 업그레이드하세요
            </p>
          </div>

          {/* 소셜 로그인 */}
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full h-11"
              onClick={() => handleSocialSignup("google")}
            >
              <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Google로 시작하기
            </Button>
            <Button
              variant="outline"
              className="w-full h-11"
              onClick={() => handleSocialSignup("kakao")}
            >
              <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="#3C1E1E">
                <path d="M12 3C6.48 3 2 6.48 2 10.5c0 2.58 1.64 4.85 4.13 6.15l-1.07 3.92c-.07.26.22.47.44.32L9.6 18.2c.78.13 1.58.2 2.4.2 5.52 0 10-3.48 10-7.5S17.52 3 12 3z" />
              </svg>
              카카오로 시작하기
            </Button>
          </div>

          <div className="relative my-6">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
              또는 이메일로 가입
            </span>
          </div>

          {/* 이메일 회원가입 폼 */}
          <form onSubmit={handleSignup} className="space-y-4">
            {error && (
              <div className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">이름</Label>
              <Input
                id="name"
                type="text"
                placeholder="홍길동"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-11"
              />
            </div>

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
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="8자 이상, 숫자 포함"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {password && (
                <div className="space-y-1 mt-2">
                  <PasswordCheck passed={passwordChecks.length} label="8자 이상" />
                  <PasswordCheck passed={passwordChecks.number} label="숫자 포함" />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="passwordConfirm">비밀번호 확인</Label>
              <Input
                id="passwordConfirm"
                type="password"
                placeholder="비밀번호를 다시 입력하세요"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                required
                className="h-11"
              />
              {passwordConfirm && (
                <PasswordCheck
                  passed={passwordChecks.match}
                  label={passwordChecks.match ? "비밀번호 일치" : "비밀번호가 일치하지 않습니다"}
                />
              )}
            </div>

            {/* 약관 동의 */}
            <div className="space-y-3 pt-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-input"
                />
                <span className="text-sm text-muted-foreground">
                  <Link href="#" className="text-foreground underline">이용약관</Link>에 동의합니다 (필수)
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreePrivacy}
                  onChange={(e) => setAgreePrivacy(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-input"
                />
                <span className="text-sm text-muted-foreground">
                  <Link href="#" className="text-foreground underline">개인정보처리방침</Link>에 동의합니다 (필수)
                </span>
              </label>
            </div>

            <Button
              type="submit"
              className="w-full h-11"
              disabled={!isFormValid || isLoading}
            >
              {isLoading ? "가입 처리 중..." : "무료 회원가입"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            이미 계정이 있으신가요?{" "}
            <Link
              href="/login"
              className="font-medium text-primary hover:underline"
            >
              로그인
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function PasswordCheck({ passed, label }: { passed: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <Check
        className={`h-3.5 w-3.5 ${
          passed ? "text-primary" : "text-muted-foreground/40"
        }`}
      />
      <span
        className={`text-xs ${
          passed ? "text-primary" : "text-muted-foreground"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
