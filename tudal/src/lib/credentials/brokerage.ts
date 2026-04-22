'use server';

import { createClient } from '@/lib/supabase/server';
import { encrypt } from '@/lib/crypto/aes';
import { maskAccount, maskKey } from './mask';
import {
  cleanInput,
  CredentialFormatError,
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

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: '로그인이 필요합니다' };

    const repEmail = process.env.ADMIN_REP_EMAIL;
    if (!input.mockMode && user.email !== repEmail) {
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
          mock_mode: input.mockMode,
          ciphertext_app_key: keyPayload.ciphertext,
          iv_app_key: keyPayload.iv,
          auth_tag_app_key: keyPayload.authTag,
          ciphertext_app_secret: secretPayload.ciphertext,
          iv_app_secret: secretPayload.iv,
          auth_tag_app_secret: secretPayload.authTag,
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
      return { success: false, error: `저장 실패: ${error.message}` };
    }
    return { success: true, data: { id: data.id } };
  } catch (e) {
    if (e instanceof CredentialFormatError) {
      return { success: false, error: e.message };
    }
    return { success: false, error: '알 수 없는 오류' };
  }
}

export async function deleteBrokerageCredential(
  id: string,
): Promise<ActionResult<void>> {
  if (!UUID_RE.test(id)) {
    return { success: false, error: 'Invalid id format' };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from('brokerage_connection')
    .delete()
    .eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true, data: undefined };
}

export async function listBrokerageCredentials(): Promise<
  BrokerageCredentialDisplay[]
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('brokerage_connection')
    .select(
      'id, broker, account_no, ciphertext_app_key, strategy_label, mock_mode, is_active, created_at, last_used_at',
    )
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (!data) return [];

  return data.map((row) => {
    const ciphertextHex = Buffer.isBuffer(row.ciphertext_app_key)
      ? row.ciphertext_app_key.toString('hex')
      : String(row.ciphertext_app_key ?? '');
    return {
      id: row.id as string,
      broker: row.broker as 'kis',
      accountNoMasked: maskAccount(row.account_no as string),
      appKeyMasked: maskKey(ciphertextHex, 2, 4),
      mockMode: Boolean(row.mock_mode),
      strategyLabel: (row.strategy_label as string | null) ?? null,
      isActive: Boolean(row.is_active),
      createdAt: row.created_at as string,
      lastUsedAt: (row.last_used_at as string | null) ?? null,
    };
  });
}

export async function testBrokerageConnection(
  _id: string,
): Promise<ActionResult<{ pong: boolean }>> {
  return { success: false, error: 'pending-s8' };
}
