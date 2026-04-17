import { describe, it, expect } from 'vitest';
import { detectSingleAdminStreak, AdminAccessLog } from '../auto-relief';

// fixture: 2026-04-11(토)~2026-04-17(금) 7일
// 함수는 캘린더 날짜 문자열만 사용하므로 주말 여부 무관
const NOW = new Date('2026-04-17T12:00:00');

function makeLogs(
  entries: { date: string; adminId: string }[]
): AdminAccessLog[] {
  return entries.map(({ date, adminId }) => ({ date, adminId }));
}

// 7일 날짜 배열 (오늘 포함 역순)
const DATES_7 = [
  '2026-04-17',
  '2026-04-16',
  '2026-04-15',
  '2026-04-14',
  '2026-04-13',
  '2026-04-12',
  '2026-04-11',
];

describe('detectSingleAdminStreak', () => {
  it('1. 7일 모두 동일 admin → active=true, streakDays=7, adminId 반환', () => {
    const logs = makeLogs(DATES_7.map((date) => ({ date, adminId: 'A' })));
    const result = detectSingleAdminStreak(logs, NOW);
    expect(result.active).toBe(true);
    expect(result.streakDays).toBe(7);
    expect(result.adminId).toBe('A');
  });

  it('2. 7일 중 6일째(2026-04-12)에 다른 admin B 추가 → active=false, streakDays=5', () => {
    // 오늘(4-17)부터: 4-17,4-16,4-15,4-14,4-13 → 5일 streak
    // 4-12에 A+B 동시 접속 → streak 중단
    const logs = makeLogs([
      ...DATES_7.filter((d) => d !== '2026-04-12').map((date) => ({
        date,
        adminId: 'A',
      })),
      { date: '2026-04-12', adminId: 'A' },
      { date: '2026-04-12', adminId: 'B' },
    ]);
    const result = detectSingleAdminStreak(logs, NOW);
    expect(result.active).toBe(false);
    expect(result.streakDays).toBe(5);
  });

  it('3. 6일만 단일 (7일째 2026-04-11 접속 없음) → active=false, streakDays=6', () => {
    const logs = makeLogs(
      DATES_7.filter((d) => d !== '2026-04-11').map((date) => ({
        date,
        adminId: 'A',
      }))
    );
    const result = detectSingleAdminStreak(logs, NOW);
    expect(result.active).toBe(false);
    expect(result.streakDays).toBe(6);
  });

  it('4. 8일 연속 단일 (windowDays=7) → active=true, streakDays=7', () => {
    const dates8 = ['2026-04-10', ...DATES_7]; // 8일
    const logs = makeLogs(dates8.map((date) => ({ date, adminId: 'A' })));
    const result = detectSingleAdminStreak(logs, NOW, 7);
    expect(result.active).toBe(true);
    expect(result.streakDays).toBe(7);
  });

  it('5. 빈 logs (0일 접속) → active=false, streakDays=0', () => {
    const result = detectSingleAdminStreak([], NOW);
    expect(result.active).toBe(false);
    expect(result.streakDays).toBe(0);
  });

  it('6. 입력 순서 무관: 뒤섞인 logs에서도 동일 결과', () => {
    // 정렬 순서: 섞어서 넣기
    const logs = makeLogs([
      { date: '2026-04-13', adminId: 'A' },
      { date: '2026-04-17', adminId: 'A' },
      { date: '2026-04-11', adminId: 'A' },
      { date: '2026-04-15', adminId: 'A' },
      { date: '2026-04-12', adminId: 'A' },
      { date: '2026-04-16', adminId: 'A' },
      { date: '2026-04-14', adminId: 'A' },
    ]);
    const result = detectSingleAdminStreak(logs, NOW);
    expect(result.active).toBe(true);
    expect(result.streakDays).toBe(7);
    expect(result.adminId).toBe('A');
  });

  it('7. windowDays=3 커스텀: 3일 연속 단일 admin → active=true', () => {
    // 최근 3일(4-17,4-16,4-15)만 admin A
    const logs = makeLogs([
      { date: '2026-04-17', adminId: 'A' },
      { date: '2026-04-16', adminId: 'A' },
      { date: '2026-04-15', adminId: 'A' },
    ]);
    const result = detectSingleAdminStreak(logs, NOW, 3);
    expect(result.active).toBe(true);
    expect(result.streakDays).toBe(3);
    expect(result.adminId).toBe('A');
  });
});
