// W1a (D5) — R2 반박 라운드 user prompt 템플릿 + peer/own 렌더 (D26 Q4 멀티라운드 반박).
// 출력 스키마 = R1과 동일 PersonaScore JSON (parsePersonaScore 재사용 — all-or-nothing per ticker).
// slot 모델명/프로바이더는 프롬프트에 비노출 (페르소나 정체성만 — 에코챔버/권위 편향 방지).
import type { PersonaScore } from '@/lib/screening/tier1-schema';

export const DEBATE_R2_USER_PROMPT_TEMPLATE = `다음 종목에 대한 1차 평가 후 위원회 반박 라운드입니다.

티커: {{TICKER}}

재무 데이터:
{{FINANCIALS}}

지난달 성과 컨텍스트:
{{REFLECTION_CONTEXT}}

당신의 1차 평가:
{{OWN_PRIOR}}

동료 위원 1차 평가:
{{PEER_ARGUMENTS}}

지시: 동료 평가의 논거를 검토해 동의하지 않는 부분은 반박하고, 설득력 있는 반론이 있으면 본인 점수를 수정하세요. 동조 압력이 아닌 근거 기반 수정만 하세요. 다수 의견이라는 이유만으로 점수를 바꾸지 마세요.

응답을 다음 JSON 형식으로만 반환하세요 (다른 텍스트·마크다운 없이):
{
  "scores": { "short": 0, "mid": 0, "long": 0 },
  "winning_timeframe": "short",
  "rationale_kr": "한 줄 근거 (한국어, 80자 이내 — 반박/수정 사유 반영)",
  "conviction": 0
}`;

/** 본인 R1 평가 1-2줄 요약. */
export function renderOwnPrior(own: PersonaScore): string {
  return [
    `단기 ${own.scores.short} / 중기 ${own.scores.mid} / 장기 ${own.scores.long} (주력 ${own.winning_timeframe}, 확신 ${own.conviction})`,
    `근거: ${own.rationale_kr}`,
  ].join('\n');
}

/** 타 위원 R1 평가 — 위원당 1줄. label = 페르소나 표시명 (slot 모델 비노출). */
export function renderPeerArguments(
  peers: ReadonlyArray<{ label: string; score: PersonaScore }>,
): string {
  return peers
    .map(
      ({ label, score }) =>
        `- ${label}: 단${score.scores.short}/중${score.scores.mid}/장${score.scores.long}, 확신${score.conviction} — ${score.rationale_kr}`,
    )
    .join('\n');
}
