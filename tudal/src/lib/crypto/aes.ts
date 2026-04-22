import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

export type EncryptedPayload = {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
};

export class MekConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MekConfigurationError';
  }
}

export class DecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DecryptionError';
  }
}

const IV_LENGTH = 12;
const MEK_BYTE_LENGTH = 32;
const HEX_RE = /^[0-9a-fA-F]+$/;

function loadMek(): Buffer {
  const hex = process.env.API_CRED_MASTER_KEY;
  if (!hex) {
    throw new MekConfigurationError('API_CRED_MASTER_KEY env is not set');
  }
  if (hex.length !== MEK_BYTE_LENGTH * 2) {
    throw new MekConfigurationError(
      `API_CRED_MASTER_KEY must be ${MEK_BYTE_LENGTH * 2} hex chars (=${MEK_BYTE_LENGTH} bytes). Got ${hex.length}`,
    );
  }
  if (!HEX_RE.test(hex)) {
    throw new MekConfigurationError('API_CRED_MASTER_KEY must be hex-encoded');
  }
  return Buffer.from(hex, 'hex');
}

export function encrypt(plaintext: string): EncryptedPayload {
  const mek = loadMek();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', mek, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return { ciphertext, iv, authTag };
}

export function decrypt(payload: EncryptedPayload): string {
  const mek = loadMek();
  try {
    const decipher = createDecipheriv('aes-256-gcm', mek, payload.iv);
    decipher.setAuthTag(payload.authTag);
    const plaintext = Buffer.concat([
      decipher.update(payload.ciphertext),
      decipher.final(),
    ]);
    return plaintext.toString('utf8');
  } catch {
    throw new DecryptionError(
      'Decryption failed (auth tag mismatch or corrupted data)',
    );
  }
}
