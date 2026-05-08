// admin-access-logs.ts — T7e.6 boundary
// 실제 어드민 접속 로그 source는 T7e 범위 밖으로 분리 (HANDOFF '신규 마이그 0건' 기조).
// 본 함수는 빈 배열을 반환하며, BL-20 7일 단일 어드민 자동 바이패스는 source 정의 전까지 영구 비활성.
import type { AdminAccessLog } from "@/lib/portfolio/auto-relief";

export async function getRecentAdminAccessLogs(
  _now: Date = new Date(),
  _windowDays: number = 7,
): Promise<AdminAccessLog[]> {
  return [];
}
