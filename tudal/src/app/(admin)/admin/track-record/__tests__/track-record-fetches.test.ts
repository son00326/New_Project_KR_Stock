// PR4 Task 3 Step 3.1 — fetchTrackRecordCumulative + fetchTrackRecordArchive unit tests.
// SoT plan: docs/superpowers/plans/2026-05-25-pr4-ui-caller-wire.md §Step 3.1 (lines 1052-1066).
// Group A + F 해소: Track Record 누적 vs 월별 아카이브 탭 분리.
//
// 별도 file로 분리 — actions.test.ts는 Tier 2 wiring (PR3c Step 3c) 대규모 mock 보존.
//
// fetchTrackRecordCumulative tests (3):
//   (1) 5 internal fetches all 성공 → bundle 반환 (summary/monthly/buckets/counterfactual/capMonths)
//   (2) all internal fetches return null/empty → bundle 반환 (defaults preserved, capMonths=0)
//   (3) decisionTree null → capMonths=0 fallback
//
// fetchTrackRecordArchive tests (6):
//   (1) stock_reports empty → []
//   (2) stock_reports multi-month + matching approvals → grouped + sorted desc
//   (3) month with reports but no approval → approval=null
//   (4) approval is_final priority: 동월에 final + non-final 둘 다 있으면 final 우선
//   (5) graceful: missing short_list_30 row → reports include null name/sector/bucket
//   (6) options.month drill-in (B33 omxy R1 fix) — 3 tables 모두 eq('month', '...') 호출 invariant
//
//   B32 fix omxy R1: 3 query 실제 병렬화 (Promise.all). thenable concurrent 실행 검증은
//                    observable stub가 invocation 순서를 보장하지 않음 (Promise.all 내부 schedule).
//                    test로 직접 verify 어렵 — 코드 리뷰 + grep으로 보장.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// hoisted mocks — actions.ts dynamic import에서 일관 적용.
const mocks = vi.hoisted(() => ({
  getPerformanceSummary: vi.fn(),
  getMonthlyPerformance: vi.fn(),
  getBucketPerformance: vi.fn(),
  getCounterfactual: vi.fn(),
  getDecisionTreeSnapshot: vi.fn(),
  computeCapMonths: vi.fn(),
  // supabase createClient → chain mock
  createClient: vi.fn(),
}));

vi.mock('@/lib/data/admin-performance', () => ({
  getPerformanceSummary: mocks.getPerformanceSummary,
  getMonthlyPerformance: mocks.getMonthlyPerformance,
  getBucketPerformance: mocks.getBucketPerformance,
  getCounterfactual: mocks.getCounterfactual,
}));
vi.mock('@/lib/data/admin-decision-tree', () => ({
  getDecisionTreeSnapshot: mocks.getDecisionTreeSnapshot,
}));
vi.mock('@/lib/performance/cap-months', () => ({
  computeCapMonths: mocks.computeCapMonths,
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ─── Supabase chain stub builder ─────────────────────────────────────────────
// 각 테이블별 chain (select → eq → order)에 대한 결과 주입.
interface TableStub {
  rows: unknown[];
  error?: { code?: string; message?: string } | null;
}

function buildSupabaseStub(byTable: Record<string, TableStub>) {
  function chain(table: string): unknown {
    const stub = byTable[table] ?? { rows: [], error: null };
    const result = { data: stub.rows, error: stub.error ?? null };
    return {
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: () => Promise.resolve(result),
            // direct await (without order)
            then: (resolve: (v: typeof result) => unknown) => resolve(result),
          }),
          order: () => Promise.resolve(result),
          then: (resolve: (v: typeof result) => unknown) => resolve(result),
        }),
        order: () => Promise.resolve(result),
        then: (resolve: (v: typeof result) => unknown) => resolve(result),
      }),
    };
  }
  return { from: (table: string) => chain(table) };
}

