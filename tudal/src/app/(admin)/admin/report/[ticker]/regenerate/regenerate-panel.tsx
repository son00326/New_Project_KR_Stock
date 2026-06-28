"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { regenerateReport } from "./actions";
import { formatErrorMessage } from "@/lib/admin/format-error";

interface RegenerateConfirmPanelProps {
  ticker: string;
  month: string;
  allowed: boolean;
}

function reportHref(ticker: string, month: string): string {
  return `/admin/report/${ticker}?month=${month.slice(0, 7)}`;
}

export function RegenerateConfirmPanel({
  ticker,
  month,
  allowed,
}: RegenerateConfirmPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const returnHref = reportHref(ticker, month);

  function handleRegenerate() {
    setErrorMsg(null);
    startTransition(async () => {
      const result = await regenerateReport({ ticker, month });
      if (result.success) {
        router.push(returnHref);
        router.refresh();
      } else {
        setErrorMsg(formatErrorMessage(result.error));
      }
    });
  }

  return (
    <div className="space-y-4">
      {errorMsg && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMsg}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={handleRegenerate}
          disabled={!allowed || isPending}
          title={!allowed ? "이번 달 재생성 한도 소진" : undefined}
        >
          {isPending ? "처리 중…" : "재생성"}
        </Button>

        <Link
          href={returnHref}
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          취소
        </Link>
      </div>
    </div>
  );
}
