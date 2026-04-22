import { describe, it, expect } from 'vitest';
import { maskKey, maskAccount } from '../mask';

describe('maskKey', () => {
  it('masks long key with 2 prefix + 4 suffix', () => {
    expect(maskKey('PS1234567890abcdef1234567890abcdef12', 2, 4)).toBe(
      'PS**···ef12',
    );
  });

  it('returns fallback for short input', () => {
    expect(maskKey('abc', 2, 4)).toBe('****');
  });

  it('handles empty string safely', () => {
    expect(maskKey('', 2, 4)).toBe('****');
  });
});

describe('maskAccount', () => {
  it('masks Korean brokerage account format (8-2)', () => {
    expect(maskAccount('12345678-01')).toBe('12345678-**');
  });

  it('returns fallback for unrecognized format', () => {
    expect(maskAccount('1234')).toBe('****');
  });
});
