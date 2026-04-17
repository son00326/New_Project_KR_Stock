"use client";

import { useState } from "react";
import { HelpCircle, TrendingUp, TrendingDown, Minus } from "lucide-react";

// 제품/용어 상세 설명 데이터베이스
const PRODUCT_GLOSSARY: Record<string, {
  term: string;
  simple: string;
  detailed: string;
  example?: string;
  cycle?: { status: "upcycle" | "downcycle" | "recovery" | "peak"; label: string; detail: string };
}> = {
  "DRAM (서버/모바일/PC용)": {
    term: "DRAM",
    simple: "컴퓨터나 스마트폰이 '지금 하고 있는 일'을 기억하는 부품",
    detailed: "Dynamic Random Access Memory의 약자. 데이터를 임시로 저장하는 휘발성 메모리로, 전원이 꺼지면 데이터가 사라집니다. 컴퓨터의 RAM, 스마트폰 램이 바로 DRAM입니다. 용량이 클수록 여러 앱을 동시에 빠르게 실행할 수 있습니다.",
    example: "여러분의 스마트폰이 8GB RAM이라면, 그 8GB가 바로 삼성전자가 만드는 DRAM입니다.",
    cycle: { status: "recovery", label: "회복기", detail: "2023년 하락 후 AI 서버 수요로 가격 반등 중. 서버 DRAM은 강세, PC/모바일은 완만한 회복." },
  },
  "NAND Flash (SSD/UFS)": {
    term: "NAND Flash",
    simple: "전원이 꺼져도 데이터가 남아있는 저장 장치의 핵심 부품",
    detailed: "비휘발성 메모리로, 전원 없이도 데이터를 보관합니다. SSD(컴퓨터 저장장치), USB 메모리, 스마트폰 내장 저장공간에 사용됩니다. DRAM이 '작업 공간'이라면, NAND는 '서랍장(저장소)'입니다.",
    example: "스마트폰 '256GB 저장공간'이라고 할 때, 그 256GB가 NAND Flash입니다.",
    cycle: { status: "recovery", label: "회복 초기", detail: "업체들의 감산 효과로 가격 반등 중이나 DRAM보다 회복 속도 느림." },
  },
  "Exynos AP (모바일 프로세서)": {
    term: "Exynos AP",
    simple: "스마트폰의 '두뇌' 역할을 하는 칩",
    detailed: "Application Processor의 약자. 스마트폰에서 앱 실행, 화면 표시, 인터넷 연결 등 모든 연산을 처리하는 핵심 칩입니다. 퀄컴 스냅드래곤, 애플 A시리즈와 경쟁합니다.",
    example: "갤럭시 S 시리즈 일부 모델에 삼성 자체 개발 엑시노스 칩이 탑재됩니다.",
    cycle: { status: "downcycle", label: "하락기", detail: "퀄컴 스냅드래곤 대비 경쟁력 열위. 최근 갤럭시 플래그십에서 퀄컴 채택 비중 증가." },
  },
  "이미지센서 (카메라)": {
    term: "이미지센서",
    simple: "카메라가 빛을 받아 사진/영상으로 변환해주는 부품",
    detailed: "렌즈를 통해 들어온 빛을 전기 신호로 변환하는 반도체입니다. 스마트폰 카메라, 자동차 카메라(ADAS), CCTV 등에 사용됩니다. 소니가 세계 1위이며, 삼성전자가 2위입니다.",
    cycle: { status: "recovery", label: "회복기", detail: "자동차 카메라 수요 증가. 스마트폰 멀티카메라 트렌드 지속." },
  },
  "파운드리 (3nm/2nm 위탁생산)": {
    term: "파운드리",
    simple: "다른 회사가 설계한 반도체를 대신 만들어주는 사업",
    detailed: "Foundry. 반도체 설계(설계도) 회사가 직접 공장을 갖기 어려우므로, 삼성전자나 TSMC 같은 파운드리 기업이 대신 생산해줍니다. '3nm/2nm'는 회로의 미세함을 뜻하며, 숫자가 작을수록 더 고성능·저전력 칩을 만들 수 있습니다.",
    example: "NVIDIA가 GPU를 설계하면, TSMC가 공장에서 실제로 만들어줍니다. 삼성도 이 시장에서 경쟁 중입니다.",
    cycle: { status: "downcycle", label: "하락기", detail: "TSMC 대비 수율/기술 격차로 가동률 50~60%. 2nm 전환이 반전 기회." },
  },
  "HBM (AI 서버용 고대역폭 메모리)": {
    term: "HBM (High Bandwidth Memory)",
    simple: "AI 서버에 필수적인 '초고속 메모리'. 현재 가장 뜨거운 반도체.",
    detailed: "여러 개의 DRAM을 수직으로 쌓아 초고속으로 데이터를 주고받을 수 있게 만든 메모리입니다. ChatGPT 같은 AI를 구동하는 GPU(NVIDIA H100 등)에 반드시 필요합니다. 일반 DRAM보다 3~5배 비싸며, 현재 수요가 공급을 크게 초과하는 상태입니다.",
    example: "NVIDIA GPU 1개에 HBM이 약 6~8개 탑재됩니다. AI 데이터센터 하나에 수천 개의 GPU가 들어가므로, HBM 수요는 폭발적입니다.",
    cycle: { status: "upcycle", label: "호황기", detail: "AI 수요 폭발로 2025~2027년 연 60%+ 성장 전망. 수요 > 공급 지속." },
  },
  "Galaxy S 시리즈 (프리미엄)": {
    term: "Galaxy S 시리즈",
    simple: "삼성의 최고급 스마트폰 라인업. 아이폰과 직접 경쟁.",
    detailed: "매년 초에 출시되는 삼성전자의 프리미엄 플래그십 스마트폰입니다. 최신 AP, 최고급 카메라, Galaxy AI 기능을 탑재합니다. S25 Ultra의 출고가는 약 170만원대입니다.",
    cycle: { status: "recovery", label: "회복기", detail: "Galaxy AI 탑재로 교체 수요 자극. ASP 상승 추세." },
  },
  "Galaxy Z Fold/Flip (폴더블)": {
    term: "Galaxy Z 시리즈",
    simple: "화면이 접히는 폴더블 스마트폰. 삼성이 세계 1위(75%).",
    detailed: "화면을 반으로 접을 수 있는 혁신적 폼팩터의 스마트폰입니다. Fold는 태블릿처럼 펼쳐지고, Flip은 컴팩트하게 접힙니다. 삼성전자가 시장을 개척했으며 글로벌 점유율 약 75%로 압도적 1위입니다.",
    cycle: { status: "upcycle", label: "성장기", detail: "폴더블 시장 연 30%+ 성장. 경쟁사 진입 증가하나 삼성 기술 우위 유지." },
  },
};

