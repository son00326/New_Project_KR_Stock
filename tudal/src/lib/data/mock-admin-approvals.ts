import type { PortfolioApproval } from "@/types/admin";

// MVP용 mock 데이터 — 추후 어드민 승인 액션 Supabase write로 교체 (S3 승인 워크플로우)
// E4 PortfolioApproval (승인 이벤트). 선착순 is_final=true 1건/월.
// D15 게이팅(24h Holding + 2인 열람 + 이의 48h) 필드 포함.
//
// 2026-03: is_final=true 이력 1건 (prev month 확정 예시)
// 2026-04: is_final=true 시연용 row 추가 — 이의 제기 UI 노출 테스트 (US-T3.7)
export const MOCK_ADMIN_APPROVALS: PortfolioApproval[] = [
  {
    id: "approval-2026-03",
    month: "2026-03-01",
    adminId: "admin-001",
    approvalType: "accept",
    approvedAt: "2026-03-03T02:30:00.000Z", // 03-03 11:30 KST
    isFinal: true,
    prevPortfolioHeld: false,
    shortlistGeneratedAt: "2026-03-01T00:00:00.000Z", // 03-01 09:00 KST
    disputeRaisedAt: null,
    disputeRaisedBy: null,
    disputeReason: null,
    disputeResolvedAt: null,
    gatingAutoReliefActive: false,
    reanalysisCount: 0,
  },
  {
    id: "approval-2026-04",
    month: "2026-04-01",
    adminId: "admin-a",
    approvalType: "accept",
    approvedAt: "2026-04-17T00:00:00.000Z", // 04-17 09:00 KST
    isFinal: true,
    prevPortfolioHeld: false,
    shortlistGeneratedAt: "2026-04-01T00:00:00.000Z", // 04-01 09:00 KST
    disputeRaisedAt: null,
    disputeRaisedBy: null,
    disputeReason: null,
    disputeResolvedAt: null,
    gatingAutoReliefActive: false,
    reanalysisCount: 0,
  },
];
