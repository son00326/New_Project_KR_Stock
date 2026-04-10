// 매크로 지표 카테고리
export type MacroCategory =
  | "sentiment"    // 심리 지표
  | "economic"     // 경제 지표
  | "rates"        // 금리
  | "commodities"  // 원자재
  | "fx"           // 환율
  | "calendar";    // 경제 캘린더

// 매크로 지표
export interface MacroIndicator {
  id: string;
  name: string;
  nameKo: string;
  category: MacroCategory;
  value: number;
  previousValue: number;
  change: number;
  changePercent: number;
  unit: string;
  updatedAt: string;
  signal: "bullish" | "bearish" | "neutral";
  description: string;
}

// 경제 이벤트 캘린더
export interface EconomicEvent {
  id: string;
  date: string;
  time: string;
  name: string;
  nameKo: string;
  country: "US" | "KR" | "EU" | "JP" | "CN";
  importance: "high" | "medium" | "low";
  previous?: string;
  forecast?: string;
  actual?: string;
  category: "rates" | "employment" | "inflation" | "gdp" | "options" | "other";
}

// 종합 투자 판단
export interface MarketVerdict {
  overallSignal: "strong_bullish" | "bullish" | "neutral" | "bearish" | "strong_bearish";
  score: number; // 0~100
  summary: string;
  details: {
    category: string;
    signal: "bullish" | "bearish" | "neutral";
    reason: string;
  }[];
  updatedAt: string;
}
