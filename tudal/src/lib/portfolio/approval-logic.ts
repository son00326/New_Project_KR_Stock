// 승인 워크플로우 순수 판정 로직 — UI / Server Action 공용
// S3 US-T3.3 (2026-04-17)
// 의존성 없음 (pure functions). Supabase·React import 금지.

// ---------------------------------------------------------------------------
// 에러 코드 상수
// ---------------------------------------------------------------------------
export const ACCEPT_ERROR_ALREADY_FINALIZED = 'already_finalized' as const;
export const ACCEPT_ERROR_GATED = 'gated' as const;

// ---------------------------------------------------------------------------
// 타입
// ---------------------------------------------------------------------------
export type AcceptAttemptOutcome =
  | { allowed: true }
  | { allowed: false; error: 'already_finalized' | 'gated'; message: string };

export interface ApprovalState {
  /** 이미 다른 admin이 is_final=true로 확정한 경우 */
  monthFinalizedByOtherAdmin: boolean;
  /** T3.6 computeAcceptGate 결과 반영 (외부에서 주입) */
  gateAllowed: boolean;
}

// ---------------------------------------------------------------------------
// isAcceptAllowed — Accept 시도 가능 여부 순수 판정
// 우선순위: monthFinalizedByOtherAdmin > gateAllowed
// ---------------------------------------------------------------------------
export function isAcceptAllowed(state: ApprovalState): AcceptAttemptOutcome {
  if (state.monthFinalizedByOtherAdmin) {
    return {
      allowed: false,
      error: ACCEPT_ERROR_ALREADY_FINALIZED,
      message: '이미 다른 어드민이 이번 달 포트를 확정했습니다',
    };
  }

  if (!state.gateAllowed) {
    return {
      allowed: false,
      error: ACCEPT_ERROR_GATED,
      message: 'D15 게이팅 조건 미충족',
    };
  }

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// isUniqueViolation — Supabase/pg unique_violation(23505) 식별
// pg error: { code: '23505', ... } 또는 Supabase 에러 { code: 23505 | '23505', ... }
// any 사용 금지 — in 연산자 + typeof 가드로 안전하게 추출
// ---------------------------------------------------------------------------
export function isUniqueViolation(err: unknown): boolean {
  if (err === null || err === undefined || typeof err !== 'object') {
    return false;
  }

  if (!('code' in err)) {
    return false;
  }

  const code = (err as Record<string, unknown>).code;
  return code === '23505' || code === 23505;
}
