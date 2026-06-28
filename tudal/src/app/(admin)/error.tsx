"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// FixPlan-46 §P1.3 G-2-FE — /admin 라우트 그룹 공통 에러 boundary.
// Server Component throw·Supabase wrapper 실패 시 Next.js가 이 경계로 fallback.
// 'use client' 필수 (reset prop이 client 함수).
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 운영 중에는 Sentry/observability로 전송 (S7d 후속). 지금은 콘솔만.
    console.error("[admin error boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">관리자 페이지에 오류가 발생했습니다</h1>
        <p className="text-sm text-muted-foreground">
          잠시 후 다시 시도해주세요. 문제가 계속되면 콘솔 로그를 확인해주세요.
        </p>
        {error.digest && (
          <p className="font-mono text-xs text-muted-foreground">
            digest: {error.digest}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={() => reset()}>다시 시도</Button>
        <Link href="/admin">
          <Button variant="outline">관리자 홈으로</Button>
        </Link>
      </div>
    </div>
  );
}
