// dispute.ts — 이의 제기 순수 판정 함수 (S3 US-T3.7 BL-7 A)
// 이의 사유 검증 · 중복 이의 차단 · 48h Hold 판정
// Supabase·Next.js·fetch 호출 없음. 순수 함수 전용.

import { DISPUTE_REASON_MIN_LENGTH } from "@/types/admin";

// ---------------------------------------------------------------------------
// 에러 코드
// ---------------------------------------------------------------------------

export const DISPUTE_ERROR_REASON_TOO_SHORT = "reason_too_short" as const;
export const DISPUTE_ERROR_ALREADY_DISPUTED = "already_disputed" as const;

export type DisputeError = "reason_too_short" | "already_disputed";

// ---------------------------------------------------------------------------
// 타입
// ---------------------------------------------------------------------------

export interface DisputeValidation {
  valid: boolean;
  error?: DisputeError;
}

// ---------------------------------------------------------------------------
// validateDisputeReason — 이의 제기 사유 길이 검증
// trim 후 DISPUTE_REASON_MIN_LENGTH(=20)자 미만이면 invalid.
// ---------------------------------------------------------------------------

export function validateDisputeReason(reason: string): DisputeValidation {
  if (reason.trim().length < DISPUTE_REASON_MIN_LENGTH) {
    return { valid: false, error: DISPUTE_ERROR_REASON_TOO_SHORT };
  }
  return { valid: true };
}

// ---------------------------------------------------------------------------
// canRaiseDispute — 이미 이의 제기된 approval에 대해 재이의 차단
// disputeRaisedAt 존재 && disputeResolvedAt === null → already_disputed
// 해결됐거나(disputeResolvedAt 존재) 처음이면 valid.
// ---------------------------------------------------------------------------

export function canRaiseDispute(approval: {
  disputeRaisedAt: string | null;
  disputeResolvedAt: string | null;
}): DisputeValidation {
  if (
    approval.disputeRaisedAt !== null &&
    approval.disputeResolvedAt === null
  ) {
    return { valid: false, error: DISPUTE_ERROR_ALREADY_DISPUTED };
  }
  return { valid: true };
}

// ---------------------------------------------------------------------------
// isDisputeHoldExpired — 48h Hold 만료 판정
// raisedAt + 48h 이후면 만료(true).
// ---------------------------------------------------------------------------

const DISPUTE_HOLD_MS = 48 * 60 * 60 * 1000;

export function isDisputeHoldExpired(raisedAt: Date, now: Date): boolean {
  return now.getTime() >= raisedAt.getTime() + DISPUTE_HOLD_MS;
}

// ---------------------------------------------------------------------------
// isAcceptBlockedByDispute — 결합: 48h 미경과 시 Accept 차단
// disputeRaisedAt 존재 && (disputeResolvedAt === null OR 48h 미경과) → true
// ---------------------------------------------------------------------------

export function isAcceptBlockedByDispute(
  disputeRaisedAt: string | null,
  disputeResolvedAt: string | null,
  now: Date,
): boolean {
  if (disputeRaisedAt === null) return false;

  // resolvedAt 없으면 무조건 차단
  if (disputeResolvedAt === null) return true;

  // resolvedAt 있어도 48h 미경과면 차단
  const raisedAt = new Date(disputeRaisedAt);
  return !isDisputeHoldExpired(raisedAt, now);
}
