import type { FinancialData } from "@/types/stock";

// 삼성전자 10개년 재무 데이터
export const SAMSUNG_10Y_FINANCIALS: FinancialData[] = [
  { ticker: "005930", year: 2015, revenue: 200_6535_0000_0000, operatingIncome: 26_4134_0000_0000, netIncome: 19_0601_0000_0000, totalAssets: 242_1795_0000_0000, totalEquity: 179_5961_0000_0000, totalDebt: 62_5834_0000_0000, eps: 2742, bps: 28126, dps: 420 },
  { ticker: "005930", year: 2016, revenue: 201_8667_0000_0000, operatingIncome: 29_2407_0000_0000, netIncome: 22_7260_0000_0000, totalAssets: 262_1743_0000_0000, totalEquity: 192_6550_0000_0000, totalDebt: 69_5193_0000_0000, eps: 3064, bps: 30427, dps: 570 },
  { ticker: "005930", year: 2017, revenue: 239_5754_0000_0000, operatingIncome: 53_6450_0000_0000, netIncome: 42_1867_0000_0000, totalAssets: 301_7521_0000_0000, totalEquity: 214_3498_0000_0000, totalDebt: 87_4023_0000_0000, eps: 5997, bps: 33228, dps: 850 },
  { ticker: "005930", year: 2018, revenue: 243_7714_0000_0000, operatingIncome: 58_8867_0000_0000, netIncome: 44_3449_0000_0000, totalAssets: 339_3572_0000_0000, totalEquity: 247_7532_0000_0000, totalDebt: 91_6040_0000_0000, eps: 6461, bps: 37528, dps: 1416 },
  { ticker: "005930", year: 2019, revenue: 230_4009_0000_0000, operatingIncome: 27_7685_0000_0000, netIncome: 21_7389_0000_0000, totalAssets: 352_5645_0000_0000, totalEquity: 262_7949_0000_0000, totalDebt: 89_7696_0000_0000, eps: 3166, bps: 39406, dps: 1416 },
  { ticker: "005930", year: 2020, revenue: 236_8070_0000_0000, operatingIncome: 35_9939_0000_0000, netIncome: 26_4078_0000_0000, totalAssets: 378_2357_0000_0000, totalEquity: 280_1415_0000_0000, totalDebt: 98_0942_0000_0000, eps: 3841, bps: 42180, dps: 1444 },
  { ticker: "005930", year: 2021, revenue: 279_6048_0000_0000, operatingIncome: 51_6339_0000_0000, netIncome: 39_9075_0000_0000, totalAssets: 426_6152_0000_0000, totalEquity: 296_2225_0000_0000, totalDebt: 130_3927_0000_0000, eps: 5777, bps: 44528, dps: 1444 },
  { ticker: "005930", year: 2022, revenue: 302_2314_0000_0000, operatingIncome: 43_3766_0000_0000, netIncome: 55_6541_0000_0000, totalAssets: 448_4559_0000_0000, totalEquity: 327_2729_0000_0000, totalDebt: 121_1830_0000_0000, eps: 8057, bps: 49468, dps: 1444 },
  { ticker: "005930", year: 2023, revenue: 258_9355_0000_0000, operatingIncome: 6_5670_0000_0000, netIncome: 15_4871_0000_0000, totalAssets: 455_9046_0000_0000, totalEquity: 336_0825_0000_0000, totalDebt: 119_8221_0000_0000, eps: 2131, bps: 50817, dps: 1444 },
  { ticker: "005930", year: 2024, revenue: 300_9100_0000_0000, operatingIncome: 32_7300_0000_0000, netIncome: 30_1200_0000_0000, totalAssets: 470_0000_0000_0000, totalEquity: 345_0000_0000_0000, totalDebt: 125_0000_0000_0000, eps: 4380, bps: 52100, dps: 1444 },
];

// 손익계산서 상세
export interface IncomeStatement {
  year: number;
  revenue: number;
  costOfRevenue: number;
  grossProfit: number;
  grossMargin: number;
  sgna: number;
  rnd: number;
  operatingIncome: number;
  operatingMargin: number;
  otherIncome: number;
  interestExpense: number;
  preTaxIncome: number;
  incomeTax: number;
  netIncome: number;
  netMargin: number;
}

