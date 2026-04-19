// alpha.ts — 단순 알파 순수 계산 함수 (S4 T4.2)
// Supabase·Next.js·fetch 호출 없음. 순수 함수 전용.

/**
 * 단순 알파 = 포트폴리오 수익률 - 벤치마크 수익률 (CAPM 아님).
 * 소수점 입력 (e.g. 0.10 = +10%).
 */
export function computeAlpha(
  portfolioReturn: number,
  benchmarkReturn: number
): number {
  return portfolioReturn - benchmarkReturn;
}
