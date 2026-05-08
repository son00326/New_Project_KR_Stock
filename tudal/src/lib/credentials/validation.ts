export class CredentialFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CredentialFormatError';
  }
}

const KIS_APP_KEY_RE = /^[A-Za-z0-9]{36}$/;
const KIS_APP_SECRET_RE = /^[A-Za-z0-9=+/]{180}$/;
const KIS_ACCOUNT_NO_RE = /^\d{8}-\d{2}$/;
const BINANCE_API_KEY_RE = /^[A-Za-z0-9]{64}$/;
const BINANCE_API_SECRET_RE = /^[A-Za-z0-9]{64}$/;

export function validateKisAppKey(v: string): void {
  if (!KIS_APP_KEY_RE.test(v)) {
    throw new CredentialFormatError(
      `KIS APP_KEY는 36자 영숫자여야 합니다. 현재 ${v.length}자`,
    );
  }
}

export function validateKisAppSecret(v: string): void {
  if (!KIS_APP_SECRET_RE.test(v)) {
    throw new CredentialFormatError(
      `KIS APP_SECRET는 180자여야 합니다. 현재 ${v.length}자`,
    );
  }
}

export function validateKisAccountNo(v: string): void {
  if (!KIS_ACCOUNT_NO_RE.test(v)) {
    throw new CredentialFormatError('KIS 계좌번호 형식: 12345678-01');
  }
}

export function validateBinanceApiKey(v: string): void {
  if (!BINANCE_API_KEY_RE.test(v)) {
    throw new CredentialFormatError(
      `Binance API KEY는 64자 영숫자여야 합니다. 현재 ${v.length}자`,
    );
  }
}

export function validateBinanceApiSecret(v: string): void {
  if (!BINANCE_API_SECRET_RE.test(v)) {
    throw new CredentialFormatError(
      `Binance API SECRET는 64자 영숫자여야 합니다. 현재 ${v.length}자`,
    );
  }
}

export function validateLabel(v: string): void {
  if (v.length < 1 || v.length > 40) {
    throw new CredentialFormatError(
      `라벨은 1~40자여야 합니다. 현재 ${v.length}자`,
    );
  }
}

export function validateBooleanMode(v: unknown, label: string): boolean {
  if (typeof v !== 'boolean') {
    throw new CredentialFormatError(`${label} 모드 값이 올바르지 않습니다.`);
  }
  return v;
}

export function cleanInput(v: string): string {
  return v.trim();
}
