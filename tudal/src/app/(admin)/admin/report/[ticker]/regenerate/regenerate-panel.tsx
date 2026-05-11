"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { regenerateReport } from "./actions";

interface RegenerateConfirmPanelProps {
  ticker: string;
  month: string;
  allowed: boolean;
}

function formatErrorMessage(code: string): string {
  switch (code) {
    case "manual_cap_exhausted":
      return "이번 달 수동 재생성 한도가 소진되었습니다.";
    case "cost_hardcap_40man":
      return "월 AI 비용 한도(40만원)에 도달했습니다. 다음 달 1일까지 재생성을 보류하세요.";
    case "report_not_found":
      return "이번 달 리포트가 아직 생성되지 않아 재생성할 수 없습니다.";
    case "report_lookup_failed":
      return "리포트 조회 중 오류가 발생했습니다. 잠시 후 다시 시도하세요.";
    case "regen_counter_lookup_failed":
      return "재생성 카운터 조회에 실패했습니다. 잠시 후 다시 시도하세요.";
    case "regen_counter_write_failed":
      return "재생성 카운터 저장에 실패했습니다. 잠시 후 다시 시도하세요.";
    case "regen_counter_write_conflict":
      return "다른 어드민이 동시에 재생성 중입니다. 잠시 후 다시 시도하세요.";
    case "auth_unavailable":
      return "관리자 인증을 확인할 수 없습니다. 다시 로그인해주세요.";
    default:
      return `오류: ${code}`;
  }
}

export function RegenerateConfirmPanel({
  ticker,
  month,
  allowed,
}: RegenerateConfirmPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function handleRegenerate() {
    setErrorMsg(null);
    startTransition(async () => {
      const result = await regenerateReport({ ticker, month });
      if (result.success) {
        router.push(`/admin/report/${ticker}`);
        router.refresh();
      } else {
        setErrorMsg(formatErrorMessage(result.error));
      }
    });
  }

  return (
    <div className="space-y-4">
      {errorMsg && (
        <p className="text-sm text-destructive">{errorMsg}</p>
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
          href={`/admin/report/${ticker}`}
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          취소
        </Link>
      </div>
    </div>
  );
}