interface ProductTooltipProps {
  product: string;
}

export function ProductTooltip({ product }: ProductTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const info = PRODUCT_GLOSSARY[product];

  if (!info) {
    return (
      <span className="text-xs bg-muted px-2.5 py-1 rounded-full">{product}</span>
    );
  }

  const cycleColors = {
    upcycle: { bg: "bg-red-50 border-red-200", text: "text-red-700", icon: <TrendingUp className="h-3 w-3" /> },
    downcycle: { bg: "bg-blue-50 border-blue-200", text: "text-blue-700", icon: <TrendingDown className="h-3 w-3" /> },
    recovery: { bg: "bg-green-50 border-green-200", text: "text-green-700", icon: <TrendingUp className="h-3 w-3" /> },
    peak: { bg: "bg-yellow-50 border-yellow-200", text: "text-yellow-700", icon: <Minus className="h-3 w-3" /> },
  };

  return (
    <span className="relative inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`text-xs px-2.5 py-1 rounded-full inline-flex items-center gap-1 transition-colors ${
          isOpen ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
        }`}
      >
        {product}
        <HelpCircle className="h-3 w-3 opacity-60" />
      </button>

      {isOpen && (
        <>
          {/* 오버레이 클릭 닫기 */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          {/* 툴팁 팝오버 */}
          <div className="absolute left-0 top-full mt-2 z-50 w-80 sm:w-96 rounded-xl border bg-background shadow-lg p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div>
              <h5 className="font-bold text-sm">{info.term}</h5>
              <p className="text-xs text-primary font-medium mt-0.5">{info.simple}</p>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">{info.detailed}</p>

            {info.example && (
              <div className="rounded-lg bg-muted/50 p-2.5">
                <p className="text-xs leading-relaxed">
                  <strong>쉬운 예시:</strong> {info.example}
                </p>
              </div>
            )}

            {info.cycle && (() => {
              const c = cycleColors[info.cycle!.status];
              return (
                <div className={`rounded-lg border p-2.5 ${c.bg}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    {c.icon}
                    <span className={`text-xs font-bold ${c.text}`}>
                      현재 시장: {info.cycle!.label}
                    </span>
                  </div>
                  <p className="text-xs opacity-80 leading-relaxed">{info.cycle!.detail}</p>
                </div>
              );
            })()}
          </div>
        </>
      )}
    </span>
  );
}
