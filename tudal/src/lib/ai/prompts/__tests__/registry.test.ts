import { describe, it, expect } from 'vitest';
import { CORE_11_PERSONAS, type PersonaContract } from '../personas';

const EXPECTED_IDS = [
  'warren-buffett',
  'stanley-druckenmiller',
  'cathie-wood',
  'peter-lynch',
  'charlie-munger',
  'phil-fisher',
  'rakesh-jhunjhunwala',
  'mohnish-pabrai',
  'michael-burry',
  'nassim-taleb',
  'chair',
] as const;

const REQUIRED_PLACEHOLDERS = ['{{TICKER}}', '{{FINANCIALS}}', '{{REFLECTION_CONTEXT}}'];

describe('persona registry (Q4)', () => {
  it('11 personas, no id duplicates', () => {
    const ids = CORE_11_PERSONAS.map((p) => p.id);
    expect(ids).toHaveLength(11);
    expect(new Set(ids).size).toBe(11);
  });

  it('all expected ids present', () => {
    const ids = CORE_11_PERSONAS.map((p) => p.id).sort();
    expect(ids).toEqual([...EXPECTED_IDS].sort());
  });

  it('version is YYYY-MM-DD for all', () => {
    const re = /^\d{4}-\d{2}-\d{2}$/;
    for (const p of CORE_11_PERSONAS) {
      expect(p.version).toMatch(re);
    }
  });

  it('all userPromptTemplate contain required placeholders', () => {
    for (const p of CORE_11_PERSONAS) {
      for (const ph of REQUIRED_PLACEHOLDERS) {
        expect(p.userPromptTemplate).toContain(ph);
      }
    }
  });

  it('systemPrompt and userPromptTemplate non-empty (>= 100 chars)', () => {
    for (const p of CORE_11_PERSONAS) {
      expect(p.systemPrompt.length).toBeGreaterThanOrEqual(100);
      expect(p.userPromptTemplate.length).toBeGreaterThanOrEqual(100);
    }
  });
});
