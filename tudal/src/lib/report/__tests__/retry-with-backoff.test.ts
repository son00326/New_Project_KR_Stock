// PR5 retry-with-backoff — pure 로직 단위 테스트 (plan §6 T-b1/T-b2 + T2).
import { describe, it, expect, vi } from 'vitest';
import {
  retryWithBackoff,
  isTransientError,
} from '@/lib/report/retry-with-backoff';

describe('isTransientError (T-b2 transient classifier)', () => {
  it('LLM 실패 코드 3종(full_report/critic/revise)을 transient로 분류 (R1 MEDIUM-2)', () => {
    expect(isTransientError(new Error('full_report_llm_failed'))).toBe(true);
    expect(isTransientError(new Error('critic_llm_failed'))).toBe(true);
    expect(isTransientError(new Error('revise_llm_failed'))).toBe(true);
  });

  it('429/529/network 힌트를 transient로 분류', () => {
    expect(isTransientError(new Error('HTTP 429 rate limited'))).toBe(true);
    expect(isTransientError(new Error('overloaded 529'))).toBe(true);
    expect(isTransientError(new Error('network timeout'))).toBe(true);
  });

  it('non-transient: ai_key_unavailable / cost_hardcap_40man', () => {
    expect(isTransientError(new Error('ai_key_unavailable'))).toBe(false);
    expect(isTransientError(new Error('cost_hardcap_40man'))).toBe(false);
    expect(isTransientError(new Error('invalid_ticker'))).toBe(false);
  });
});

describe('retryWithBackoff (T-b1 deterministic + T2 retry)', () => {
  it('transient error는 정확히 retries(2)회 재시도 후 throw (총 3회 시도)', async () => {
    const fn = vi.fn(async () => {
      throw new Error('critic_llm_failed');
    });
    const sleep = vi.fn(async () => {});
    await expect(
      retryWithBackoff(fn, { retries: 2, sleep, jitter: (ms) => ms }),
    ).rejects.toThrow('critic_llm_failed');
    expect(fn).toHaveBeenCalledTimes(3); // 1 + 2 retries
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('non-transient error는 0회 재시도 (즉시 throw)', async () => {
    const fn = vi.fn(async () => {
      throw new Error('ai_key_unavailable');
    });
    const sleep = vi.fn(async () => {});
    await expect(retryWithBackoff(fn, { retries: 2, sleep })).rejects.toThrow(
      'ai_key_unavailable',
    );
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('deterministic backoff 2000→4000 (factor 2, cap 8000)', async () => {
    const fn = vi.fn(async () => {
      throw new Error('full_report_llm_failed');
    });
    const delays: number[] = [];
    const sleep = vi.fn(async (ms: number) => {
      delays.push(ms);
    });
    await expect(
      retryWithBackoff(fn, {
        retries: 2,
        baseMs: 2000,
        capMs: 8000,
        sleep,
        jitter: (ms) => ms,
      }),
    ).rejects.toThrow();
    expect(delays).toEqual([2000, 4000]);
  });

  it('첫 시도 성공 시 retry 0', async () => {
    const fn = vi.fn(async () => 'ok');
    const sleep = vi.fn(async () => {});
    await expect(retryWithBackoff(fn, { sleep })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('transient 후 성공 시 결과 반환', async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      if (calls < 2) throw new Error('network glitch');
      return 'recovered';
    });
    const sleep = vi.fn(async () => {});
    await expect(
      retryWithBackoff(fn, { retries: 2, sleep, jitter: (ms) => ms }),
    ).resolves.toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
