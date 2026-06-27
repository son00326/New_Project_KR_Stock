// G3 Risk 3자 토론 게이트 (shadow-first, D33). pure 모듈은 env 미접근 — 유일 경계.
//   off(default) → 위험 재판정 미실행·AI 0·비용 0·mutation 0 (Accept 비차단·byte-identical).
export function isRiskDebateEnabled(): boolean {
  return process.env.RISK_DEBATE_ENABLED === "true";
}
