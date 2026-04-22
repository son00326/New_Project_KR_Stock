import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  upsertSingle: vi.fn(),
  deleteEq: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: () => ({
      upsert: () => ({
        select: () => ({
          single: async () => mocks.upsertSingle(),
        }),
      }),
      delete: () => ({
        eq: async () => mocks.deleteEq(),
      }),
      select: () => ({
        eq: () => ({
          order: async () => ({ data: [] }),
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
