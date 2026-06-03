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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const validArgs = {
  ticker: '005930',
  name: '삼성전자',
  sector: '반도체',
  month: '2026-06',
};

// B65-P3 omxy R2 BLOCKER fix — triggerFullReport는 getUser 직후 is_admin() RPC로 admin assertion
// (admin_emails 직접 SELECT는 RESTRICTIVE RLS로 불가). 기존 success/orchestrate path 테스트는
// is_admin → true mock 필요 (없으면 admin_required로 조기 반환).
const adminRpc = async (fn: string) => {
  if (fn === 'is_admin') return { data: true, error: null };
  throw new Error(`unexpected_rpc:${fn}`);
};

// PR-H scope 2 — enrich source. triggerFullReport은 getActiveShortList({month-01})로 row 조회 후
// enrichReportInput(row)로 stub 6필드 교체. 아래 fixture/enriched는 success/order 테스트 공용.
const shortlistRowFixture = {
  id: 'sl-1',
  month: '2026-06-01',
  ticker: '005930',
  name: '삼성전자',
  sector: '반도체',
  bucket: 'short',
  rank: 1,
  compositeScore: 80,
  trendScore: 75,
  momentumScore: 70,
  volatilityScore: 30,
  divergencePct: 1.2,
  sparkline7d: [],
  signalLabel: 'breakout',
  deltaStatus: 'hold',
  deltaReason: '',
  summary3Line: '',
  suggestedWeight: 0.034,
  createdAt: '2026-06-01T00:00:00Z',
  consensusBadge: '🟢',
  aiScore: 82,
};
const ENRICHED = {
  tier1Verdict: 'BUY',
  consensusBadge: '🟢',
  financialsSummary: '[005930 2024 연간] 매출 100억 · ROE 12.0%',
  technicalsSummary: '종합 80 · 추세 75 · 모멘텀 70 · 변동성 30 · breakout',
  macroSummary: '근거 부족',
  sectorReference: '반도체 섹터 Level A 레퍼런스 적용',
};