export const SAMSUNG_INCOME_STATEMENTS: IncomeStatement[] = [
  { year: 2021, revenue: 279_6048_0000_0000, costOfRevenue: 174_2058_0000_0000, grossProfit: 105_3990_0000_0000, grossMargin: 37.7, sgna: 28_5321_0000_0000, rnd: 22_2330_0000_0000, operatingIncome: 51_6339_0000_0000, operatingMargin: 18.5, otherIncome: 2_1000_0000_0000, interestExpense: 8750_0000_0000, preTaxIncome: 52_8589_0000_0000, incomeTax: 12_9514_0000_0000, netIncome: 39_9075_0000_0000, netMargin: 14.3 },
  { year: 2022, revenue: 302_2314_0000_0000, costOfRevenue: 196_4820_0000_0000, grossProfit: 105_7494_0000_0000, grossMargin: 35.0, sgna: 30_1200_0000_0000, rnd: 24_8528_0000_0000, operatingIncome: 43_3766_0000_0000, operatingMargin: 14.4, otherIncome: 18_5000_0000_0000, interestExpense: 1_2300_0000_0000, preTaxIncome: 60_6466_0000_0000, incomeTax: 4_9925_0000_0000, netIncome: 55_6541_0000_0000, netMargin: 18.4 },
  { year: 2023, revenue: 258_9355_0000_0000, costOfRevenue: 192_3680_0000_0000, grossProfit: 66_5675_0000_0000, grossMargin: 25.7, sgna: 29_5600_0000_0000, rnd: 24_4405_0000_0000, operatingIncome: 6_5670_0000_0000, operatingMargin: 2.5, otherIncome: 12_8000_0000_0000, interestExpense: 1_5400_0000_0000, preTaxIncome: 17_8270_0000_0000, incomeTax: 2_3399_0000_0000, netIncome: 15_4871_0000_0000, netMargin: 6.0 },
  { year: 2024, revenue: 300_9100_0000_0000, costOfRevenue: 198_6006_0000_0000, grossProfit: 102_3094_0000_0000, grossMargin: 34.0, sgna: 30_0000_0000_0000, rnd: 25_5794_0000_0000, operatingIncome: 32_7300_0000_0000, operatingMargin: 10.9, otherIncome: 5_0000_0000_0000, interestExpense: 1_3000_0000_0000, preTaxIncome: 36_4300_0000_0000, incomeTax: 6_3100_0000_0000, netIncome: 30_1200_0000_0000, netMargin: 10.0 },
];

// 재무상태표 상세
export interface BalanceSheet {
  year: number;
  currentAssets: number;
  cash: number;
  inventory: number;
  nonCurrentAssets: number;
  ppe: number;
  totalAssets: number;
  currentLiabilities: number;
  nonCurrentLiabilities: number;
  totalLiabilities: number;
  totalEquity: number;
  retainedEarnings: number;
  debtToEquity: number;
  currentRatio: number;
}

export const SAMSUNG_BALANCE_SHEETS: BalanceSheet[] = [
  { year: 2021, currentAssets: 218_1236_0000_0000, cash: 104_6447_0000_0000, inventory: 41_3844_0000_0000, nonCurrentAssets: 208_4916_0000_0000, ppe: 138_6200_0000_0000, totalAssets: 426_6152_0000_0000, currentLiabilities: 88_5230_0000_0000, nonCurrentLiabilities: 41_8697_0000_0000, totalLiabilities: 130_3927_0000_0000, totalEquity: 296_2225_0000_0000, retainedEarnings: 270_1000_0000_0000, debtToEquity: 44.0, currentRatio: 2.46 },
  { year: 2022, currentAssets: 218_1600_0000_0000, cash: 95_3000_0000_0000, inventory: 52_0800_0000_0000, nonCurrentAssets: 230_2959_0000_0000, ppe: 155_5000_0000_0000, totalAssets: 448_4559_0000_0000, currentLiabilities: 79_1130_0000_0000, nonCurrentLiabilities: 42_0700_0000_0000, totalLiabilities: 121_1830_0000_0000, totalEquity: 327_2729_0000_0000, retainedEarnings: 303_0000_0000_0000, debtToEquity: 37.0, currentRatio: 2.76 },
  { year: 2023, currentAssets: 210_3000_0000_0000, cash: 80_8000_0000_0000, inventory: 40_7000_0000_0000, nonCurrentAssets: 245_6046_0000_0000, ppe: 165_3000_0000_0000, totalAssets: 455_9046_0000_0000, currentLiabilities: 77_3000_0000_0000, nonCurrentLiabilities: 42_5221_0000_0000, totalLiabilities: 119_8221_0000_0000, totalEquity: 336_0825_0000_0000, retainedEarnings: 311_0000_0000_0000, debtToEquity: 35.7, currentRatio: 2.72 },
  { year: 2024, currentAssets: 220_0000_0000_0000, cash: 85_0000_0000_0000, inventory: 45_0000_0000_0000, nonCurrentAssets: 250_0000_0000_0000, ppe: 170_0000_0000_0000, totalAssets: 470_0000_0000_0000, currentLiabilities: 80_0000_0000_0000, nonCurrentLiabilities: 45_0000_0000_0000, totalLiabilities: 125_0000_0000_0000, totalEquity: 345_0000_0000_0000, retainedEarnings: 320_0000_0000_0000, debtToEquity: 36.2, currentRatio: 2.75 },
];
