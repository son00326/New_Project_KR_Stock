// 투달 서비스 상수

export const SITE_NAME = "투달";
export const SITE_NAME_EN = "TUDAL";
export const SITE_DESCRIPTION = "투자의 달인 - AI 기반 주식 분석 플랫폼";
export const SITE_URL = "https://tudal.co.kr";

// 구독 플랜
export const PLANS = {
  free: {
    name: "Free",
    nameKo: "무료",
    price: 0,
    yearlyPrice: 0,
    features: [
      "월 3회 리포트 열람",
      "초보 레벨 분석만",
      "일 3회 종목 검색",
      "포트폴리오 종목 5개",
    ],
    limits: {
      reportViews: 3,
      searchPerDay: 3,
      portfolioStocks: 5,
      analysisLevel: ["beginner"] as const,
      peerComparison: false,
      newsAlerts: false,
      aiAnalyst: false,
      targetPrice: false,
    },
  },
  standard: {
    name: "Standard",
    nameKo: "스탠다드",
    price: 14900,
    yearlyPrice: 119000,
    features: [
      "무제한 리포트 열람",
      "초보 + 중급 분석",
      "무제한 종목 검색",
      "포트폴리오 종목 30개",
      "국내 Peer 비교",
      "일 3회 뉴스 알림",
      "AI 월간 리포트",
      "평단가 시뮬레이터",
    ],
    limits: {
      reportViews: Infinity,
      searchPerDay: Infinity,
      portfolioStocks: 30,
      analysisLevel: ["beginner", "intermediate"] as const,
      peerComparison: "domestic" as const,
      newsAlerts: 3,
      aiAnalyst: "monthly" as const,
      targetPrice: false,
    },
  },
  pro: {
    name: "Pro",
    nameKo: "프로",
    price: 34900,
    yearlyPrice: 299000,
    features: [
      "무제한 리포트 열람",
      "초보 + 중급 + 고급(전문가) 분석",
      "무제한 종목 검색",
      "무제한 포트폴리오",
      "국내 + 해외 Peer 비교",
      "실시간 무제한 뉴스 알림",
      "AI 월간 + 분기 In-depth 리포트",
      "목표주가(TP) 제공",
      "평단가 시뮬레이터",
    ],
    limits: {
      reportViews: Infinity,
      searchPerDay: Infinity,
      portfolioStocks: Infinity,
      analysisLevel: ["beginner", "intermediate", "advanced"] as const,
      peerComparison: "all" as const,
      newsAlerts: Infinity,
      aiAnalyst: "quarterly" as const,
      targetPrice: true,
    },
  },
} as const;

export type PlanKey = keyof typeof PLANS;

// 포맷 유틸
export function formatKRW(value: number): string {
  if (value >= 1_0000_0000_0000) {
    return `${(value / 1_0000_0000_0000).toFixed(1)}조`;
  }
  if (value >= 1_0000_0000) {
    return `${(value / 1_0000_0000).toFixed(0)}억`;
  }
  if (value >= 1_0000) {
    return `${(value / 1_0000).toFixed(0)}만`;
  }
  return value.toLocaleString("ko-KR");
}

export function formatPrice(value: number): string {
  return value.toLocaleString("ko-KR") + "원";
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}
