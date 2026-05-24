// PR3c — 3-step orchestration critic (Haiku 4.5) prompt module.
// SoT = docs/superpowers/plans/2026-05-24-pr3c-orchestration-sector-reference.md (v6, omxy R6 CONVERGED, 누적 21 BLOCKERS)
//
// 풀 리포트 writer draft에 대한 6축 적대적 검증:
//   1. 팩트 (factuality)         — 수치/날짜/출처 일관성
//   2. 논리 (logic)              — 논거 모순/인과 비약
//   3. 누락 (completeness)       — 필수 섹션·peer 비교·시나리오·리스크 누락
//   4. 구조 (structure)          — Section 0~7 + Appendix 프레임워크 준수
//   5. 편향 (bias)               — 과도한 낙관/비관, 동일 논거 반복
//   6. 독자 수준 (reader_level)  — 비유·용어 풀이·"이 섹션에서 알 수 있는 것"
//
// PR3b full-report-prompt.ts 패턴 (B9/B10/B16 fix) follow:
//   - placeholder token (0~100/<number>/<...>) 0 매치
//   - ```json fence 0 매치, plain delimiter <<<CRITIC_JSON_EXAMPLE_START>>>...<<<CRITIC_JSON_EXAMPLE_END>>>
//   - example JSON valid parse
// omxy R1 B7 fix: reason 한국어 500자 이내 (zod max 500 + DB CHECK 500 양쪽).
// omxy R2 (d) fix: prompt_version 분리 — CRITIC_PROMPT_VERSION = 'critic-v1' (cost_log filter UI).

export const CRITIC_PROMPT_VERSION = 'critic-v1';

export const CRITIC_JSON_EXAMPLE_START = '<<<CRITIC_JSON_EXAMPLE_START>>>';
export const CRITIC_JSON_EXAMPLE_END = '<<<CRITIC_JSON_EXAMPLE_END>>>';

export const CRITIC_SYSTEM_PROMPT = `당신은 한국 주식 풀 리포트의 적대적 검증자입니다. writer draft를 6축에서 평가하고 JSON 1회 출력합니다.

6축 (한국어 라벨 — 영문 key):
1. 팩트 (factuality)         — 수치 / 날짜 / 출처 일관성
2. 논리 (logic)              — 논거 모순 / 인과 비약
3. 누락 (completeness)       — 필수 섹션 / peer 비교 / 시나리오 / 리스크 누락
4. 구조 (structure)          — Section 0~7 + Appendix 프레임워크 준수
5. 편향 (bias)               — 과도한 낙관 / 비관 / 동일 논거 반복
6. 독자 수준 (reader_level)  — 비유 / 용어 풀이 / "이 섹션에서 알 수 있는 것" 가이드

Kevin v3.1 M1~M8 markers (참고):
- M1 4 axes (안정성·수익성·성장성·밸류)
- M2 financial cite (재무 직접 인용)
- M3 no-fabrication (근거 부족 명시)
- M4 peer 3+ (동종 비교 3사)
- M5 valuation trial (PER/PBR/EV-EBITDA 가정 노출)
- M6 BUY / HOLD / SELL 명시
- M7 일상 비유
- M8 200자 cap (페르소나 발언)

각 축에 대해 verdict (PASS / WARN / FAIL) + reason (한국어 500자 이내) 출력.

응답은 JSON object 단일 응답 — 마크다운 fence 또는 본문 설명 금지. 응답은 { 문자로 시작하고 } 문자로 끝나는 JSON object만. 모든 문자열은 ASCII straight quote 사용.

응답 schema (실제 reason은 사례별 채워서 응답):

${CRITIC_JSON_EXAMPLE_START}
{
  "factuality": {"verdict": "PASS", "reason": "수치와 날짜가 일관됩니다"},
  "logic": {"verdict": "WARN", "reason": "성장 동인 2개가 부분적으로 중복됩니다"},
  "completeness": {"verdict": "PASS", "reason": "peer 비교 3사가 포함되었습니다"},
  "structure": {"verdict": "PASS", "reason": "9개 키가 모두 포함되었습니다"},
  "bias": {"verdict": "PASS", "reason": "낙관 / 비관이 균형적입니다"},
  "reader_level": {"verdict": "WARN", "reason": "일상 비유가 일부 섹션에서 부족합니다"}
}
${CRITIC_JSON_EXAMPLE_END}
`;

export interface CriticUserPromptInput {
  ticker: string;
  month: string;            // 'YYYY-MM'
  sectionsSummary: string;  // writer draft Section 0~7 + Appendix 요약 본문 (직렬화 JSON 또는 텍스트)
  sectorContext: string;    // SECTOR_PHILOSOPHIES + sector reference
  kevinV31Markers: string;  // M1~M8 marker hint (요약 또는 selected list)
  consensusBadge: '🟢' | '🔵' | '🟣' | '🟡';
}

export function buildCriticUserPrompt(input: CriticUserPromptInput): string {
  return `[종목] ${input.ticker}
[월간] ${input.month}
[합의 배지] ${input.consensusBadge}

[sectorContext]
${input.sectorContext}

[Kevin v3.1 markers]
${input.kevinV31Markers}

[writer draft sectionsSummary]
${input.sectionsSummary}

위 입력을 6축에서 적대적으로 검증하세요. 응답은 JSON object 단일 응답 — 6 키 (factuality, logic, completeness, structure, bias, reader_level) 모두 포함 필수. 각 키 값은 {"verdict": "PASS"|"WARN"|"FAIL", "reason": "한국어 500자 이내 1~2문장"} 형식. 마크다운 fence 또는 본문 설명 추가 금지.`;
}
