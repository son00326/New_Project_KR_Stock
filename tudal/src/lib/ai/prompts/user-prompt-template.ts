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
