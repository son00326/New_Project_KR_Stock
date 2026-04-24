export type CredentialListErrorDescription = {
  kind: 'schema_unavailable' | 'load_failed';
  message: string;
};

const SCHEMA_UNAVAILABLE_RE =
  /(could not find the table|schema cache|relation .* does not exist|does not exist)/i;

export function describeCredentialListError(
  error: unknown,
): CredentialListErrorDescription {
  const message = error instanceof Error ? error.message : String(error);
  if (SCHEMA_UNAVAILABLE_RE.test(message)) {
    return {
      kind: 'schema_unavailable',
      message:
        'Credential DB 마이그레이션이 아직 적용되지 않아 등록 목록을 불러올 수 없습니다. DQ-7 0009 마이그레이션 적용 후 다시 확인하세요.',
    };
  }

  return {
    kind: 'load_failed',
    message:
      '자격증명 목록을 불러오지 못했습니다. 권한, 네트워크, Supabase 상태를 확인하세요.',
  };
}
