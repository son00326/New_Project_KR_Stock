// gating.ts — D15 게이팅 순수 판정 함수 (S3 US-T3.6)
// R3.3-7 24h Hold · R3.3-8 2인 열람 · R3.3-9 연휴 우회
// Supabase·Next.js·fetch 호출 없음. 순수 함수 전용.

import type { KrBusinessDay } from '@/types/kr-business-days';
import { addBusinessDays } from './business-days';

// ---------------------------------------------------------------------------
// 타입
// ---------------------------------------------------------------------------

export interface AcceptGateInput {
  shortlistGeneratedAt: Date;      // 홈 Short List 생성 시각
  now: Date;                       // 현재 시각 (테스트에서 주입)
  distinctViewerCount: number;     // report_view_log COUNT(DISTINCT admin_id)
  calendar: KrBusinessDay[];       // E11 kr_business_days SELECT 결과
  autoReliefActive: boolean;       // T3.8 detectSingleAdminStreak 결과
}

export type AcceptGateReason =
  | 'hold_24h'             // 24h 미경과 (24h 기준이 D+4 영업일보다 이른 경우)
  | 'business_days_bypass' // 24h는 경과했지만 D+4 영업일 미도달
  | 'viewers_insufficient' // 2인 열람 미달
  | 'ok';

export interface AcceptGateResult {
  allowed: boolean;
  reason: AcceptGateReason;
  remainingMs?: number;       // 차단 상태에서만 — Hold 남은 ms (min 0)
  viewersRemaining?: number;  // 2인 미달 시 남은 인원
  holdExpiresAt?: Date;       // 최종 Hold 만료 시각 (디버깅 편의, 항상 반환)
}

// ---------------------------------------------------------------------------
// computeAcceptGate — D15 게이팅 판정
// ---------------------------------------------------------------------------

export function computeAcceptGate(input: AcceptGateInput): AcceptGateResult {
  const { shortlistGeneratedAt, now, distinctViewerCount, calendar, autoReliefActive } = input;

  // ── Hold 만료 시각 계산 ──────────────────────────────────────────────────
  // R3.3-7: 24h 만료 시각
  const hold24hExpiresAt = new Date(shortlistGeneratedAt.getTime() + 24 * 60 * 60 * 1000);

  // R3.3-9: D+4 영업일 만료 시각 (addBusinessDays는 time-of-day 보존)
  const holdBizDaysExpiresAt = addBusinessDays(shortlistGeneratedAt, 4, calendar);

  // holdExpiresAt = MAX(24h, D+4 영업일) — 둘 다 만료 필요 (R3.3-9)
  // 디버깅 편의: 실제로 적용되는 최종 만료 시각 (더 늦은 쪽)
  const holdExpiresAt =
    hold24hExpiresAt.getTime() >= holdBizDaysExpiresAt.getTime()
      ? hold24hExpiresAt
      : holdBizDaysExpiresAt;

  // ── Hold 게이팅 판정: 두 조건을 순서대로 독립 검사 ───────────────────────
  // 1단계: 24h 미경과 (R3.3-7) — 우선 노출 reason
  if (now.getTime() < hold24hExpiresAt.getTime()) {
    const remainingMs = Math.max(0, holdExpiresAt.getTime() - now.getTime());
    return {
      allowed: false,
      reason: 'hold_24h',
      remainingMs,
      holdExpiresAt,
    };
  }

  // 2단계: D+4 영업일 미경과 (R3.3-9 연휴 우회 — 24h는 통과했지만 영업일 미도달)
  if (now.getTime() < holdBizDaysExpiresAt.getTime()) {
    const remainingMs = Math.max(0, holdBizDaysExpiresAt.getTime() - now.getTime());
    return {
      allowed: false,
      reason: 'business_days_bypass',
      remainingMs,
      holdExpiresAt,
    };
  }

  // ── 2인 열람 게이팅 판정 (Hold 통과 후) ──────────────────────────────────
  // R3.3-8: autoReliefActive=true면 완전 생략 (BL-20 A)
  if (!autoReliefActive && distinctViewerCount < 2) {
    return {
      allowed: false,
      reason: 'viewers_insufficient',
      viewersRemaining: 2 - distinctViewerCount,
      holdExpiresAt,
    };
  }

  // ── 통과 ─────────────────────────────────────────────────────────────────
  return {
    allowed: true,
    reason: 'ok',
    holdExpiresAt,
  };
}
