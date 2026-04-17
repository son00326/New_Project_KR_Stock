// mock-admin-access-logs.ts — BL-20 A 자동 바이패스 감지용 관리자 접속 로그 mock
// S3 US-T3.8: detectSingleAdminStreak 입력 fixture.
//
// 기본 fixture: 3인 어드민(A·B·C) 혼합 접속 → active=false (정상 모드).
// alternative fixture (주석): 7일 모두 A만 접속 → active=true (비상 완화 모드).

import type { AdminAccessLog } from "@/lib/portfolio/auto-relief";

// 어드민 ID (mock-admin-report-view-log.ts MOCK_ADMIN_IDS와 정합)
const ADMIN_A = "aaaaaaaa-0000-0000-0000-000000000001";
const ADMIN_B = "bbbbbbbb-0000-0000-0000-000000000002";
const ADMIN_C = "cccccccc-0000-0000-0000-000000000003";

// 기본 fixture: 2026-04-11 ~ 2026-04-17 (7일), 3인 혼합
// → detectSingleAdminStreak active=false
export const MOCK_ADMIN_ACCESS_LOGS: AdminAccessLog[] = [
  // 2026-04-11 (토) — A, B 접속
  { adminId: ADMIN_A, date: "2026-04-11" },
  { adminId: ADMIN_B, date: "2026-04-11" },
  // 2026-04-12 (일) — A만 접속
  { adminId: ADMIN_A, date: "2026-04-12" },
  // 2026-04-13 (월) — A, C 접속
  { adminId: ADMIN_A, date: "2026-04-13" },
  { adminId: ADMIN_C, date: "2026-04-13" },
  // 2026-04-14 (화) — B, C 접속
  { adminId: ADMIN_B, date: "2026-04-14" },
  { adminId: ADMIN_C, date: "2026-04-14" },
  // 2026-04-15 (수) — A, B 접속
  { adminId: ADMIN_A, date: "2026-04-15" },
  { adminId: ADMIN_B, date: "2026-04-15" },
  // 2026-04-16 (목) — A, B, C 접속
  { adminId: ADMIN_A, date: "2026-04-16" },
  { adminId: ADMIN_B, date: "2026-04-16" },
  { adminId: ADMIN_C, date: "2026-04-16" },
  // 2026-04-17 (금) — A, B 접속
  { adminId: ADMIN_A, date: "2026-04-17" },
  { adminId: ADMIN_B, date: "2026-04-17" },
];

