// PR4 Task 1 Step 1.1 — caller DI seam test for commitFullReport (B2 fix omxy R1).
// SoT plan: docs/superpowers/plans/2026-05-25-pr4-ui-caller-wire.md §Step 1.1.1 (lines 434-500).
//
// Plan code drift (Step 1.1.1 작성 시점 catch — omxy R1~R7 21 BLOCKERS catch 후 잔여):
//   plan mock rpc는 `{ data: { report_id }, error: null }` (success: true 누락).
//   writer.ts:194-195 `if (!data?.success) throw 'update_report_sections_0_7_failed:no_success'`로
//   commitFullReport throw → test FAIL. fix = mock에 `success: true` 추가 (기존 writer.test.ts:86 패턴 정합).
//
// 2 tests:
//   (a) options.client 주입 → fakeClient.rpc called (admin caller, RPC 도달)
//   (b) options 미지정 → createClient fallback (default behavior preserved)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validFullReportJson } from '@/test/fixtures/full-report-valid';

describe('commitFullReport — caller DI seam (PR4 Task 1 Step 1.1)', () => {
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

  it('uses injected client when options.client provided (admin caller, RPC 도달 + 전파 전체 검증)', async () => {
    // OMXY R1 B23 fix: §1.1.7 invariant 완전 고정 — injected client가 commitFullReport 본체에서
    // (1) preflightHardcap 2nd arg (2) callFullReport 2nd arg (3) final RPC 까지 모두 전파되는지
    // 명시 assert. 회귀 시 silent pass 차단.
    const fakeClient = {
      rpc: vi.fn().mockResolvedValue({
        data: { success: true, report_id: 'rpt-1' },
        error: null,
      }),
    };
    const preflightHardcapMock = vi.fn().mockResolvedValue(undefined);
    const callFullReportMock = vi.fn().mockResolvedValue({
      content: validFullReportJson(),
      usage: {
        input_tokens: 1,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        output_tokens: 1,
      },
      costKrw: 1,
    });
    const createClientSpy = vi.fn();
    vi.doMock('@/lib/supabase/server', () => ({ createClient: createClientSpy }));
    vi.doMock('@/lib/cost/cost-logger', () => ({
      preflightHardcap: preflightHardcapMock,
      insertCostLog: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock('@/lib/ai/full-report-client', () => ({
      callFullReport: callFullReportMock,
    }));
    const { commitFullReport } = await import('@/lib/report/full-report-writer');
    await commitFullReport(validInput, { client: fakeClient as never, callerKind: 'admin' });

    // (1) createClient NOT called — injected client가 fallback 차단.
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
    // (4) final RPC on injected client.
    expect(fakeClient.rpc).toHaveBeenCalledWith(
      'update_report_sections_0_7',
      expect.any(Object),
    );
  });

  it('STEP-2: callerKind=cron → preflightHardcap uses service-role cost path', async () => {
    const fakeClient = {
      rpc: vi.fn().mockResolvedValue({
        data: { success: true, report_id: 'rpt-cron' },
        error: null,
      }),
    };
    const preflightHardcapMock = vi.fn().mockResolvedValue(undefined);
    vi.doMock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
    vi.doMock('@/lib/cost/cost-logger', () => ({
      preflightHardcap: preflightHardcapMock,
      insertCostLog: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock('@/lib/ai/full-report-client', () => ({
      callFullReport: vi.fn().mockResolvedValue({
        content: validFullReportJson(),
        usage: {
          input_tokens: 1,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
          output_tokens: 1,
        },
        costKrw: 1,
      }),
    }));
    const { commitFullReport } = await import('@/lib/report/full-report-writer');
    await commitFullReport(validInput, { client: fakeClient as never, callerKind: 'cron' });

    expect(preflightHardcapMock).toHaveBeenCalledWith(
      expect.any(Object),
      { client: fakeClient, callerKind: 'service-role' },
    );
  });

  it('falls back to createClient when options omitted (default behavior preserved)', async () => {
    const createClientSpy = vi.fn().mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({
        data: { success: true, report_id: 'rpt-2' },
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
        usage: {
          input_tokens: 1,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
          output_tokens: 1,
        },
        costKrw: 1,
      }),
    }));
    const { commitFullReport } = await import('@/lib/report/full-report-writer');
    await commitFullReport(validInput); // options omitted
    expect(createClientSpy).toHaveBeenCalled();
  });
});
