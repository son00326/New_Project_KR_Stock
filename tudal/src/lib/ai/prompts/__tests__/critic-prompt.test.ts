// PR3c Task 1 — critic-prompt 6축 verdict + plain delimiter + Kevin v3.1 markers test.
// SoT = docs/superpowers/plans/2026-05-24-pr3c-orchestration-sector-reference.md (v6, omxy R6 CONVERGED)
// PR3b full-report-prompt.test.ts 패턴 follow.

import { describe, expect, it } from 'vitest';
import {
  CRITIC_SYSTEM_PROMPT,
  buildCriticUserPrompt,
  CRITIC_PROMPT_VERSION,
  CRITIC_JSON_EXAMPLE_START,
  CRITIC_JSON_EXAMPLE_END,
} from '@/lib/ai/prompts/critic-prompt';

describe('CRITIC_SYSTEM_PROMPT — 6축 verdict + Kevin v3.1 markers (PR3c v6 omxy R6 CONVERGED)', () => {
  // 6축 label substring (factuality / logic / completeness / structure / bias / reader_level)
  const labels = ['팩트', '논리', '누락', '구조', '편향', '독자 수준'];
  it.each(labels)('contains 6축 label substring "%s"', (l) => {
    expect(CRITIC_SYSTEM_PROMPT).toContain(l);
  });

  // 6축 english key substring
  const keys = ['factuality', 'logic', 'completeness', 'structure', 'bias', 'reader_level'];
  it.each(keys)('contains 6축 english key "%s"', (k) => {
    expect(CRITIC_SYSTEM_PROMPT).toContain(k);
  });

  it('Kevin v3.1 marker hint — M1~M8 (M1·M8 표기) + 200자 cap 박제', () => {
    expect(CRITIC_SYSTEM_PROMPT).toContain('Kevin v3.1');
    expect(CRITIC_SYSTEM_PROMPT).toContain('M1');
    expect(CRITIC_SYSTEM_PROMPT).toContain('M8');
    expect(CRITIC_SYSTEM_PROMPT).toContain('200자 cap');
  });

  // B7 fix (omxy R2): reason 한국어 500자 이내 명시
  it('B7 fix — reason 한국어 500자 이내 명시', () => {
    expect(CRITIC_SYSTEM_PROMPT).toMatch(/500자/);
  });

  // PR3b B9/B16 패턴: placeholder token 0 매치
  it('placeholder token (0~100 / <number> / <...>) 0 매치', () => {
    expect(CRITIC_SYSTEM_PROMPT).not.toMatch(/0~100|<number>|<\.\.\.>/);
  });

  // PR3b B10/B16 패턴: ```json fence 금지, plain delimiter 사용
  it('```json fence 금지, plain delimiter 사용', () => {
    expect(CRITIC_SYSTEM_PROMPT).not.toMatch(/```json/);
    expect(CRITIC_SYSTEM_PROMPT).toContain(CRITIC_JSON_EXAMPLE_START);
    expect(CRITIC_SYSTEM_PROMPT).toContain(CRITIC_JSON_EXAMPLE_END);
  });

  it('plain delimiter 안 JSON example이 valid JSON parse', () => {
    const startIdx =
      CRITIC_SYSTEM_PROMPT.indexOf(CRITIC_JSON_EXAMPLE_START) + CRITIC_JSON_EXAMPLE_START.length;
    const endIdx = CRITIC_SYSTEM_PROMPT.indexOf(CRITIC_JSON_EXAMPLE_END);
    const jsonBlock = CRITIC_SYSTEM_PROMPT.slice(startIdx, endIdx).trim();
    expect(() => JSON.parse(jsonBlock)).not.toThrow();
    const parsed = JSON.parse(jsonBlock) as Record<string, { verdict: string; reason: string }>;
    for (const k of keys) {
      expect(parsed[k]).toBeDefined();
      expect(parsed[k].verdict).toMatch(/^(PASS|WARN|FAIL)$/);
      expect(parsed[k].reason).toBeTypeOf('string');
    }
  });

  it('CRITIC_PROMPT_VERSION is "critic-v1" (omxy R2 (d) prompt_version 분리)', () => {
    expect(CRITIC_PROMPT_VERSION).toBe('critic-v1');
  });
});

describe('buildCriticUserPrompt — 6 fields', () => {
  const baseInput = {
    ticker: '196170',
    month: '2026-06',
    sectionsSummary: 'Section 0~7 + Appendix 요약 본문 (writer draft)',
    sectorContext: '바이오 sector — 임상 단계 NPV 모델',
    kevinV31Markers: 'M2 financial cite + M4 peer 3+',
    consensusBadge: '🟢' as const,
  };

  it('포함: ticker / month / sectionsSummary', () => {
    const p = buildCriticUserPrompt(baseInput);
    expect(p).toContain('196170');
    expect(p).toContain('2026-06');
    expect(p).toContain('Section 0~7');
  });

  it('포함: sectorContext / kevinV31Markers / consensusBadge', () => {
    const p = buildCriticUserPrompt(baseInput);
    expect(p).toContain('바이오');
    expect(p).toContain('M2');
    expect(p).toContain('🟢');
  });

  it('JSON 응답 6축 key 명시', () => {
    const p = buildCriticUserPrompt(baseInput);
    for (const k of [
      'factuality',
      'logic',
      'completeness',
      'structure',
      'bias',
      'reader_level',
    ]) {
      expect(p).toContain(k);
    }
  });
});
