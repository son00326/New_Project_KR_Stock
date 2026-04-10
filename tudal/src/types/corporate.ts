// 지배구조 / 계열사
export interface Subsidiary {
  name: string;
  ticker?: string;           // 상장 종목코드 (없으면 비상장)
  ownership: number;          // 지분율 (%)
  relationship: "자회사" | "손자회사" | "관계회사" | "합작법인";
  businessArea: string;
  marketCap?: number;         // 시가총액 (상장사만)
  isListed: boolean;
}

// 주주 구성
export interface ShareholderInfo {
  name: string;
  category: "최대주주" | "특수관계인" | "국민연금" | "외국인" | "자사주" | "기타";
  shares: number;             // 보유 주식 수
  ownership: number;          // 지분율 (%)
}

// 수주 데이터
export interface OrderBacklog {
  year: number;
  quarter?: number;
  orderReceived: number;      // 수주액
  orderBacklog: number;       // 수주잔고
  revenue: number;            // 매출액 (비교용)
  bookToBill?: number;        // B/B ratio (수주/매출)
}

// 배당 이력
export interface DividendHistory {
  year: number;
  dps: number;                // 주당배당금
  dividendYield: number;      // 배당수익률 (%)
  payoutRatio: number;        // 배당성향 (%)
  totalDividend: number;      // 총배당금
}

// 임원 정보
export interface Executive {
  name: string;
  position: string;
  role: string;
  tenure: string;             // 재임 기간
}

// 신용등급
export interface CreditRating {
  agency: string;             // 평가기관
  rating: string;             // 등급
  outlook: "안정적" | "긍정적" | "부정적" | "관찰";
  date: string;
}
