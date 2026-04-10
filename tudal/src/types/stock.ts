// 종목 기본 정보
export interface Stock {
  ticker: string;           // 종목코드 (예: "005930")
  name: string;             // 종목명 (예: "삼성전자")
  market: "KOSPI" | "KOSDAQ";
  sector: string;           // 업종
  industry: string;         // 산업
  description: string;      // 회사 설명
  listingDate: string;      // 상장일
  marketCap: number;        // 시가총액
  currentPrice: number;     // 현재가
  changePercent: number;    // 등락률
  volume: number;           // 거래량
}

// 재무제표 데이터
export interface FinancialData {
  ticker: string;
  year: number;
  quarter?: number;
  revenue: number;          // 매출액
  operatingIncome: number;  // 영업이익
  netIncome: number;        // 순이익
  totalAssets: number;      // 총자산
  totalEquity: number;      // 자본총계
  totalDebt: number;        // 부채총계
  eps: number;              // 주당순이익
  bps: number;              // 주당순자산
  dps: number;              // 주당배당금
}

// 매출 구성 (사업 단위별)
export interface RevenueSegment {
  ticker: string;
  year: number;
  segmentName: string;      // 사업부문명
  revenue: number;          // 매출액
  proportion: number;       // 비중 (%)
}

// 투자 지표 (멀티플)
export interface Multiples {
  ticker: string;
  date: string;
  per: number | null;       // PER (주가수익비율)
  pbr: number | null;       // PBR (주가순자산비율)
  psr: number | null;       // PSR (주가매출비율)
  evEbitda: number | null;  // EV/EBITDA
  roe: number | null;       // ROE (자기자본이익률)
  roa: number | null;       // ROA (총자산이익률)
  dividendYield: number | null; // 배당수익률
}

// Peer Group
export interface PeerCompany {
  ticker: string;
  name: string;
  market: string;
  region: "domestic" | "overseas";
  multiples: Multiples;
}

export interface PeerComparison {
  targetStock: Stock;
  domesticPeers: PeerCompany[];
  overseasPeers: PeerCompany[];
  valuationVerdict: "undervalued" | "fairvalue" | "overvalued";
  verdictReason: string;
}

// Fundamental 분석 리포트
export interface FundamentalReport {
  ticker: string;
  level: "beginner" | "intermediate" | "advanced";
  companyOverview: string;       // 회사 개요
  businessHistory: string;       // 사업 히스토리
  mainProducts: string;          // 주요 제품/서비스
  competitiveAdvantage: string;  // 경쟁 우위
  futureOutlook: string;         // 미래 전망
  risks: string;                 // 리스크 요인
  generatedAt: string;
}

// 구독 등급
export type SubscriptionTier = "free" | "standard" | "pro";

// 유저 프로필
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  tier: SubscriptionTier;
  createdAt: string;
  reportViewsRemaining: number;  // Free 유저용 잔여 리포트 열람 횟수
}
