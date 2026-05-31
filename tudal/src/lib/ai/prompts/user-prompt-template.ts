// Shared user prompt template (Plan R2 omxy 정정 — 11 persona import 순환 위험 해소).
// Placeholders rendered by render-user-prompt.ts.

export const CORE_USER_PROMPT_TEMPLATE = `다음 종목을 평가해 주세요.

티커: {{TICKER}}

재무 데이터:
{{FINANCIALS}}

지난달 성과 컨텍스트:
{{REFLECTION_CONTEXT}}

응답을 다음 JSON 형식으로 반환하세요:
{
  "vote": "BUY" | "HOLD" | "SELL",
  "one_line": "한 줄 평가 (한국어, 80자 이내)",
  "argument_excerpt": "상세 논거 (한국어, 200자 이내)"
}`;

// PR-C (ADR 2026-05-31): Tier 1 selection 어댑터 전용 — PersonaScore({scores,winning_timeframe,rationale_kr,conviction}) 출력.
// persona_id는 어댑터가 input personaId로 authoritative 주입(LLM echo 미신뢰) → 프롬프트에서 요구 안 함.
// legacy CORE_USER_PROMPT_TEMPLATE({vote})는 track-record deprecate(PR-J)까지 보존.
export const PERSONA_SCORE_USER_PROMPT_TEMPLATE = `다음 종목을 당신의 투자 철학으로 평가해 단기·중기·장기 매력도를 점수화해 주세요.

티커: {{TICKER}}

재무 데이터:
{{FINANCIALS}}

지난달 성과 컨텍스트:
{{REFLECTION_CONTEXT}}

평가 기준:
- scores.short / scores.mid / scores.long: 각 시간대(단기/중기/장기)의 매력도 0~100 (높을수록 매력적).
- winning_timeframe: 당신이 가장 강하게 보는 시간대 ("short" | "mid" | "long" 중 하나).
- conviction: 본 평가에 대한 확신도 0~100.

응답을 다음 JSON 형식으로만 반환하세요 (다른 텍스트·마크다운 없이):
{
  "scores": { "short": 0, "mid": 0, "long": 0 },
  "winning_timeframe": "short",
  "rationale_kr": "한 줄 근거 (한국어, 80자 이내)",
  "conviction": 0
}`;
