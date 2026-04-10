"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ReportLimitBannerProps {
  remaining: number;
  total: number;
}

export function ReportLimitBanner({ remaining, total }: ReportLimitBannerProps) {
  if (remaining > total) return null; // unlimited

  return (
    <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0" />
        <p className="text-sm text-yellow-800">
          무료 리포트 열람 횟수:{" "}
          <span className="font-semibold">
            {remaining}/{total}회 남음
          </span>
        </p>
      </div>
      <Link href="/pricing">
        <Button size="sm" variant="outline" className="text-xs">
          무제한 이용하기
        </Button>
      </Link>
    </div>
  );
}
