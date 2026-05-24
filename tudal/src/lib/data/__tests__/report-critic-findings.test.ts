// PR3c Task 8 — report-critic-findings helper test (B6 + B7 + B12 + B19 fix).

import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => {
  const rpc = vi.fn();
  const selectChain = (returnData: unknown[]) => ({
    select: () => ({
      eq: () => ({
        order: () => ({ limit: () => ({ maybeSingle: () => ({ data: returnData[0] ?? null, error: null }) }) }),
        eq: () => ({ data: returnData, error: null }),
      }),
    }),
  });
  return {
    createClient: vi.fn().mockResolvedValue({
      rpc,
      from: vi.fn().mockReturnValue(selectChain([])),
    }),
    __rpc: rpc,
  };
});

const happyVerdict = {
  factuality: { verdict: 'PASS' as const, reason: 'ok' },
  logic: { verdict: 'WARN' as const, reason: 'mid' },
  completeness: { verdict: 'PASS' as const, reason: 'ok' },
  structure: { verdict: 'PASS' as const, reason: 'ok' },
  bias: { verdict: 'PASS' as const, reason: 'ok' },
  reader_level: { verdict: 'PASS' as const, reason: 'ok' },
};

describe('insertCriticFindingsRun — atomic RPC (B6 + B7 + B19)', () => {
  beforeEach(async () => {
    const sb = await import('@/lib/supabase/server');
    const rpc = (sb as unknown as { __rpc: ReturnType<typeof vi.fn> }).__rpc;
    rpc.mockReset();
    rpc.mockResolvedValue({ data: 'run-uuid-1', error: null });
  });

  it('happy path — RPC 호출 + run_id 반환 + target_stage default writer_draft', async () => {
    const sb = await import('@/lib/supabase/server');
    const rpc = (sb as unknown as { __rpc: ReturnType<typeof vi.fn> }).__rpc;
    const { insertCriticFindingsRun } = await import('@/lib/data/report-critic-findings');
    const result = await insertCriticFindingsRun('report-id-1', happyVerdict);
    expect(rpc).toHaveBeenCalledWith('insert_critic_findings_run', {
      p_report_id: 'report-id-1',
      p_verdict: happyVerdict,
      p_target_stage: 'writer_draft',
    });
    expect(result.runId).toBe('run-uuid-1');
  });

  it('target_stage="revised" 명시 호출 (미래 확장 hook)', async () => {
    const sb = await import('@/lib/supabase/server');
    const rpc = (sb as unknown as { __rpc: ReturnType<typeof vi.fn> }).__rpc;
    const { insertCriticFindingsRun } = await import('@/lib/data/report-critic-findings');
    await insertCriticFindingsRun('report-id-1', happyVerdict, 'revised');
    expect(rpc).toHaveBeenCalledWith('insert_critic_findings_run', {
      p_report_id: 'report-id-1',
      p_verdict: happyVerdict,
      p_target_stage: 'revised',
    });
  });

  it('RPC error → report_critic_findings_rpc_failed throw', async () => {
    const sb = await import('@/lib/supabase/server');
    const rpc = (sb as unknown as { __rpc: ReturnType<typeof vi.fn> }).__rpc;
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'P0001', message: 'fail' } });
    const { insertCriticFindingsRun } = await import('@/lib/data/report-critic-findings');
    await expect(insertCriticFindingsRun('r1', happyVerdict)).rejects.toThrow(
      /report_critic_findings_rpc_failed:P0001/,
    );
  });
});

describe('getCriticFindingsByRunId — B12 fix strict latest', () => {
  it('reportId + runId pinning으로 strict 조회', async () => {
    const { getCriticFindingsByRunId } = await import('@/lib/data/report-critic-findings');
    const result = await getCriticFindingsByRunId('report-id-1', 'run-uuid-1');
    expect(Array.isArray(result)).toBe(true);
  });
});
