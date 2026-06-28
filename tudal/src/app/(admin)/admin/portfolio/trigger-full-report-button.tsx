// PR4 Task 1 Step 1.3.1 — admin trigger 버튼 (commitFullReport fast path wire).
// SoT plan: docs/superpowers/plans/2026-05-25-pr4-ui-caller-wire.md §Step 1.3 (lines 787-983).
//
// Plan drift fix (1.3.1 → 1.3.4.3 정합):
//   plan §1.3.1 props는 {ticker, month, name}만이지만 triggerFullReport(actions.ts)는 4-field
//   {ticker, name, sector, month} 요구. plan §1.3.4.3은 sector 전달. 본 컴포넌트는 4-field 채택.
//
// 흐름: 버튼 클릭 → useTransition + triggerFullReport(4-field) → success/error feedback (한국어).
// 한국어 UI 문구 + aria-busy + role=status.
'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { triggerFullReport } from './actions';
import { formatErrorMessage } from '@/lib/admin/format-error';

export interface TriggerFullReportButtonProps {
  ticker: string;
  name: string;
  sector: string;
  month: string; // YYYY-MM (caller가 ShortListItem.month.slice(0,7) 변환 후 전달)
}

export function TriggerFullReportButton({
  ticker,
  name,
  sector,
  month,
}: TriggerFullReportButtonProps) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<
    { kind: 'success' | 'error'; msg: string } | null
  >(null);

  // PR4 Task 9 omxy R5 watch: B43 (shortlist-row.tsx 구조 재정렬)으로 action은 <summary> OUT의
  // sibling으로 이동됨. 본 stopPropagation은 defense-in-depth — wrapper row 클릭 이벤트 위임이나
  // 다른 parent click handler 발화 차단 보조. HTML5 nesting violation은 B43 구조 fix에서 해소.
  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const res = await triggerFullReport({ ticker, name, sector, month });
      if (res.success) {
        setFeedback({
          kind: 'success',
          msg: `리포트 생성 완료 (${res.data.reportId.slice(0, 8)}…)`,
        });
      } else {
        setFeedback({ kind: 'error', msg: formatErrorMessage(res.error) });
      }
    });
  }

  return (
    // C-1 fix: wrapper도 click bubble 차단 (feedback span 클릭으로 toggle 발화 방지).
    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <Button
        type="button"
        onClick={handleClick}
        disabled={pending}
        aria-busy={pending}
        variant="default"
        size="sm"
      >
        {pending ? '생성 중…' : `${name} 리포트 생성`}
      </Button>
      {feedback && (
        <span
          className={
            feedback.kind === 'success'
              ? 'text-xs text-success'
              : 'text-xs text-destructive'
          }
          role="status"
        >
          {feedback.msg}
        </span>
      )}
    </div>
  );
}
