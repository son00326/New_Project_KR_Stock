import { describe, expect, it } from 'vitest';
import {
  FULL_REPORT_SYSTEM_PROMPT,
  buildFullReportUserPrompt,
  FULL_REPORT_PROMPT_VERSION,
  FULL_REPORT_JSON_EXAMPLE_START,
  FULL_REPORT_JSON_EXAMPLE_END,
} from '@/lib/ai/prompts/full-report-prompt';

describe('FULL_REPORT_SYSTEM_PROMPT — Section 0~7 라벨 (page.tsx + zod schema 정합)', () => {
  // P1 #5 fix: page.tsx SECTION_LIST 라벨 baseline
  const labels = [
    '투자 요약',          // Section 0
    '기업 개요',          // Section 1
    '재무 분석',          // Section 2
    '밸류에이션',         // Section 3
    '성장성',             // Section 4
    '리스크',             // Section 5
    '모멘텀',             // Section 6
    'Exit',               // Section 7
  ];
  it.each(labels)('contains label substring "%s"', (l) => {
    expect(FULL_REPORT_SYSTEM_PROMPT).toContain(l);
  });

  it('Kevin v3.1 quality markers — 근거 부족 / 비교 가능한 회사 / 일상 비유 / JSON', () => {
    for (const m of ['근거 부족', '비교 가능한 회사', '일상 비유', 'JSON']) {
      expect(FULL_REPORT_SYSTEM_PROMPT).toContain(m);
    }
  });

  // B9 fix: '0~100' 토큰 0 매치 (test와 implementation self-fail 방지)
  it('B9 fix — placeholder token (0~100 / <number> / <...>) 0 매치', () => {
    expect(FULL_REPORT_SYSTEM_PROMPT).not.toMatch(/0~100|<number>|<\.\.\.>/);
  });

  // B10 fix: 마크다운 fence (```json) 금지, plain delimiter 사용
  it('B10 fix — markdown fence 금지, plain delimiter 사용', () => {
    expect(FULL_REPORT_SYSTEM_PROMPT).not.toMatch(/```json/);
    expect(FULL_REPORT_SYSTEM_PROMPT).toContain(FULL_REPORT_JSON_EXAMPLE_START);
    expect(FULL_REPORT_SYSTEM_PROMPT).toContain(FULL_REPORT_JSON_EXAMPLE_END);
  });

  // B10 fix: plain delimiter 안 JSON example이 valid JSON
  it('B10 fix — plain delimiter 안 JSON example이 valid JSON parse', () => {
    const startIdx = FULL_REPORT_SYSTEM_PROMPT.indexOf(FULL_REPORT_JSON_EXAMPLE_START) + FULL_REPORT_JSON_EXAMPLE_START.length;
    const endIdx = FULL_REPORT_SYSTEM_PROMPT.indexOf(FULL_REPORT_JSON_EXAMPLE_END);
    const jsonBlock = FULL_REPORT_SYSTEM_PROMPT.slice(startIdx, endIdx).trim();
    expect(() => JSON.parse(jsonBlock)).not.toThrow();
  });

  it('FULL_REPORT_PROMPT_VERSION is "v1"', () => {
    expect(FULL_REPORT_PROMPT_VERSION).toBe('v1');
  });
});

describe('buildFullReportUserPrompt', () => {
  const baseInput = {
    ticker: '196170',
    name: '알테오젠',
    sector: '바이오',
    month: '2026-06',
    tier1Verdict: 'BUY' as const,
    consensusBadge: '🟢' as const,
    financialsSummary: 'OPM 흑전, 부채비율 35%',
    technicalsSummary: '60일선 위, 거래량 평균 ×1.4',
    macroSummary: '금리 동결, 원화 약세',
    sectorReference: '바이오 reference 본문 (Alteogen)',
  };

  it('포함: ticker / name / sector / month', () => {
    const p = buildFullReportUserPrompt(baseInput);
    expect(p).toContain('196170');
    expect(p).toContain('알테오젠');
    expect(p).toContain('바이오');
    expect(p).toContain('2026-06');
  });

  it('포함: Tier 1 verdict + consensus badge', () => {
    const p = buildFullReportUserPrompt(baseInput);
    expect(p).toContain('BUY');
    expect(p).toContain('🟢');
  });

  it('포함: financials / technicals / macro / sectorReference', () => {
    const p = buildFullReportUserPrompt(baseInput);
    expect(p).toContain('OPM 흑전');
    expect(p).toContain('60일선 위');
    expect(p).toContain('금리 동결');
    expect(p).toContain('Alteogen');
  });

  it('JSON 응답 schema 강제 — section_0..7 + appendix 9 키 모두 명시', () => {
    const p = buildFullReportUserPrompt(baseInput);
    for (const key of ['section_0', 'section_1', 'section_2', 'section_3', 'section_4', 'section_5', 'section_6', 'section_7', 'appendix']) {
      expect(p).toContain(key);
    }
  });
});
