import { describe, it, expect, vi, beforeEach } from 'vitest';
import { acquireBatchLock, releaseBatchLock } from '../admin-batch-runs';

const mockRpc = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve({
    rpc: mockRpc,
    from: vi.fn(() => ({ update: mockUpdate })),
  })),
}));

describe('admin-batch-runs (Plan R3 BLOCKER 6 — RPC 기반 lock)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('acquireBatchLock first call → acquire_batch_lock RPC returns acquired:true', async () => {
    mockRpc.mockResolvedValue({ data: { acquired: true, resumed: false }, error: null });
    const result = await acquireBatchLock('2026-05');
    expect(mockRpc).toHaveBeenCalledWith('acquire_batch_lock', { p_month: '2026-05' });
    expect(result.acquired).toBe(true);
    expect(result.resumed).toBe(false);
  });

  it('acquireBatchLock when status=running → RPC raises batch_already_running', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'batch_already_running', code: 'P0001' },
    });
    await expect(acquireBatchLock('2026-05')).rejects.toThrow('batch_already_running');
  });

  it('releaseBatchLock updates status to succeeded', async () => {
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    await releaseBatchLock({ month: '2026-05', status: 'succeeded', callCountDone: 330 });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });
});
