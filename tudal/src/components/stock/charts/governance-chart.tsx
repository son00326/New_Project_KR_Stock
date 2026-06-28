"use client";

import { Badge } from "@/components/ui/badge";
import { formatKRW } from "@/lib/constants";
import type { Subsidiary } from "@/types/corporate";

interface GovernanceChartProps {
  companyName: string;
  subsidiaries: Subsidiary[];
}

const RELATIONSHIP_COLOR = {
  "자회사": "bg-chart-1/10 text-chart-1 border-0",
  "손자회사": "bg-chart-4/10 text-chart-4 border-0",
  "관계회사": "bg-chart-3/10 text-chart-3 border-0",
  "합작법인": "bg-chart-5/10 text-chart-5 border-0",
};

export function GovernanceChart({ companyName, subsidiaries }: GovernanceChartProps) {
  const directSubs = subsidiaries.filter((s) => s.ownership > 50);
  const affiliates = subsidiaries.filter((s) => s.ownership > 0 && s.ownership <= 50);
  const groupCompanies = subsidiaries.filter((s) => s.ownership === 0);

  return (
    <div className="space-y-8">
      {/* 지배구조 다이어그램 */}
      <div className="relative">
        {/* 중심 회사 */}
        <div className="flex justify-center mb-8">
          <div className="rounded-xl border-2 border-primary bg-primary/5 px-8 py-4 text-center">
            <p className="font-bold text-lg">{companyName}</p>
            <p className="text-xs text-muted-foreground">분석 대상 기업</p>
          </div>
        </div>

        {/* 자회사 (50% 초과 지분) */}
        {directSubs.length > 0 && (
          <div className="mb-8">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-chart-1" />
              자회사 (지분율 50% 초과)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {directSubs.map((sub) => (
                <SubsidiaryCard key={sub.name} subsidiary={sub} />
              ))}
            </div>
          </div>
        )}

        {/* 관계회사 (지분 보유) */}
        {affiliates.length > 0 && (
          <div className="mb-8">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-chart-3" />
              관계회사 및 지분 투자 기업
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {affiliates.map((sub) => (
                <SubsidiaryCard key={sub.name} subsidiary={sub} />
              ))}
            </div>
          </div>
        )}

        {/* 삼성그룹 주요 계열사 (직접 지분 없음) */}
        {groupCompanies.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-market-neutral" />
              삼성그룹 주요 계열사 (직접 지분 없음, 순환출자 구조)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupCompanies.map((sub) => (
                <SubsidiaryCard key={sub.name} subsidiary={sub} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground border-t pt-4">
        {Object.entries(RELATIONSHIP_COLOR).map(([key, cls]) => (
          <div key={key} className="flex items-center gap-1.5">
            <Badge className={`text-xs ${cls}`}>{key}</Badge>
          </div>
        ))}
        <span className="ml-auto">* 지분율은 직접 보유 기준</span>
      </div>
    </div>
  );
}

function SubsidiaryCard({ subsidiary }: { subsidiary: Subsidiary }) {
  const relColor = RELATIONSHIP_COLOR[subsidiary.relationship];

  return (
    <div className="rounded-xl border p-3 hover:shadow-toss-sm transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{subsidiary.name}</span>
          {subsidiary.isListed && (
            <Badge variant="outline" className="text-xs">
              상장
            </Badge>
          )}
        </div>
        <Badge className={`text-xs shrink-0 ${relColor}`}>
          {subsidiary.relationship}
        </Badge>
      </div>

      <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
        {subsidiary.businessArea}
      </p>

      <div className="flex items-center gap-3 text-xs">
        {subsidiary.ownership > 0 && (
          <span className="font-semibold text-primary tabular-nums">
            지분 {subsidiary.ownership}%
          </span>
        )}
        {subsidiary.ticker && (
          <span className="text-muted-foreground tabular-nums">{subsidiary.ticker}</span>
        )}
        {subsidiary.marketCap && (
          <span className="text-muted-foreground tabular-nums">
            시총 {formatKRW(subsidiary.marketCap)}
          </span>
        )}
      </div>
    </div>
  );
}
