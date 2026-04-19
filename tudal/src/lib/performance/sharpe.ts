// sharpe.ts — 샤프 지수 순수 계산 함수 (S4 T4.2)
// Supabase·Next.js·fetch 호출 없음. 순수 함수 전용.

/**
 * 연환산 샤프 지수를 반환.
 * - dailyReturns: 일별 수익률 (소수점, e.g. 0.01 = +1%)
 * - riskFreeRate: 무위험 수익률 (소수점, 기본값 0)
 * - 빈 배열 또는 길이 1 이하 → 0
 * - 표본 표준편차(n-1) = 0 → 0
 * - 공식: (mean - riskFreeRate) / stddev * sqrt(252)
 */
export function computeSharpeRatio(
  dailyReturns: number[],
  riskFreeRate: number = 0
): number {
  if (dailyReturns.length <= 1) {
    return 0;
  }

  const n = dailyReturns.length;
  const mean = dailyReturns.reduce((sum, r) => sum + r, 0) / n;

  const variance =
    dailyReturns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (n - 1);
  const stddev = Math.sqrt(variance);

  if (stddev === 0) {
    return 0;
  }

  return ((mean - riskFreeRate) / stddev) * Math.sqrt(252);
}
