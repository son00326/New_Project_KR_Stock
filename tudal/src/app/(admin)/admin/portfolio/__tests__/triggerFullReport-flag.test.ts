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

// is_admin() RPC 기반 admin assertion (B65-P3 omxy R2 BLOCKER fix — admin_emails 직접 SELECT는
// RESTRICTIVE RLS로 불가, is_admin() SECURITY DEFINER RPC가 정답).
function mockAuthedClient(opts?: { isAdmin?: boolean }) {
  const isAdmin = opts?.isAdmin !== false;
  return {
    auth: {
      getUser: async () => ({
        data: { user: { id: 'admin-uid', email: 'admin@example.com' } },
        error: null,
      }),
    },
    rpc: async (fn: string) => {
      if (fn === 'is_admin') return { data: isAdmin, error: null };
      throw new Error(`unexpected_rpc:${fn}`);
    },
  };
}

describe('triggerFullReport — B65-P3 feature flag toggle (Test 1 action seam)', () => {
  // Test 8 — env cleanup (omxy R1 Kepler W2 + omxy R1 Mencius flake-guard): before+after 모두 delete.
  beforeEach(() => {
    vi.resetModules();
    delete process.env.PR4_TRIGGER_UPSERT_ENABLED;
    // PR-B2 (B7/D-8): cost-logging fail-closed guard 통과 위해 flag ON (PR4 flag와 독립).
    process.env.AI_COST_LOG_REAL_INSERT_ENABLED = 'true';
  });
  afterEach(() => {
    delete process.env.PR4_TRIGGER_UPSERT_ENABLED;
    delete process.env.AI_COST_LOG_REAL_INSERT_ENABLED;
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
    // PR-H scope 2: enrich source (flag=true도 orchestrate 직전 enrich 경유).
    vi.doMock('@/lib/data/admin-shortlist', () => ({
      getActiveShortList: vi.fn().mockResolvedValue([{ ticker: '005930', name: '삼성전자', sector: '반도체' }]),
    }));
    vi.doMock('@/lib/report/report-input-enricher', () => ({
      enrichReportInput: vi.fn().mockResolvedValue({
        tier1Verdict: 'BUY',
        consensusBadge: '🟢',
        financialsSummary: 'fin',
        technicalsSummary: 'tech',
        macroSummary: '근거 부족',
        sectorReference: 'ref',
      }),
    }));
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

  it("flag='true' + 비admin: admin_required + orchestrate NOT called (omxy R1 HIGH fix — cost-burn hole 차단)", async () => {
    process.env.PR4_TRIGGER_UPSERT_ENABLED = 'true';
    const reportExistsMock = vi.fn();
    const orchestrateMock = vi.fn();
    vi.doMock('@/lib/data/admin-reports', () => ({ reportExistsForMonth: reportExistsMock }));
    vi.doMock('@/lib/report/full-report-orchestrator', () => ({ orchestrateFullReport: orchestrateMock }));
    vi.doMock('@/lib/supabase/server', () => ({ createClient: async () => mockAuthedClient({ isAdmin: false }) }));
    const { triggerFullReport } = await import('../actions');
    const res = await triggerFullReport(validArgs);
    expect(res).toEqual({ success: false, error: 'admin_required' });
    // cost-burn 차단: admin assertion이 preflight/orchestrate보다 선행.
    expect(orchestrateMock).not.toHaveBeenCalled();
    expect(reportExistsMock).not.toHaveBeenCalled();
  });
});
