import { describe, expect, it, vi, beforeEach } from 'vitest';

const rpcMock = vi.fn();
const eqMock = vi.fn();
const updateMock = vi.fn(() => ({ eq: eqMock }));
const fromMock = vi.fn(() => ({ update: updateMock }));

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(() => ({
    rpc: rpcMock,
    from: fromMock,
  })),
}));

import {
  acquireBatchLockCron,
  releaseBatchLockCron,
} from '../admin-batch-runs-cron';

beforeEach(() => {
  rpcMock.mockReset();
  eqMock.mockReset();
  updateMock.mockClear();
  fromMock.mockClear();
});

describe('acquireBatchLockCron', () => {
  it('calls acquire_batch_lock_v2 with p_caller_kind=cron and returns acquired', async () => {
    rpcMock.mockResolvedValue({
      data: { acquired: true, resumed: false },
      error: null,
    });
    const result = await acquireBatchLockCron('2026-06');
    expect(rpcMock).toHaveBeenCalledWith('acquire_batch_lock_v2', {
      p_month: '2026-06',
      p_caller_kind: 'cron',
    });
    expect(result).toEqual({ acquired: true, resumed: false });
  });

  it('throws supabase error message when RPC fails', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'batch_already_running' },
    });
    await expect(acquireBatchLockCron('2026-06')).rejects.toThrow(
      /batch_already_running/,
    );
  });

  it('throws batch_lock_acquire_failed when data.acquired is falsy', async () => {
    rpcMock.mockResolvedValue({ data: { acquired: false }, error: null });
    await expect(acquireBatchLockCron('2026-06')).rejects.toThrow(
      /batch_lock_acquire_failed/,
    );
  });
});

describe('releaseBatchLockCron', () => {
  it('updates monthly_batch_runs with succeeded status', async () => {
    eqMock.mockResolvedValue({ error: null });
    await releaseBatchLockCron({
      month: '2026-06',
      status: 'succeeded',
      callCountDone: 30,
    });
    expect(fromMock).toHaveBeenCalledWith('monthly_batch_runs');
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'succeeded',
        call_count_done: 30,
        error_code: null,
      }),
    );
    expect(eqMock).toHaveBeenCalledWith('month', '2026-06');
  });

  it('throws batch_lock_release_failed on supabase error', async () => {
    eqMock.mockResolvedValue({ error: { code: '23505' } });
    await expect(
      releaseBatchLockCron({
        month: '2026-06',
        status: 'failed',
        callCountDone: 0,
        errorCode: 'tier0_source_not_wired_pr1_followup',
      }),
    ).rejects.toThrow(/batch_lock_release_failed:23505/);
  });
});
