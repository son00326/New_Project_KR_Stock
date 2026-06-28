"use client";

import { useState, useTransition } from "react";
import { decideFunnelReflectionProposal } from "@/app/(admin)/admin/funnel-reflection/actions";
import { formatErrorMessage } from "@/lib/admin/format-error";

// G1 제안 승인/거절 버튼 — 기록만(자동 적용 아님).
export function DecideButtons({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function decide(decision: "approved" | "rejected") {
    setError(null);
    startTransition(async () => {
      const res = await decideFunnelReflectionProposal({ id, decision });
      if (!res.success) setError(res.error);
    });
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => decide("approved")}
        className="rounded-lg border border-market-up px-2.5 py-1 text-xs font-medium text-market-up transition-colors hover:bg-market-up/10 disabled:opacity-50"
      >
        승인(기록)
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => decide("rejected")}
        className="rounded-lg border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
      >
        거절
      </button>
      <span className="text-[10px] text-muted-foreground">
        ※ 승인=기록만, funnel 자동 적용 아님
      </span>
      {error && (
        <span role="status" className="text-xs text-market-down">
          {formatErrorMessage(error)}
        </span>
      )}
    </div>
  );
}
