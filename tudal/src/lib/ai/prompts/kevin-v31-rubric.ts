// tudal/src/lib/ai/prompts/kevin-v31-rubric.ts
//
// Kevin v3.1 quality rubric — Core 11 + Tier 2 sector 196 = 207 persona system prompt 공통 적용 SoT.
// Spec rationale (rationale only, CI 검증 X) = docs/superpowers/specs/2026-05-21-kevin-v31-rubric.md
// omxy debate CONVERGED: 53차 §2 R1~R3 (8 markers + persona individuality wrapper + 200자 = argument cap).
//
// 목적 = "어떤 기업이 선정되어도 Kevin v3.1 reference 정도 quality의 inquiry pattern microstructure가
//        200자 argument에 일관 작동" (사용자 명시 목표).
//
// Persona individuality wrapper 원칙:
//   - rubric = wrapper, NOT replacement
//   - corePrincipleText (persona 고유 평가 원칙) = 선행 보존
//   - KEVIN_V31_RUBRIC_INSTRUCTION = 답변 방식/근거 품질/환각 방지 규칙 후단 적용

/**
 * 4 inquiry axes (Q1~Q4) — Kevin v3.1 narrative spine.
 *
 * 200자 argument는 이 중 1~2 axes에 답한다.
 * Q5 ("살까 말까?")는 response JSON의 `vote` 필드 (BUY/HOLD/SELL)로 강제 표현 — argument에는 axes Q1~Q4.
 */
export const KEVIN_V31_INQUIRY_AXES = [
  "Q1: 이 회사 뭐 하는데? (사업 모델 1문장 + 섹터 일상 비유)",
  "Q2: 왜 지금 주목/조심/관망? (트리거·catalyst·우려)",
  "Q3: 얼마가 적정가인데? (peer multiple/PSR/PER 비교 + 가정 노출)",
  "Q4: 뭐가 틀어지면 안 되나? (invalidation: price/event/deadline)",
] as const;

/**
 * 8 quality markers — KEVIN_V31_RUBRIC_INSTRUCTION 안에 모두 substring 포함.
 *
 * CI invariant test (kevin-v31-rubric.test.ts + persona-rubric-coverage.test.ts)에서:
 *   - 본 rubric instruction 자체에 8 marker substring 포함 검증
 *   - 207 persona system prompt 각각이 rubric instruction을 inject했는지 검증
 *
 * marker substring은 "brittle exact match" 방지 위해 짧은 안정 문자열 선택 (omxy R3 implementation note).
 */
export const KEVIN_V31_QUALITY_MARKERS = {
  M1_inquiry_axes: "Q1:",
  M2_financial_cite: "재무 데이터 직접 인용",
  M3_no_fabrication: "근거 부족",
  M4_peer_comparison: "비교 가능한 회사",
  M5_valuation_trial: "추정 시",
  M6_judgment_exposure: "BUY/HOLD/SELL",
  M7_beginner_friendly: "일상 비유",
  M8_argument_cap: "200자 이내",
} as const;

/**
 * Rubric instruction text — 모든 207 persona system prompt에 inject (applyKevinV31Rubric helper 경유).
 *
 * 8 markers (KEVIN_V31_QUALITY_MARKERS) 모두 substring 포함.
 * 본 instruction은 LLM에게 "답변 방식/근거 품질/환각 방지" 규칙을 제시 — persona 고유 평가 원칙은 wrapper의
 * 앞단(corePrincipleText)에서 별도 제시.
 */
export const KEVIN_V31_RUBRIC_INSTRUCTION = `Kevin v3.1 inquiry pattern (200자 argument 표현 규칙):

다음 4 inquiry axes 중 본 종목에 가장 적합한 1~2개에 답한다:
- Q1: 이 회사 뭐 하는데? (사업 모델 1문장 + 섹터 일상 비유, 예: "카페 본사가 가맹점 매출의 5% 받는 모델")
- Q2: 왜 지금 주목/조심/관망? (트리거·catalyst·우려)
- Q3: 얼마가 적정가인데? (peer multiple/PSR/PER 비교 + 가정 노출, 예: "PSR 31배 ÷ peer median 10배 = 3배 premium, 신약 1상 catalyst로 정당화 추정 시")
- Q4: 뭐가 틀어지면 안 되나? (invalidation: price·event·deadline)

품질 규칙 (8 markers):
1. 재무 데이터 직접 인용 — 제공된 financials에서 숫자만 인용 (예: "PSR 31배 · 매출 YoY +110%"). 자유 fabrication 금지.
2. 가정 명시 — "추정 시" / "가정" 명시 (예: "peer multiple median 10배로 수렴 추정 시 -67% 하향").
3. 근거 부족 fallback — 재무 데이터 부재 시 "근거 부족" 명시. 숫자 환각 금지.
4. 비교 가능한 회사 명시 — peer 1개 이상 명시 (예: "비교 가능한 회사 Halozyme 대비 2.4배 비쌈").
5. 일상 비유 — 영어 약자 (PSR/PER/WACC 등) 첫 등장 시 일상 비유 선행 (예: "PSR = 월세 100만원 건물이 얼마에 팔리는가 배수"). 메타 분석 용어 ("Peer 5축", "Pure-play", "Bridge") 본문 출현 금지.
6. BUY/HOLD/SELL 명시 — 응답 JSON의 vote 필드 + argument에 판단 근거 노출.
7. 영어 약자는 한글 풀이 후 병기 — 첫 등장 시 PSR/PER/WACC/DCF/LTM/NTM/OPM/EV/EBITDA/CAGR/TP 등 일상 비유로 풀어 쓰고, 영어 약자를 괄호 또는 후행 병기.
8. argument_excerpt는 200자 이내 — 위 규칙들을 200자 cap 안에서 압축. 80자 one_line + 200자 argument_excerpt 분리.

페르소나 고유 평가 원칙은 본 rubric의 wrapper로 적용 — 본인의 평가 lens (예: Buffett의 해자, Lynch의 이해 가능성)는 답변에 반드시 선행하고, Kevin rubric은 그 답변의 표현 방식·근거 품질·환각 방지에 적용한다.`;

/**
 * applyKevinV31Rubric(corePrincipleText, sectorContext?) — persona prompt composition helper.
 *
 * @param corePrincipleText persona 고유 평가 원칙 (예: warren-buffett 4 buckets, sector philosophy).
 *                          rubric 위에 **선행 보존** (persona individuality wrapper 원칙).
 * @param sectorContext Tier 2 sector 전용 context (sector philosophy + base/overlay adjustments 등).
 *                      Core 11 sector-agnostic이면 undefined. 합쳐 넘기면 단일 sectorContext 문자열로 처리.
 * @returns composed system prompt fragment — `<corePrincipleText>\n\n[<sectorContext>\n\n]<KEVIN_V31_RUBRIC_INSTRUCTION>`
 *
 * 사용 예 (Core 11, sector-agnostic):
 *   const sp = applyKevinV31Rubric(WARREN_BUFFETT_CORE_PRINCIPLE);
 *
 * 사용 예 (Tier 2, sector-aware):
 *   const sp = applyKevinV31Rubric(baseSlotPrinciple, `${sectorPhilosophy}\n\n섹터-특화 adjustment: ${adjustment}`);
 */
export function applyKevinV31Rubric(
  corePrincipleText: string,
  sectorContext?: string,
): string {
  const sectorBlock = sectorContext !== undefined ? `\n\n${sectorContext}` : "";
  return `${corePrincipleText}${sectorBlock}\n\n${KEVIN_V31_RUBRIC_INSTRUCTION}`;
}
