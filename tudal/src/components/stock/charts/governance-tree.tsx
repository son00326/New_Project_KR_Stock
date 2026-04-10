"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatKRW } from "@/lib/constants";
import type { Subsidiary } from "@/types/corporate";

interface GovernanceTreeProps {
  companyName: string;
  companyTicker: string;
  subsidiaries: Subsidiary[];
}

export function GovernanceTree({ companyName, companyTicker, subsidiaries }: GovernanceTreeProps) {
  const directSubs = subsidiaries.filter((s) => s.ownership > 50);
  const majorAffiliates = subsidiaries.filter((s) => s.ownership > 0 && s.ownership <= 50);
  const groupCompanies = subsidiaries.filter((s) => s.ownership === 0);

  return (
    <div className="space-y-6">
      {/* 트리 루트 */}
      <div className="flex flex-col items-center">
        {/* 루트 노드 */}
        <div className="rounded-xl border-2 border-primary bg-primary/5 px-6 py-3 text-center shadow-sm">
          <p className="font-bold text-base">{companyName}</p>
          <p className="text-xs text-muted-foreground">{companyTicker} | KOSPI</p>
        </div>

        {/* 1차 연결선 - 자회사 */}
        {directSubs.length > 0 && (
          <>
            <div className="w-px h-6 bg-border" />
            <div className="text-xs font-semibold text-muted-foreground bg-muted px-3 py-1 rounded-full">
              자회사 (지분 50% 초과, 실질 지배)
            </div>
            <div className="w-px h-4 bg-border" />

            {/* 가로 연결선 */}
            <div className="relative w-full max-w-4xl">
              <div className="absolute top-0 left-[10%] right-[10%] h-px bg-border" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-4">
                {directSubs.map((sub) => (
                  <TreeNode key={sub.name} subsidiary={sub} level="child" />
                ))}
              </div>
            </div>
          </>
        )}

        {/* 2차 연결선 - 관계회사 */}
        {majorAffiliates.length > 0 && (
          <>
            <div className="w-px h-8 bg-border mt-6" />
            <div className="text-xs font-semibold text-muted-foreground bg-muted px-3 py-1 rounded-full">
              주요 관계회사 (지분 투자, 경영 영향력)
            </div>
            <div className="w-px h-4 bg-border" />

            <div className="relative w-full max-w-5xl">
              <div className="absolute top-0 left-[5%] right-[5%] h-px bg-border" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-4">
                {majorAffiliates.map((sub) => (
                  <TreeNode key={sub.name} subsidiary={sub} level="affiliate" />
                ))}
              </div>
            </div>
          </>
        )}

        {/* 3차 - 그룹 계열사 */}
        {groupCompanies.length > 0 && (
          <>
            <div className="w-px h-8 bg-border/50 mt-6 border-dashed" />
            <div className="text-xs font-semibold text-muted-foreground bg-muted/50 px-3 py-1 rounded-full border border-dashed">
              삼성그룹 계열사 (직접 지분 없음, 순환출자 구조로 연결)
            </div>
            <div className="w-px h-4 bg-border/50 border-dashed" />

            <div className="relative w-full max-w-5xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-4">
                {groupCompanies.map((sub) => (
                  <TreeNode key={sub.name} subsidiary={sub} level="group" />
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* 주요 포인트 */}
      <div className="rounded-lg bg-muted/50 p-4 mt-6">
        <p className="text-sm font-medium mb-2">지배구조 핵심 포인트</p>
        <ul className="text-xs text-muted-foreground space-y-1.5 leading-relaxed">
          <li>• <strong>삼성디스플레이(84.8%)</strong>와 <strong>하만(100%)</strong>은 삼성전자가 실질 지배하는 핵심 자회사입니다.</li>
          <li>• <strong>삼성바이오로직스(31.5%)</strong>는 시가총액 45조원으로 삼성전자 보유 지분 가치만 약 14조원에 달합니다.</li>
          <li>• 삼성그룹의 지배구조는 <strong>이재용 회장 → 삼성물산 → 삼성생명 → 삼성전자</strong>의 순환출자 구조로 연결되어 있습니다.</li>
          <li>• 삼성전자의 해외 생산법인(미국 오스틴, 중국 시안)은 100% 자회사로, 지정학적 리스크와 직결됩니다.</li>
        </ul>
      </div>
    </div>
  );
}

function TreeNode({
  subsidiary,
  level,
}: {
  subsidiary: Subsidiary;
  level: "child" | "affiliate" | "group";
}) {
  const borderColor = {
    child: "border-blue-300 bg-blue-50/50",
    affiliate: "border-green-300 bg-green-50/50",
    group: "border-gray-200 bg-muted/30 border-dashed",
  }[level];

  const ownershipColor = {
    child: "text-blue-700 bg-blue-100",
    affiliate: "text-green-700 bg-green-100",
    group: "text-gray-500 bg-gray-100",
  }[level];

  const content = (
    <div className={`rounded-lg border p-3 ${borderColor} transition-shadow ${subsidiary.ticker ? "hover:shadow-md hover:border-primary/50 cursor-pointer group" : "hover:shadow-sm"}`}>
      {/* 상단: 이름 + 지분율 */}
      <div className="flex items-start justify-between mb-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-semibold group-hover:text-primary transition-colors">{subsidiary.name}</span>
          {subsidiary.isListed && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">상장</Badge>
          )}
        </div>
        {subsidiary.ownership > 0 && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${ownershipColor}`}>
            {subsidiary.ownership}%
          </span>
        )}
      </div>

      {/* 사업 영역 */}
      <p className="text-xs text-muted-foreground leading-relaxed mb-2">
        {subsidiary.businessArea}
      </p>

      {/* 하단 정보 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {subsidiary.ticker && (
            <span className="font-mono">{subsidiary.ticker}</span>
          )}
          {subsidiary.marketCap && (
            <span>시총 {formatKRW(subsidiary.marketCap)}</span>
          )}
        </div>
        {subsidiary.ticker && (
          <span className="text-[10px] text-primary font-medium flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            분석 보기 <ArrowRight className="h-3 w-3" />
          </span>
        )}
      </div>
    </div>
  );

  if (subsidiary.ticker) {
    return <Link href={`/stock/${subsidiary.ticker}`}>{content}</Link>;
  }

  return content;
}
