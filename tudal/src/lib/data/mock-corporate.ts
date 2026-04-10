import type {
  Subsidiary,
  ShareholderInfo,
  OrderBacklog,
  DividendHistory,
  Executive,
  CreditRating,
} from "@/types/corporate";

// 삼성전자 계열사 (삼성그룹 주요 계열사)
export const MOCK_SUBSIDIARIES: Record<string, Subsidiary[]> = {
  "005930": [
    { name: "삼성디스플레이", ownership: 84.8, relationship: "자회사", businessArea: "OLED/LCD 디스플레이 제조", isListed: false },
    { name: "삼성SDI", ticker: "006400", ownership: 19.6, relationship: "관계회사", businessArea: "2차전지, 전자재료", isListed: true, marketCap: 24_0000_0000_0000 },
    { name: "삼성전기", ticker: "009150", ownership: 23.7, relationship: "관계회사", businessArea: "MLCC, 카메라모듈, 기판", isListed: true, marketCap: 8_0000_0000_0000 },
    { name: "삼성SDS", ticker: "018260", ownership: 22.6, relationship: "관계회사", businessArea: "IT서비스, 물류", isListed: true, marketCap: 11_0000_0000_0000 },
    { name: "하만인터내셔널", ownership: 100, relationship: "자회사", businessArea: "차량용 인포테인먼트, 전장", isListed: false },
    { name: "삼성바이오로직스", ticker: "207940", ownership: 31.5, relationship: "관계회사", businessArea: "바이오 의약품 CMO/CDO", isListed: true, marketCap: 45_0000_0000_0000 },
    { name: "삼성물산", ticker: "028260", ownership: 0, relationship: "관계회사", businessArea: "건설, 상사, 패션, 리조트 (삼성그룹 지주회사 역할)", isListed: true, marketCap: 18_0000_0000_0000 },
    { name: "삼성생명", ticker: "032830", ownership: 0, relationship: "관계회사", businessArea: "생명보험 (삼성전자 지분 8.5% 보유)", isListed: true, marketCap: 15_0000_0000_0000 },
    { name: "삼성화재", ticker: "000810", ownership: 0, relationship: "관계회사", businessArea: "손해보험", isListed: true, marketCap: 12_0000_0000_0000 },
    { name: "삼성오스틴반도체", ownership: 100, relationship: "자회사", businessArea: "미국 텍사스 파운드리 생산법인", isListed: false },
    { name: "삼성반도체시안", ownership: 100, relationship: "자회사", businessArea: "중국 시안 NAND Flash 생산법인", isListed: false },
  ],
};

// 삼성전자 주주 구성
export const MOCK_SHAREHOLDERS: Record<string, ShareholderInfo[]> = {
  "005930": [
    { name: "이재용 (회장)", category: "최대주주", shares: 1_268_994_640, ownership: 17.08 },
    { name: "삼성생명 등 특수관계인", category: "특수관계인", shares: 621_000_000, ownership: 8.36 },
    { name: "국민연금", category: "국민연금", shares: 681_000_000, ownership: 9.17 },
    { name: "외국인 투자자", category: "외국인", shares: 3_850_000_000, ownership: 51.84 },
    { name: "자사주", category: "자사주", shares: 509_000_000, ownership: 6.86 },
    { name: "기타 소액주주", category: "기타", shares: 496_000_000, ownership: 6.69 },
  ],
};

// 삼성전자 수주 추이 (반도체/파운드리 기준)
export const MOCK_ORDER_BACKLOG: Record<string, OrderBacklog[]> = {
  "005930": [
    { year: 2021, orderReceived: 310_0000_0000_0000, orderBacklog: 85_0000_0000_0000, revenue: 279_6048_0000_0000, bookToBill: 1.11 },
    { year: 2022, orderReceived: 325_0000_0000_0000, orderBacklog: 108_0000_0000_0000, revenue: 302_2314_0000_0000, bookToBill: 1.08 },
    { year: 2023, orderReceived: 245_0000_0000_0000, orderBacklog: 94_0000_0000_0000, revenue: 258_9355_0000_0000, bookToBill: 0.95 },
    { year: 2024, orderReceived: 330_0000_0000_0000, orderBacklog: 123_0000_0000_0000, revenue: 300_9100_0000_0000, bookToBill: 1.10 },
  ],
};

// 삼성전자 배당 이력
export const MOCK_DIVIDENDS: Record<string, DividendHistory[]> = {
  "005930": [
    { year: 2021, dps: 1444, dividendYield: 1.84, payoutRatio: 25.0, totalDividend: 9_8000_0000_0000 },
    { year: 2022, dps: 1444, dividendYield: 2.45, payoutRatio: 17.9, totalDividend: 9_8000_0000_0000 },
    { year: 2023, dps: 1444, dividendYield: 1.86, payoutRatio: 67.8, totalDividend: 9_8000_0000_0000 },
    { year: 2024, dps: 1444, dividendYield: 2.41, payoutRatio: 33.0, totalDividend: 9_8000_0000_0000 },
  ],
};

// 삼성전자 주요 임원
export const MOCK_EXECUTIVES: Record<string, Executive[]> = {
  "005930": [
    { name: "이재용", position: "회장", role: "그룹 총괄 경영", tenure: "2022.10~" },
    { name: "한종희", position: "부회장·대표이사", role: "DX부문(가전/TV) 총괄", tenure: "2021.12~" },
    { name: "경계현", position: "대표이사·사장", role: "DS부문(반도체) 총괄", tenure: "2022.12~" },
    { name: "노태문", position: "사장", role: "MX부문(모바일) 총괄", tenure: "2020.01~" },
    { name: "전영현", position: "부회장", role: "DS부문(메모리) 총괄", tenure: "2024.05~" },
  ],
};

// 삼성전자 신용등급
export const MOCK_CREDIT_RATINGS: Record<string, CreditRating[]> = {
  "005930": [
    { agency: "한국신용평가", rating: "AAA", outlook: "안정적", date: "2025-06-15" },
    { agency: "나이스신용평가", rating: "AAA", outlook: "안정적", date: "2025-06-20" },
    { agency: "S&P", rating: "AA-", outlook: "안정적", date: "2025-04-10" },
    { agency: "Moody's", rating: "Aa3", outlook: "안정적", date: "2025-03-22" },
  ],
};
