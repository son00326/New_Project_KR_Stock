// 삼성전자 분기별 재무 데이터
export interface QuarterlyFinancial {
  year: number;
  quarter: number;
  revenue: number;
  operatingIncome: number;
  netIncome: number;
  operatingMargin: number;
  // YoY 비교용 (전년 동기)
  revYoY?: number;
  opIncYoY?: number;
  netIncYoY?: number;
}

export const SAMSUNG_QUARTERLY: QuarterlyFinancial[] = [
  // 2023
  { year: 2023, quarter: 1, revenue: 63_7455_0000_0000, operatingIncome: 6402_0000_0000, netIncome: 1_5700_0000_0000, operatingMargin: 1.0, revYoY: -18.1, opIncYoY: -95.5, netIncYoY: -86.1 },
  { year: 2023, quarter: 2, revenue: 60_0100_0000_0000, operatingIncome: 6685_0000_0000, netIncome: 1_7200_0000_0000, operatingMargin: 1.1, revYoY: -22.3, opIncYoY: -95.2, netIncYoY: -85.8 },
  { year: 2023, quarter: 3, revenue: 67_4000_0000_0000, operatingIncome: 2_4300_0000_0000, netIncome: 5_8400_0000_0000, operatingMargin: 3.6, revYoY: -12.2, opIncYoY: -77.6, netIncYoY: -37.9 },
  { year: 2023, quarter: 4, revenue: 67_7800_0000_0000, operatingIncome: 2_8283_0000_0000, netIncome: 6_3571_0000_0000, operatingMargin: 4.2, revYoY: -3.4, opIncYoY: -34.4, netIncYoY: -72.6 },
  // 2024
  { year: 2024, quarter: 1, revenue: 71_9200_0000_0000, operatingIncome: 6_6100_0000_0000, netIncome: 6_7500_0000_0000, operatingMargin: 9.2, revYoY: 12.8, opIncYoY: 932.4, netIncYoY: 329.9 },
  { year: 2024, quarter: 2, revenue: 74_0700_0000_0000, operatingIncome: 10_4400_0000_0000, netIncome: 9_8400_0000_0000, operatingMargin: 14.1, revYoY: 23.4, opIncYoY: 1462.0, netIncYoY: 472.1 },
  { year: 2024, quarter: 3, revenue: 79_1000_0000_0000, operatingIncome: 9_1800_0000_0000, netIncome: 7_8300_0000_0000, operatingMargin: 11.6, revYoY: 17.4, opIncYoY: 277.8, netIncYoY: 34.1 },
  { year: 2024, quarter: 4, revenue: 75_8200_0000_0000, operatingIncome: 6_5000_0000_0000, netIncome: 5_7000_0000_0000, operatingMargin: 8.6, revYoY: 11.9, opIncYoY: 129.8, netIncYoY: -10.3 },
];

// 애널리스트 TP 컨센서스
export interface AnalystTP {
  date: string;
  institution: string;
  analyst: string;
  targetPrice: number;
  rating: "매수" | "보유" | "매도" | "비중확대" | "중립" | "Buy" | "Hold" | "Outperform";
  previousTP?: number;
  region: "domestic" | "overseas";
}

export const SAMSUNG_ANALYST_TPS: AnalystTP[] = [
  // 국내
  { date: "2026-04-08", institution: "삼성증권", analyst: "이종욱", targetPrice: 78000, rating: "매수", previousTP: 75000, region: "domestic" },
  { date: "2026-04-07", institution: "미래에셋증권", analyst: "김영건", targetPrice: 82000, rating: "매수", previousTP: 80000, region: "domestic" },
  { date: "2026-04-04", institution: "NH투자증권", analyst: "류영호", targetPrice: 75000, rating: "매수", previousTP: 72000, region: "domestic" },
  { date: "2026-04-03", institution: "KB증권", analyst: "김동원", targetPrice: 80000, rating: "매수", previousTP: 78000, region: "domestic" },
  { date: "2026-04-01", institution: "한국투자증권", analyst: "김광진", targetPrice: 76000, rating: "매수", previousTP: 74000, region: "domestic" },
  { date: "2026-03-28", institution: "대신증권", analyst: "이수빈", targetPrice: 72000, rating: "매수", previousTP: 70000, region: "domestic" },
  { date: "2026-03-25", institution: "신한투자증권", analyst: "오강호", targetPrice: 74000, rating: "매수", previousTP: 72000, region: "domestic" },
  { date: "2026-03-20", institution: "하나증권", analyst: "김록호", targetPrice: 85000, rating: "매수", previousTP: 80000, region: "domestic" },
  // 해외
  { date: "2026-04-09", institution: "Morgan Stanley", analyst: "Shawn Kim", targetPrice: 80000, rating: "Outperform", previousTP: 75000, region: "overseas" },
  { date: "2026-04-05", institution: "Goldman Sachs", analyst: "Brian Kwon", targetPrice: 85000, rating: "Buy", previousTP: 82000, region: "overseas" },
  { date: "2026-04-02", institution: "JP Morgan", analyst: "JJ Park", targetPrice: 78000, rating: "Outperform", previousTP: 76000, region: "overseas" },
  { date: "2026-03-30", institution: "Citi", analyst: "Peter Lee", targetPrice: 72000, rating: "Buy", previousTP: 70000, region: "overseas" },
  { date: "2026-03-27", institution: "UBS", analyst: "Nicolas Gaudois", targetPrice: 76000, rating: "Buy", previousTP: 74000, region: "overseas" },
  { date: "2026-03-22", institution: "BofA Securities", analyst: "Daniel Kim", targetPrice: 88000, rating: "Buy", previousTP: 85000, region: "overseas" },
];