describe('triggerFullReport admin server action (PR4 Task 1 Step 1.2)', () => {
  beforeEach(() => {
    vi.resetModules();
    // B65-P3 omxy R2 flake-guard: shell env에 PR4_TRIGGER_UPSERT_ENABLED=true 잔존 시
    // B65-P1 default/preflight regression 테스트가 무력화될 수 있어 명시 delete.
    delete process.env.PR4_TRIGGER_UPSERT_ENABLED;
    // PR-B2 (B7/D-8): triggerFullReport은 실 AI 전 isCostLoggingEnabled() fail-closed guard. happy-path는 flag ON.
    process.env.AI_COST_LOG_REAL_INSERT_ENABLED = 'true';
  });
  afterEach(() => {
    delete process.env.PR4_TRIGGER_UPSERT_ENABLED;
    delete process.env.AI_COST_LOG_REAL_INSERT_ENABLED;
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
      auth: { getUser: async () => ({ data: { user: { id: 'admin-uid', email: 'admin@example.com' } }, error: null }) },
      rpc: adminRpc,
    };
    const getActiveShortListMock = vi.fn().mockResolvedValue([shortlistRowFixture]);
    const enrichMock = vi.fn().mockResolvedValue({ ...ENRICHED });
    vi.doMock('@/lib/data/admin-reports', () => ({
      reportExistsForMonth: vi.fn().mockResolvedValue(true),
    }));
    vi.doMock('@/lib/data/admin-shortlist', () => ({
      getActiveShortList: getActiveShortListMock,
    }));
    vi.doMock('@/lib/report/report-input-enricher', () => ({
      enrichReportInput: enrichMock,
    }));
    vi.doMock('@/lib/report/full-report-orchestrator', () => ({
      orchestrateFullReport: orchestrateFullReportMock,
    }));
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: async () => supabaseClient,
    }));
    const { triggerFullReport } = await import('../actions');
    const res = await triggerFullReport({
      ...validArgs,
      name: '클라이언트 입력명',
      sector: '클라이언트 입력섹터',
    });
    expect(res).toEqual({ success: true, data: { reportId: 'rpt-1' } });
    // B24 invariant (Task 2 quality path): 4-field args + options {client, callerKind: 'admin'}.
    // PR-H scope 2: stub 6필드 → enrichReportInput(shortlist row) 실값 swap.
    // silent regression 차단:
    //   - 2nd arg 누락 / { client: undefined, callerKind: 'admin' } → FAIL
    //   - callerKind: 'cron' → FAIL (admin path는 'admin')
    //   - adminUserId 누락/하드코딩 → FAIL
    //   - enrich stub 역회귀 (HOLD / 🟡 / 근거 부족 재등장) → FAIL
    //   - orchestrate → commit 역회귀 (fast path 회귀) → mock 미호출 → FAIL
    expect(orchestrateFullReportMock).toHaveBeenCalledTimes(1);
    const [payloadArg, optionsArg] = orchestrateFullReportMock.mock.calls[0];
    expect(payloadArg).toStrictEqual({
      ticker: '005930',
      name: '삼성전자',
      sector: '반도체',
      month: '2026-06',
      tier1Verdict: ENRICHED.tier1Verdict,
      consensusBadge: ENRICHED.consensusBadge,
      financialsSummary: ENRICHED.financialsSummary,
      technicalsSummary: ENRICHED.technicalsSummary,
      macroSummary: ENRICHED.macroSummary,
      sectorReference: ENRICHED.sectorReference,
      adminUserId: 'admin-uid',
    });
    expect(optionsArg).toStrictEqual({ client: supabaseClient, callerKind: 'admin' });
    // PR-H — enrich/name/sector source invariant: short_list_30 row + same caller client.
    // Client-supplied name/sector drift must not leak into the LLM prompt.
    expect(getActiveShortListMock).toHaveBeenCalledWith({
      month: '2026-06-01',
      client: supabaseClient,
    });
    expect(enrichMock).toHaveBeenCalledTimes(1);
    const [enrichItemArg, enrichOptArg] = enrichMock.mock.calls[0];
    expect(enrichItemArg).toMatchObject({ ticker: '005930' });
    expect(enrichOptArg).toEqual({ client: supabaseClient });
  });

  // PR-H scope 2 — ticker가 이번 달 shortlist에 없으면 shortlist_item_not_found (enrich/orchestrate NOT called).
  it('rejects when ticker missing from current month shortlist (shortlist_item_not_found)', async () => {
    const orchestrateMock = vi.fn();
    const enrichMock = vi.fn();
    const supabaseClient = {
      auth: { getUser: async () => ({ data: { user: { id: 'admin-uid' } }, error: null }) },
      rpc: adminRpc,
    };
    vi.doMock('@/lib/data/admin-reports', () => ({
      reportExistsForMonth: vi.fn().mockResolvedValue(true),
    }));
    vi.doMock('@/lib/data/admin-shortlist', () => ({
      getActiveShortList: vi.fn().mockResolvedValue([]), // ticker absent
    }));
    vi.doMock('@/lib/report/report-input-enricher', () => ({ enrichReportInput: enrichMock }));
    vi.doMock('@/lib/report/full-report-orchestrator', () => ({ orchestrateFullReport: orchestrateMock }));
    vi.doMock('@/lib/supabase/server', () => ({ createClient: async () => supabaseClient }));
    const { triggerFullReport } = await import('../actions');
    const res = await triggerFullReport(validArgs);
    expect(res).toEqual({ success: false, error: 'shortlist_item_not_found' });
    expect(enrichMock).not.toHaveBeenCalled();
    expect(orchestrateMock).not.toHaveBeenCalled();
  });

  it('rejects when matched shortlist row has empty name/sector (row SoT prompt degradation 차단)', async () => {
    const orchestrateMock = vi.fn();
    const enrichMock = vi.fn();
    const supabaseClient = {
      auth: { getUser: async () => ({ data: { user: { id: 'admin-uid' } }, error: null }) },
      rpc: adminRpc,
    };
    vi.doMock('@/lib/data/admin-reports', () => ({
      reportExistsForMonth: vi.fn().mockResolvedValue(true),
    }));
    vi.doMock('@/lib/data/admin-shortlist', () => ({
      getActiveShortList: vi.fn().mockResolvedValue([
        { ...shortlistRowFixture, name: ' ', sector: '반도체' },
      ]),
    }));
    vi.doMock('@/lib/report/report-input-enricher', () => ({ enrichReportInput: enrichMock }));
    vi.doMock('@/lib/report/full-report-orchestrator', () => ({ orchestrateFullReport: orchestrateMock }));
    vi.doMock('@/lib/supabase/server', () => ({ createClient: async () => supabaseClient }));
    const { triggerFullReport } = await import('../actions');
    const res = await triggerFullReport(validArgs);
    expect(res).toEqual({ success: false, error: 'shortlist_item_not_found' });
    expect(enrichMock).not.toHaveBeenCalled();
    expect(orchestrateMock).not.toHaveBeenCalled();
  });

  it('returns shortlist_lookup_failed when short_list_30 lookup throws (raw DB error 노출 차단)', async () => {
    const orchestrateMock = vi.fn();
    const enrichMock = vi.fn();
    const supabaseClient = {
      auth: { getUser: async () => ({ data: { user: { id: 'admin-uid' } }, error: null }) },
      rpc: adminRpc,
    };
    vi.doMock('@/lib/data/admin-reports', () => ({
      reportExistsForMonth: vi.fn().mockResolvedValue(true),
    }));
    vi.doMock('@/lib/data/admin-shortlist', () => ({
      getActiveShortList: vi.fn().mockRejectedValue(new Error('short_list_30 query failed: rls denied')),
    }));
    vi.doMock('@/lib/report/report-input-enricher', () => ({ enrichReportInput: enrichMock }));
    vi.doMock('@/lib/report/full-report-orchestrator', () => ({ orchestrateFullReport: orchestrateMock }));
    vi.doMock('@/lib/supabase/server', () => ({ createClient: async () => supabaseClient }));
    const { triggerFullReport } = await import('../actions');
    const res = await triggerFullReport(validArgs);
    expect(res).toEqual({ success: false, error: 'shortlist_lookup_failed' });
    expect(enrichMock).not.toHaveBeenCalled();
    expect(orchestrateMock).not.toHaveBeenCalled();
  });

  it('propagates enrich financials SELECT code while keeping orchestrate cost 0', async () => {
    const orchestrateMock = vi.fn();
    const supabaseClient = {
      auth: { getUser: async () => ({ data: { user: { id: 'admin-uid' } }, error: null }) },
      rpc: adminRpc,
    };
    vi.doMock('@/lib/data/admin-reports', () => ({
      reportExistsForMonth: vi.fn().mockResolvedValue(true),
    }));
    vi.doMock('@/lib/data/admin-shortlist', () => ({
      getActiveShortList: vi.fn().mockResolvedValue([shortlistRowFixture]),
    }));
    vi.doMock('@/lib/report/report-input-enricher', () => ({
      enrichReportInput: vi.fn().mockRejectedValue(new Error('financials_corp_lookup_failed:PGRST301')),
    }));
    vi.doMock('@/lib/report/full-report-orchestrator', () => ({ orchestrateFullReport: orchestrateMock }));
    vi.doMock('@/lib/supabase/server', () => ({ createClient: async () => supabaseClient }));
    const { triggerFullReport } = await import('../actions');
    const res = await triggerFullReport(validArgs);
    expect(res).toEqual({ success: false, error: 'financials_corp_lookup_failed:PGRST301' });
    expect(orchestrateMock).not.toHaveBeenCalled();
  });

  it('PR-B2 (B7/D-8): AI_COST_LOG_REAL_INSERT_ENABLED!==true → cost_logging_disabled + orchestrate NOT called (hardcap fail-open 차단)', async () => {
    process.env.AI_COST_LOG_REAL_INSERT_ENABLED = 'false';
    const orchestrateMock = vi.fn();
    const supabaseClient = {
      auth: { getUser: async () => ({ data: { user: { id: 'admin-uid', email: 'admin@example.com' } }, error: null }) },
      rpc: adminRpc,
    };
    vi.doMock('@/lib/report/full-report-orchestrator', () => ({
      orchestrateFullReport: orchestrateMock,
    }));
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: async () => supabaseClient,
    }));
    const { triggerFullReport } = await import('../actions');
    const res = await triggerFullReport(validArgs);
    // flag off → cost_log noop → getMonthlyTotal=0 → preflightHardcap fail-open이므로, 실 AI 진입 전 차단.
    expect(res).toEqual({ success: false, error: 'cost_logging_disabled' });
    expect(orchestrateMock).not.toHaveBeenCalled();
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
    vi.doMock('@/lib/data/admin-shortlist', () => ({
      getActiveShortList: vi.fn().mockResolvedValue([shortlistRowFixture]),
    }));
    vi.doMock('@/lib/report/report-input-enricher', () => ({
      enrichReportInput: vi.fn().mockResolvedValue({ ...ENRICHED }),
    }));
    vi.doMock('@/lib/report/full-report-orchestrator', () => ({
      orchestrateFullReport: vi
        .fn()
        .mockRejectedValue(new Error('full_report_validation_failed:section_0:headline')),
    }));
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: { id: 'admin-uid', email: 'admin@example.com' } }, error: null }) },
        rpc: adminRpc,
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
    vi.doMock('@/lib/data/admin-shortlist', () => ({
      getActiveShortList: vi.fn().mockResolvedValue([shortlistRowFixture]),
    }));
    vi.doMock('@/lib/report/report-input-enricher', () => ({
      enrichReportInput: vi.fn().mockResolvedValue({ ...ENRICHED }),
    }));
    vi.doMock('@/lib/report/full-report-orchestrator', () => ({
      orchestrateFullReport: vi.fn().mockRejectedValue(new Error('cost_hardcap_40man')),
    }));
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: { id: 'admin-uid', email: 'admin@example.com' } }, error: null }) },
        rpc: adminRpc,
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
        auth: { getUser: async () => ({ data: { user: { id: 'admin-uid', email: 'admin@example.com' } }, error: null }) },
        rpc: adminRpc,
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
        auth: { getUser: async () => ({ data: { user: { id: 'admin-uid', email: 'admin@example.com' } }, error: null }) },
        rpc: adminRpc,
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
    vi.doMock('@/lib/data/admin-shortlist', () => ({
      getActiveShortList: vi.fn().mockResolvedValue([shortlistRowFixture]),
    }));
    vi.doMock('@/lib/report/report-input-enricher', () => ({
      enrichReportInput: vi.fn().mockResolvedValue({ ...ENRICHED }),
    }));
    vi.doMock('@/lib/report/full-report-orchestrator', () => ({
      orchestrateFullReport: orchestrateMock,
    }));
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: { id: 'admin-uid', email: 'admin@example.com' } }, error: null }) },
        rpc: adminRpc,
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
    const getActiveShortListMock = vi.fn(async () => {
      callOrder.push('getActiveShortList');
      return [shortlistRowFixture];
    });
    const enrichMock = vi.fn(async () => {
      callOrder.push('enrichReportInput');
      return { ...ENRICHED };
    });
    const orchestrateMock = vi.fn(async () => {
      callOrder.push('orchestrateFullReport');
      return { reportId: 'rpt-3', costKrw: 0, revised: false };
    });
    vi.doMock('@/lib/data/admin-reports', () => ({
      reportExistsForMonth: reportExistsMock,
    }));
    vi.doMock('@/lib/data/admin-shortlist', () => ({
      getActiveShortList: getActiveShortListMock,
    }));
    vi.doMock('@/lib/report/report-input-enricher', () => ({
      enrichReportInput: enrichMock,
    }));
    vi.doMock('@/lib/report/full-report-orchestrator', () => ({
      orchestrateFullReport: orchestrateMock,
    }));
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: async () => ({
        auth: { getUser: getUserMock },
        rpc: adminRpc,
      }),
    }));
    const { triggerFullReport } = await import('../actions');
    await triggerFullReport(validArgs);
    // PR-H scope 2: enrich(getActiveShortList → enrichReportInput)는 preflight 후, orchestrate 직전.
    expect(callOrder).toEqual([
      'auth.getUser',
      'reportExistsForMonth',
      'getActiveShortList',
      'enrichReportInput',
      'orchestrateFullReport',
    ]);
  });
});
