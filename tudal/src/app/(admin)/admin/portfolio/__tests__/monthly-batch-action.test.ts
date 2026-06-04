// PR1 legacy triggerMonthlyBatch admin server action tests.
import { describe, expect, it, vi, beforeEach } from 'vitest';

const {
  getUserMock,
  rpcMock,
  isCostLoggingEnabledMock,
  preflightHardcapMock,
} = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  rpcMock: vi.fn(),
  isCostLoggingEnabledMock: vi.fn(),
  preflightHardcapMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: getUserMock },
    rpc: rpcMock,
  }),
}));
vi.mock('@/lib/cost/cost-logger', () => ({
  isCostLoggingEnabled: isCostLoggingEnabledMock,
  preflightHardcap: preflightHardcapMock,
  insertCostLog: vi.fn(),
}));

import { triggerMonthlyBatch } from '../actions';

const ADMIN_USER = { data: { user: { id: 'admin-uuid-123' } } };

beforeEach(() => {
  getUserMock.mockReset();
  rpcMock.mockReset();
  rpcMock.mockResolvedValue({ data: true, error: null });
  isCostLoggingEnabledMock.mockReset();
  preflightHardcapMock.mockReset();
});

describe('triggerMonthlyBatch', () => {
  it('returns invalid_input when month not string', async () => {
    // @ts-expect-error testing runtime input validation
    const res = await triggerMonthlyBatch({});
    expect(res).toEqual({ success: false, error: 'invalid_input' });
  });

  it('returns invalid_month for YYYY-MM-DD (full date)', async () => {
    const res = await triggerMonthlyBatch({ month: '2026-06-01' });
    expect(res).toEqual({ success: false, error: 'invalid_month' });
  });

  it('returns invalid_month for YYYY-M (single digit month)', async () => {
    const res = await triggerMonthlyBatch({ month: '2026-6' });
    expect(res).toEqual({ success: false, error: 'invalid_month' });
  });

  it('returns auth_unavailable when no admin user', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const res = await triggerMonthlyBatch({ month: '2026-06' });
    expect(res).toEqual({ success: false, error: 'auth_unavailable' });
  });

  it('non-admin session fails before deprecated orchestrator/AI path', async () => {
    getUserMock.mockResolvedValue(ADMIN_USER);
    rpcMock.mockResolvedValue({ data: false, error: null });
    const res = await triggerMonthlyBatch({ month: '2026-06' });
    expect(res).toEqual({ success: false, error: 'admin_required' });
    expect(isCostLoggingEnabledMock).not.toHaveBeenCalled();
    expect(preflightHardcapMock).not.toHaveBeenCalled();
  });

  it('W2a wiring fix: admin trigger fails closed before old single-shot AI/orchestrator cost path', async () => {
    getUserMock.mockResolvedValue(ADMIN_USER);
    const res = await triggerMonthlyBatch({ month: '2026-06' });
    expect(res).toEqual({
      success: false,
      error: 'monthly_batch_single_shot_deprecated',
    });
    expect(isCostLoggingEnabledMock).not.toHaveBeenCalled();
    expect(preflightHardcapMock).not.toHaveBeenCalled();
  });
});
