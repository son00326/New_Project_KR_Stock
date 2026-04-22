import { describe, it, expect } from 'vitest';
import {
  validateKisAppKey,
  validateKisAppSecret,
  validateKisAccountNo,
  validateBinanceApiKey,
  validateBinanceApiSecret,
  validateLabel,
  cleanInput,
  CredentialFormatError,
} from '../validation';

describe('validateKisAppKey', () => {
  it('accepts 36 alphanumeric chars', () => {
    expect(() => validateKisAppKey('A'.repeat(36))).not.toThrow();
  });

  it('rejects 35 chars (too short)', () => {
    expect(() => validateKisAppKey('A'.repeat(35))).toThrow(
      CredentialFormatError,
    );
  });

  it('rejects 37 chars (too long)', () => {
    expect(() => validateKisAppKey('A'.repeat(37))).toThrow(
      CredentialFormatError,
    );
  });

  it('rejects non-alphanumeric chars', () => {
    expect(() => validateKisAppKey('A'.repeat(35) + '!')).toThrow(
      CredentialFormatError,
    );
  });
});

describe('validateKisAppSecret', () => {
  it('accepts 180 alphanumeric chars', () => {
    expect(() => validateKisAppSecret('B'.repeat(180))).not.toThrow();
  });

  it('rejects wrong length', () => {
    expect(() => validateKisAppSecret('B'.repeat(179))).toThrow(
      CredentialFormatError,
    );
  });
});

describe('validateKisAccountNo', () => {
  it('accepts 8-2 format (12345678-01)', () => {
    expect(() => validateKisAccountNo('12345678-01')).not.toThrow();
  });

  it('rejects other formats (4-8)', () => {
    expect(() => validateKisAccountNo('1234-56789012')).toThrow(
      CredentialFormatError,
    );
  });
});

describe('validateBinanceApiKey', () => {
  it('accepts 64 alphanumeric chars', () => {
    expect(() => validateBinanceApiKey('a'.repeat(64))).not.toThrow();
  });

  it('rejects 63 chars', () => {
    expect(() => validateBinanceApiKey('a'.repeat(63))).toThrow(
      CredentialFormatError,
    );
  });

  it('rejects 65 chars', () => {
    expect(() => validateBinanceApiKey('a'.repeat(65))).toThrow(
      CredentialFormatError,
    );
  });
});

describe('validateBinanceApiSecret', () => {
  it('accepts 64 alphanumeric chars', () => {
    expect(() => validateBinanceApiSecret('b'.repeat(64))).not.toThrow();
  });
});

describe('validateLabel', () => {
  it('accepts 1 char (min)', () => {
    expect(() => validateLabel('x')).not.toThrow();
  });

  it('accepts 40 chars (max)', () => {
    expect(() => validateLabel('x'.repeat(40))).not.toThrow();
  });

  it('rejects empty string', () => {
    expect(() => validateLabel('')).toThrow(CredentialFormatError);
  });

  it('rejects 41 chars', () => {
    expect(() => validateLabel('x'.repeat(41))).toThrow(CredentialFormatError);
  });
});

describe('cleanInput', () => {
  it('trims leading and trailing whitespace', () => {
    expect(cleanInput('  abc  ')).toBe('abc');
  });

  it('preserves internal content as-is', () => {
    expect(cleanInput('abc-def')).toBe('abc-def');
  });
});
