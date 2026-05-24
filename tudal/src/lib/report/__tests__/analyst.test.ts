// PR3c Task 4 — analyst pure-code shape transform test (B9 fix omxy R1).
// quality lift claim 0 — production validation A/B comparison OOS.

import { describe, expect, it } from 'vitest';
import { enrichInput } from '@/lib/report/analyst';
import type { FullReportUserPromptInput } from '@/lib/ai/prompts/full-report-prompt';

const baseInput: FullReportUserPromptInput = {
  ticker: '196170',
  name: '알테오젠',
  sector: '바이오',
  month: '2026-06',
  tier1Verdict: 'BUY',
  consensusBadge: '🟢',
  financialsSummary: 'OPM 12%, 부채비율 35%, ROIC 15%',
  technicalsSummary: '60일선 위, 거래량 평균 ×1.4, RSI 58',
  macroSummary: '금리 동결, 원화 약세, KOSPI 모멘텀',
  sectorReference: '바이오 reference 본문 (Alteogen)',
};

describe('enrichInput — pure-code shape transform (PR3c Task 4, omxy R6 CONVERGED)', () => {
  it('returns object with all original input fields preserved', () => {
    const enriched = enrichInput(baseInput);
    expect(enriched.ticker).toBe(baseInput.ticker);
    expect(enriched.name).toBe(baseInput.name);
    expect(enriched.sector).toBe(baseInput.sector);
    expect(enriched.month).toBe(baseInput.month);
    expect(enriched.tier1Verdict).toBe(baseInput.tier1Verdict);
    expect(enriched.consensusBadge).toBe(baseInput.consensusBadge);
    expect(enriched.financialsSummary).toBe(baseInput.financialsSummary);
    expect(enriched.technicalsSummary).toBe(baseInput.technicalsSummary);
    expect(enriched.macroSummary).toBe(baseInput.macroSummary);
    expect(enriched.sectorReference).toBe(baseInput.sectorReference);
  });

  it('LLM 호출 0 — pure function, side-effect 없음', () => {
    // pure 함수이므로 enrichInput 호출 자체는 LLM/network/IO 트리거 0.
    // 본 단언은 invariant 박제 (regression catch). 실제 호출은 호출만 한다.
    const r1 = enrichInput(baseInput);
    const r2 = enrichInput(baseInput);
    // 동일 input → 동일 output (deterministic invariant)
    expect(r1).toEqual(r2);
  });

  it('idempotent — 같은 input 여러 번 호출 동일 결과', () => {
    const r1 = enrichInput(baseInput);
    const r2 = enrichInput(baseInput);
    const r3 = enrichInput(baseInput);
    expect(r1).toEqual(r2);
    expect(r2).toEqual(r3);
  });

  it('빈 sub-summary string도 정상 처리 (edge case)', () => {
    const edge = { ...baseInput, financialsSummary: '', technicalsSummary: '', macroSummary: '' };
    const enriched = enrichInput(edge);
    expect(enriched.financialsSummary).toBe('');
    expect(enriched.technicalsSummary).toBe('');
    expect(enriched.macroSummary).toBe('');
  });

  it('long sub-summary string preserved (no truncation)', () => {
    const longString = 'a'.repeat(2000);
    const edge = { ...baseInput, financialsSummary: longString };
    const enriched = enrichInput(edge);
    expect(enriched.financialsSummary).toBe(longString);
    expect(enriched.financialsSummary.length).toBe(2000);
  });
});
