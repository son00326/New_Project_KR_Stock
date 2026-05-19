import { describe, it, expect } from 'vitest';
import { section8Schema, section8BScopeExample, section8HappyExample } from '../section-8-schema';

describe('section-8-schema (Q3)', () => {
  it('happy path (Part A 14 + B 5 + C + D 11) parses', () => {
    const parsed = section8Schema.parse(section8HappyExample);
    expect(parsed.partA).toHaveLength(14);
    expect(parsed.partD).toHaveLength(11);
  });

  it('B-scope variant (Part A = []) parses', () => {
    const parsed = section8Schema.parse(section8BScopeExample);
    expect(parsed.partA).toEqual([]);
    expect(parsed.partD).toHaveLength(11);
  });

  it('round-trip JSON stringify/parse preserves shape', () => {
    const original = section8BScopeExample;
    const stringified = JSON.stringify(original);
    const reparsed = section8Schema.parse(JSON.parse(stringified));
    expect(reparsed).toEqual(original);
  });
});