describe('fetchTrackRecordCumulative (PR4 Task 3 Step 3.1)', () => {
  it('returns full bundle when all 5 fetches succeed', async () => {
    mocks.getPerformanceSummary.mockResolvedValue({
      cumulativeReturn: 0.05,
      cumulativeKospi: 0.03,
      cumulativeAlpha: 0.02,
      cumulativeSharpe: 1.2,
      cumulativeMdd: -0.05,
      currentCapMonths: 0,
      dailyReturns: [],
      cumulativeValues: [],
    });
    mocks.getMonthlyPerformance.mockResolvedValue([
      { month: '2026-04-01', portfolioReturn: 0.05, kospiReturn: 0.03, alpha: 0.02, sharpe: 1.2, capStreak: 1 },
    ]);
    mocks.getBucketPerformance.mockResolvedValue([
      { bucket: 'short', cumulativeReturn: 0.04, sharpe: 1.1, tickerCount: 10 },
    ]);
    mocks.getCounterfactual.mockResolvedValue({
      aiOnlyReturn: 0.06,
      actualReturn: 0.05,
      deltaPct: 0.01,
      note: 'mock',
    });
    mocks.getDecisionTreeSnapshot.mockResolvedValue({
      monthlyVerdicts: ['o', 'o', 'x'],
    });
    mocks.computeCapMonths.mockReturnValue({ currentStreak: 2, history: [] });

    const { fetchTrackRecordCumulative } = await import('../actions');
    const result = await fetchTrackRecordCumulative();

    expect(result.summary?.cumulativeReturn).toBe(0.05);
    expect(result.monthly).toHaveLength(1);
    expect(result.buckets).toHaveLength(1);
    expect(result.counterfactual?.aiOnlyReturn).toBe(0.06);
    expect(result.capMonths).toBe(2);

    // 모두 호출 invariant (parallel Promise.all)
    expect(mocks.getPerformanceSummary).toHaveBeenCalledTimes(1);
    expect(mocks.getMonthlyPerformance).toHaveBeenCalledTimes(1);
    expect(mocks.getBucketPerformance).toHaveBeenCalledTimes(1);
    expect(mocks.getCounterfactual).toHaveBeenCalledTimes(1);
    expect(mocks.getDecisionTreeSnapshot).toHaveBeenCalledTimes(1);
    expect(mocks.computeCapMonths).toHaveBeenCalledWith(['o', 'o', 'x']);
  });

  it('returns bundle with defaults when all fetches return null/empty', async () => {
    mocks.getPerformanceSummary.mockResolvedValue(null);
    mocks.getMonthlyPerformance.mockResolvedValue([]);
    mocks.getBucketPerformance.mockResolvedValue([]);
    mocks.getCounterfactual.mockResolvedValue(null);
    mocks.getDecisionTreeSnapshot.mockResolvedValue(null);

    const { fetchTrackRecordCumulative } = await import('../actions');
    const result = await fetchTrackRecordCumulative();

    expect(result.summary).toBeNull();
    expect(result.monthly).toEqual([]);
    expect(result.buckets).toEqual([]);
    expect(result.counterfactual).toBeNull();
    expect(result.capMonths).toBe(0);
    // decisionTree null → computeCapMonths 미호출 (early branch invariant)
    expect(mocks.computeCapMonths).not.toHaveBeenCalled();
  });

  it('capMonths defaults to 0 when decisionTree is null', async () => {
    mocks.getPerformanceSummary.mockResolvedValue(null);
    mocks.getMonthlyPerformance.mockResolvedValue([]);
    mocks.getBucketPerformance.mockResolvedValue([]);
    mocks.getCounterfactual.mockResolvedValue(null);
    mocks.getDecisionTreeSnapshot.mockResolvedValue(null);

    const { fetchTrackRecordCumulative } = await import('../actions');
    const result = await fetchTrackRecordCumulative();
    expect(result.capMonths).toBe(0);
  });
});

