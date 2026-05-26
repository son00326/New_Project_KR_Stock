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

  it('uses injected client when options.client provided (admin caller, RPC 도달)', async () => {
    const fakeClient = {
      rpc: vi.fn().mockResolvedValue({
        data: { success: true, report_id: 'rpt-1' },
        error: null,
      }),
    };
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
    await commitFullReport(validInput, { client: fakeClient as never, callerKind: 'admin' });
    expect(fakeClient.rpc).toHaveBeenCalledWith(
      'update_report_sections_0_7',
      expect.any(Object),
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
