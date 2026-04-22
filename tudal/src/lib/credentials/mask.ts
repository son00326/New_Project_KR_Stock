const MIN_MASKABLE_LENGTH = 7;

export function maskKey(key: string, prefix = 2, suffix = 4): string {
  if (!key || key.length < MIN_MASKABLE_LENGTH) return '****';
  const head = key.slice(0, prefix);
  const tail = key.slice(-suffix);
  return `${head}**···${tail}`;
}

export function maskAccount(accountNo: string): string {
  const m = /^(\d{8})-\d{2}$/.exec(accountNo);
  if (m) return `${m[1]}-**`;
  return '****';
}
