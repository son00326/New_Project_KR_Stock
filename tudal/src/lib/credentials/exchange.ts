'use server';

import { createClient } from '@/lib/supabase/server';
import { encrypt } from '@/lib/crypto/aes';
import { maskKey } from './mask';
import {
  cleanInput,
  CredentialFormatError,
  validateBinanceApiKey,
  validateBinanceApiSecret,
  validateLabel,
} from './validation';
import type {
  ActionResult,
  ExchangeCredentialDisplay,
  ExchangeCredentialInput,
} from './types';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function upsertExchangeCredential(
  input: ExchangeCredentialInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const label = cleanInput(input.label);
    const apiKey = cleanInput(input.apiKey);
    const apiSecret = cleanInput(input.apiSecret);
    validateLabel(label);
    validateBinanceApiKey(apiKey);
    validateBinanceApiSecret(apiSecret);

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: '로그인이 필요합니다' };

    const repEmail = process.env.ADMIN_REP_EMAIL;
    if (!input.testnetMode && user.email !== repEmail) {
      return { success: false, error: '메인넷 등록은 대표만 가능합니다' };
    }

    const keyPayload = encrypt(apiKey);
    const secretPayload = encrypt(apiSecret);

    const { data, error } = await supabase
      .from('exchange_connection')
      .upsert(
        {
          admin_id: user.id,
          exchange: input.exchange,
          label,
          testnet_mode: input.testnetMode,
          ciphertext_api_key: keyPayload.ciphertext,
          iv_api_key: keyPayload.iv,
          auth_tag_api_key: keyPayload.authTag,
          ciphertext_api_secret: secretPayload.ciphertext,
          iv_api_secret: secretPayload.iv,
          auth_tag_api_secret: secretPayload.authTag,
          is_active: true,
        },
        { onConflict: 'admin_id,exchange,label' },
      )
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: '이미 등록된 라벨입니다' };
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

export async function deleteExchangeCredential(
  id: string,
): Promise<ActionResult<void>> {
  if (!UUID_RE.test(id)) {
    return { success: false, error: 'Invalid id format' };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from('exchange_connection')
    .delete()
    .eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true, data: undefined };
}

export async function listExchangeCredentials(): Promise<
  ExchangeCredentialDisplay[]
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('exchange_connection')
    .select(
      'id, exchange, label, ciphertext_api_key, testnet_mode, is_active, created_at, last_used_at',
    )
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (!data) return [];

  return data.map((row) => {
    const ciphertextHex = Buffer.isBuffer(row.ciphertext_api_key)
      ? row.ciphertext_api_key.toString('hex')
      : String(row.ciphertext_api_key ?? '');
    return {
      id: row.id as string,
      exchange: row.exchange as 'binance_futures',
      label: row.label as string,
      apiKeyMasked: maskKey(ciphertextHex, 2, 4),
      testnetMode: Boolean(row.testnet_mode),
      isActive: Boolean(row.is_active),
      createdAt: row.created_at as string,
      lastUsedAt: (row.last_used_at as string | null) ?? null,
    };
  });
}

export async function testExchangeConnection(
  _id: string,
): Promise<ActionResult<{ pong: boolean }>> {
  return { success: false, error: 'pending-s8' };
}
