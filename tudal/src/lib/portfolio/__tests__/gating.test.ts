// gating.test.ts — D15 게이팅 단위 테스트 (S3 US-T3.6)
import { describe, it, expect } from 'vitest';
import { computeAcceptGate, AcceptGateInput } from '../gating';
import type { KrBusinessDay } from '@/types/kr-business-days';

// ---------------------------------------------------------------------------
// 픽스처 헬퍼
// ---------------------------------------------------------------------------

function bd(date: string): KrBusinessDay {
  return { date, isBusinessDay: true, holidayName: null };
}

function hd(date: string, holidayName: string): KrBusinessDay {
  return { date, isBusinessDay: false, holidayName };
}

// 2026-04 일반 구간 (주말은 fallback으로 처리)
// shortlistGeneratedAt=2026-04-13T10:00 KST 기준 D+4 = 2026-04-17(금)
const APRIL_2026: KrBusinessDay[] = [
  bd('2026-04-13'), // 월
  bd('2026-04-14'), // 화
  bd('2026-04-15'), // 수
  bd('2026-04-16'), // 목
  bd('2026-04-17'), // 금  ← D+4
  bd('2026-04-20'), // 월
];

// 2026-09 추석 연휴 구간
// shortlistGeneratedAt=2026-09-23T10:00 KST 기준
// 09-24(추석), 09-25(추석), 09-26(Sat), 09-27(Sun) 스킵
// D+4 = +1:09-28, +2:09-29, +3:09-30, +4:10-01(fallback 평일)
const SEP_2026_CHUSEOK: KrBusinessDay[] = [
  bd('2026-09-23'),                 // 수
  hd('2026-09-24', '추석'),         // 목
  hd('2026-09-25', '추석'),         // 금
  // 09-26 Sat, 09-27 Sun — fallback false
  bd('2026-09-28'),                 // 월 +1
  bd('2026-09-29'),                 // 화 +2
  bd('2026-09-30'),                 // 수 +3
  // 10-01 Thu — fallback true(평일) +4
];

// ---------------------------------------------------------------------------
// 테스트
// ---------------------------------------------------------------------------

