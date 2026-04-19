import type { RegenCounter } from "@/types/admin";

// MVP용 mock 데이터 — 추후 Supabase 카운터 테이블로 교체 (S4 M9 재생성 cap 가드)
// E8 RegenCounter (재생성 카운터). auto ≤ 1, manual ≤ 2, 매월 1일 리셋.
export const MOCK_ADMIN_REGEN_COUNTERS: RegenCounter[] = [
  // 005930 삼성전자 — 신규 (수동 2회 남음)
  {
    id: "regen-1",
    ticker: "005930",
    month: "2026-04-01",
    autoCount: 0,
    manualCount: 0,
    resetAt: "2026-05-01T00:00:00+09:00",
  },
  // 000660 SK하이닉스 — 부분 사용 (수동 1회 남음)
  {
    id: "regen-2",
    ticker: "000660",
    month: "2026-04-01",
    autoCount: 1,
    manualCount: 1,
    resetAt: "2026-05-01T00:00:00+09:00",
  },
  // 207940 삼성바이오로직스 — 소진 (수동 0회 남음, 버튼 비활성화)
  {
    id: "regen-3",
    ticker: "207940",
    month: "2026-04-01",
    autoCount: 0,
    manualCount: 2,
    resetAt: "2026-05-01T00:00:00+09:00",
  },
];
