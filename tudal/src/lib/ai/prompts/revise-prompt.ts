// PR3c — 3-step orchestration revise (Opus 4.7) prompt module.
// SoT = plan v6, omxy R6 CONVERGED. 누적 21 BLOCKERS.
//
// critic 6축에서 WARN/FAIL flagged 시 호출. writer draft sections + critic findings → revised sections.
// max_tokens 8192 (B3 fix omxy R1) — full rewrite tolerate, truncation 차단.
// REVISE input 8000 보수화 (B11 fix omxy R2) — originalSections JSON inject 시 token 여유.

export const REVISE_PROMPT_VERSION = 'revise-v1';

export const REVISE_JSON_EXAMPLE_START = '<<<REVISE_JSON_EXAMPLE_START>>>';
export const REVISE_JSON_EXAMPLE_END = '<<<REVISE_JSON_EXAMPLE_END>>>';

export const REVISE_SYSTEM_PROMPT = `당신은 한국 주식 풀 리포트의 재작성자입니다. writer draft와 critic findings를 입력으로 받아, WARN / FAIL flagged 섹션을 수정한 최종 보고서를 생성합니다.

원본 섹션 구성 (PR3b writer 동일):
- Section 0: 투자 요약 (headline / thesis / conviction / 합의 mini / 가격 밴드)
- Section 1: 기업 개요 (사업 description / 사업부 segments / 핵심 사실)
- Section 2: 재무 분석 (매출 추세 / 마진 / 재무 건전성)
- Section 3: 밸류에이션 (peer multiples / 비교 가능한 회사)
- Section 4: 성장성 (성장 drivers / TAM)
- Section 5: 리스크 (severity high/medium/low)
- Section 6: 모멘텀 (5-Signal + 3축: trend/momentum/volatility)
- Section 7: Exit 조건 (triggers / alternatives)
- Appendix: 기술적 지표 + 데이터 출처

수정 원칙:
- critic이 PASS로 평가한 섹션은 가능하면 그대로 유지. 변경 최소화.
- WARN / FAIL flagged 축에 대한 critic reason을 반영. reason의 결함을 직접 해소.
- 9개 키 (section_0~7 + appendix) 모두 반환 필수. 누락 금지.
- 모든 문자열 값은 ASCII straight quote 사용. typographic / smart quote 금지.
- 응답은 JSON object 단일 응답 — 마크다운 fence 또는 본문 설명 금지. { 시작 } 끝.

응답 schema 예시 (실제 값으로 대체):

${REVISE_JSON_EXAMPLE_START}
{
  "section_0": {
    "headline": "수정된 헤드라인",
    "thesis": ["근거 1", "근거 2"],
    "conviction": 72,
    "committeeMini": {
      "core": {"approve": 7, "reject": 2, "abstain": 2},
      "sector": {"approve": 9, "reject": 3, "abstain": 2}
    },
    "priceBands": {"bear": "450,000원", "base": "620,000원", "bull": "820,000원"}
  },
  "section_1": {
    "description": "사업 설명",
    "segments": [{"name": "사업부", "share": "55%"}],
    "keyFacts": [{"label": "라벨", "value": "값"}]
  },
  "section_2": {
    "summary": "재무 요약",
    "revenue": [{"fy": "2025E", "value": "1800억", "yoy": "+38%"}],
    "margins": {"operating": "12%", "net": "8%"},
    "balance": {"debtRatio": "35%", "cash": "2400억"}
  },
  "section_3": {
    "summary": "밸류에이션 요약",
    "multiples": [{"metric": "PSR", "value": "18배", "peer": "12배 (peer)"}]
  },
  "section_4": {
    "summary": "성장성 요약",
    "drivers": ["성장 동인 1"],
    "tam": "40조"
  },
  "section_5": {
    "summary": "리스크 요약",
    "risks": [{"title": "리스크 제목", "severity": "high", "detail": "상세"}]
  },
  "section_6": {
    "summary": "모멘텀 요약",
    "signals": [{"name": "MACD", "state": "on", "note": "수치"}],
    "axis": {"trend": 72, "momentum": 65, "volatility": 48},
    "divergencePct": 3.4
  },
  "section_7": {
    "summary": "Exit 조건 요약",
    "triggers": ["트리거 1"],
    "alternatives": [{"label": "대안", "detail": "상세"}]
  },
  "appendix": {
    "technicals": [{"name": "RSI", "value": "58"}],
    "dataSources": ["DART", "pykrx"]
  }
}
${REVISE_JSON_EXAMPLE_END}
`;

export interface ReviseUserPromptInput {
  ticker: string;
  month: string;
  originalSections: Record<string, unknown>;       // writer draft sections (Section 0~7 + appendix)
  criticFindings: Record<string, { verdict: string; reason: string }>;  // critic verdict (WARN/FAIL만 inject)
}

export function buildReviseUserPrompt(input: ReviseUserPromptInput): string {
  // WARN/FAIL findings만 inject (PASS는 제외 — reason 의미 없음 + token 절약)
  const flaggedFindings = Object.entries(input.criticFindings)
    .filter(([, v]) => v.verdict === 'WARN' || v.verdict === 'FAIL')
    .reduce<Record<string, { verdict: string; reason: string }>>((acc, [k, v]) => {
      acc[k] = v;
      return acc;
    }, {});

  return `[종목] ${input.ticker}
[월간] ${input.month}

[원본 writer draft sections (Section 0~7 + appendix)]
${JSON.stringify(input.originalSections, null, 2)}

[critic 6축 findings (WARN/FAIL flagged 만 — PASS 제외)]
${JSON.stringify(flaggedFindings, null, 2)}

위 입력을 사용해 WARN / FAIL 축의 결함을 해소한 수정 보고서를 생성하세요. 9개 키 (section_0, section_1, section_2, section_3, section_4, section_5, section_6, section_7, appendix) 모두 포함 필수. JSON object 단일 응답 — 마크다운 fence / 본문 설명 추가 금지.`;
}
