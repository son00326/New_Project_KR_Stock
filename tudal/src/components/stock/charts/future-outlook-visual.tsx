"use client";

import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, AlertTriangle, Lightbulb } from "lucide-react";

interface OutlookItem {
  category: string;
  title: string;
  description: string;
  impact: "positive" | "negative" | "neutral";
  importance: "high" | "medium";
}

interface FutureOutlookVisualProps {
  opportunities: OutlookItem[];
  risks: OutlookItem[];
  investmentThesis: string;
}

const IMPACT_ICON = {
  positive: <TrendingUp className="h-4 w-4 text-chart-3" />,
  negative: <TrendingDown className="h-4 w-4 text-chart-2" />,
  neutral: <AlertTriangle className="h-4 w-4 text-chart-5" />,
};

const IMPORTANCE_STYLE = {
  high: "bg-chart-2/10 text-chart-2 border-0",
  medium: "bg-chart-5/10 text-chart-5 border-0",
};

export function FutureOutlookVisual({
  opportunities,
  risks,
  investmentThesis,
}: FutureOutlookVisualProps) {
  return (
    <div className="space-y-6">
      {/* 투자 포인트 요약 */}
      <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="h-5 w-5 text-primary" />
          <h4 className="font-semibold">핵심 투자 포인트</h4>
        </div>
        <p className="text-sm leading-relaxed">{investmentThesis}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 성장 기회 */}
        <div>
          <h4 className="text-sm font-semibold text-chart-3 mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            성장 기회 (Opportunities)
          </h4>
          <div className="space-y-3">
            {opportunities.map((item, i) => (
              <OutlookCard key={i} item={item} />
            ))}
          </div>
        </div>

        {/* 리스크 요인 */}
        <div>
          <h4 className="text-sm font-semibold text-chart-2 mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            리스크 요인 (Risks)
          </h4>
          <div className="space-y-3">
            {risks.map((item, i) => (
              <OutlookCard key={i} item={item} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function OutlookCard({ item }: { item: OutlookItem }) {
  return (
    <div className="rounded-xl border p-3 hover:shadow-toss-sm transition-shadow">
      <div className="flex items-center gap-2 mb-1.5">
        {IMPACT_ICON[item.impact]}
        <span className="text-sm font-medium">{item.title}</span>
        <Badge className={`text-xs ml-auto ${IMPORTANCE_STYLE[item.importance]}`}>
          {item.importance === "high" ? "핵심" : "참고"}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed pl-6">
        {item.description}
      </p>
    </div>
  );
}

// 삼성전자 미래 전망 프리셋
export function getSamsungOutlookData(): FutureOutlookVisualProps {
  return {
    investmentThesis:
      "삼성전자의 핵심 투자 포인트는 \"AI 시대의 메모리 반도체 수혜\"입니다. AI 서버에 필수적인 HBM(고대역폭 메모리) 수요가 연평균 60% 이상 성장할 전망이며, 삼성전자는 세계 최대 메모리 반도체 기업으로서 이 수혜를 가장 크게 받을 수 있는 포지션에 있습니다. 다만 HBM 시장에서 SK하이닉스 대비 기술 후발이라는 점이 단기 리스크이며, 이 격차를 얼마나 빠르게 좁히느냐가 향후 주가 방향을 결정할 핵심 변수입니다.",
    opportunities: [
      {
        category: "AI 반도체",
        title: "HBM(고대역폭 메모리) 시장 급성장",
        description: "ChatGPT, 클라우드 AI 등으로 HBM 수요가 폭발적으로 증가 중. 2025~2027년 연평균 60%+ 성장 전망. 삼성전자 HBM3E 양산 안정화 시 매출 급증 기대.",
        impact: "positive",
        importance: "high",
      },
      {
        category: "파운드리",
        title: "2nm GAA 공정 양산 준비",
        description: "차세대 2nm GAA(Gate-All-Around) 공정을 준비 중. TSMC와의 기술 격차를 축소할 수 있는 중요한 전환점. 성공 시 파운드리 점유율 대폭 확대 가능.",
        impact: "positive",
        importance: "high",
      },
      {
        category: "스마트폰",
        title: "온디바이스 AI로 ASP 상승",
        description: "갤럭시 AI 기능 탑재로 프리미엄 스마트폰의 평균판매가격(ASP) 상승 추세. 폴더블 + AI가 결합된 차별화된 사용자 경험으로 수익성 개선 기대.",
        impact: "positive",
        importance: "medium",
      },
      {
        category: "금리 환경",
        title: "금리 인하 사이클 시작",
        description: "미국·한국 모두 금리 인하 진행 중. 성장주 밸류에이션에 긍정적. 대규모 CAPEX 투자를 진행하는 삼성전자의 금융 비용 부담 완화.",
        impact: "positive",
        importance: "medium",
      },
    ],
    risks: [
      {
        category: "기술 경쟁",
        title: "HBM 기술 후발 리스크",
        description: "SK하이닉스가 NVIDIA HBM 공급 우선 지위를 확보. 삼성전자의 HBM3E 수율이 기대에 미치지 못할 경우 시장 점유율 확보에 차질. 현재 약 1년의 기술 격차 존재.",
        impact: "negative",
        importance: "high",
      },
      {
        category: "반도체 사이클",
        title: "메모리 가격 하락 사이클 가능성",
        description: "2023년처럼 메모리 가격 급락 시 영업이익이 85% 이상 감소할 수 있음. AI 수요가 사이클을 완화시킬 수 있으나, 구조적 사이클 리스크는 상존.",
        impact: "negative",
        importance: "high",
      },
      {
        category: "지정학",
        title: "미중 반도체 갈등",
        description: "시안 NAND 공장 등 중국 내 사업에 대한 규제 리스크. 미국의 대중국 반도체 수출 규제가 강화될 경우 삼성전자의 중국 매출(약 15%)에 타격 가능.",
        impact: "negative",
        importance: "medium",
      },
      {
        category: "경쟁",
        title: "파운드리 TSMC 격차",
        description: "첨단 파운드리에서 TSMC가 60%+ 점유율로 압도적 우위. 주요 팹리스(Apple, NVIDIA, AMD 등)의 대부분이 TSMC를 이용. 수율 열위로 인한 고객 확보 난항.",
        impact: "negative",
        importance: "medium",
      },
    ],
  };
}
