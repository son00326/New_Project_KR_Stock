import { describe, it, expect } from 'vitest';
import {
  isAcceptAllowed,
  isUniqueViolation,
  ACCEPT_ERROR_ALREADY_FINALIZED,
  ACCEPT_ERROR_GATED,
} from '../approval-logic';

describe('isAcceptAllowed', () => {
  it('정상 상태: 둘 다 허용 → allowed:true', () => {
    const result = isAcceptAllowed({
      monthFinalizedByOtherAdmin: false,
      gateAllowed: true,
    });
    expect(result).toEqual({ allowed: true });
  });

  it('이미 확정: monthFinalizedByOtherAdmin=true → allowed:false, error:already_finalized', () => {
    const result = isAcceptAllowed({
      monthFinalizedByOtherAdmin: true,
      gateAllowed: true,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.error).toBe(ACCEPT_ERROR_ALREADY_FINALIZED);
      expect(result.message).toBe('이미 다른 어드민이 이번 달 포트를 확정했습니다');
    }
  });

  it('게이팅 차단: gateAllowed=false → allowed:false, error:gated', () => {
    const result = isAcceptAllowed({
      monthFinalizedByOtherAdmin: false,
      gateAllowed: false,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.error).toBe(ACCEPT_ERROR_GATED);
      expect(result.message).toBe('D15 게이팅 조건 미충족');
    }
  });

  it('우선순위: 둘 다 true → already_finalized 우선', () => {
    const result = isAcceptAllowed({
      monthFinalizedByOtherAdmin: true,
      gateAllowed: false,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.error).toBe(ACCEPT_ERROR_ALREADY_FINALIZED);
    }
  });
});

describe('isUniqueViolation', () => {
  it('{code:"23505"} → true', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
  });

  it('{code:23505} (숫자) → true', () => {
    expect(isUniqueViolation({ code: 23505 })).toBe(true);
  });

  it('{code:"42P01"} → false', () => {
    expect(isUniqueViolation({ code: '42P01' })).toBe(false);
  });

  it('null → false', () => {
    expect(isUniqueViolation(null)).toBe(false);
  });

  it('undefined → false', () => {
    expect(isUniqueViolation(undefined)).toBe(false);
  });

  it('문자열 "error" → false', () => {
    expect(isUniqueViolation('error')).toBe(false);
  });
});
