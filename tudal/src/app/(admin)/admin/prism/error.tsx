"use client";

import { AlertTriangle } from "lucide-react";

export default function PrismError({
  unstable_retry,
}: {
  readonly error: Error & { readonly digest?: string };
  readonly unstable_retry: () => void;
}) {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/5 px-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle aria-hidden="true" className="size-5 text-destructive" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">프리즘 데이터를 불러오지 못했어요</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        관리자 권한과 최신 스냅샷 조회 상태를 확인한 뒤 다시 시도해 주세요.
      </p>
      <button
        className="mt-5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={unstable_retry}
        type="button"
      >
        다시 시도
      </button>
    </div>
  );
}