describe('fetchTrackRecordArchive (PR4 Task 3 Step 3.1)', () => {
  it('returns [] when stock_reports empty', async () => {
    mocks.createClient.mockResolvedValue(
      buildSupabaseStub({
        stock_reports: { rows: [] },
        short_list_30: { rows: [] },
        portfolio_approval: { rows: [] },
      }),
    );

    const { fetchTrackRecordArchive } = await import('../actions');
    const result = await fetchTrackRecordArchive();
    expect(result).toEqual([]);
  });

  it('groups stock_reports by month + merges approval (sorted desc)', async () => {
    mocks.createClient.mockResolvedValue(
      buildSupabaseStub({
        stock_reports: {
          rows: [
            { month: '2026-04-01', ticker: '005930' },
            { month: '2026-04-01', ticker: '035420' },
            { month: '2026-03-01', ticker: '005930' },
          ],
        },
        short_list_30: {
          rows: [
            { month: '2026-04-01', ticker: '005930', name: '삼성전자', sector: '반도체', bucket: 'short' },
            { month: '2026-04-01', ticker: '035420', name: 'NAVER', sector: 'IT/SW', bucket: 'mid' },
            { month: '2026-03-01', ticker: '005930', name: '삼성전자', sector: '반도체', bucket: 'short' },
          ],
        },
        portfolio_approval: {
          rows: [
            {
              month: '2026-04-01',
              approval_type: 'accept',
              is_final: true,
              approved_at: '2026-04-02T10:00:00Z',
            },
            {
              month: '2026-03-01',
              approval_type: 'reject',
              is_final: false,
              approved_at: '2026-03-02T10:00:00Z',
            },
          ],
        },
      }),
    );

    const { fetchTrackRecordArchive } = await import('../actions');
    const result = await fetchTrackRecordArchive();

    expect(result).toHaveLength(2);
    // sorted desc by month
    expect(result[0].month).toBe('2026-04-01');
    expect(result[1].month).toBe('2026-03-01');

    // 2026-04 reports + approval
    expect(result[0].reports).toHaveLength(2);
    expect(result[0].reports.find((r) => r.ticker === '005930')).toEqual({
      ticker: '005930',
      name: '삼성전자',
      sector: '반도체',
      bucket: 'short',
    });
    expect(result[0].approval).toEqual({
      approvalType: 'accept',
      isFinal: true,
      approvedAt: '2026-04-02T10:00:00Z',
    });

    // 2026-03 reports + approval
    expect(result[1].reports).toHaveLength(1);
    expect(result[1].approval).toEqual({
      approvalType: 'reject',
      isFinal: false,
      approvedAt: '2026-03-02T10:00:00Z',
    });
  });

  it('approval=null when month has reports but no matching approval', async () => {
    mocks.createClient.mockResolvedValue(
      buildSupabaseStub({
        stock_reports: { rows: [{ month: '2026-04-01', ticker: '005930' }] },
        short_list_30: {
          rows: [{ month: '2026-04-01', ticker: '005930', name: '삼성전자', sector: '반도체', bucket: 'short' }],
        },
        portfolio_approval: { rows: [] },
      }),
    );

    const { fetchTrackRecordArchive } = await import('../actions');
    const result = await fetchTrackRecordArchive();
    expect(result).toHaveLength(1);
    expect(result[0].approval).toBeNull();
  });

  it('prefers is_final=true approval when multiple per month', async () => {
    mocks.createClient.mockResolvedValue(
      buildSupabaseStub({
        stock_reports: { rows: [{ month: '2026-04-01', ticker: '005930' }] },
        short_list_30: {
          rows: [{ month: '2026-04-01', ticker: '005930', name: '삼성전자', sector: '반도체', bucket: 'short' }],
        },
        portfolio_approval: {
          rows: [
            // non-final reject (decided earlier)
            {
              month: '2026-04-01',
              approval_type: 'reject',
              is_final: false,
              approved_at: '2026-04-01T10:00:00Z',
            },
            // final accept (decided later)
            {
              month: '2026-04-01',
              approval_type: 'accept',
              is_final: true,
              approved_at: '2026-04-02T15:00:00Z',
            },
          ],
        },
      }),
    );

    const { fetchTrackRecordArchive } = await import('../actions');
    const result = await fetchTrackRecordArchive();
    expect(result[0].approval).toEqual({
      approvalType: 'accept',
      isFinal: true,
      approvedAt: '2026-04-02T15:00:00Z',
    });
  });

  it('graceful: missing short_list_30 row → reports include null name/sector/bucket', async () => {
    mocks.createClient.mockResolvedValue(
      buildSupabaseStub({
        stock_reports: { rows: [{ month: '2026-04-01', ticker: '999999' }] },
        short_list_30: { rows: [] }, // empty — no match
        portfolio_approval: { rows: [] },
      }),
    );

    const { fetchTrackRecordArchive } = await import('../actions');
    const result = await fetchTrackRecordArchive();
    expect(result).toHaveLength(1);
    expect(result[0].reports[0]).toEqual({
      ticker: '999999',
      name: null,
      sector: null,
      bucket: null,
    });
  });

  it('options.month drill-in — 3 tables all filtered with eq("month", value) (B33 omxy R1 fix)', async () => {
    // observable stub: .eq() 호출 인자 기록 → 3 tables 모두 month 필터 회귀 차단.
    const eqCalls: Array<{ table: string; col: string; val: unknown }> = [];

    function buildObservableStub() {
      const emptyResult = { data: [], error: null };
      function innerChain(table: string): unknown {
        return {
          eq: (col: string, val: unknown) => {
            eqCalls.push({ table, col, val });
            return innerChain(table);
          },
          order: () => Promise.resolve(emptyResult),
          then: (resolve: (v: typeof emptyResult) => unknown) => resolve(emptyResult),
        };
      }
      return {
        from: (table: string) => ({
          select: () => innerChain(table),
        }),
      };
    }
    mocks.createClient.mockResolvedValue(buildObservableStub());

    const { fetchTrackRecordArchive } = await import('../actions');
    await fetchTrackRecordArchive({ month: '2026-04-01' });

    // 3 tables 모두 month='2026-04-01' eq 호출:
    //   stock_reports (is_latest=true 1st, month 2nd) + short_list_30 (month) + portfolio_approval (month)
    const monthEqs = eqCalls.filter((c) => c.col === 'month' && c.val === '2026-04-01');
    const tables = new Set(monthEqs.map((c) => c.table));
    expect(tables).toEqual(new Set(['stock_reports', 'short_list_30', 'portfolio_approval']));

    // stock_reports는 추가로 is_latest=true 필터 보장
    const isLatestEq = eqCalls.find(
      (c) => c.table === 'stock_reports' && c.col === 'is_latest' && c.val === true,
    );
    expect(isLatestEq).toBeDefined();
  });
});
