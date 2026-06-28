"use client";

// W3b-3 (T2) — AI 포트 제안 표시 (route-local, client). enriched positions grid + 현금 + 근거.
//   순수 헬퍼(format-portfolio/proposal-view)를 소비 = 헬퍼 live caller. plain prop만 받음(직렬화 안전).
import { Fragment } from "react";
import { Badge } from "@/components/ui/badge";
import {
  formatProposalWeightPct,
  formatTimeframeLabel,
} from "@/lib/admin/format-portfolio";
import type { ProposalPositionView } from "@/lib/portfolio/proposal-view";

export function ProposalDisplay({
  positions,
  cashWeight,
  rationale,
}: {
  positions: ProposalPositionView[];
  cashWeight: number; // 0~1
  rationale: string;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-3 gap-y-2 text-sm">
        <div className="text-xs font-medium text-muted-foreground">코드</div>
        <div className="text-xs font-medium text-muted-foreground">종목</div>
        <div className="text-right text-xs font-medium text-muted-foreground">
          비중
        </div>
        <div className="text-xs font-medium text-muted-foreground">기간</div>
        {positions.map((p) => (
          <Fragment key={p.ticker}>
            <div className="font-mono tabular-nums">{p.ticker}</div>
            <div className="truncate">{p.name}</div>
            <div className="text-right tabular-nums font-medium">
              {formatProposalWeightPct(p.weight)}
            </div>
            <div>
              <Badge variant="secondary">
                {formatTimeframeLabel(p.timeframe)}
              </Badge>
            </div>
          </Fragment>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-border/60 pt-3 text-sm">
        <span className="text-muted-foreground">현금 비중</span>
        <span className="font-medium tabular-nums">
          {formatProposalWeightPct(cashWeight)}
        </span>
      </div>
      {rationale ? (
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
          {rationale}
        </p>
      ) : null}
    </div>
  );
}
