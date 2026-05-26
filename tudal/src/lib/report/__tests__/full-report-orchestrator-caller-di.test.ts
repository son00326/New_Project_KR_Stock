// PR4 Task 2 Step 2.1 — caller DI seam test for orchestrateFullReport.
// Step 1.1 (commitFullReport) 패턴과 동일 invariant — admin quality path 활성 시 모든 helper
// (preflightHardcap / callFullReport / evaluateReport→callCritic / callRevise /
// insertCriticFindingsRun / insertOrBumpBacklog / RPC update) 4 layer까지 client 전파.
//
// 2 tests:
//   (a) options.client 주입 → fakeClient.rpc called + 모든 chain helper에 client 전파
//   (b) options 미지정 → createClient fallback (default behavior preserved)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validFullReportJson } from '@/test/fixtures/full-report-valid';

describe('orchestrateFullReport — caller DI seam (PR4 Task 2 Step 2.1)', () => {
  beforeEach(() => vi.resetModules());

  const validInput = {
    ticker: '005930',
    name: '삼성전자',
    sector: '반도체',
    month: '2026-06',
    tier1Verdict: 'HOLD' as const,
    consensusBadge: '🟡' as const,
    financialsSummary: '근거 부족',
    technicalsSummary: '근거 부족',
    macroSummary: '근거 부족',
    sectorReference: '근거 부족',
    adminUserId: 'admin-uid',
  };

  // Critic verdict (all PASS, shouldRevise=false → revise path 건너뜀)
  const passVerdict = {
    factuality: { verdict: 'PASS' as const, reason: 'ok' },
    logic: { verdict: 'PASS' as const, reason: 'ok' },
    completeness: { verdict: 'PASS' as const, reason: 'ok' },
    structure: { verdict: 'PASS' as const, reason: 'ok' },
    bias: { verdict: 'PASS' as const, reason: 'ok' },
    reader_level: { verdict: 'PASS' as const, reason: 'ok' },
  };

  it('uses injected client when options.client provided (admin quality, RPC 도달 + 전파)', async () => {
    const fakeClient = {
      rpc: vi.fn().mockResolvedValue({
        data: { success: true, report_id: 'rpt-orch-1' },
        error: null,
      }),
    };
    const preflightHardcapMock = vi.fn().mockResolvedValue(undefined);
    const callFullReportMock = vi.fn().mockResolvedValue({
      content: validFullReportJson(),
      usage: { input_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 1 },
      costKrw: 1,
    });
    const evaluateReportMock = vi.fn().mockResolvedValue({
      verdict: passVerdict,
      shouldRevise: false,
      failCount: 0,
      warnCount: 0,
      costKrw: 1,
    });
    const insertCriticFindingsRunMock = vi
      .fn()
      .mockResolvedValue({ runId: 'crit-run-1' });
    const insertOrBumpBacklogMock = vi.fn().mockResolvedValue(undefined);
    const createClientSpy = vi.fn();
    vi.doMock('@/lib/supabase/server', () => ({ createClient: createClientSpy }));
    vi.doMock('@/lib/cost/cost-logger', () => ({
      preflightHardcap: preflightHardcapMock,
      insertCostLog: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock('@/lib/ai/full-report-client', () => ({
      callFullReport: callFullReportMock,
    }));
    vi.doMock('@/lib/report/critic', () => ({
      evaluateReport: evaluateReportMock,
      REVISE_TRIGGER_WARN_THRESHOLD: 4,
    }));
    vi.doMock('@/lib/data/report-critic-findings', () => ({
      insertCriticFindingsRun: insertCriticFindingsRunMock,
    }));
    vi.doMock('@/lib/data/sector-reference-backlog', () => ({
      insertOrBumpBacklog: insertOrBumpBacklogMock,
    }));
    const { orchestrateFullReport } = await import('@/lib/report/full-report-orchestrator');
    const result = await orchestrateFullReport(validInput, {
      client: fakeClient as never,
      callerKind: 'admin',
    });

    // (1) createClient NOT called.
    expect(createClientSpy).not.toHaveBeenCalled();
    // (2) preflightHardcap 2nd arg propagation.
    expect(preflightHardcapMock).toHaveBeenCalledWith(
      expect.any(Object),
      { client: fakeClient },
    );
    // (3) callFullReport 2nd arg propagation.
    expect(callFullReportMock).toHaveBeenCalledWith(
      expect.any(Object),
      { client: fakeClient },
    );
    // (4) evaluateReport 3rd arg propagation (caller DI through critic chain).
    expect(evaluateReportMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      { client: fakeClient },
    );
    // (5) insertCriticFindingsRun 4th arg propagation.
    expect(insertCriticFindingsRunMock).toHaveBeenCalledWith(
      'rpt-orch-1',
      passVerdict,
      'writer_draft',
      { client: fakeClient },
    );
    // (6) insertOrBumpBacklog 2nd arg propagation.
    expect(insertOrBumpBacklogMock).toHaveBeenCalledWith(
      '반도체',
      { client: fakeClient },
    );
    // (7) RPC on injected client.
    expect(fakeClient.rpc).toHaveBeenCalledWith(
      'update_report_sections_0_7',
      expect.any(Object),
    );
    // (8) reportId 반환.
    expect(result.reportId).toBe('rpt-orch-1');
    expect(result.revised).toBe(false);
  });

  it('propagates client to callRevise when shouldRevise=true (B27 fix omxy R1)', async () => {
    // OMXY R1 B27 fix: caller-di test가 shouldRevise=false라 revise branch 스킵 →
    // callRevise(..., {client: undefined}) 회귀 silent pass. shouldRevise=true path 별도 검증.
    const fakeClient = {
      rpc: vi.fn().mockResolvedValue({
        data: { success: true, report_id: 'rpt-orch-revise-1' },
        error: null,
      }),
    };
    // failCount: 1 → shouldRevise=true (Q3 threshold)
    const failVerdict = {
      ...passVerdict,
      factuality: { verdict: 'FAIL' as const, reason: '근거 부족' },
    };
    const callReviseMock = vi.fn().mockResolvedValue({
      content: validFullReportJson(),
      usage: { input_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 1 },
      costKrw: 272,
    });
    vi.doMock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
    vi.doMock('@/lib/cost/cost-logger', () => ({
      preflightHardcap: vi.fn().mockResolvedValue(undefined),
      insertCostLog: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock('@/lib/ai/full-report-client', () => ({
      callFullReport: vi.fn().mockResolvedValue({
        content: validFullReportJson(),
        usage: { input_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 1 },
        costKrw: 236,
      }),
    }));
    vi.doMock('@/lib/ai/revise-client', () => ({
      callRevise: callReviseMock,
    }));
    vi.doMock('@/lib/report/critic', () => ({
      evaluateReport: vi.fn().mockResolvedValue({
        verdict: failVerdict,
        shouldRevise: true,
        failCount: 1,
        warnCount: 0,
        costKrw: 27,
      }),
      REVISE_TRIGGER_WARN_THRESHOLD: 4,
    }));
    vi.doMock('@/lib/data/report-critic-findings', () => ({
      insertCriticFindingsRun: vi.fn().mockResolvedValue({ runId: 'crit-run-revise-1' }),
    }));
    vi.doMock('@/lib/data/sector-reference-backlog', () => ({
      insertOrBumpBacklog: vi.fn().mockResolvedValue(undefined),
    }));
    const { orchestrateFullReport } = await import('@/lib/report/full-report-orchestrator');
    const result = await orchestrateFullReport(validInput, {
      client: fakeClient as never,
      callerKind: 'admin',
    });

    // B27 invariant: callRevise 2nd arg client propagation.
    expect(callReviseMock).toHaveBeenCalledWith(
      expect.any(Object),
      { client: fakeClient },
    );
    expect(result.revised).toBe(true);
    expect(result.reportId).toBe('rpt-orch-revise-1');
  });

  it('falls back to createClient when options omitted (default behavior preserved)', async () => {
    const createClientSpy = vi.fn().mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({
        data: { success: true, report_id: 'rpt-orch-2' },
        error: null,
      }),
    });
    vi.doMock('@/lib/supabase/server', () => ({ createClient: createClientSpy }));
    vi.doMock('@/lib/cost/cost-logger', () => ({
      preflightHardcap: vi.fn().mockResolvedValue(undefined),
      insertCostLog: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock('@/lib/ai/full-report-client', () => ({
      callFullReport: vi.fn().mockResolvedValue({
        content: validFullReportJson(),
        usage: { input_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 1 },
        costKrw: 1,
      }),
    }));
    vi.doMock('@/lib/report/critic', () => ({
      evaluateReport: vi.fn().mockResolvedValue({
        verdict: passVerdict,
        shouldRevise: false,
        failCount: 0,
        warnCount: 0,
        costKrw: 1,
      }),
      REVISE_TRIGGER_WARN_THRESHOLD: 4,
    }));
    vi.doMock('@/lib/data/report-critic-findings', () => ({
      insertCriticFindingsRun: vi.fn().mockResolvedValue({ runId: 'crit-run-2' }),
    }));
    vi.doMock('@/lib/data/sector-reference-backlog', () => ({
      insertOrBumpBacklog: vi.fn().mockResolvedValue(undefined),
    }));
    const { orchestrateFullReport } = await import('@/lib/report/full-report-orchestrator');
    await orchestrateFullReport(validInput); // options omitted
    expect(createClientSpy).toHaveBeenCalled();
  });
});
