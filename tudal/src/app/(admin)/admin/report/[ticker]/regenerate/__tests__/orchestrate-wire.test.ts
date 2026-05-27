// PR4 Task 2 Step 2.3 — regenerateReport orchestrate wire failing test (caller DI seam invariant).
// SoT plan: docs/superpowers/plans/2026-05-25-pr4-ui-caller-wire.md §Step 2.3 (lines 1042-1048).
//
// PR4 §7.9 lesson 5중 invariant (B23~B28 silent-regression 차단):
//   (1) createClient 단일 호출 (auth용) + 그 client가 orchestrate 2nd arg로 정확 전파
//   (2) orchestrate 2nd arg = { client: supabaseClient, callerKind: 'admin' } 정확
//   (3) payload 11 fields invariant (ticker, name, sector, month, tier1Verdict, consensusBadge,
//       financials/technicals/macro/sector Summary, adminUserId) — input drift catch
//   (4) month 변환 invariant — input YYYY-MM-DD (regen-cap month) → orchestrate input YYYY-MM
//   (5) name/sector source invariant — getActiveShortList({month}).find(ticker) 정확 매핑
//
// 추가 시나리오:
//   (6) shortlist item not found → 'shortlist_item_not_found' (counter NOT incremented)
//   (7) shortlist lookup throws → 'shortlist_lookup_failed' (counter NOT incremented)
//   (8) orchestrate throws (validation/cost hardcap 등) → propagate error message
//   (9) reportId 반환 정합 (Step 2.3 핵심 deliverable — return shape +reportId)
//
// scope: orchestrate wire + caller DI + payload invariant. Tier 2/PR5 무관.
// existing actions.test.ts와 분리 — quota/validation 기존 테스트 보존.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 58차 Mock cleanup Step 2.3 — cost_log 실 SELECT (getMonthlyTotal) hoisted mock.
// 본 파일은 orchestrate wire 시나리오만 검증 — cost_log 합계는 default 0원 (hardcap unblocked).
// cost_log 특화 시나리오(throw/hardcap)는 actions.test.ts "cost_log 실 SELECT" describe로 분리.
const costMocks = vi.hoisted(() => ({
  getMonthlyTotal: vi.fn().mockResolvedValue(0),
}));
vi.mock('@/lib/cost/cost-logger', () => ({
  getMonthlyTotal: costMocks.getMonthlyTotal,
}));

const validInput = {
  ticker: '005930',
  month: '2026-04-01', // YYYY-MM-DD (regen-cap 형식)
};

const shortlistItemFixture = {
  id: 'sl-1',
  month: '2026-04-01',
  ticker: '005930',
  name: '삼성전자',
  sector: '반도체',
  bucket: 'short' as const,
  rank: 1,
  compositeScore: 80,
  trendScore: 75,
  momentumScore: 70,
  volatilityScore: 30,
  divergencePct: 1.2,
  sparkline7d: [],
  signalLabel: 'breakout',
  deltaStatus: 'hold' as const,
  deltaReason: '',
  summary3Line: '',
  suggestedWeight: 0.034,
  createdAt: '2026-04-01T00:00:00Z',
};

