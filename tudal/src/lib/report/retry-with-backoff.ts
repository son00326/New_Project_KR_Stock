// PR5 — retry with exponential backoff (pure, deterministic-testable via injected sleep).
// plan §3.5 / §4.2 C5 / omxy R1 MEDIUM-2.
//
// transient (retry): full_report_llm_failed / critic_llm_failed / revise_llm_failed / 429 / 529 / network.
// non-transient (no retry): ai_key_unavailable / cost_hardcap_exceeded — caller가 systemic abort 판단.

// 코드 작성 후 grep 검증: critic_llm_failed / revise_llm_failed 포함 (R1 MEDIUM-2).
const TRANSIENT_CODES: readonly string[] = [
  'full_report_llm_failed',
  'critic_llm_failed',
  'revise_llm_failed',
];

const TRANSIENT_HINTS: readonly string[] = [
  '429',
  '529',
  'network',
  'fetch failed',
  'ETIMEDOUT',
  'ECONNRESET',
];

export function isTransientError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  if (TRANSIENT_CODES.some((code) => message.includes(code))) return true;
  return TRANSIENT_HINTS.some((hint) => message.includes(hint));
}

export interface RetryOptions {
  retries?: number; // 추가 재시도 횟수 (총 시도 = retries + 1). default 2.
  baseMs?: number; // default 2000
  capMs?: number; // default 8000
  isTransient?: (err: unknown) => boolean;
  sleep?: (ms: number) => Promise<void>; // 주입 (deterministic test)
  jitter?: (ms: number) => number; // 주입 가능 (기본 0~baseMs 비례). test에서 identity.
}

const realSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * fn을 최대 (retries+1)회 시도. transient error만 backoff 후 재시도.
 * non-transient는 즉시 throw (caller가 systemic abort 판단). 마지막 시도 실패 시 마지막 error throw.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const retries = options.retries ?? 2;
  const baseMs = options.baseMs ?? 2000;
  const capMs = options.capMs ?? 8000;
  const isTransient = options.isTransient ?? isTransientError;
  const sleep = options.sleep ?? realSleep;
  // jitter 기본: backoff에 0~25% 비결정 가산 (test는 identity 주입).
  const jitter = options.jitter ?? ((ms: number) => ms);

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransient(err) || attempt === retries) {
        throw err;
      }
      const backoff = Math.min(capMs, baseMs * 2 ** attempt);
      await sleep(jitter(backoff));
    }
  }
  // 도달 불가 (loop가 throw 또는 return). 타입 만족용.
  throw lastErr;
}
