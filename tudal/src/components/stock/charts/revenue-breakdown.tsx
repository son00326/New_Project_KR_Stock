"use client";

import { useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Sector,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { formatKRW } from "@/lib/constants";
import { ProductTooltip } from "@/components/stock/charts/product-tooltip";
import type { RevenueSegment } from "@/types/stock";

// 사업부별 상세 정보
interface SegmentDetail {
  segmentName: string;
  fullName: string;
  description: string;
  keyProducts: string[];
  marketPosition: string;
  outlook: "positive" | "neutral" | "negative";
  outlookComment: string;
}

const SAMSUNG_SEGMENT_DETAILS: SegmentDetail[] = [
  {
    segmentName: "DS (반도체)",
    fullName: "Device Solutions — 반도체 부문",
    description: "메모리 반도체(DRAM, NAND Flash)와 비메모리 반도체(AP, 이미지센서), 그리고 다른 회사의 반도체를 대신 만들어주는 파운드리 사업을 영위합니다. 삼성전자의 핵심 중의 핵심 사업부입니다.",
    keyProducts: ["DRAM (서버/모바일/PC용)", "NAND Flash (SSD/UFS)", "Exynos AP (모바일 프로세서)", "이미지센서 (카메라)", "파운드리 (3nm/2nm 위탁생산)", "HBM (AI 서버용 고대역폭 메모리)"],
    marketPosition: "DRAM 세계 1위 (40%), NAND 세계 1위 (33%), 파운드리 세계 2위 (12%)",
    outlook: "positive",
    outlookComment: "AI 서버용 HBM 수요 폭발로 메모리 슈퍼사이클 기대. 다만 HBM 기술에서 SK하이닉스 추격 중.",
  },
  {
    segmentName: "MX (모바일)",
    fullName: "Mobile eXperience — 모바일(스마트폰) 부문",
    description: "갤럭시 스마트폰, 태블릿, 웨어러블(갤럭시 워치, 버즈) 등 모바일 기기를 개발·판매합니다. 삼성전자 매출의 가장 큰 비중을 차지하지만, 이익 기여도는 반도체보다 낮습니다.",
    keyProducts: ["Galaxy S 시리즈 (프리미엄)", "Galaxy Z Fold/Flip (폴더블)", "Galaxy A 시리즈 (중저가)", "Galaxy Tab (태블릿)", "Galaxy Watch/Buds (웨어러블)"],
    marketPosition: "스마트폰 출하량 세계 1위, 폴더블 스마트폰 세계 1위 (75%)",
    outlook: "neutral",
    outlookComment: "갤럭시 AI로 ASP 상승 기대, 그러나 스마트폰 시장 전체 성장 둔화. 중국 업체 추격 심화.",
  },
  {
    segmentName: "DX (가전)",
    fullName: "Device eXperience — 생활가전·TV 부문",
    description: "TV, 냉장고, 세탁기, 에어컨 등 생활가전과 모니터, 노트북 등 IT 기기를 제조·판매합니다. 안정적인 캐시카우 역할을 합니다.",
    keyProducts: ["Neo QLED/OLED TV", "비스포크 냉장고/세탁기/식기세척기", "시스템 에어컨", "갤럭시 북 (노트북)", "오디세이 (게이밍 모니터)"],
    marketPosition: "TV 19년 연속 세계 1위, 생활가전 글로벌 Top 3",
    outlook: "neutral",
    outlookComment: "프리미엄 가전 전략 지속. 성장 여력은 제한적이나 안정적 수익 기여.",
  },
  {
    segmentName: "SDC (디스플레이)",
    fullName: "Samsung Display — 디스플레이 부문",
    description: "스마트폰용 중소형 OLED와 TV용 대형 QD-OLED 패널을 제조합니다. 삼성전자의 자회사(삼성디스플레이)가 운영하며, Apple 아이폰에도 OLED를 공급합니다.",
    keyProducts: ["중소형 AMOLED (스마트폰용)", "QD-OLED (TV/모니터용)", "폴더블 디스플레이 패널", "차량용 디스플레이"],
    marketPosition: "중소형 OLED 세계 1위 (60%+), 대형 OLED에서 LG디스플레이와 경쟁",
    outlook: "positive",
    outlookComment: "폴더블/차량용 디스플레이 시장 확대. Apple 아이폰 OLED 공급으로 안정적 매출.",
  },
  {
    segmentName: "Harman (하만)",
    fullName: "Harman International — 전장(자동차) 부문",
    description: "2017년 삼성전자가 약 9조원에 인수한 미국 전장 기업입니다. 차량용 인포테인먼트 시스템, 오디오(JBL, Harman Kardon, AKG 브랜드), 커넥티드카 솔루션을 제공합니다.",
    keyProducts: ["차량용 인포테인먼트 시스템", "JBL/Harman Kardon/AKG 오디오", "커넥티드카 플랫폼", "OTA(Over-the-Air) 업데이트"],
    marketPosition: "차량용 인포테인먼트 글로벌 Top 3",
    outlook: "positive",
    outlookComment: "자동차 전장화/소프트웨어 정의 차량(SDV) 트렌드 수혜. 삼성의 미래 모빌리티 전략 핵심.",
  },
];

const COLORS = ["#2563eb", "#16a34a", "#ea580c", "#9333ea", "#e11d48"];

const OUTLOOK_BADGE = {
  positive: { label: "긍정적", className: "bg-green-100 text-green-700 border-0" },
  neutral: { label: "보통", className: "bg-yellow-100 text-yellow-700 border-0" },
  negative: { label: "부정적", className: "bg-red-100 text-red-700 border-0" },
};

interface RevenueBreakdownProps {
  segments: RevenueSegment[];
  level: "beginner" | "intermediate";
}

export function RevenueBreakdown({ segments, level }: RevenueBreakdownProps) {
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);

  const data = segments.map((s) => ({
    name: s.segmentName,
    value: s.revenue,
    proportion: s.proportion,
  }));

  const activeDetail = selectedSegment
    ? SAMSUNG_SEGMENT_DETAILS.find((d) => d.segmentName === selectedSegment)
    : null;

  return (
    <div className="space-y-6">
      {/* 차트 + 범례 */}
      <div className="flex flex-col lg:flex-row items-start gap-8">
        <div className="w-full lg:w-2/5 h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={115}
                paddingAngle={2}
                dataKey="value"
                onClick={(_, index) => setSelectedSegment(segments[index].segmentName)}
                className="cursor-pointer"
              >
                {data.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                    opacity={selectedSegment && selectedSegment !== segments[index].segmentName ? 0.3 : 1}
                    stroke={selectedSegment === segments[index].segmentName ? "#000" : "none"}
                    strokeWidth={selectedSegment === segments[index].segmentName ? 2 : 0}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatKRW(Number(value))} />
            </PieChart>
          </ResponsiveContainer>
          <p className="text-xs text-center text-muted-foreground mt-1">
            차트를 클릭하면 상세 정보를 확인할 수 있습니다
          </p>
        </div>

        {/* 사업부 리스트 */}
        <div className="w-full lg:w-3/5 space-y-2">
          {segments.map((segment, index) => {
            const detail = SAMSUNG_SEGMENT_DETAILS.find((d) => d.segmentName === segment.segmentName);
            const isSelected = selectedSegment === segment.segmentName;

            return (
              <button
                key={segment.segmentName}
                onClick={() => setSelectedSegment(isSelected ? null : segment.segmentName)}
                className={`w-full text-left rounded-lg border p-3 transition-all ${
                  isSelected ? "border-primary bg-primary/5 shadow-sm" : "hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <div>
                      <span className="text-sm font-semibold">{segment.segmentName}</span>
                      {detail && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {detail.fullName}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-bold">{segment.proportion}%</span>
                    <p className="text-xs text-muted-foreground">{formatKRW(segment.revenue)}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 선택된 사업부 상세 */}
      {activeDetail && (
        <div className="rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-background p-6 space-y-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-lg font-bold">{activeDetail.fullName}</h4>
              <p className="text-sm text-muted-foreground mt-1">{activeDetail.marketPosition}</p>
            </div>
            <Badge className={`shrink-0 ${OUTLOOK_BADGE[activeDetail.outlook].className}`}>
              전망: {OUTLOOK_BADGE[activeDetail.outlook].label}
            </Badge>
          </div>

          <p className="text-sm leading-relaxed">{activeDetail.description}</p>

          {/* 주요 제품/서비스 */}
          <div>
            <h5 className="text-sm font-semibold mb-2">
              주요 제품/서비스
              <span className="text-xs font-normal text-muted-foreground ml-2">클릭하면 용어 설명 + 시장 사이클 확인</span>
            </h5>
            <div className="flex flex-wrap gap-2">
              {activeDetail.keyProducts.map((product) => (
                <ProductTooltip key={product} product={product} />
              ))}
            </div>
          </div>

          {/* 전망 코멘트 */}
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs font-medium mb-1">주픽 AI 코멘트</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {activeDetail.outlookComment}
            </p>
          </div>
        </div>
      )}

      {/* 초보자 요약 */}
      {level === "beginner" && !activeDetail && (
        <div className="rounded-lg bg-muted/50 p-4">
          <p className="text-sm font-medium mb-2">한마디 정리</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            삼성전자의 가장 큰 매출원은 <strong>스마트폰(MX) 사업으로 전체의 37%</strong>를 차지합니다.
            하지만 <strong>실제로 돈을 가장 많이 버는 곳은 반도체(DS) 부문</strong>입니다.
            각 사업부를 클릭하면 어떤 제품을 만들고, 시장에서 어떤 위치인지, 앞으로의 전망은 어떤지를 확인할 수 있습니다.
          </p>
        </div>
      )}
    </div>
  );
}
