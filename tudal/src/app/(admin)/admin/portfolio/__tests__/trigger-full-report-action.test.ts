// PR4 Task 1 Step 1.2.1 — triggerFullReport server action failing test (B3+B9 fix omxy R1+R2).
// SoT plan: docs/superpowers/plans/2026-05-25-pr4-ui-caller-wire.md §Step 1.2.1 (lines 625-684).
//
// 57차 §1 — Task 2 B65-P1 immediate guard 추가 (omxy R1 CONVERGED):
//   기존 (1)~(8) 테스트 중 (5)~(8)은 reportExistsForMonth: true mock 추가 (preflight 통과).
//   신규 (9)~(12) 테스트 = B65-P1 invariant.
//
// 12 tests:
//   (1) empty ticker → invalid_input
//   (2) name missing → invalid_input
//   (3) ticker format invalid (not 6 digits) → invalid_ticker
//   (4) month format invalid (YYYY-MM-DD) → invalid_month
//   (5) success — orchestrateFullReport resolves (Task 2 Step 2.2 quality swap, preflight true)
//   (6) auth unavailable — supabase user null → auth_unavailable
//   (7) orchestrateFullReport throws full_report_validation_failed → propagate
//   (8) orchestrateFullReport throws cost_hardcap_40man → propagate
//   (9) B65-P1: reportExistsForMonth returns false → report_not_found + orchestrate NOT called
//   (10) B65-P1: reportExistsForMonth throws → report_lookup_failed + orchestrate NOT called
//   (11) B65-P1: reportExistsForMonth called with `${month}-01` (B86 invariant)
//   (12) B65-P1: silent regression — preflight after auth, before dynamic import
//
// scope: trigger 서버 액션의 입력 검증 + auth + B65-P1 preflight + orchestrateFullReport wire만.
// Task 2 Step 2.2 박제: commit → orchestrate swap. Tier 2/PR5 무관.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const validArgs = {
  ticker: '005930',
  name: '삼성전자',
  sector: '반도체',
  month: '2026-06',
};

