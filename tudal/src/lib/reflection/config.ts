// PR-K Reflection — pure constants. env 미접근(flags.ts만 env 경계).
// SoT: docs/superpowers/specs/2026-06-27-reflection-prk-build.md §1.

/** conviction 0-100 중립 midpoint. favored = conviction >= 50. */
export const FAVORED_CONVICTION_THRESHOLD = 50;

/** 회고 컨텍스트 강점 페르소나 digest 최대 N명. */
export const DEFAULT_CONTEXT_MAX_PERSONAS = 5;

/** 실현 수익률 가격 출처(KRX EOD only — 무비용). */
export const REFLECTION_PRICE_SOURCE = "KRX_EOD" as const;
