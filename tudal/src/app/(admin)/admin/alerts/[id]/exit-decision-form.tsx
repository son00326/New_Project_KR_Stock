"use client";

import { useState, useTransition } from "react";
import { recordExitDecision } from "@/app/(admin)/admin/alerts/[id]/actions";
import { formatErrorMessage } from "@/lib/admin/format-error";
import type { ExitDecision } from "@/types/admin";

// M15 Exit 결정 기록 입력 UI (S5b T5b.3, R3.10-14)
// 매도 전량 / 분할매도 / 홀딩 중 선택 + 근거 메모. 제출 후 mock fixture 갱신.

interface ExitDecisionFormProps {
  alertId: string;
}

const OPTIONS: { value: ExitDecision; label: string; hint: string }[] = [
  {
    value: "sell_all",
    label: "매도 전량",
    hint: "목표가 도달·추세 완전 이탈 — 전량 매도",
  },
  {
    value: "partial_sell",
    label: "분할매도",
    hint: "불확실성 — 50% 매도 · 잔여 모니터링",
  },
  {
    value: "hold",
    label: "홀딩",
    hint: "트리거는 소음 — 원래 시나리오 유지",
  },
];

export function ExitDecisionForm({ alertId }: ExitDecisionFormProps) {
  const [decision, setDecision] = useState<ExitDecision | null>(null);
  const [memo, setMemo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setError(null);
    if (!decision) {
      setError("결정 옵션 선택이 필요합니다.");
      return;
    }
    startTransition(async () => {
      const res = await recordExitDecision({
        alertId,
        decision,
        memo,
      });
      if (res.success) {
        setSuccess(true);
      } else {
        setError(res.error);
      }
    });
  };

  if (success) {
    return (
      <p className="rounded-xl border border-market-up/40 bg-market-up/10 px-3 py-2 text-sm text-market-up">
        결정 기록 저장 완료. 페이지를 새로 고치면 이력에 반영됩니다.
      </p>
    );
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <fieldset className="space-y-2" disabled={isPending}>
        <legend className="text-xs font-medium text-muted-foreground">
          결정 옵션
        </legend>
        {OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition-colors ${
              decision === opt.value
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-muted"
            }`}
          >
            <input
              type="radio"
              name="exit-decision"
              value={opt.value}
              checked={decision === opt.value}
              onChange={() => setDecision(opt.value)}
              className="mt-0.5 h-4 w-4 accent-primary"
            />
            <span>
              <span className="font-medium">{opt.label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {opt.hint}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">
          근거 메모 (선택)
        </span>
        <textarea
          className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
          rows={3}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="시나리오 · 근거 · 외부 정보 링크 등"
          disabled={isPending}
        />
      </label>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-market-down/40 bg-market-down/10 px-3 py-2 text-sm text-market-down"
        >
          {formatErrorMessage(error)}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || !decision}
        className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-toss-sm transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
      >
        {isPending ? "저장 중..." : "결정 기록 저장"}
      </button>
    </form>
  );
}
