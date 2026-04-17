import type { StockReport } from "@/types/admin";

// MVP용 mock 데이터 — 추후 AI Judge Engine 출력으로 교체 (S2 풀 리포트)
// E2 StockReport (종목 풀 리포트). 월 1회 배치 + 재생성 시 version 증가.
// (month, ticker) 기준 최신 1건만 isLatest=true.
export const MOCK_ADMIN_REPORTS: StockReport[] = [];
