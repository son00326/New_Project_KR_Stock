"use client";

import { Badge } from "@/components/ui/badge";

interface Competitor {
  name: string;
  region: "국내" | "해외";
  area: string;
  position: "leader" | "challenger" | "follower";
  description: string;
}

interface CompetitiveMapProps {
  companyName: string;
  competitors: Competitor[];
  strengths: string[];
  weaknesses: string[];
}

const POSITION_STYLE = {
  leader: { label: "선도", color: "bg-chart-3/10 text-chart-3 border-0" },
  challenger: { label: "도전", color: "bg-chart-5/10 text-chart-5 border-0" },
  follower: { label: "추격", color: "bg-chart-2/10 text-chart-2 border-0" },
};

export function CompetitiveMap({
  companyName,
  competitors,
  strengths,
  weaknesses,
}: CompetitiveMapProps) {
  return (
    <div className="space-y-6">
      {/* SWOT 요약 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-chart-3/20 bg-chart-3/5 p-4">
          <h4 className="text-sm font-semibold text-chart-3 mb-3">
            강점 (Strengths)
          </h4>
          <ul className="space-y-2">
            {strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-chart-3 mt-0.5 shrink-0">+</span>
                <span className="text-foreground/80">{s}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-chart-2/20 bg-chart-2/5 p-4">
          <h4 className="text-sm font-semibold text-chart-2 mb-3">
            약점 (Weaknesses)
          </h4>
          <ul className="space-y-2">
            {weaknesses.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-chart-2 mt-0.5 shrink-0">-</span>
                <span className="text-foreground/80">{w}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 경쟁사 맵 */}
      <div>
        <h4 className="text-sm font-semibold mb-3">주요 경쟁사 포지셔닝</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-3 font-medium text-muted-foreground">경쟁사</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">지역</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">경쟁 분야</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">{companyName} 포지션</th>
                <th className="text-left py-2 pl-3 font-medium text-muted-foreground">비고</th>
              </tr>
            </thead>
            <tbody>
              {competitors.map((comp) => {
                const pos = POSITION_STYLE[comp.position];
                return (
                  <tr key={comp.name} className="border-b last:border-0 transition-colors hover:bg-muted/30">
                    <td className="py-3 pr-3 font-medium">{comp.name}</td>
                    <td className="py-3 px-3">
                      <Badge variant="secondary" className="text-xs">
                        {comp.region}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-muted-foreground">{comp.area}</td>
                    <td className="py-3 px-3">
                      <Badge className={`text-xs ${pos.color}`}>{pos.label}</Badge>
                    </td>
                    <td className="py-3 pl-3 text-xs text-muted-foreground">{comp.description}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// 삼성전자 경쟁 포지션 프리셋
export function getSamsungCompetitiveData() {
  return {
    competitors: [
      { name: "SK하이닉스", region: "국내" as const, area: "메모리 반도체 (HBM)", position: "follower" as const, description: "HBM 시장에서 SK하이닉스가 선점. 삼성전자가 추격 중" },
      { name: "TSMC", region: "해외" as const, area: "파운드리 (위탁 생산)", position: "follower" as const, description: "TSMC가 글로벌 1위 (60%+). 기술·수율 격차 존재" },
      { name: "Micron", region: "해외" as const, area: "메모리 반도체", position: "leader" as const, description: "DRAM/NAND 모두 삼성이 시장 점유율 1위" },
      { name: "Apple", region: "해외" as const, area: "스마트폰", position: "challenger" as const, description: "전체 출하량 1위 삼성 vs 수익성 1위 애플" },
      { name: "Intel", region: "해외" as const, area: "파운드리/비메모리", position: "challenger" as const, description: "파운드리 시장 진입 경쟁. 기술 전환기 기회" },
      { name: "Samsung Display", region: "국내" as const, area: "OLED 디스플레이", position: "leader" as const, description: "중소형 OLED 세계 1위 (60%+ 점유율)" },
    ],
    strengths: [
      "메모리 반도체 세계 1위 — DRAM 40%, NAND 33% 시장 점유율",
      "수직계열화 — 반도체~디스플레이~완제품까지 자체 생산 가능",
      "연간 R&D 25조원 투자 — 글로벌 특허 출원 1위권",
      "연간 CAPEX 40~50조원 규모의 대규모 설비 투자 능력",
      "B2B + B2C 사업 다각화로 사이클 변동 완충",
    ],
    weaknesses: [
      "HBM 기술에서 SK하이닉스 대비 약 1년 후발",
      "파운드리 수율이 TSMC 대비 열위 — 주요 고객 확보 어려움",
      "총주주환원율 약 35% — 글로벌 빅테크 대비 낮은 수준",
      "반도체 사이클 의존도 높음 — 2023년 영업이익 85% 급감 경험",
      "갤럭시 스마트폰 수익성이 애플 아이폰 대비 낮음",
    ],
  };
}