describe('computeAcceptGate', () => {
  // ── 케이스 1: 24h 미경과 → hold_24h 차단 ─────────────────────────────────
  it('케이스 1 — 24h 미경과: hold_24h 차단, remainingMs > 0', () => {
    const input: AcceptGateInput = {
      // shortlistGeneratedAt: 2026-04-13T10:00 KST = 01:00 UTC
      shortlistGeneratedAt: new Date('2026-04-13T01:00:00.000Z'),
      // now: 2026-04-13T20:00 KST = 11:00 UTC (10h 경과 — 24h 미달)
      now: new Date('2026-04-13T11:00:00.000Z'),
      distinctViewerCount: 2,
      calendar: APRIL_2026,
      autoReliefActive: false,
    };

    const result = computeAcceptGate(input);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('hold_24h');
    expect(result.remainingMs).toBeDefined();
    expect(result.remainingMs!).toBeGreaterThan(0);
    expect(result.holdExpiresAt).toBeDefined();
  });

  // ── 케이스 2: 24h·D+4 모두 경과 + 2인 달성 → 통과 ──────────────────────
  it('케이스 2 — 24h·D+4 경과 + 2인 달성: allowed=true, reason=ok', () => {
    const input: AcceptGateInput = {
      shortlistGeneratedAt: new Date('2026-04-13T01:00:00.000Z'), // KST 10:00
      // now: 2026-04-17T11:00 KST = 02:00 UTC
      // 24h 만료: 04-14T10:00 KST ✓  D+4 만료: 04-17T10:00 KST ✓
      now: new Date('2026-04-17T02:00:00.000Z'),
      distinctViewerCount: 2,
      calendar: APRIL_2026,
      autoReliefActive: false,
    };

    const result = computeAcceptGate(input);

    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('ok');
    expect(result.holdExpiresAt).toBeDefined();
    expect(result.remainingMs).toBeUndefined();
  });

  // ── 케이스 3: 24h·D+4 모두 경과 + 1인 열람 → viewers_insufficient ────────
  it('케이스 3 — 24h·D+4 경과 + 1인 열람: viewers_insufficient, viewersRemaining=1', () => {
    const input: AcceptGateInput = {
      shortlistGeneratedAt: new Date('2026-04-13T01:00:00.000Z'),
      now: new Date('2026-04-17T02:00:00.000Z'), // D+4 이후
      distinctViewerCount: 1,
      calendar: APRIL_2026,
      autoReliefActive: false,
    };

    const result = computeAcceptGate(input);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('viewers_insufficient');
    expect(result.viewersRemaining).toBe(1);
    expect(result.holdExpiresAt).toBeDefined();
    expect(result.remainingMs).toBeUndefined();
  });

  // ── 케이스 4: autoReliefActive=true → 2인 게이팅 skip, 0인이어도 통과 ────
  it('케이스 4 — autoReliefActive=true: 2인 게이팅 skip → allowed=true', () => {
    const input: AcceptGateInput = {
      shortlistGeneratedAt: new Date('2026-04-13T01:00:00.000Z'),
      now: new Date('2026-04-17T02:00:00.000Z'), // D+4 이후
      distinctViewerCount: 0,
      calendar: APRIL_2026,
      autoReliefActive: true,
    };

    const result = computeAcceptGate(input);

    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('ok');
  });

  // ── 케이스 5: 연휴 우회 — 24h 경과했지만 D+4 영업일 미도달 ───────────────
  // shortlistGeneratedAt = 2026-09-23T10:00 KST
  // 24h 만료 = 2026-09-24T10:00 KST
  // D+4 영업일 = 2026-10-01T10:00 KST (추석 연휴로 밀림)
  // now = 2026-09-24T11:00 KST → 24h 통과, D+4 미도달 → business_days_bypass
  it('케이스 5 — 연휴 우회: 24h 경과 + D+4 미도달 → business_days_bypass', () => {
    const input: AcceptGateInput = {
      // shortlistGeneratedAt: 2026-09-23T10:00 KST = 01:00 UTC
      shortlistGeneratedAt: new Date('2026-09-23T01:00:00.000Z'),
      // now: 2026-09-24T11:00 KST = 02:00 UTC (24h+1h 경과, D+4 미도달)
      now: new Date('2026-09-24T02:00:00.000Z'),
      distinctViewerCount: 2,
      calendar: SEP_2026_CHUSEOK,
      autoReliefActive: false,
    };

    const result = computeAcceptGate(input);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('business_days_bypass');
    expect(result.remainingMs).toBeDefined();
    expect(result.remainingMs!).toBeGreaterThan(0);
    expect(result.holdExpiresAt).toBeDefined();
    // holdExpiresAt은 D+4 영업일 기준 (09-23 이후 4영업일 = 10-01)
    // 09-27 이후여야 함
    expect(result.holdExpiresAt!.getTime()).toBeGreaterThan(
      new Date('2026-09-27T00:00:00.000Z').getTime()
    );
  });

  // ── 케이스 6: 연휴 없는 구간 — 24h·D+4 모두 도달 후 통과 증명 ────────────
  // shortlistGeneratedAt = 2026-04-13T10:00 KST
  // 24h 만료 = 2026-04-14T10:00 KST
  // D+4 영업일 = 2026-04-17T10:00 KST (04-14,15,16,17 평일 4개)
  // now = 2026-04-17T11:00 KST → 둘 다 통과 → allowed=true
  it('케이스 6 — 24h·D+4 모두 도달(연휴 없음): allowed=true', () => {
    const input: AcceptGateInput = {
      shortlistGeneratedAt: new Date('2026-04-13T01:00:00.000Z'), // KST 10:00
      // now: 2026-04-17T11:00 KST = 02:00 UTC
      now: new Date('2026-04-17T02:00:00.000Z'),
      distinctViewerCount: 2,
      calendar: APRIL_2026,
      autoReliefActive: false,
    };

    const result = computeAcceptGate(input);

    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('ok');
  });

  // ── 77차 D31 relaxGate (내부도구 완화 모드) ───────────────────────────────

  // 케이스 7: relaxGate=true + 24h 경과 + D+4 미도달 + 0인 열람 → 통과
  //   (strict면 케이스 5처럼 business_days_bypass로 막힐 입력)
  it('케이스 7 — relaxGate=true: 24h 경과 후 D+4·2인 면제 → allowed=true', () => {
    const input: AcceptGateInput = {
      shortlistGeneratedAt: new Date('2026-09-23T01:00:00.000Z'), // KST 10:00
      now: new Date('2026-09-24T02:00:00.000Z'),                  // 24h+1h 경과, D+4 미도달
      distinctViewerCount: 0,
      calendar: SEP_2026_CHUSEOK,
      autoReliefActive: false,
      relaxGate: true,
    };

    const result = computeAcceptGate(input);

    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('ok');
    expect(result.holdExpiresAt).toBeDefined();
  });

  // 케이스 8: relaxGate=true 라도 24h 미경과면 hold_24h 차단 (최소 sanity hold 유지)
  it('케이스 8 — relaxGate=true + 24h 미경과: hold_24h 여전히 차단', () => {
    const input: AcceptGateInput = {
      shortlistGeneratedAt: new Date('2026-04-13T01:00:00.000Z'),
      now: new Date('2026-04-13T11:00:00.000Z'), // 10h 경과 (24h 미달)
      distinctViewerCount: 0,
      calendar: APRIL_2026,
      autoReliefActive: false,
      relaxGate: true,
    };

    const result = computeAcceptGate(input);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('hold_24h');
    expect(result.remainingMs!).toBeGreaterThan(0);
  });

  // 케이스 9: relaxGate 미지정(undefined) → 기존 strict 동작 후방호환 (D+4 미도달 차단)
  it('케이스 9 — relaxGate 미지정: strict 후방호환 (business_days_bypass 유지)', () => {
    const input: AcceptGateInput = {
      shortlistGeneratedAt: new Date('2026-09-23T01:00:00.000Z'),
      now: new Date('2026-09-24T02:00:00.000Z'),
      distinctViewerCount: 2,
      calendar: SEP_2026_CHUSEOK,
      autoReliefActive: false,
      // relaxGate 미지정
    };

    const result = computeAcceptGate(input);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('business_days_bypass');
  });
});
