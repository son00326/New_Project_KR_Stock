import { describe, it, expect, beforeEach } from 'vitest';
import {
  encrypt,
  decrypt,
  DecryptionError,
  MekConfigurationError,
} from '../aes';

const TEST_MEK_HEX =
  '7f3e8a1b9c2d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f';

describe('aes', () => {
  beforeEach(() => {
    process.env.API_CRED_MASTER_KEY = TEST_MEK_HEX;
  });

  describe('encrypt/decrypt roundtrip', () => {
    it('returns original plaintext', () => {
      const plaintext = 'my-secret-api-key';
      const payload = encrypt(plaintext);
      const decoded = decrypt(payload);
      expect(decoded).toBe(plaintext);
    });
  });

  describe('IV uniqueness', () => {
    it('produces iv of length 12 bytes', () => {
      const { iv } = encrypt('x');
      expect(iv.length).toBe(12);
    });

    it('produces authTag of length 16 bytes', () => {
      const { authTag } = encrypt('x');
      expect(authTag.length).toBe(16);
    });

    it('produces unique ciphertext for same plaintext across 100 runs', () => {
      const pt = 'same-plaintext';
      const seen = new Set<string>();
      for (let i = 0; i < 100; i++) {
        seen.add(encrypt(pt).ciphertext.toString('hex'));
      }
      expect(seen.size).toBe(100);
    });
  });

  describe('edge cases', () => {
    it('roundtrips empty string', () => {
      expect(decrypt(encrypt(''))).toBe('');
    });

    it('roundtrips korean (UTF-8)', () => {
      const pt = '안녕하세요 Binance API key 🔑';
      expect(decrypt(encrypt(pt))).toBe(pt);
    });

    it('roundtrips large payload (10KB)', () => {
      const pt = 'x'.repeat(10_000);
      expect(decrypt(encrypt(pt))).toBe(pt);
    });
  });

  describe('tamper detection', () => {
    it('throws DecryptionError when ciphertext is flipped', () => {
      const payload = encrypt('secret');
      payload.ciphertext[0] ^= 0xff;
      expect(() => decrypt(payload)).toThrow(DecryptionError);
    });

    it('throws DecryptionError when iv is flipped', () => {
      const payload = encrypt('secret');
      payload.iv[0] ^= 0xff;
      expect(() => decrypt(payload)).toThrow(DecryptionError);
    });

    it('throws DecryptionError when authTag is flipped', () => {
      const payload = encrypt('secret');
      payload.authTag[0] ^= 0xff;
      expect(() => decrypt(payload)).toThrow(DecryptionError);
    });

    it('throws DecryptionError when decrypted with different MEK', () => {
      const payload = encrypt('secret');
      process.env.API_CRED_MASTER_KEY =
        '0000000000000000000000000000000000000000000000000000000000000000';
      expect(() => decrypt(payload)).toThrow(DecryptionError);
    });
  });

  describe('MEK configuration errors', () => {
    it('throws MekConfigurationError when env is missing', () => {
      delete process.env.API_CRED_MASTER_KEY;
      expect(() => encrypt('x')).toThrow(MekConfigurationError);
    });

    it('throws MekConfigurationError when hex length is wrong', () => {
      process.env.API_CRED_MASTER_KEY = 'abc123';
      expect(() => encrypt('x')).toThrow(MekConfigurationError);
    });

    it('throws MekConfigurationError when non-hex chars are present', () => {
      process.env.API_CRED_MASTER_KEY = 'z'.repeat(64);
      expect(() => encrypt('x')).toThrow(MekConfigurationError);
    });
  });
});