describe('triggerFullReport admin server action (PR4 Task 1 Step 1.2)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('rejects when input.ticker empty (invalid_input)', async () => {
    const { triggerFullReport } = await import('../actions');
    const res = await triggerFullReport({ ...validArgs, ticker: '' });
    expect(res).toEqual({ success: false, error: 'invalid_input' });
  });

  it('rejects when input.name missing (invalid_input)', async () => {
    const { triggerFullReport } = await import('../actions');
    // @ts-expect-error — runtime invalid_input 검증 (name 누락 시나리오)
    const res = await triggerFullReport({ ticker: '005930', sector: '반도체', month: '2026-06' });
    expect(res).toEqual({ success: false, error: 'invalid_input' });
  });

  it('rejects when ticker format invalid (not 6 digits)', async () => {
    const { triggerFullReport } = await import('../actions');
    const res = await triggerFullReport({ ...validArgs, ticker: 'AAPL' });
    expect(res).toEqual({ success: false, error: 'invalid_ticker' });
  });

  it('rejects when month format invalid (YYYY-MM-DD → not allowed, YYYY-MM only)', async () => {
    const { triggerFullReport } = await import('../actions');
    const res = await triggerFullReport({ ...validArgs, month: '2026-06-01' });
    expect(res).toEqual({ success: false, error: 'invalid_month' });
  });

  // PR4 Task 9 Track 2 C-2 + omxy R4 B44 fix — silent-regression test.
  // page.tsx의 `sector ?? ""` 회피 path가 빈 문자열을 propagate해서 writer prompt가 degrade되는 것을 차단.
  it('rejects whitespace-only name (C-2 fix — empty name → invalid_input, orchestrate NOT called)', async () => {
    const orchestrateMock = vi.fn();
    vi.doMock('@/lib/report/full-report-orchestrator', () => ({
      orchestrateFullReport: orchestrateMock,
    }));
    const { triggerFullReport } = await import('../actions');
    const res = await triggerFullReport({ ...validArgs, name: '   ' });
    expect(res).toEqual({ success: false, error: 'invalid_input' });
    expect(orchestrateMock).not.toHaveBeenCalled();
  });

  it('rejects empty sector (C-2 fix — sector ?? "" propagation 차단, orchestrate NOT called)', async () => {
    const orchestrateMock = vi.fn();
    vi.doMock('@/lib/report/full-report-orchestrator', () => ({
      orchestrateFullReport: orchestrateMock,
    }));
    const { triggerFullReport } = await import('../actions');
    const res = await triggerFullReport({ ...validArgs, sector: '' });
    expect(res).toEqual({ success: false, error: 'invalid_input' });
    expect(orchestrateMock).not.toHaveBeenCalled();
  });

  it('rejects whitespace-only sector (C-2 fix — trim() guard, orchestrate NOT called)', async () => {
    const orchestrateMock = vi.fn();
    vi.doMock('@/lib/report/full-report-orchestrator', () => ({
      orchestrateFullReport: orchestrateMock,
    }));
    const { triggerFullReport } = await import('../actions');
    const res = await triggerFullReport({ ...validArgs, sector: '\t \n' });
    expect(res).toEqual({ success: false, error: 'invalid_input' });
    expect(orchestrateMock).not.toHaveBeenCalled();
  });

  it('returns success when orchestrateFullReport succeeds + caller DI seam invariant (Task 2 Step 2.2 swap)', async () => {
    // Task 2 Step 2.2 박제: admin path = orchestrateFullReport (quality, Kevin v3.1 target).
    // B24 invariant 유지 — input fields + options {client, callerKind} 정확 전파.
    // 57차 §1 — B65-P1 preflight 통과 위해 reportExistsForMonth: true mock (omxy R1 권고 c).
    const orchestrateFullReportMock = vi
      .fn()
      .mockResolvedValue({ reportId: 'rpt-1', costKrw: 535, revised: false });
    const supabaseClient = {
      auth: { getUser: async () => ({ data: { user: { id: 'admin-uid' } }, error: null }) },
    };
    vi.doMock('@/lib/data/admin-reports', () => ({
      reportExistsForMonth: vi.fn().mockResolvedValue(true),
    }));
    vi.doMock('@/lib/report/full-report-orchestrator', () => ({
      orchestrateFullReport: orchestrateFullReportMock,
    }));
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: async () => supabaseClient,
    }));
    const { triggerFullReport } = await import('../actions');
    const res = await triggerFullReport(validArgs);
    expect(res).toEqual({ success: true, data: { reportId: 'rpt-1' } });
    // B24 invariant (Task 2 quality path): 4-field args + options {client, callerKind: 'admin'}.
    // silent regression 차단:
    //   - 2nd arg 누락 / { client: undefined, callerKind: 'admin' } → FAIL
    //   - callerKind: 'cron' → FAIL (admin path는 'admin')
    //   - adminUserId 누락/하드코딩 → FAIL
    //   - prompt-valid stub drift (HOLD / 🟡 / 근거 부족) → FAIL
    //   - orchestrate → commit 역회귀 (fast path 회귀) → mock 미호출 → FAIL
    expect(orchestrateFullReportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ticker: '005930',
        name: '삼성전자',
        sector: '반도체',
        month: '2026-06',
        tier1Verdict: 'HOLD',
        consensusBadge: '🟡',
        financialsSummary: '근거 부족',
        technicalsSummary: '근거 부족',
        macroSummary: '근거 부족',
        sectorReference: '근거 부족',
        adminUserId: 'admin-uid',
      }),
      { client: supabaseClient, callerKind: 'admin' },
    );
  });

  it('returns error when auth unavailable (user null)', async () => {
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: null }, error: null }) },
      }),
    }));
    const { triggerFullReport } = await import('../actions');
    const res = await triggerFullReport(validArgs);
    expect(res).toEqual({ success: false, error: 'auth_unavailable' });
  });

  it('returns error when orchestrateFullReport throws full_report_validation_failed', async () => {
    // 57차 §1 — B65-P1 preflight 통과 위해 reportExistsForMonth: true mock.
    vi.doMock('@/lib/data/admin-reports', () => ({
      reportExistsForMonth: vi.fn().mockResolvedValue(true),
    }));
    vi.doMock('@/lib/report/full-report-orchestrator', () => ({
      orchestrateFullReport: vi
        .fn()
        .mockRejectedValue(new Error('full_report_validation_failed:section_0:headline')),
    }));
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: { id: 'admin-uid' } }, error: null }) },
      }),
    }));
    const { triggerFullReport } = await import('../actions');
    const res = await triggerFullReport(validArgs);
    expect(res).toEqual({
      success: false,
      error: 'full_report_validation_failed:section_0:headline',
    });
  });

  it('returns error when orchestrateFullReport throws cost_hardcap_40man', async () => {
    // 57차 §1 — B65-P1 preflight 통과 위해 reportExistsForMonth: true mock.
    vi.doMock('@/lib/data/admin-reports', () => ({
      reportExistsForMonth: vi.fn().mockResolvedValue(true),
    }));
    vi.doMock('@/lib/report/full-report-orchestrator', () => ({
      orchestrateFullReport: vi.fn().mockRejectedValue(new Error('cost_hardcap_40man')),
    }));
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: { id: 'admin-uid' } }, error: null }) },
      }),
    }));
    const { triggerFullReport } = await import('../actions');
    const res = await triggerFullReport(validArgs);
    expect(res).toEqual({ success: false, error: 'cost_hardcap_40man' });
  });

  // ---------------------------------------------------------------------------
  // 57차 §1 — Task 2 B65-P1 immediate guard invariants (omxy R1 CONVERGED).
  //
  // HANDOFF §9.2 박제: update_report_sections_0_7 UPDATE-only RPC가 row 부재 시
  // fail → 1~3 LLM call 비용 burn. Preflight cheap SELECT로 fail-fast.
  // B86: input.month YYYY-MM → stock_reports.month (date) YYYY-MM-01 변환 (preflight 전용).
  // ---------------------------------------------------------------------------

  it('B65-P1 (9): reportExistsForMonth returns false → report_not_found + orchestrate NOT called', async () => {
    const reportExistsMock = vi.fn().mockResolvedValue(false);
    const orchestrateMock = vi.fn();
    vi.doMock('@/lib/data/admin-reports', () => ({
      reportExistsForMonth: reportExistsMock,
    }));
    vi.doMock('@/lib/report/full-report-orchestrator', () => ({
      orchestrateFullReport: orchestrateMock,
    }));
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: { id: 'admin-uid' } }, error: null }) },
      }),
    }));
    const { triggerFullReport } = await import('../actions');
    const res = await triggerFullReport(validArgs);
    expect(res).toEqual({ success: false, error: 'report_not_found' });
    expect(reportExistsMock).toHaveBeenCalledTimes(1);
    // cost burn 차단 invariant: orchestrate 미진입.
    expect(orchestrateMock).not.toHaveBeenCalled();
  });

  it('B65-P1 (10): reportExistsForMonth throws → report_lookup_failed + orchestrate NOT called', async () => {
    const reportExistsMock = vi
      .fn()
      .mockRejectedValue(new Error('stock_reports existence check failed: rls denied'));
    const orchestrateMock = vi.fn();
    vi.doMock('@/lib/data/admin-reports', () => ({
      reportExistsForMonth: reportExistsMock,
    }));
    vi.doMock('@/lib/report/full-report-orchestrator', () => ({
      orchestrateFullReport: orchestrateMock,
    }));
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: { id: 'admin-uid' } }, error: null }) },
      }),
    }));
    const { triggerFullReport } = await import('../actions');
    const res = await triggerFullReport(validArgs);
    expect(res).toEqual({ success: false, error: 'report_lookup_failed' });
    expect(orchestrateMock).not.toHaveBeenCalled();
  });

  it('B65-P1 (11): reportExistsForMonth called with `${month}-01` (B86 month format invariant)', async () => {
    const reportExistsMock = vi.fn().mockResolvedValue(true);
    const orchestrateMock = vi
      .fn()
      .mockResolvedValue({ reportId: 'rpt-2', costKrw: 0, revised: false });
    vi.doMock('@/lib/data/admin-reports', () => ({
      reportExistsForMonth: reportExistsMock,
    }));
    vi.doMock('@/lib/report/full-report-orchestrator', () => ({
      orchestrateFullReport: orchestrateMock,
    }));
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: { id: 'admin-uid' } }, error: null }) },
      }),
    }));
    const { triggerFullReport } = await import('../actions');
    const res = await triggerFullReport({ ...validArgs, month: '2026-06' });
    expect(res.success).toBe(true);
    // B86 invariant: input month=YYYY-MM → preflight call args=(ticker, 'YYYY-MM-01').
    expect(reportExistsMock).toHaveBeenCalledWith('005930', '2026-06-01');
    // orchestrate payload month는 YYYY-MM 유지 (omxy R1 (e) — preflight 전용 변환).
    expect(orchestrateMock).toHaveBeenCalledWith(
      expect.objectContaining({ month: '2026-06' }),
      expect.anything(),
    );
  });

  it('B65-P1 (12): preflight after auth, before orchestrate (silent regression — call order invariant)', async () => {
    const callOrder: string[] = [];
    const getUserMock = vi.fn(async () => {
      callOrder.push('auth.getUser');
      return { data: { user: { id: 'admin-uid' } }, error: null };
    });
    const reportExistsMock = vi.fn(async () => {
      callOrder.push('reportExistsForMonth');
      return true;
    });
    const orchestrateMock = vi.fn(async () => {
      callOrder.push('orchestrateFullReport');
      return { reportId: 'rpt-3', costKrw: 0, revised: false };
    });
    vi.doMock('@/lib/data/admin-reports', () => ({
      reportExistsForMonth: reportExistsMock,
    }));
    vi.doMock('@/lib/report/full-report-orchestrator', () => ({
      orchestrateFullReport: orchestrateMock,
    }));
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: async () => ({
        auth: { getUser: getUserMock },
      }),
    }));
    const { triggerFullReport } = await import('../actions');
    await triggerFullReport(validArgs);
    expect(callOrder).toEqual([
      'auth.getUser',
      'reportExistsForMonth',
      'orchestrateFullReport',
    ]);
  });
});
