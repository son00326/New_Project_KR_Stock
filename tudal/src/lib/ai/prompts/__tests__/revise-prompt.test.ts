// PR3c Task 3 — revise-prompt test (Opus 4.7 max_tokens 8192 B3 fix).

import { describe, expect, it } from 'vitest';
import {
  REVISE_SYSTEM_PROMPT,
  buildReviseUserPrompt,
  REVISE_PROMPT_VERSION,
  REVISE_JSON_EXAMPLE_START,
  REVISE_JSON_EXAMPLE_END,
} from '@/lib/ai/prompts/revise-prompt';

describe('REVISE_SYSTEM_PROMPT (PR3c Task 3, omxy R6 CONVERGED)', () => {
  const sectionLabels = [
    '투자 요약', '기업 개요', '재무 분석', '밸류에이션', '성장성', '리스크', '모멘텀', 'Exit',
  ];
  it.each(sectionLabels)('contains section label substring "%s"', (l) => {
    expect(REVISE_SYSTEM_PROMPT).toContain(l);
  });

  it('placeholder token (0~100 / <number> / <...>) 0 매치', () => {
    expect(REVISE_SYSTEM_PROMPT).not.toMatch(/0~100|<number>|<\.\.\.>/);
  });

  it('```json fence 금지 + plain delimiter 사용', () => {
    expect(REVISE_SYSTEM_PROMPT).not.toMatch(/```json/);
    expect(REVISE_SYSTEM_PROMPT).toContain(REVISE_JSON_EXAMPLE_START);
    expect(REVISE_SYSTEM_PROMPT).toContain(REVISE_JSON_EXAMPLE_END);
  });

  it('REVISE_PROMPT_VERSION is "revise-v1" (cost_log filter UI 분리)', () => {
    expect(REVISE_PROMPT_VERSION).toBe('revise-v1');
  });
});

describe('buildReviseUserPrompt', () => {
  const baseInput = {
    ticker: '196170',
    month: '2026-06',
    originalSections: {
      section_0: { headline: '예시' },
      section_1: { description: '사업' },
    },
    criticFindings: {
      factuality: { verdict: 'WARN', reason: '수치 일부 오류' },
      logic: { verdict: 'FAIL', reason: '논거 비약' },
    },
  };

  it('포함: ticker / month', () => {
    const p = buildReviseUserPrompt(baseInput);
    expect(p).toContain('196170');
    expect(p).toContain('2026-06');
  });

  it('originalSections JSON 직렬화 포함', () => {
    const p = buildReviseUserPrompt(baseInput);
    expect(p).toContain('예시');
    expect(p).toContain('사업');
  });

  it('criticFindings (WARN/FAIL만) 포함', () => {
    const p = buildReviseUserPrompt(baseInput);
    expect(p).toContain('수치 일부 오류');
    expect(p).toContain('논거 비약');
  });

  it('JSON 응답 9 키 명시', () => {
    const p = buildReviseUserPrompt(baseInput);
    for (const k of [
      'section_0', 'section_1', 'section_2', 'section_3', 'section_4',
      'section_5', 'section_6', 'section_7', 'appendix',
    ]) {
      expect(p).toContain(k);
    }
  });
});
