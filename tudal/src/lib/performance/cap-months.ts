// cap-months.ts — CAP 달성 스트릭 순수 계산 함수 (S4 T4.2)
// Supabase·Next.js·fetch 호출 없음. 순수 함수 전용.

export const CAP_MONTHS_TARGET = 12;

/**
 * 월별 판정 배열의 말미 연속 '○' 개수를 반환.
 * - 빈 배열 → currentStreak: 0
 * - '○'가 아닌 판정이 끼어들면 streak 초기화
 */
export function computeCapMonths(
  monthlyJudgments: Array<'○' | '△' | '✕'>
): { currentStreak: number; target: number } {
  let streak = 0;

  for (let i = monthlyJudgments.length - 1; i >= 0; i--) {
    if (monthlyJudgments[i] === '○') {
      streak++;
    } else {
      break;
    }
  }

  return { currentStreak: streak, target: CAP_MONTHS_TARGET };
}
