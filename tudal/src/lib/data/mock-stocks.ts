import type { Stock, FinancialData, RevenueSegment, Multiples } from "@/types/stock";

// MVP용 mock 데이터 — 추후 DART/KRX API로 교체
export const MOCK_STOCKS: Stock[] = [
  {
    ticker: "005930",
    name: "삼성전자",
    market: "KOSPI",
    sector: "전기전자",
    industry: "반도체",
    description: "종합 반도체, 스마트폰, 가전 제조 기업",
    listingDate: "1975-06-11",
    marketCap: 358_0000_0000_0000,
    currentPrice: 59800,
    changePercent: 1.35,
    volume: 12_345_678,
  },
  {
    ticker: "000660",
    name: "SK하이닉스",
    market: "KOSPI",
    sector: "전기전자",
    industry: "반도체",
    description: "DRAM, NAND Flash 메모리 반도체 제조 기업",
    listingDate: "1996-12-26",
    marketCap: 142_0000_0000_0000,
    currentPrice: 195000,
    changePercent: -0.51,
    volume: 3_456_789,
  },
  {
    ticker: "035420",
    name: "NAVER",
    market: "KOSPI",
    sector: "서비스업",
    industry: "인터넷",
    description: "대한민국 1위 검색 포털 및 IT 플랫폼 기업",
    listingDate: "2002-10-29",
    marketCap: 32_0000_0000_0000,
    currentPrice: 195500,
    changePercent: 2.09,
    volume: 1_234_567,
  },
  {
    ticker: "051910",
    name: "LG화학",
    market: "KOSPI",
    sector: "화학",
    industry: "2차전지/화학",
    description: "석유화학, 첨단소재, 생명과학 사업 영위. 2차전지 사업은 LG에너지솔루션으로 분사",
    listingDate: "2001-04-25",
    marketCap: 19_0000_0000_0000,
    currentPrice: 269000,
    changePercent: -1.10,
    volume: 456_789,
  },
  {
    ticker: "006400",
    name: "삼성SDI",
    market: "KOSPI",
    sector: "전기전자",
    industry: "2차전지",
    description: "소형 배터리, 자동차 배터리, ESS 배터리 제조 기업",
    listingDate: "1979-03-09",
    marketCap: 24_0000_0000_0000,
    currentPrice: 349000,
    changePercent: 0.87,
    volume: 345_678,
  },
  {
    ticker: "035720",
    name: "카카오",
    market: "KOSPI",
    sector: "서비스업",
    industry: "인터넷",
    description: "카카오톡 기반 메신저, 핀테크, 콘텐츠, 모빌리티 플랫폼",
    listingDate: "2017-07-10",
    marketCap: 16_0000_0000_0000,
    currentPrice: 36050,
    changePercent: -0.28,
    volume: 2_345_678,
  },
  {
    ticker: "005380",
    name: "현대차",
    market: "KOSPI",
    sector: "운수장비",
    industry: "자동차",
    description: "대한민국 1위 완성차 기업. 전기차, 수소차 등 미래 모빌리티 사업 확대 중",
    listingDate: "1974-06-28",
    marketCap: 45_0000_0000_0000,
    currentPrice: 213000,
    changePercent: 1.67,
    volume: 1_567_890,
  },
  {
    ticker: "068270",
    name: "셀트리온",
    market: "KOSPI",
    sector: "의약품",
    industry: "바이오",
    description: "바이오시밀러 전문 기업. 램시마, 트룩시마 등 글로벌 바이오시밀러 선두",
    listingDate: "2018-02-09",
    marketCap: 28_0000_0000_0000,
    currentPrice: 198500,
    changePercent: 3.12,
    volume: 1_890_123,
  },
];

// 삼성전자 재무 데이터 예시
export const MOCK_FINANCIALS: Record<string, FinancialData[]> = {
  "005930": [
    { ticker: "005930", year: 2021, revenue: 279_6048_0000_0000, operatingIncome: 51_6339_0000_0000, netIncome: 39_9075_0000_0000, totalAssets: 426_6152_0000_0000, totalEquity: 296_2225_0000_0000, totalDebt: 130_3927_0000_0000, eps: 5777, bps: 44528, dps: 1444 },
    { ticker: "005930", year: 2022, revenue: 302_2314_0000_0000, operatingIncome: 43_3766_0000_0000, netIncome: 55_6541_0000_0000, totalAssets: 448_4559_0000_0000, totalEquity: 327_2729_0000_0000, totalDebt: 121_1830_0000_0000, eps: 8057, bps: 49468, dps: 1444 },
    { ticker: "005930", year: 2023, revenue: 258_9355_0000_0000, operatingIncome: 6_5670_0000_0000, netIncome: 15_4871_0000_0000, totalAssets: 455_9046_0000_0000, totalEquity: 336_0825_0000_0000, totalDebt: 119_8221_0000_0000, eps: 2131, bps: 50817, dps: 1444 },
    { ticker: "005930", year: 2024, revenue: 300_9100_0000_0000, operatingIncome: 32_7300_0000_0000, netIncome: 30_1200_0000_0000, totalAssets: 470_0000_0000_0000, totalEquity: 345_0000_0000_0000, totalDebt: 125_0000_0000_0000, eps: 4380, bps: 52100, dps: 1444 },
  ],
};

// 삼성전자 매출 구성 예시
export const MOCK_REVENUE_SEGMENTS: Record<string, RevenueSegment[]> = {
  "005930": [
    { ticker: "005930", year: 2024, segmentName: "DS (반도체)", revenue: 91_7200_0000_0000, proportion: 30.5 },
    { ticker: "005930", year: 2024, segmentName: "MX (모바일)", revenue: 111_3367_0000_0000, proportion: 37.0 },
    { ticker: "005930", year: 2024, segmentName: "DX (가전)", revenue: 54_1638_0000_0000, proportion: 18.0 },
    { ticker: "005930", year: 2024, segmentName: "SDC (디스플레이)", revenue: 33_1002_0000_0000, proportion: 11.0 },
    { ticker: "005930", year: 2024, segmentName: "Harman (하만)", revenue: 10_5893_0000_0000, proportion: 3.5 },
  ],
};

// 삼성전자 멀티플 + Peer 데이터
export const MOCK_MULTIPLES: Record<string, Multiples> = {
  "005930": { ticker: "005930", date: "2026-04-11", per: 13.6, pbr: 1.15, psr: 1.19, evEbitda: 5.8, roe: 8.5, roa: 6.4, dividendYield: 2.41 },
  "000660": { ticker: "000660", date: "2026-04-11", per: 8.2, pbr: 1.65, psr: 2.45, evEbitda: 4.5, roe: 20.1, roa: 12.3, dividendYield: 0.77 },
  "035420": { ticker: "035420", date: "2026-04-11", per: 22.5, pbr: 1.45, psr: 3.20, evEbitda: 12.3, roe: 6.4, roa: 4.5, dividendYield: 0.41 },
};

// 종목 검색
export function searchStocks(query: string): Stock[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return MOCK_STOCKS.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.ticker.includes(q) ||
      s.sector.includes(q) ||
      s.industry.includes(q)
  );
}

// 종목 상세 조회
export function getStockByTicker(ticker: string): Stock | undefined {
  return MOCK_STOCKS.find((s) => s.ticker === ticker);
}