describe('regenerateReport orchestrate wire (PR4 Task 2 Step 2.3)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns success with reportId + caller DI seam invariant (B23-style 5중 assert)', async () => {
    // PR4 §7.9 lesson: 결과값 assert만으로는 silent regression 차단 불가.
    // (a) createClient called once (auth용)
    // (b) orchestrate 2nd arg = { client: supabaseClient, callerKind: 'admin' }
    // (c) payload 11 fields exact
    // (d) month conversion YYYY-MM-DD → YYYY-MM
    // (e) name/sector from shortlist row
    const supabaseClient = {
      auth: { getUser: async () => ({ data: { user: { id: 'admin-uid' } }, error: null }) },
    };
    const createClientSpy = vi.fn().mockResolvedValue(supabaseClient);
    const orchestrateMock = vi
      .fn()
      .mockResolvedValue({ reportId: 'rpt-005930-2026-04', costKrw: 535, revised: false });
    const reportExistsMock = vi.fn().mockResolvedValue(true);
    const getActiveShortListMock = vi.fn().mockResolvedValue([shortlistItemFixture]);
    const incrementMock = vi.fn().mockResolvedValue({ ok: true, manualCount: 1 });

    vi.doMock('@/lib/supabase/server', () => ({ createClient: createClientSpy }));
    vi.doMock('@/lib/data/admin-reports', () => ({ reportExistsForMonth: reportExistsMock }));
    vi.doMock('@/lib/data/admin-shortlist', () => ({ getActiveShortList: getActiveShortListMock }));
    vi.doMock('@/lib/data/admin-regen-counters', () => ({ incrementManualRegenCount: incrementMock }));
    vi.doMock('@/lib/report/full-report-orchestrator', () => ({ orchestrateFullReport: orchestrateMock }));

    const { regenerateReport } = await import('../actions');
    const res = await regenerateReport(validInput);

    expect(res).toEqual({
      success: true,
      data: {
        manualCount: 1,
        manualRemaining: 1,
        reportId: 'rpt-005930-2026-04',
      },
    });

    // (a) createClient single-call invariant (auth + DI both share 1 actions.ts-level client)
    expect(createClientSpy).toHaveBeenCalledTimes(1);

    // (b)+(c)+(d)+(e) orchestrate payload + 2nd arg STRICT invariant — omxy R1 B30 fix.
    // partial matcher는 extra field drift 통과시킴 → toStrictEqual 강제 (11 fields exact + options exact).
    expect(orchestrateMock).toHaveBeenCalledTimes(1);
    const [payloadArg, optionsArg] = orchestrateMock.mock.calls[0];
    expect(payloadArg).toStrictEqual({
      ticker: '005930',
      name: '삼성전자',
      sector: '반도체',
      month: '2026-04', // YYYY-MM (converted from 2026-04-01)
      tier1Verdict: 'HOLD',
      consensusBadge: '🟡',
      financialsSummary: '근거 부족',
      technicalsSummary: '근거 부족',
      macroSummary: '근거 부족',
      sectorReference: '근거 부족',
      adminUserId: 'admin-uid',
    });
    expect(optionsArg).toStrictEqual({ client: supabaseClient, callerKind: 'admin' });

    // (e') name/sector source invariant — getActiveShortList({month}) 인자 정확 (omxy R1 B31 fix).
    // 인자 없는 getActiveShortList() 회귀 차단 (최신월 fallback이 silent drift 만들 수 있음).
    expect(getActiveShortListMock).toHaveBeenCalledWith({ month: '2026-04-01' });

    // counter increment BEFORE orchestrate (재시도 폭증 차단 invariant)
    expect(incrementMock).toHaveBeenCalledWith('005930', '2026-04-01');
    const incrementOrder = incrementMock.mock.invocationCallOrder[0];
    const orchestrateOrder = orchestrateMock.mock.invocationCallOrder[0];
    expect(incrementOrder).toBeLessThan(orchestrateOrder);

    // shortlist BEFORE counter (cheap lookup fail-fast — counter 보존)
    const shortlistOrder = getActiveShortListMock.mock.invocationCallOrder[0];
    expect(shortlistOrder).toBeLessThan(incrementOrder);
  });

  // PR4 Task 9 Track 2 C-2 + omxy R4 B44 fix — silent-regression: shortlist row whitespace name/sector.
  it('returns shortlist_item_not_found for whitespace-only sector (C-2 fix — empty silent LLM degradation 차단)', async () => {
    const supabaseClient = {
      auth: { getUser: async () => ({ data: { user: { id: 'admin-uid' } }, error: null }) },
    };
    const orchestrateMock = vi.fn();
    const incrementMock = vi.fn();

    vi.doMock('@/lib/supabase/server', () => ({ createClient: async () => supabaseClient }));
    vi.doMock('@/lib/data/admin-reports', () => ({
      reportExistsForMonth: vi.fn().mockResolvedValue(true),
    }));
    vi.doMock('@/lib/data/admin-shortlist', () => ({
      getActiveShortList: vi.fn().mockResolvedValue([
        { ...shortlistItemFixture, sector: '   ' }, // whitespace sector
      ]),
    }));
    vi.doMock('@/lib/data/admin-regen-counters', () => ({ incrementManualRegenCount: incrementMock }));
    vi.doMock('@/lib/report/full-report-orchestrator', () => ({ orchestrateFullReport: orchestrateMock }));

    const { regenerateReport } = await import('../actions');
    const res = await regenerateReport(validInput);

    expect(res).toEqual({ success: false, error: 'shortlist_item_not_found' });
    expect(incrementMock).not.toHaveBeenCalled();
    expect(orchestrateMock).not.toHaveBeenCalled();
  });

  it('returns shortlist_item_not_found for whitespace-only name (C-2 fix)', async () => {
    const supabaseClient = {
      auth: { getUser: async () => ({ data: { user: { id: 'admin-uid' } }, error: null }) },
    };
    const orchestrateMock = vi.fn();
    const incrementMock = vi.fn();

    vi.doMock('@/lib/supabase/server', () => ({ createClient: async () => supabaseClient }));
    vi.doMock('@/lib/data/admin-reports', () => ({
      reportExistsForMonth: vi.fn().mockResolvedValue(true),
    }));
    vi.doMock('@/lib/data/admin-shortlist', () => ({
      getActiveShortList: vi.fn().mockResolvedValue([
        { ...shortlistItemFixture, name: '' }, // empty name
      ]),
    }));
    vi.doMock('@/lib/data/admin-regen-counters', () => ({ incrementManualRegenCount: incrementMock }));
    vi.doMock('@/lib/report/full-report-orchestrator', () => ({ orchestrateFullReport: orchestrateMock }));

    const { regenerateReport } = await import('../actions');
    const res = await regenerateReport(validInput);

    expect(res).toEqual({ success: false, error: 'shortlist_item_not_found' });
    expect(incrementMock).not.toHaveBeenCalled();
    expect(orchestrateMock).not.toHaveBeenCalled();
  });

  it('returns shortlist_item_not_found when ticker missing in current month shortlist (counter NOT incremented)', async () => {
    const supabaseClient = {
      auth: { getUser: async () => ({ data: { user: { id: 'admin-uid' } }, error: null }) },
    };
    const orchestrateMock = vi.fn();
    const incrementMock = vi.fn();

    vi.doMock('@/lib/supabase/server', () => ({ createClient: async () => supabaseClient }));
    vi.doMock('@/lib/data/admin-reports', () => ({
      reportExistsForMonth: vi.fn().mockResolvedValue(true),
    }));
    vi.doMock('@/lib/data/admin-shortlist', () => ({
      getActiveShortList: vi.fn().mockResolvedValue([]), // empty — ticker absent
    }));
    vi.doMock('@/lib/data/admin-regen-counters', () => ({ incrementManualRegenCount: incrementMock }));
    vi.doMock('@/lib/report/full-report-orchestrator', () => ({ orchestrateFullReport: orchestrateMock }));

    const { regenerateReport } = await import('../actions');
    const res = await regenerateReport(validInput);

    expect(res).toEqual({ success: false, error: 'shortlist_item_not_found' });
    expect(incrementMock).not.toHaveBeenCalled();
    expect(orchestrateMock).not.toHaveBeenCalled();
  });

  it('returns shortlist_lookup_failed when getActiveShortList throws (counter NOT incremented)', async () => {
    const supabaseClient = {
      auth: { getUser: async () => ({ data: { user: { id: 'admin-uid' } }, error: null }) },
    };
    const orchestrateMock = vi.fn();
    const incrementMock = vi.fn();

    vi.doMock('@/lib/supabase/server', () => ({ createClient: async () => supabaseClient }));
    vi.doMock('@/lib/data/admin-reports', () => ({
      reportExistsForMonth: vi.fn().mockResolvedValue(true),
    }));
    vi.doMock('@/lib/data/admin-shortlist', () => ({
      getActiveShortList: vi.fn().mockRejectedValue(new Error('rls denied')),
    }));
    vi.doMock('@/lib/data/admin-regen-counters', () => ({ incrementManualRegenCount: incrementMock }));
    vi.doMock('@/lib/report/full-report-orchestrator', () => ({ orchestrateFullReport: orchestrateMock }));

    const { regenerateReport } = await import('../actions');
    const res = await regenerateReport(validInput);

    expect(res).toEqual({ success: false, error: 'shortlist_lookup_failed' });
    expect(incrementMock).not.toHaveBeenCalled();
    expect(orchestrateMock).not.toHaveBeenCalled();
  });

  it('propagates orchestrate error message (e.g., cost_hardcap_40man, full_report_validation_failed)', async () => {
    // Step 2.2 trigger-full-report-action 패턴 동일 — orchestrate throw 시 error.message 전파.
    const supabaseClient = {
      auth: { getUser: async () => ({ data: { user: { id: 'admin-uid' } }, error: null }) },
    };
    vi.doMock('@/lib/supabase/server', () => ({ createClient: async () => supabaseClient }));
    vi.doMock('@/lib/data/admin-reports', () => ({
      reportExistsForMonth: vi.fn().mockResolvedValue(true),
    }));
    vi.doMock('@/lib/data/admin-shortlist', () => ({
      getActiveShortList: vi.fn().mockResolvedValue([shortlistItemFixture]),
    }));
    vi.doMock('@/lib/data/admin-regen-counters', () => ({
      incrementManualRegenCount: vi.fn().mockResolvedValue({ ok: true, manualCount: 1 }),
    }));
    vi.doMock('@/lib/report/full-report-orchestrator', () => ({
      orchestrateFullReport: vi
        .fn()
        .mockRejectedValue(new Error('full_report_validation_failed:section_0:headline')),
    }));

    const { regenerateReport } = await import('../actions');
    const res = await regenerateReport(validInput);
    expect(res).toEqual({
      success: false,
      error: 'full_report_validation_failed:section_0:headline',
    });
  });

  it('propagates cost_hardcap_40man from orchestrate', async () => {
    const supabaseClient = {
      auth: { getUser: async () => ({ data: { user: { id: 'admin-uid' } }, error: null }) },
    };
    vi.doMock('@/lib/supabase/server', () => ({ createClient: async () => supabaseClient }));
    vi.doMock('@/lib/data/admin-reports', () => ({
      reportExistsForMonth: vi.fn().mockResolvedValue(true),
    }));
    vi.doMock('@/lib/data/admin-shortlist', () => ({
      getActiveShortList: vi.fn().mockResolvedValue([shortlistItemFixture]),
    }));
    vi.doMock('@/lib/data/admin-regen-counters', () => ({
      incrementManualRegenCount: vi.fn().mockResolvedValue({ ok: true, manualCount: 1 }),
    }));
    vi.doMock('@/lib/report/full-report-orchestrator', () => ({
      orchestrateFullReport: vi.fn().mockRejectedValue(new Error('cost_hardcap_40man')),
    }));

    const { regenerateReport } = await import('../actions');
    const res = await regenerateReport(validInput);
    expect(res).toEqual({ success: false, error: 'cost_hardcap_40man' });
  });

  it('rejects when auth unavailable (user null) — orchestrate NOT called', async () => {
    const orchestrateMock = vi.fn();
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: null }, error: null }) },
      }),
    }));
    vi.doMock('@/lib/data/admin-reports', () => ({
      reportExistsForMonth: vi.fn().mockResolvedValue(true),
    }));
    vi.doMock('@/lib/data/admin-shortlist', () => ({ getActiveShortList: vi.fn() }));
    vi.doMock('@/lib/data/admin-regen-counters', () => ({ incrementManualRegenCount: vi.fn() }));
    vi.doMock('@/lib/report/full-report-orchestrator', () => ({
      orchestrateFullReport: orchestrateMock,
    }));

    // auth_unavailable은 production 모드에서만 — dev fallback 'admin-001'.
    // 일관성 위해 production stub (vi.stubEnv readonly 회피).
    vi.stubEnv('NODE_ENV', 'production');

    const { regenerateReport } = await import('../actions');
    const res = await regenerateReport(validInput);
    expect(res).toEqual({ success: false, error: 'auth_unavailable' });
    expect(orchestrateMock).not.toHaveBeenCalled();
  });
});
