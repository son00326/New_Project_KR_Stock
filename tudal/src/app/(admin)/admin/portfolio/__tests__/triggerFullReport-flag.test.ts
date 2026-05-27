// B65-P3 Test 1 (action seam) — triggerFullReport feature flag toggle invariant.
// plan: docs/superpowers/plans/2026-05-26-b65-p3-feature-flag-impl.md §5 Test 1 + Test 8.
//
// 별도 파일 (omxy R1 Schop B8 fix — seam 분리). 기존 trigger-full-report-action.test.ts는
// flag unset(default false) 가정 → 본 파일이 env를 set/cleanup하여 오염 차단 (Test 8 env cleanup).
//
// invariant:
//   - flag unset/'false': B65-P1 guard 진입 (reportExistsForMonth called).
//   - flag='true': B65-P1 guard skip (reportExistsForMonth NOT called) + orchestrate(callerKind='admin') 진입.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const validArgs = {
  ticker: '005930',
  name: '삼성전자',
  sector: '반도체',
  month: '2026-06',
};

function mockAuthedClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: 'admin-uid' } }, error: null }),
    },
  };
}

describe('triggerFullReport — B65-P3 feature flag toggle (Test 1 action seam)', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  // Test 8 — env cleanup (omxy R1 Kepler W2 fix): 매 테스트 후 flag 제거하여 누수 0.
  afterEach(() => {
    delete process.env.PR4_TRIGGER_UPSERT_ENABLED;
  });

  it('flag unset (default false): B65-P1 guard 진입 — reportExistsForMonth called + report_not_found', async () => {
    const reportExistsMock = vi.fn().mockResolvedValue(false);
    const orchestrateMock = vi.fn();
    vi.doMock('@/lib/data/admin-reports', () => ({ reportExistsForMonth: reportExistsMock }));
    vi.doMock('@/lib/report/full-report-orchestrator', () => ({ orchestrateFullReport: orchestrateMock }));
    vi.doMock('@/lib/supabase/server', () => ({ createClient: async () => mockAuthedClient() }));
    const { triggerFullReport } = await import('../actions');
    const res = await triggerFullReport(validArgs);
    expect(res).toEqual({ success: false, error: 'report_not_found' });
    expect(reportExistsMock).toHaveBeenCalledTimes(1);
    expect(orchestrateMock).not.toHaveBeenCalled();
  });

  it("flag='false' (strict true 아님): B65-P1 guard 진입 (fallback)", async () => {
    process.env.PR4_TRIGGER_UPSERT_ENABLED = 'false';
    const reportExistsMock = vi.fn().mockResolvedValue(false);
    const orchestrateMock = vi.fn();
    vi.doMock('@/lib/data/admin-reports', () => ({ reportExistsForMonth: reportExistsMock }));
    vi.doMock('@/lib/report/full-report-orchestrator', () => ({ orchestrateFullReport: orchestrateMock }));
    vi.doMock('@/lib/supabase/server', () => ({ createClient: async () => mockAuthedClient() }));
    const { triggerFullReport } = await import('../actions');
    const res = await triggerFullReport(validArgs);
    expect(res).toEqual({ success: false, error: 'report_not_found' });
    expect(reportExistsMock).toHaveBeenCalledTimes(1);
    expect(orchestrateMock).not.toHaveBeenCalled();
  });

  it("flag='true': B65-P1 guard skip — reportExistsForMonth NOT called + orchestrate(callerKind='admin') 진입", async () => {
    process.env.PR4_TRIGGER_UPSERT_ENABLED = 'true';
    // false를 반환하도록 mock — 하지만 호출 자체가 안 되어야 함 (skip invariant).
    const reportExistsMock = vi.fn().mockResolvedValue(false);
    const supabaseClient = mockAuthedClient();
    const orchestrateMock = vi
      .fn()
      .mockResolvedValue({ reportId: 'rpt-upsert-1', costKrw: 535, revised: false });
    vi.doMock('@/lib/data/admin-reports', () => ({ reportExistsForMonth: reportExistsMock }));
    vi.doMock('@/lib/report/full-report-orchestrator', () => ({ orchestrateFullReport: orchestrateMock }));
    vi.doMock('@/lib/supabase/server', () => ({ createClient: async () => supabaseClient }));
    const { triggerFullReport } = await import('../actions');
    const res = await triggerFullReport(validArgs);
    expect(res).toEqual({ success: true, data: { reportId: 'rpt-upsert-1' } });
    // B65-P3 invariant: flag=true 시 preflight skip (row 부재여도 orchestrate 진입).
    expect(reportExistsMock).not.toHaveBeenCalled();
    expect(orchestrateMock).toHaveBeenCalledWith(
      expect.objectContaining({ ticker: '005930', adminUserId: 'admin-uid' }),
      { client: supabaseClient, callerKind: 'admin' },
    );
  });
});
