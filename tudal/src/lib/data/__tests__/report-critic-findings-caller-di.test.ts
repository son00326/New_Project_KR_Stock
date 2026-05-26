// PR4 Task 1 Step 1.1.8 — caller DI seam invariant tests for report-critic-findings helpers (B2 fix omxy R1).
// 6 tests: insertCriticFindingsRun + getCriticFindingsByRunId + listLatestRunCriticFindings × (with/without options).
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('report-critic-findings — caller DI seam (PR4 Task 1 Step 1.1.8)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  const validVerdict = {
    factuality: { verdict: 'PASS', reason: 'ok' },
    logic: { verdict: 'PASS', reason: 'ok' },
    completeness: { verdict: 'PASS', reason: 'ok' },
    structure: { verdict: 'PASS', reason: 'ok' },
    bias: { verdict: 'PASS', reason: 'ok' },
    reader_level: { verdict: 'PASS', reason: 'ok' },
  } as never;

  describe('insertCriticFindingsRun', () => {
    it('uses options.client when provided (createClient NOT called)', async () => {
      const rpcMock = vi.fn().mockResolvedValue({ data: 'run-1', error: null });
      const createClientSpy = vi.fn();
      vi.doMock('@/lib/supabase/server', () => ({ createClient: createClientSpy }));
      const { insertCriticFindingsRun } = await import('@/lib/data/report-critic-findings');
      const result = await insertCriticFindingsRun(
        'report-uuid',
        validVerdict,
        'writer_draft',
        { client: { rpc: rpcMock } as never },
      );
      expect(rpcMock).toHaveBeenCalledWith('insert_critic_findings_run', expect.any(Object));
      expect(createClientSpy).not.toHaveBeenCalled();
      expect(result.runId).toBe('run-1');
    });

    it('falls back to createClient when options omitted', async () => {
      const rpcMock = vi.fn().mockResolvedValue({ data: 'run-2', error: null });
      const createClientSpy = vi.fn().mockResolvedValue({ rpc: rpcMock });
      vi.doMock('@/lib/supabase/server', () => ({ createClient: createClientSpy }));
      const { insertCriticFindingsRun } = await import('@/lib/data/report-critic-findings');
      await insertCriticFindingsRun('report-uuid', validVerdict);
      expect(createClientSpy).toHaveBeenCalled();
    });
  });

  describe('getCriticFindingsByRunId', () => {
    it('uses options.client when provided (createClient NOT called)', async () => {
      const eqMock2 = vi.fn().mockResolvedValue({ data: [], error: null });
      const eqMock1 = vi.fn().mockReturnValue({ eq: eqMock2 });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock1 });
      const fromMock = vi.fn().mockReturnValue({ select: selectMock });
      const createClientSpy = vi.fn();
      vi.doMock('@/lib/supabase/server', () => ({ createClient: createClientSpy }));
      const { getCriticFindingsByRunId } = await import('@/lib/data/report-critic-findings');
      await getCriticFindingsByRunId('report-uuid', 'run-1', { client: { from: fromMock } as never });
      expect(fromMock).toHaveBeenCalledWith('report_critic_findings');
      expect(createClientSpy).not.toHaveBeenCalled();
    });

    it('falls back to createClient when options omitted', async () => {
      const eqMock2 = vi.fn().mockResolvedValue({ data: [], error: null });
      const eqMock1 = vi.fn().mockReturnValue({ eq: eqMock2 });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock1 });
      const fromMock = vi.fn().mockReturnValue({ select: selectMock });
      const createClientSpy = vi.fn().mockResolvedValue({ from: fromMock });
      vi.doMock('@/lib/supabase/server', () => ({ createClient: createClientSpy }));
      const { getCriticFindingsByRunId } = await import('@/lib/data/report-critic-findings');
      await getCriticFindingsByRunId('report-uuid', 'run-1');
      expect(createClientSpy).toHaveBeenCalled();
    });
  });

  describe('listLatestRunCriticFindings', () => {
    it('uses options.client when provided (createClient NOT called)', async () => {
      const maybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null });
      const limitMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
      const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
      const eqMock = vi.fn().mockReturnValue({ order: orderMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
      const fromMock = vi.fn().mockReturnValue({ select: selectMock });
      const createClientSpy = vi.fn();
      vi.doMock('@/lib/supabase/server', () => ({ createClient: createClientSpy }));
      const { listLatestRunCriticFindings } = await import('@/lib/data/report-critic-findings');
      await listLatestRunCriticFindings('report-uuid', { client: { from: fromMock } as never });
      expect(fromMock).toHaveBeenCalledWith('report_critic_findings');
      expect(createClientSpy).not.toHaveBeenCalled();
    });

    it('falls back to createClient when options omitted', async () => {
      const maybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null });
      const limitMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
      const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
      const eqMock = vi.fn().mockReturnValue({ order: orderMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
      const fromMock = vi.fn().mockReturnValue({ select: selectMock });
      const createClientSpy = vi.fn().mockResolvedValue({ from: fromMock });
      vi.doMock('@/lib/supabase/server', () => ({ createClient: createClientSpy }));
      const { listLatestRunCriticFindings } = await import('@/lib/data/report-critic-findings');
      await listLatestRunCriticFindings('report-uuid');
      expect(createClientSpy).toHaveBeenCalled();
    });
  });
});
