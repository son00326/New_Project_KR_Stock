// PR3b — writer Section 0~7 + Appendix 풀 리포트 생성용 prompt module.
// SoT = docs/superpowers/plans/2026-05-23-pr3b-writer-section-0-7.md (omxy R1~R5 CONVERGED, 누적 24 BLOCKERS catch & fix).

export const FULL_REPORT_PROMPT_VERSION = 'v1';

// B10 fix: markdown fence 대신 plain delimiter (LLM이 fence로 응답할 확률 감소).
export const FULL_REPORT_JSON_EXAMPLE_START = '<<<JSON_EXAMPLE_START>>>';
export const FULL_REPORT_JSON_EXAMPLE_END = '<<<JSON_EXAMPLE_END>>>';

// B9 fix: '0~100' 토큰 제거 — "0과 100 사이" 표현 + valid JSON example에 실제 number value로 명시.
// B16 fix: prompt body에 literal markdown fence 토큰 0 (테스트 self-fail 차단).
// P1 #5: page.tsx SECTION_LIST 라벨 baseline (ReportFramework.md 라벨은 future-state).
// Kevin v3.1: M2 재무 데이터 직접 인용 / M3 근거 부족 / M4 비교 가능한 회사 / M7 일상 비유.
export const FULL_REPORT_SYSTEM_PROMPT = `당신은 한국 주식 풀 리포트 작성자입니다. 비전문가도 이해할 수 있는 일상 비유와 정확한 재무 인용으로 8개 섹션 + Appendix를 작성합니다.

섹션 구성:
- Section 0: 투자 요약 (headline / thesis / conviction 점수 / 합의 mini / 가격 밴드)
- Section 1: 기업 개요 (사업 description / 사업부 segments / 핵심 사실)
- Section 2: 재무 분석 (매출 추세 / 마진 / 재무 건전성)
- Section 3: 밸류에이션 (peer multiples / 비교 가능한 회사)
- Section 4: 성장성 (성장 drivers / TAM)
- Section 5: 리스크 (severity high/medium/low)
- Section 6: 모멘텀 (5-Signal + 3축: trend/momentum/volatility)
- Section 7: Exit 조건 (triggers / alternatives)
- Appendix: 기술적 지표 + 데이터 출처

품질 원칙:
- 재무 데이터는 입력으로 주어진 financials/technicals/macro에서만 인용합니다. 추측 금지. 데이터 부재 시 "근거 부족"이라고 명시합니다.
- 밸류에이션에는 비교 가능한 회사(peer) 1~3개를 반드시 포함합니다.
- 전문용어 첫 등장 시 일상 비유 또는 한글 풀이를 동반합니다.
- 모든 결과는 JSON object 단일 응답으로 반환합니다. 마크다운 fence(코드블록) 또는 본문 설명 추가 금지. 응답은 { 문자로 시작하고 } 문자로 끝나는 JSON object만.

응답 schema (반드시 모든 키 포함, 아래 예시는 valid JSON — 실제 값으로 대체. severity는 "high"|"medium"|"low" 중 하나, state는 "on"|"watch"|"off" 중 하나, conviction과 axis 각 필드는 0과 100 사이 number, divergencePct는 음수 허용 number):

${FULL_REPORT_JSON_EXAMPLE_START}
{
  "section_0": {
    "headline": "예시 헤드라인",
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
    "segments": [{"name": "사업부명", "share": "55%"}],
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
    "alternatives": [{"label": "대안 라벨", "detail": "대안 상세"}]
  },
  "appendix": {
    "technicals": [{"name": "RSI", "value": "58"}],
    "dataSources": ["DART", "pykrx"]
  }
}
${FULL_REPORT_JSON_EXAMPLE_END}
`;

export interface FullReportUserPromptInput {
  ticker: string;
  name: string;
  sector: string;
  month: string;
  tier1Verdict: 'BUY' | 'HOLD' | 'SELL';
  consensusBadge: '🟢' | '🔵' | '🟣' | '🟡';
  financialsSummary: string;
  technicalsSummary: string;
  macroSummary: string;
  sectorReference: string;
}

export function buildFullReportUserPrompt(input: FullReportUserPromptInput): string {
  return `[종목] ${input.name} (${input.ticker}) — ${input.sector} 섹터
[월간] ${input.month}
[Tier 1 합의 판정] ${input.tier1Verdict}  [합의 배지] ${input.consensusBadge}

[financials]
${input.financialsSummary}

[technicals]
${input.technicalsSummary}

[macro]
${input.macroSummary}

[sectorReference]
${input.sectorReference}

위 입력 데이터만 사용해서 응답 schema에 정확히 일치하는 JSON object를 반환하세요. 키 누락 / 타입 mismatch 금지. 9개 키 모두 포함 필수: section_0, section_1, section_2, section_3, section_4, section_5, section_6, section_7, appendix. 응답은 JSON object만 — 본문 설명 / 마크다운 fence 추가 금지.`;
}
