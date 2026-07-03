// G1 Funnel Reflection (D-2) — B++ cfg1 funnel champion 가중치 mirror 상수.
//
// SoT = Python cfg1 lock (scripts/screen_shortlist_tier0.py run_bpp_candidates +
//   scripts/tier0_factors.py rank ensemble): cfg1 = trend + size sleeve only
//   (foreign/DART 구조적 neutral, 수기 가중치 폐기 — equal-weight rank combine).
//   본 상수는 그 mirror(회고/제안 로그의 champion 스냅샷)일 뿐, 어떤 코드도 이 값으로
//   production funnel을 구동하지 않는다(자동 적용 영구 금지 — 0047 제안 로그 전용).
// drift-pin: __tests__/funnel-champion-config.test.ts가 shape/값을 고정 — Python cfg1
//   변경 시 여기 + 테스트를 동시 갱신(provenance 유지).
// diagnostic only · 예측 아님(NO-CONFIG-PASSES 불변) · forward-validate.

import type { FunnelConfig } from "@/lib/reflection/funnel-reflection";

/** cfg1 mirror: trend + size 동등 가중(equal-weight rank combine의 스냅샷 표현). */
export const FUNNEL_CHAMPION_CONFIG: Readonly<FunnelConfig> = Object.freeze({
  trend: 0.5,
  size: 0.5,
});

/**
 * factor_ranks 부재(마이그 0050 미적용 / 과거 월 rows) fallback — tier0_score 단일
 * pseudo-factor. 0.5 = bounded nudge(±0.05, clamp[0,1])가 양방향 대칭으로 움직일 수 있는
 * 중립 시작점(실 funnel 가중치 아님 — evidence.exposureSource로 fallback임을 명시).
 */
export const TIER0_SCORE_PSEUDO_FACTOR = "tier0_score";
export const TIER0_SCORE_PSEUDO_CONFIG: Readonly<FunnelConfig> = Object.freeze({
  [TIER0_SCORE_PSEUDO_FACTOR]: 0.5,
});
