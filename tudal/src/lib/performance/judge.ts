// judge.ts — Decision Tree 판정 순수 함수 (S4 T4.2, BL-8=A 복합 AND)
// Supabase·Next.js·fetch 호출 없음. 순수 함수 전용.

// ---------------------------------------------------------------------------
// 임계값 상수 (BL-8=A)
// ---------------------------------------------------------------------------

export const ALPHA_THRESHOLD = 0;
export const SHARPE_THRESHOLD = 0.5;
export const MDD_THRESHOLD = -0.15;

// ---------------------------------------------------------------------------
// 타입
// ---------------------------------------------------------------------------

export type DecisionVerdict = '○' | '△' | '✕';

export interface DecisionBreakdown {
  alpha: boolean;
  sharpe: boolean;
  mdd: boolean;
}

export interface DecisionResult {
  overall: DecisionVerdict;
  breakdown: DecisionBreakdown;
}

// ---------------------------------------------------------------------------
// judgeDecisionTree — 3지표 복합 AND 판정
// ---------------------------------------------------------------------------

/**
 * 3개 지표를 임계값과 비교해 ○/△/✕ 판정을 반환.
 * - 3/3 통과 → '○'
 * - 2/3 통과 → '△'
 * - 0~1/3 통과 → '✕'
 */
export function judgeDecisionTree(input: {
  alpha: number;
  sharpe: number;
  mdd: number;
}): DecisionResult {
  const breakdown: DecisionBreakdown = {
    alpha: input.alpha >= ALPHA_THRESHOLD,
    sharpe: input.sharpe >= SHARPE_THRESHOLD,
    // MDD는 음수이므로 >= -0.15 (e.g. -0.10 >= -0.15 → pass)
    mdd: input.mdd >= MDD_THRESHOLD,
  };

  const passCount = [breakdown.alpha, breakdown.sharpe, breakdown.mdd].filter(
    Boolean
  ).length;

  let overall: DecisionVerdict;
  if (passCount === 3) {
    overall = '○';
  } else if (passCount === 2) {
    overall = '△';
  } else {
    overall = '✕';
  }

  return { overall, breakdown };
}
