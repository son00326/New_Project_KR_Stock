// PR4 Task 1 Step 1.1.8 — caller DI seam invariant tests for sector-reference-backlog (B2 fix omxy R1).
// 2 tests: insertOrBumpBacklog + listBacklog with options.client.
//
// Note: insertOrBumpBacklog의 createClient call은 hasLevelABodyReference early-return 통과 후만 도달.
// 비-Level A sector ('건설') 사용으로 RPC 도달 path 검증.
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('sector-reference-backlog — caller DI seam (PR4 Task 1 Step 1.1.8)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('insertOrBumpBacklog', () => {
    it('uses options.client when provided (non-Level-A sector, createClient NOT called)', async () => {
      const rpcMock = vi.fn().mockResolvedValue({ error: null });
      const createClientSpy = vi.fn();
      vi.doMock('@/lib/supabase/server', () => ({ createClient: createClientSpy }));
      const { insertOrBumpBacklog } = await import('@/lib/data/sector-reference-backlog');
      await insertOrBumpBacklog('건설', { client: { rpc: rpcMock } as never });
      expect(rpcMock).toHaveBeenCalledWith('insert_or_bump_sector_backlog', { p_sector: '건설' });
      expect(createClientSpy).not.toHaveBeenCalled();
    });

    it('falls back to createClient when options omitted (non-Level-A sector)', async () => {
      const rpcMock = vi.fn().mockResolvedValue({ error: null });
      const createClientSpy = vi.fn().mockResolvedValue({ rpc: rpcMock });
      vi.doMock('@/lib/supabase/server', () => ({ createClient: createClientSpy }));
      const { insertOrBumpBacklog } = await import('@/lib/data/sector-reference-backlog');
      await insertOrBumpBacklog('건설');
      expect(createClientSpy).toHaveBeenCalled();
      expect(rpcMock).toHaveBeenCalledWith('insert_or_bump_sector_backlog', { p_sector: '건설' });
    });
  });

  describe('listBacklog', () => {
    it('uses options.client when provided (createClient NOT called)', async () => {
      const orderMock = vi.fn().mockResolvedValue({ data: [], error: null });
      const selectMock = vi.fn().mockReturnValue({ order: orderMock });
      const fromMock = vi.fn().mockReturnValue({ select: selectMock });
      const createClientSpy = vi.fn();
      vi.doMock('@/lib/supabase/server', () => ({ createClient: createClientSpy }));
      const { listBacklog } = await import('@/lib/data/sector-reference-backlog');
      await listBacklog({ client: { from: fromMock } as never });
      expect(fromMock).toHaveBeenCalledWith('sector_reference_backlog');
      expect(createClientSpy).not.toHaveBeenCalled();
    });

    it('falls back to createClient when options omitted', async () => {
      const orderMock = vi.fn().mockResolvedValue({ data: [], error: null });
      const selectMock = vi.fn().mockReturnValue({ order: orderMock });
      const fromMock = vi.fn().mockReturnValue({ select: selectMock });
      const createClientSpy = vi.fn().mockResolvedValue({ from: fromMock });
      vi.doMock('@/lib/supabase/server', () => ({ createClient: createClientSpy }));
      const { listBacklog } = await import('@/lib/data/sector-reference-backlog');
      await listBacklog();
      expect(createClientSpy).toHaveBeenCalled();
    });
  });
});
