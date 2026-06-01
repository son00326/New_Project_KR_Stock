// PR1 triggerMonthlyBatch admin server action tests.
import { describe, expect, it, vi, beforeEach } from 'vitest';

const { getUserMock, runOrchestratorMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  runOrchestratorMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: getUserMock },
  }),
}));
vi.mock('@/lib/screening/monthly-batch-orchestrator', () => ({
  runMonthlyBatchOrchestrator: runOrchestratorMock,
}));
vi.mock('@/lib/data/admin-batch-runs', () => ({
  acquireBatchLock: vi.fn(),
  releaseBatchLock: vi.fn(),
}));
vi.mock('@/lib/data/admin-shortlist-persist', () => ({
  upsertShortList30: vi.fn(),
}));

import { triggerMonthlyBatch } from '../actions';

beforeEach(() => {
  getUserMock.mockReset();
  runOrchestratorMock.mockReset();
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
    expect(runOrchestratorMock).not.toHaveBeenCalled();
  });

  it('success path returns selectedCount from orchestrator outcome', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'admin-uuid-123' } },
    });
    runOrchestratorMock.mockResolvedValue({
      month: '2026-06',
      selectedCount: 30,
      notSelectedCount: 120,
      badgeOnlyCount: 0,
      promptVersionId: 'render-user-prompt@v1',
      personasVersionId: 'core11@v3.1',
    });
    const res = await triggerMonthlyBatch({ month: '2026-06' });
    expect(res).toEqual({ success: true, data: { selectedCount: 30 } });
    const args = runOrchestratorMock.mock.calls[0][0];
    expect(args.adminUserId).toBe('admin-uuid-123');
    // Server action path: recordSchedulerFailAlert is noop wire.
    expect(typeof args.recordSchedulerFailAlert).toBe('function');
    await expect(args.persist('2026-06', [])).rejects.toThrow(
      'tier1_persist_blocked_until_pr_e',
    );
  });

  it('orchestrator throw → error mapped to message', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'admin-uuid-123' } },
    });
    runOrchestratorMock.mockRejectedValue(
      new Error('tier0_source_not_wired_pr1_followup'),
    );
    const res = await triggerMonthlyBatch({ month: '2026-06' });
    expect(res).toEqual({
      success: false,
      error: 'tier0_source_not_wired_pr1_followup',
    });
  });
});
