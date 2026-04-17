// auto-relief.ts — 7일 연속 단일 admin_id 접속 감지 순수 함수 (S3 US-T3.8)
// BL-20 A: 최근 7일 연속 단일 admin_id만 /admin 접속 시 D15 2인 게이팅 자동 바이패스.
// Supabase·Next.js·fetch 호출 없음. 순수 함수 전용.

export interface AdminAccessLog {
  adminId: string;
  date: string; // YYYY-MM-DD (KST 기준, 접속 발생일)
}

export interface AutoReliefState {
  active: boolean;
  streakDays: number;
  adminId?: string;
}

/**
 * 최근 N일 연속 단일 admin_id 접속 여부 판정.
 *
 * - now 기준 과거 `windowDays`(기본 7)일 각각에 대해 distinct admin_id 그룹 확인
 * - now 당일이 1일째, 역순으로 windowDays일까지 검사
 * - 매 일자에 정확히 1명(같은 admin)만 등장해야 streak 유지
 * - streakDays >= windowDays 이면 active=true + adminId 반환
 * - 하루라도 2명 이상 / 0명(접속 없음) / 다른 admin → streak 중단
 *   → 끊기기 직전까지 누적 streakDays 반환 후 active=false
 */
export function detectSingleAdminStreak(
  logs: AdminAccessLog[],
  now: Date,
  windowDays: number = 7
): AutoReliefState {
  // now 기준 YYYY-MM-DD 키 생성 (로컬 기준)
  function toDateKey(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 날짜 → distinct adminId 집합 Map 구축
  const dateMap = new Map<string, Set<string>>();
  for (const log of logs) {
    if (!dateMap.has(log.date)) {
      dateMap.set(log.date, new Set<string>());
    }
    dateMap.get(log.date)!.add(log.adminId);
  }

  let streakDays = 0;
  let streakAdminId: string | undefined;

  // now 당일(0 offset)부터 역순으로 windowDays일 검사
  for (let offset = 0; offset < windowDays; offset++) {
    const d = new Date(now);
    d.setDate(d.getDate() - offset);
    const key = toDateKey(d);

    const admins = dateMap.get(key);

    if (!admins || admins.size === 0) {
      // 접속 없음 → streak 중단
      break;
    }

    if (admins.size > 1) {
      // 복수 admin → streak 중단
      break;
    }

    const currentAdmin = [...admins][0];

    if (offset === 0) {
      // 첫 날: streak 시작 admin 결정
      streakAdminId = currentAdmin;
      streakDays = 1;
    } else if (currentAdmin === streakAdminId) {
      // 같은 admin 연속
      streakDays++;
    } else {
      // 다른 admin → streak 중단
      break;
    }
  }

  if (streakDays >= windowDays) {
    return { active: true, streakDays, adminId: streakAdminId };
  }

  return { active: false, streakDays };
}
