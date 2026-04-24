import { describe, expect, it } from 'vitest';
import { describeCredentialListError } from '../errors';

describe('describeCredentialListError', () => {
  it('classifies missing credential tables as a migration error', () => {
    expect(
      describeCredentialListError(
        new Error(
          'brokerage credential lookup failed: Could not find the table public.brokerage_connection in the schema cache',
        ),
      ),
    ).toEqual({
      kind: 'schema_unavailable',
      message:
        'Credential DB 마이그레이션이 아직 적용되지 않아 등록 목록을 불러올 수 없습니다. DQ-7 0009 마이그레이션 적용 후 다시 확인하세요.',
    });
  });

  it('does not mislabel permission failures as a missing migration', () => {
    expect(
      describeCredentialListError(
        new Error('brokerage credential lookup failed: permission denied for table brokerage_connection'),
      ),
    ).toEqual({
      kind: 'load_failed',
      message:
        '자격증명 목록을 불러오지 못했습니다. 권한, 네트워크, Supabase 상태를 확인하세요.',
    });
  });
});
