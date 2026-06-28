import Link from "next/link";
import { Suspense } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { JoopickLogo } from "@/components/layout/logo";
import { LoginForm } from "@/app/(auth)/login/login-form";

// /login — Supabase signInWithPassword 연동 (22차 후속).
// Server Component 래퍼 + Suspense 경계 (Next 16 useSearchParams 요구).

function LoginFormFallback() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-11 rounded-xl bg-muted" />
      <div className="h-11 rounded-xl bg-muted" />
      <div className="mt-6 h-11 rounded-xl bg-muted" />
      <div className="h-11 rounded-xl bg-muted" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-8 px-8">
          <div className="flex flex-col items-center mb-8">
            <Link href="/" className="mb-2">
              <JoopickLogo size="lg" />
            </Link>
            <p className="text-sm text-muted-foreground">
              주픽에 오신 것을 환영합니다
            </p>
          </div>
          <Suspense fallback={<LoginFormFallback />}>
            <LoginForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
