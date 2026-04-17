import type { RegenCounter } from "@/types/admin";

// MVP용 mock 데이터 — 추후 Supabase 카운터 테이블로 교체 (S4 M9 재생성 cap 가드)
// E8 RegenCounter (재생성 카운터). auto ≤ 1, manual ≤ 2, 매월 1일 리셋.
export const MOCK_ADMIN_REGEN_COUNTERS: RegenCounter[] = [];