// Trailing vs Forward 멀티플
export interface MultiplesTimeSeries {
  year: number;
  isForward?: boolean;
  per: number | null;
  pbr: number | null;
  psr: number | null;
  evEbitda: number | null;
  roe: number | null;
}

export const SAMSUNG_MULTIPLES_HISTORY: MultiplesTimeSeries[] = [
  { year: 2020, per: 15.5, pbr: 1.42, psr: 1.52, evEbitda: 6.1, roe: 9.4 },
  { year: 2021, per: 12.2, pbr: 1.58, psr: 1.38, evEbitda: 5.2, roe: 13.5 },
  { year: 2022, per: 7.3, pbr: 1.19, psr: 1.05, evEbitda: 4.3, roe: 17.0 },
  { year: 2023, per: 36.5, pbr: 1.21, psr: 1.18, evEbitda: 15.8, roe: 4.6 },
  { year: 2024, per: 13.6, pbr: 1.15, psr: 1.19, evEbitda: 5.8, roe: 8.5 },
  // Forward (컨센서스 추정)
  { year: 2025, isForward: true, per: 9.8, pbr: 1.08, psr: 1.05, evEbitda: 4.2, roe: 12.0 },
  { year: 2026, isForward: true, per: 7.5, pbr: 0.95, psr: 0.92, evEbitda: 3.5, roe: 14.5 },
];

// 해외 Peer 데이터
export interface GlobalPeer {
  ticker: string;
  name: string;
  country: string;
  exchange: string;
  marketCap: number;      // USD 기준
  per: number | null;
  forwardPer: number | null;
  pbr: number | null;
  psr: number | null;
  evEbitda: number | null;
  roe: number | null;
  dividendYield: number | null;
}

export const SAMSUNG_GLOBAL_PEERS: GlobalPeer[] = [
  { ticker: "MU", name: "Micron Technology", country: "US", exchange: "NASDAQ", marketCap: 128_000_000_000, per: 7.8, forwardPer: 6.2, pbr: 1.95, psr: 3.1, evEbitda: 5.5, roe: 25.0, dividendYield: 0.45 },
  { ticker: "TSM", name: "TSMC", country: "TW", exchange: "NYSE", marketCap: 820_000_000_000, per: 22.5, forwardPer: 18.0, pbr: 6.8, psr: 10.5, evEbitda: 14.2, roe: 30.0, dividendYield: 1.2 },
  { ticker: "INTC", name: "Intel", country: "US", exchange: "NASDAQ", marketCap: 108_000_000_000, per: null, forwardPer: 25.0, pbr: 0.85, psr: 2.0, evEbitda: 12.5, roe: -1.5, dividendYield: 1.8 },
  { ticker: "NVDA", name: "NVIDIA", country: "US", exchange: "NASDAQ", marketCap: 2_800_000_000_000, per: 35.0, forwardPer: 25.0, pbr: 45.0, psr: 28.0, evEbitda: 30.0, roe: 120.0, dividendYield: 0.03 },
  { ticker: "QCOM", name: "Qualcomm", country: "US", exchange: "NASDAQ", marketCap: 185_000_000_000, per: 16.5, forwardPer: 13.0, pbr: 7.2, psr: 4.5, evEbitda: 11.0, roe: 43.0, dividendYield: 1.9 },
];

// 시장 사이클 정보
export interface MarketCycleInfo {
  segment: string;
  cycle: "upcycle" | "downcycle" | "recovery" | "peak";
  description: string;
  startDate: string;
  indicators: string[];
}

export const SAMSUNG_MARKET_CYCLES: MarketCycleInfo[] = [
  { segment: "DRAM", cycle: "recovery", description: "2024년 하반기부터 가격 반등. AI 서버 수요가 견인하나 PC/모바일 수요 회복은 점진적.", startDate: "2024 Q3~", indicators: ["DRAM 고정가 +15% QoQ", "서버 DRAM 비중 확대", "재고 정상화 진행 중"] },
  { segment: "NAND Flash", cycle: "recovery", description: "공급 축소 효과로 가격 반등 중. SSD 수요 증가가 긍정적이나 속도는 DRAM보다 느림.", startDate: "2024 Q4~", indicators: ["NAND 고정가 +8% QoQ", "128단 이상 고사양 비중 증가", "업체들 감산 지속"] },
  { segment: "HBM", cycle: "upcycle", description: "AI 서버 폭발적 수요로 공급 부족 상태. 2025~2027년까지 연 60%+ 성장 전망.", startDate: "2023 Q2~", indicators: ["HBM3E 수요 > 공급", "NVIDIA H100/B100 수요 급증", "가격 프리미엄 유지"] },
  { segment: "스마트폰", cycle: "recovery", description: "2023년 바닥 찍고 완만한 회복세. AI 폰 사이클이 교체 수요 자극 가능.", startDate: "2024 Q1~", indicators: ["글로벌 출하량 +3% YoY", "ASP 상승 추세 (AI 프리미엄)", "중국 시장 부진 지속"] },
  { segment: "파운드리", cycle: "downcycle", description: "TSMC 대비 기술/수율 격차로 가동률 저조. 2nm 전환이 반전 계기가 될 수 있음.", startDate: "2023 Q1~", indicators: ["가동률 50~60% 추정", "주요 고객 이탈 우려", "2nm GAA 양산 준비 중"] },
  { segment: "디스플레이(OLED)", cycle: "upcycle", description: "아이폰 OLED 공급 확대 + IT용 OLED 침투율 상승으로 호황.", startDate: "2024 Q2~", indicators: ["아이폰16 Pro OLED 공급", "태블릿/노트북 OLED 전환 가속", "QD-OLED TV 수요 증가"] },
];
