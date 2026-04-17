import type { PortfolioApproval } from "@/types/admin";

// MVP용 mock 데이터 — 추후 어드민 승인 액션 Supabase write로 교체 (S3 승인 워크플로우)
// E4 PortfolioApproval (승인 이벤트). 선착순 is_final=true 1건/월.
// D15 게이팅(24h Holding + 2인 열람 + 이의 48h) 필드 포함.
export const MOCK_ADMIN_APPROVALS: PortfolioApproval[] = [];
