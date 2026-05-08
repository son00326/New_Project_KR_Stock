import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  upsertSingle: vi.fn(),
  upsertPayload: vi.fn(),
  deleteEq: vi.fn(),
  selectOrder: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: () => ({
      upsert: (payload: unknown) => {
        mocks.upsertPayload(payload);
        return {
        select: () => ({
          single: async () => mocks.upsertSingle(),
        }),
        };
      },
      delete: () => ({
        eq: async () => mocks.deleteEq(),
      }),
      select: () => ({
        eq: () => ({
          order: async () => mocks.selectOrder(),
        }),
      }),
    }),
  }),
}));

const TEST_MEK =
  '7f3e8a1b9c2d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f';
const UUID_VALID = '12345678-1234-1234-1234-123456789abc';

const validInput = {
  exchange: 'binance_futures' as const,
  label: 'main-futures',
  apiKey: 'a'.repeat(64),
  apiSecret: 'b'.repeat(64),
  testnetMode: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.API_CRED_MASTER_KEY = TEST_MEK;
  process.env.ADMIN_REP_EMAIL = 'rep@example.com';
  mocks.selectOrder.mockResolvedValue({ data: [], error: null });
});

describe('upsertExchangeCredential', () => {
  it('rejects when user is not logged in', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const { upsertExchangeCredential } = await import('../exchange');
    const r = await upsertExchangeCredential(validInput);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toMatch(/로그인/);
  });

  it('rejects on format violation — short apiKey (63)', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.c' } },
    });
    const { upsertExchangeCredential } = await import('../exchange');
    const r = await upsertExchangeCredential({
      ...validInput,
      apiKey: 'a'.repeat(63),
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toMatch(/64자/);
  });

  it('rejects empty label', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.c' } },
    });
    const { upsertExchangeCredential } = await import('../exchange');
    const r = await upsertExchangeCredential({ ...validInput, label: '' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toMatch(/라벨/);
  });

  it('rejects 41-char label (>40 max)', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.c' } },
    });
    const { upsertExchangeCredential } = await import('../exchange');
    const r = await upsertExchangeCredential({
      ...validInput,
      label: 'x'.repeat(41),
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toMatch(/1~40자/);
  });

  it('blocks non-rep from saving mainnet (testnetMode=false)', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'friend@b.c' } },
    });
    const { upsertExchangeCredential } = await import('../exchange');
    const r = await upsertExchangeCredential({
      ...validInput,
      testnetMode: false,
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toMatch(/메인넷.*대표/);
  });

  it('rejects malformed testnetMode before saving', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'friend@b.c' } },
    });
    const { upsertExchangeCredential } = await import('../exchange');
    const r = await upsertExchangeCredential({
      ...validInput,
      testnetMode: 'false',
    } as unknown as typeof validInput);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toMatch(/모드/);
    expect(mocks.upsertPayload).not.toHaveBeenCalled();
  });

  it('allows rep to save mainnet', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'rep@example.com' } },
    });
    mocks.upsertSingle.mockResolvedValue({
      data: { id: 'new-uuid' },
      error: null,
    });
    const { upsertExchangeCredential } = await import('../exchange');
    const r = await upsertExchangeCredential({
      ...validInput,
      testnetMode: false,
    });
    expect(r.success).toBe(true);
  });

  it('maps 23505 to friendly message (duplicate label)', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.c' } },
    });
    mocks.upsertSingle.mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'dup' },
    });
    const { upsertExchangeCredential } = await import('../exchange');
    const r = await upsertExchangeCredential(validInput);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toMatch(/이미 등록/);
  });

  it('succeeds with valid input (testnetMode=true)', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.c' } },
    });
    mocks.upsertSingle.mockResolvedValue({
      data: { id: 'new-uuid' },
      error: null,
    });
    const { upsertExchangeCredential } = await import('../exchange');
    const r = await upsertExchangeCredential(validInput);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.id).toBe('new-uuid');
  });

  it('serializes encrypted bytea fields as Postgres hex strings', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.c' } },
    });
    mocks.upsertSingle.mockResolvedValue({
      data: { id: 'new-uuid' },
      error: null,
    });
    const { upsertExchangeCredential } = await import('../exchange');

    await upsertExchangeCredential(validInput);

    expect(mocks.upsertPayload).toHaveBeenCalledOnce();
    const payload = mocks.upsertPayload.mock.calls[0][0] as Record<string, unknown>;
    for (const field of [
      'ciphertext_api_key',
      'iv_api_key',
      'auth_tag_api_key',
      'ciphertext_api_secret',
      'iv_api_secret',
      'auth_tag_api_secret',
    ]) {
      expect(payload[field]).toEqual(expect.stringMatching(/^\\x[0-9a-f]+$/));
    }
  });

  it('returns an operational error when MEK is misconfigured', async () => {
    process.env.API_CRED_MASTER_KEY = 'bad-key';
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.c' } },
    });
    const { upsertExchangeCredential } = await import('../exchange');
    const r = await upsertExchangeCredential(validInput);

    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toMatch(/암호화 키/);
  });
});

describe('deleteExchangeCredential', () => {
  it('rejects malformed id', async () => {
    const { deleteExchangeCredential } = await import('../exchange');
    const r = await deleteExchangeCredential('not-a-uuid');
    expect(r.success).toBe(false);
  });

  it('succeeds on valid uuid (idempotent)', async () => {
    mocks.deleteEq.mockResolvedValue({ error: null });
    const { deleteExchangeCredential } = await import('../exchange');
    const r = await deleteExchangeCredential(UUID_VALID);
    expect(r.success).toBe(true);
  });
});

describe('testExchangeConnection', () => {
  it('returns pending-s8 stub', async () => {
    const { testExchangeConnection } = await import('../exchange');
    const r = await testExchangeConnection(UUID_VALID);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toBe('pending-s8');
  });
});

describe('listExchangeCredentials', () => {
  it('uses stored api_key_masked instead of deriving display from ciphertext', async () => {
    mocks.selectOrder.mockResolvedValue({
      data: [
        {
          id: UUID_VALID,
          exchange: 'binance_futures',
          label: 'main-futures',
          api_key_masked: 'aa···aaaa',
          testnet_mode: true,
          is_active: true,
          created_at: '2026-04-24T00:00:00.000Z',
          last_used_at: null,
        },
      ],
      error: null,
    });
    const { listExchangeCredentials } = await import('../exchange');

    const rows = await listExchangeCredentials();

    expect(rows[0].apiKeyMasked).toBe('aa···aaaa');
  });

  it('does not hide Supabase lookup errors as an empty list', async () => {
    mocks.selectOrder.mockResolvedValue({
      data: null,
      error: { message: 'relation "exchange_connection" does not exist' },
    });
    const { listExchangeCredentials } = await import('../exchange');

    await expect(listExchangeCredentials()).rejects.toThrow(
      /exchange credential lookup failed/,
    );
  });
});
