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
  broker: 'kis' as const,
  accountNo: '12345678-01',
  appKey: 'A'.repeat(36),
  appSecret: 'B'.repeat(180),
  mockMode: true,
  strategyLabel: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.API_CRED_MASTER_KEY = TEST_MEK;
  process.env.ADMIN_REP_EMAIL = 'rep@example.com';
  mocks.selectOrder.mockResolvedValue({ data: [], error: null });
});

describe('upsertBrokerageCredential', () => {
  it('rejects when user is not logged in', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const { upsertBrokerageCredential } = await import('../brokerage');
    const r = await upsertBrokerageCredential(validInput);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toMatch(/로그인/);
  });

  it('rejects on format violation — short appKey', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.c' } },
    });
    const { upsertBrokerageCredential } = await import('../brokerage');
    const r = await upsertBrokerageCredential({
      ...validInput,
      appKey: 'A'.repeat(35),
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toMatch(/36자/);
  });

  it('rejects on format violation — account_no wrong format', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.c' } },
    });
    const { upsertBrokerageCredential } = await import('../brokerage');
    const r = await upsertBrokerageCredential({
      ...validInput,
      accountNo: '12345678-XX',
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toMatch(/12345678-01/);
  });

  it('blocks non-rep from saving real account (mockMode=false)', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'friend@b.c' } },
    });
    const { upsertBrokerageCredential } = await import('../brokerage');
    const r = await upsertBrokerageCredential({
      ...validInput,
      mockMode: false,
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toMatch(/실계좌.*대표/);
  });

  it('allows rep to save real account', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'rep@example.com' } },
    });
    mocks.upsertSingle.mockResolvedValue({
      data: { id: 'new-uuid' },
      error: null,
    });
    const { upsertBrokerageCredential } = await import('../brokerage');
    const r = await upsertBrokerageCredential({
      ...validInput,
      mockMode: false,
    });
    expect(r.success).toBe(true);
  });

  it('maps 23505 (unique violation) to friendly message', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.c' } },
    });
    mocks.upsertSingle.mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'dup' },
    });
    const { upsertBrokerageCredential } = await import('../brokerage');
    const r = await upsertBrokerageCredential(validInput);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toMatch(/이미 등록/);
  });

  it('succeeds with valid input (mockMode=true)', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.c' } },
    });
    mocks.upsertSingle.mockResolvedValue({
      data: { id: 'new-uuid' },
      error: null,
    });
    const { upsertBrokerageCredential } = await import('../brokerage');
    const r = await upsertBrokerageCredential(validInput);
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
    const { upsertBrokerageCredential } = await import('../brokerage');

    await upsertBrokerageCredential(validInput);

    expect(mocks.upsertPayload).toHaveBeenCalledOnce();
    const payload = mocks.upsertPayload.mock.calls[0][0] as Record<string, unknown>;
    for (const field of [
      'ciphertext_app_key',
      'iv_app_key',
      'auth_tag_app_key',
      'ciphertext_app_secret',
      'iv_app_secret',
      'auth_tag_app_secret',
    ]) {
      expect(payload[field]).toEqual(expect.stringMatching(/^\\x[0-9a-f]+$/));
    }
  });

  it('returns an operational error when MEK is misconfigured', async () => {
    process.env.API_CRED_MASTER_KEY = 'bad-key';
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.c' } },
    });
    const { upsertBrokerageCredential } = await import('../brokerage');
    const r = await upsertBrokerageCredential(validInput);

    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toMatch(/암호화 키/);
  });
});

describe('deleteBrokerageCredential', () => {
  it('rejects malformed id', async () => {
    const { deleteBrokerageCredential } = await import('../brokerage');
    const r = await deleteBrokerageCredential('not-a-uuid');
    expect(r.success).toBe(false);
  });

  it('succeeds on valid uuid (idempotent)', async () => {
    mocks.deleteEq.mockResolvedValue({ error: null });
    const { deleteBrokerageCredential } = await import('../brokerage');
    const r = await deleteBrokerageCredential(UUID_VALID);
    expect(r.success).toBe(true);
  });
});

describe('testBrokerageConnection', () => {
  it('returns pending-s8 stub (will be wired in S8-Scaffold)', async () => {
    const { testBrokerageConnection } = await import('../brokerage');
    const r = await testBrokerageConnection(UUID_VALID);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toBe('pending-s8');
  });
});

describe('listBrokerageCredentials', () => {
  it('uses stored app_key_masked instead of deriving display from ciphertext', async () => {
    mocks.selectOrder.mockResolvedValue({
      data: [
        {
          id: UUID_VALID,
          broker: 'kis',
          account_no: '12345678-01',
          app_key_masked: 'AA···AAAA',
          strategy_label: null,
          mock_mode: true,
          is_active: true,
          created_at: '2026-04-24T00:00:00.000Z',
          last_used_at: null,
        },
      ],
      error: null,
    });
    const { listBrokerageCredentials } = await import('../brokerage');

    const rows = await listBrokerageCredentials();

    expect(rows[0].appKeyMasked).toBe('AA···AAAA');
  });

  it('does not hide Supabase lookup errors as an empty list', async () => {
    mocks.selectOrder.mockResolvedValue({
      data: null,
      error: { message: 'relation "brokerage_connection" does not exist' },
    });
    const { listBrokerageCredentials } = await import('../brokerage');

    await expect(listBrokerageCredentials()).rejects.toThrow(
      /brokerage credential lookup failed/,
    );
  });
});
