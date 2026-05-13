'use server';

import { createClient } from '@/lib/supabase/server';
import { encrypt, MekConfigurationError } from '@/lib/crypto/aes';
import { maskAccount, maskKey } from './mask';
import {
  cleanInput,
  CredentialFormatError,
  validateBooleanMode,
  validateKisAccountNo,
  validateKisAppKey,
  validateKisAppSecret,
} from './validation';
import type {
  ActionResult,
  BrokerageCredentialDisplay,
  BrokerageCredentialInput,
} from './types';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toPostgresBytea(value: Buffer): string {
  return `\\x${value.toString('hex')}`;
}

export async function upsertBrokerageCredential(
  input: BrokerageCredentialInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const accountNo = cleanInput(input.accountNo);
    const appKey = cleanInput(input.appKey);
    const appSecret = cleanInput(input.appSecret);
    validateKisAccountNo(accountNo);
    validateKisAppKey(appKey);
    validateKisAppSecret(appSecret);
    const mockMode = validateBooleanMode(input.mockMode, 'KIS');

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: '로그인이 필요합니다' };

    const repEmail = process.env.ADMIN_REP_EMAIL;
    if (!mockMode && user.email !== repEmail) {
      return { success: false, error: '실계좌 등록은 대표만 가능합니다' };
    }

    const keyPayload = encrypt(appKey);
    const secretPayload = encrypt(appSecret);

    const { data, error } = await supabase
      .from('brokerage_connection')
      .upsert(
        {
          admin_id: user.id,
          broker: input.broker,
          account_no: accountNo,
          strategy_label: input.strategyLabel,
          mock_mode: mockMode,
          app_key_masked: maskKey(appKey, 2, 4),
          ciphertext_app_key: toPostgresBytea(keyPayload.ciphertext),
          iv_app_key: toPostgresBytea(keyPayload.iv),
          auth_tag_app_key: toPostgresBytea(keyPayload.authTag),
          ciphertext_app_secret: toPostgresBytea(secretPayload.ciphertext),
          iv_app_secret: toPostgresBytea(secretPayload.iv),
          auth_tag_app_secret: toPostgresBytea(secretPayload.authTag),
          is_active: true,
        },
        { onConflict: 'admin_id,broker,account_no' },
      )
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: '이미 등록된 계좌입니다' };
      }
      // FixPlan-46 §P1.1 omxy 합의 Round 6: DB raw message는 generic wrap.
      // dev 환경에서는 console.error로 원문 유지 (디버깅용). credential payload는 절대 로그 금지.
      if (process.env.NODE_ENV !== 'production') {
        console.error('[credentials:brokerage] insert error', error);
      }
      return { success: false, error: '저장소 처리 중 오류가 발생했습니다' };
    }
    return { success: true, data: { id: data.id } };
  } catch (e) {
    if (e instanceof CredentialFormatError) {
      return { success: false, error: e.message };
    }
    if (e instanceof MekConfigurationError) {
      console.error('[credentials:brokerage] API_CRED_MASTER_KEY misconfigured');
      return { success: false, error: '암호화 키 설정 오류: API_CRED_MASTER_KEY 확인 필요' };
    }
    console.error('[credentials:brokerage] unexpected upsert failure', e);
    return { success: false, error: '알 수 없는 오류' };
  }
}

export async function deleteBrokerageCredential(
  id: string,
): Promise<ActionResult<void>> {
  if (!UUID_RE.test(id)) {
    return { success: false, error: '잘못된 ID 형식입니다' };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from('brokerage_connection')
    .delete()
    .eq('id', id);
  if (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[credentials:brokerage] delete error', error);
    }
    return { success: false, error: '저장소 처리 중 오류가 발생했습니다' };
  }
  return { success: true, data: undefined };
}

export async function listBrokerageCredentials(): Promise<
  BrokerageCredentialDisplay[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('brokerage_connection')
    .select(
      'id, broker, account_no, app_key_masked, strategy_label, mock_mode, is_active, created_at, last_used_at',
    )
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`brokerage credential lookup failed: ${error.message}`);
  }
  if (!data) return [];

  return data.map((row) => ({
    id: row.id as string,
    broker: row.broker as 'kis',
    accountNoMasked: maskAccount(row.account_no as string),
    appKeyMasked: row.app_key_masked as string,
    mockMode: Boolean(row.mock_mode),
    strategyLabel: (row.strategy_label as string | null) ?? null,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at as string,
    lastUsedAt: (row.last_used_at as string | null) ?? null,
  }));
}

export async function testBrokerageConnection(
  id: string,
): Promise<ActionResult<{ pong: boolean }>> {
  void id; // S8-Scaffold T8.x에서 broker.ping(decrypted(id))로 연결 예정
  return { success: false, error: 'Binance 키 저장은 S8 자동매매에서 활성화됩니다' };
}
