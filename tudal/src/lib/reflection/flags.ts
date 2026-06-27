// PR-K Reflection 환경 게이트 (shadow-first). pure 모듈은 env 미접근 — 유일 경계.
//   - REFLECTION_ENABLED: 회고 job + 선정 컨텍스트 주입 게이트. off → job 미실행 + 주입 "" (byte-identical).
//   - REFLECTION_LLM_SUMMARY_ENABLED: (선택) 페르소나 케이스 LLM 요약 게이트. default false = 무비용.
// 기본 회고 job = 무비용(KRX EOD only). LLM 요약만 별 flag + hardcap reservation.

export function isReflectionEnabled(): boolean {
  return process.env.REFLECTION_ENABLED === "true";
}

export function isReflectionLlmSummaryEnabled(): boolean {
  return process.env.REFLECTION_LLM_SUMMARY_ENABLED === "true";
}

// G1 Tier0 Reflection Lab (D33) — funnel 가중치 champion/challenger 제안 게이트.
//   별개 층(PR-K=prompt 주입 회고 ≠ G1=numeric funnel 가중치 회고). off → 제안 생성 0(mutation 0).
export function isFunnelReflectionEnabled(): boolean {
  return process.env.FUNNEL_REFLECTION_ENABLED === "true";
}
