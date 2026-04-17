import type { PortfolioSnapshot } from "@/types/admin";

// MVP용 mock 데이터 — 추후 EOD 배치 + pykrx 종가로 교체 (S4 성과·Decision Tree)
// E5 PortfolioSnapshot (가상 포트 일별 스냅샷).
// D11: 가상 트래킹 전용. 어드민 실제 증권사 계좌 포지션과 별개 (E9와 분리).
export const MOCK_ADMIN_SNAPSHOTS: PortfolioSnapshot[] = [];
