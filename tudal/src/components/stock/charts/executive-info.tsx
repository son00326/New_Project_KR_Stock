"use client";

import { Badge } from "@/components/ui/badge";
import type { Executive, CreditRating } from "@/types/corporate";

interface ExecutiveInfoProps {
  executives: Executive[];
  creditRatings: CreditRating[];
}

const OUTLOOK_STYLE = {
  "안정적": "bg-green-100 text-green-700 border-0",
  "긍정적": "bg-blue-100 text-blue-700 border-0",
  "부정적": "bg-red-100 text-red-700 border-0",
  "관찰": "bg-yellow-100 text-yellow-700 border-0",
};

export function ExecutiveInfo({ executives, creditRatings }: ExecutiveInfoProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 주요 임원 */}
      <div>
        <h4 className="text-sm font-semibold mb-3">주요 경영진</h4>
        <div className="space-y-2">
          {executives.map((exec) => (
            <div
              key={exec.name}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{exec.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {exec.position}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{exec.role}</p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {exec.tenure}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 신용등급 */}
      <div>
        <h4 className="text-sm font-semibold mb-3">신용등급</h4>
        <div className="space-y-2">
          {creditRatings.map((cr) => (
            <div
              key={cr.agency}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div>
                <span className="text-sm font-medium">{cr.agency}</span>
                <p className="text-xs text-muted-foreground mt-0.5">{cr.date}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-primary">{cr.rating}</span>
                <Badge className={`text-xs ${OUTLOOK_STYLE[cr.outlook]}`}>
                  {cr.outlook}
                </Badge>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg bg-muted/50 p-3 mt-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong>AAA/AA-</strong>는 최고 수준의 신용등급으로, 원리금 상환 능력이 매우 우수하다는 의미입니다.
            삼성전자는 국내 최고 등급(AAA)과 글로벌 상위 등급(AA-/Aa3)을 모두 보유하고 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}
