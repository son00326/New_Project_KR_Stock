// mdd.ts — 최대 낙폭(MDD) 순수 계산 함수 (S4 T4.2)
// Supabase·Next.js·fetch 호출 없음. 순수 함수 전용.

/**
 * 누적 포트폴리오 가치 시계열로부터 MDD를 반환.
 * - 반환값: 음수 소수점 (e.g. -0.0667 = -6.67%)
 * - 빈 배열 또는 길이 1 이하 → 0
 * - 우상향만 → 0
 */
export function computeMaxDrawdown(cumulativeValues: number[]): number {
  if (cumulativeValues.length <= 1) {
    return 0;
  }

  let peak = cumulativeValues[0];
  let maxDrawdown = 0;

  for (const value of cumulativeValues) {
    if (value > peak) {
      peak = value;
    }
    // peak > 0 방어: 0 나누기 방지
    if (peak > 0) {
      const drawdown = (value - peak) / peak;
      if (drawdown < maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
  }

  return maxDrawdown;
}
