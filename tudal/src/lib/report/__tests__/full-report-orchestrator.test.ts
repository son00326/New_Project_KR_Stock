// PR3c Task 6 — full-report-orchestrator test (3-step + conditional revise + persistence).
// SoT = plan v6, omxy R6 CONVERGED.

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const rpcMock = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    rpc: rpcMock,
  }),
}));

vi.mock('@/lib/cost/cost-logger', () => ({
  preflightHardcap: vi.fn().mockResolvedValue({ currentTotal: 0, reservation: 512, remaining: 399_488 }),
  insertCostLog: vi.fn().mockResolvedValue({ id: 'log-1' }),
}));

const callFullReportMock = vi.fn();
vi.mock('@/lib/ai/full-report-client', () => ({
  callFullReport: callFullReportMock,
}));

const evaluateReportMock = vi.fn();
vi.mock('@/lib/report/critic', () => ({
  evaluateReport: evaluateReportMock,
}));

const callReviseMock = vi.fn();
vi.mock('@/lib/ai/revise-client', () => ({
  callRevise: callReviseMock,
  REVISE_API_MODEL: 'claude-opus-4-7',
  REVISE_MAX_TOKENS: 8192,
}));

const insertCriticFindingsRunMock = vi.fn();
vi.mock('@/lib/data/report-critic-findings', () => ({
  insertCriticFindingsRun: insertCriticFindingsRunMock,
}));

const insertOrBumpBacklogMock = vi.fn();
vi.mock('@/lib/data/sector-reference-backlog', () => ({
  insertOrBumpBacklog: insertOrBumpBacklogMock,
}));

const commitSection8StepMock = vi.fn();
vi.mock('@/lib/report/section8-step', () => ({
  commitSection8Step: (...args: unknown[]) => commitSection8StepMock(...args),
  isAiBadge: (badge: string | null | undefined) => badge === '🟢' || badge === '🔵' || badge === '🟣' || badge === '🟡',
}));

// PR-T2a — sector board seam mock (flag-off in existing tests → not called → no impact).
const commitSectorBoardStepMock = vi.fn();
vi.mock('@/lib/report/sector-board-step', () => ({
  commitSectorBoardStep: (...args: unknown[]) => commitSectorBoardStepMock(...args),
}));

const happySections = {
  section_0: { headline: '예시', thesis: ['t1', 't2'], conviction: 72, committeeMini: { core: { approve: 7, reject: 2, abstain: 2 }, sector: { approve: 9, reject: 3, abstain: 2 } }, priceBands: { bear: '450,000원', base: '620,000원', bull: '820,000원' } },
  section_1: { description: '사업', segments: [{ name: 'A', share: '55%' }], keyFacts: [{ label: 'L', value: 'V' }] },
  section_2: { summary: '요약', revenue: [{ fy: '2025E', value: '1800억', yoy: '+38%' }], margins: { operating: '12%', net: '8%' }, balance: { debtRatio: '35%', cash: '2400억' } },
  section_3: { summary: '밸류', multiples: [{ metric: 'PSR', value: '18배', peer: '12배 (peer)' }] },
  section_4: { summary: '성장', drivers: ['d1'], tam: '40조' },
  section_5: { summary: '리스크', risks: [{ title: 'r', severity: 'high', detail: 'd' }] },
  section_6: { summary: '모멘텀', signals: [{ name: 'MACD', state: 'on', note: 'note' }], axis: { trend: 72, momentum: 65, volatility: 48 }, divergencePct: 3.4 },
  section_7: { summary: 'Exit', triggers: ['t1'], alternatives: [{ label: 'L', detail: 'D' }] },
  appendix: { technicals: [{ name: 'RSI', value: '58' }], dataSources: ['DART', 'pykrx'] },
};

const happyCritic = {
  verdict: {
    factuality: { verdict: 'PASS', reason: 'ok' },
    logic: { verdict: 'PASS', reason: 'ok' },
    completeness: { verdict: 'PASS', reason: 'ok' },
    structure: { verdict: 'PASS', reason: 'ok' },
    bias: { verdict: 'PASS', reason: 'ok' },
    reader_level: { verdict: 'PASS', reason: 'ok' },
  },
  shouldRevise: false,
  failCount: 0,
  warnCount: 0,
  costKrw: 5,
};

const baseInput = {
  ticker: '196170',
  name: '알테오젠',
  sector: '건설',  // Level A 부족 sector (backlog INSERT 진입)
  month: '2026-06',
  tier1Verdict: 'BUY' as const,
  consensusBadge: '🟢' as const,
  financialsSummary: 'finsum',
  technicalsSummary: 'techsum',
  macroSummary: 'macrosum',
  sectorReference: 'sectorref',
  adminUserId: 'u1',
};

describe('orchestrateFullReport — 3-step + conditional revise + persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: { success: true, report_id: 'r-uuid-1' }, error: null });
    callFullReportMock.mockReset();
    evaluateReportMock.mockReset();
    callReviseMock.mockReset();
    insertCriticFindingsRunMock.mockReset();
    insertOrBumpBacklogMock.mockReset();
    commitSection8StepMock.mockReset();
    commitSection8StepMock.mockResolvedValue({ status: 'committed', reportId: 'r-uuid-1' });
    commitSectorBoardStepMock.mockReset();
    commitSectorBoardStepMock.mockResolvedValue({ status: 'committed', reportId: 'r-uuid-1' });
    delete process.env.PR5B_SECTION8_ENABLED;
    delete process.env.SECTOR_BOARD_ENABLED;
  });
  afterEach(() => {
    delete process.env.PR5B_SECTION8_ENABLED;
    delete process.env.SECTOR_BOARD_ENABLED;
  });

  it('happy path (no revise) — writer 1회 + critic 1회 + revise 0회 + 3 RPC + criticRunId 반환', async () => {
    callFullReportMock.mockResolvedValueOnce({
      content: JSON.stringify(happySections),
      usage: { input_tokens: 3000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 6000 },
      costKrw: 236,
    });
    evaluateReportMock.mockResolvedValueOnce(happyCritic);
    insertCriticFindingsRunMock.mockResolvedValueOnce({ runId: 'critic-run-uuid-1' });

    const { orchestrateFullReport } = await import('@/lib/report/full-report-orchestrator');
    const result = await orchestrateFullReport(baseInput);

    expect(callFullReportMock).toHaveBeenCalledTimes(1);
    expect(evaluateReportMock).toHaveBeenCalledTimes(1);
    expect(callReviseMock).not.toHaveBeenCalled();  // critic PASS → no revise
    expect(rpcMock).toHaveBeenCalledTimes(1);  // update_report_sections_0_7
    expect(insertCriticFindingsRunMock).toHaveBeenCalledTimes(1);
    // PR4 Task 2 Step 2.1: caller DI seam — 4th/2nd arg = { client: undefined } when omitted.
    expect(insertCriticFindingsRunMock).toHaveBeenCalledWith(
      'r-uuid-1',
      happyCritic.verdict,
      'writer_draft',
      { client: undefined },
    );
    expect(insertOrBumpBacklogMock).toHaveBeenCalledWith('건설', { client: undefined });

    expect(result.reportId).toBe('r-uuid-1');
    expect(result.revised).toBe(false);
    expect(result.costKrw).toBe(236 + 5);  // writer + critic, revise 0
    expect(result.criticRunId).toBe('critic-run-uuid-1');  // B17 fix
  });

  // PR-T2a — SECTOR_BOARD_ENABLED seam (flag-gated, dormant by default).
  async function runHappy() {
    callFullReportMock.mockResolvedValueOnce({
      content: JSON.stringify(happySections),
      usage: { input_tokens: 3000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 6000 },
      costKrw: 236,
    });
    evaluateReportMock.mockResolvedValueOnce(happyCritic);
    insertCriticFindingsRunMock.mockResolvedValueOnce({ runId: 'critic-run-uuid-1' });
    const { orchestrateFullReport } = await import('@/lib/report/full-report-orchestrator');
    return orchestrateFullReport(baseInput);
  }

  it('SECTOR_BOARD_ENABLED unset → commitSectorBoardStep NOT called (dormant)', async () => {
    await runHappy();
    expect(commitSectorBoardStepMock).not.toHaveBeenCalled();
  });

  it('SECTOR_BOARD_ENABLED=true + PR5B_SECTION8_ENABLED unset → commitSectorBoardStep NOT called', async () => {
    process.env.SECTOR_BOARD_ENABLED = 'true';
    await runHappy();
    expect(commitSection8StepMock).not.toHaveBeenCalled();
    expect(commitSectorBoardStepMock).not.toHaveBeenCalled();
  });

  it('SECTOR_BOARD_ENABLED=true + PR5B_SECTION8_ENABLED=true + section8 committed → commitSectorBoardStep called with ticker/month/badge/adminUserId/client', async () => {
    process.env.SECTOR_BOARD_ENABLED = 'true';
    process.env.PR5B_SECTION8_ENABLED = 'true';
    await runHappy();
    expect(commitSection8StepMock).toHaveBeenCalledTimes(1);
    expect(commitSectorBoardStepMock).toHaveBeenCalledTimes(1);
    expect(commitSectorBoardStepMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ticker: '196170',
        month: '2026-06',
        badge: '🟢',
        adminUserId: 'u1',
      }),
    );
  });

  it('SECTOR_BOARD_ENABLED=true + PR5B_SECTION8_ENABLED=true + section8 unavailable → commitSectorBoardStep NOT called', async () => {
    process.env.SECTOR_BOARD_ENABLED = 'true';
    process.env.PR5B_SECTION8_ENABLED = 'true';
    commitSection8StepMock.mockResolvedValueOnce({ status: 'section8_unavailable' });

    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    await runHappy();
    expect(commitSection8StepMock).toHaveBeenCalledTimes(1);
    expect(commitSectorBoardStepMock).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledWith(
      JSON.stringify({
        event: 'commit_sector_board_skipped',
        ticker: '196170',
        month: '2026-06',
        status: 'section8_not_committed',
      }),
    );
    infoSpy.mockRestore();
  });

  it('critic FAIL → revise 1회 → orchestrator success (1회 hard cap)', async () => {
    callFullReportMock.mockResolvedValueOnce({
      content: JSON.stringify(happySections),
      usage: { input_tokens: 3000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 6000 },
      costKrw: 236,
    });
    const failCritic = {
      ...happyCritic,
      verdict: { ...happyCritic.verdict, logic: { verdict: 'FAIL', reason: '논거 비약' } },
      shouldRevise: true,
      failCount: 1,
    };
    evaluateReportMock.mockResolvedValueOnce(failCritic);
    callReviseMock.mockResolvedValueOnce({
      content: JSON.stringify(happySections),  // revised sections
      usage: { input_tokens: 8000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 6000 },
      costKrw: 271,
    });
    insertCriticFindingsRunMock.mockResolvedValueOnce({ runId: 'critic-run-uuid-2' });

    const { orchestrateFullReport } = await import('@/lib/report/full-report-orchestrator');
    const result = await orchestrateFullReport(baseInput);

    expect(callReviseMock).toHaveBeenCalledTimes(1);
    expect(evaluateReportMock).toHaveBeenCalledTimes(1);  // 1회 hard cap — critic 재호출 0
    expect(result.revised).toBe(true);
    expect(result.costKrw).toBe(236 + 5 + 271);
    expect(insertCriticFindingsRunMock).toHaveBeenCalledWith(
      'r-uuid-1',
      failCritic.verdict,
      'writer_draft',
      { client: undefined },
    );
  });

  it('writer FAIL → throw (orchestrator 진입 막힘)', async () => {
    callFullReportMock.mockRejectedValueOnce(new Error('full_report_llm_failed'));
    const { orchestrateFullReport } = await import('@/lib/report/full-report-orchestrator');
    await expect(orchestrateFullReport(baseInput)).rejects.toThrow('full_report_llm_failed');
    expect(evaluateReportMock).not.toHaveBeenCalled();
  });

  it('revise FAIL → throw (1회 hard cap, critic 재호출 0)', async () => {
    callFullReportMock.mockResolvedValueOnce({
      content: JSON.stringify(happySections),
      usage: { input_tokens: 3000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 6000 },
      costKrw: 236,
    });
    evaluateReportMock.mockResolvedValueOnce({ ...happyCritic, shouldRevise: true, failCount: 1 });
    callReviseMock.mockRejectedValueOnce(new Error('revise_llm_failed'));

    const { orchestrateFullReport } = await import('@/lib/report/full-report-orchestrator');
    await expect(orchestrateFullReport(baseInput)).rejects.toThrow('revise_llm_failed');
  });

  it('B21 fix — backlog INSERT throw → orchestrator success + warn (non-blocking)', async () => {
    callFullReportMock.mockResolvedValueOnce({
      content: JSON.stringify(happySections),
      usage: { input_tokens: 3000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 6000 },
      costKrw: 236,
    });
    evaluateReportMock.mockResolvedValueOnce(happyCritic);
    insertCriticFindingsRunMock.mockResolvedValueOnce({ runId: 'critic-run-uuid-3' });
    insertOrBumpBacklogMock.mockRejectedValueOnce(new Error('sector_reference_backlog_rpc_failed:XX001'));

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { orchestrateFullReport } = await import('@/lib/report/full-report-orchestrator');
    const result = await orchestrateFullReport(baseInput);
    expect(result.reportId).toBe('r-uuid-1');
    expect(result.revised).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('B17 — criticRunId 반환 + getCriticFindingsByRunId strict 조회 가능', async () => {
    callFullReportMock.mockResolvedValueOnce({
      content: JSON.stringify(happySections),
      usage: { input_tokens: 3000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 6000 },
      costKrw: 236,
    });
    evaluateReportMock.mockResolvedValueOnce(happyCritic);
    insertCriticFindingsRunMock.mockResolvedValueOnce({ runId: 'critic-run-uuid-4' });

    const { orchestrateFullReport } = await import('@/lib/report/full-report-orchestrator');
    const result = await orchestrateFullReport(baseInput);
    expect(result.criticRunId).toBe('critic-run-uuid-4');
    expect(typeof result.criticRunId).toBe('string');
  });

  it('Level A 보유 sector (바이오) → backlog INSERT skip (helper early return — B20)', async () => {
    callFullReportMock.mockResolvedValueOnce({
      content: JSON.stringify(happySections),
      usage: { input_tokens: 3000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 6000 },
      costKrw: 236,
    });
    evaluateReportMock.mockResolvedValueOnce(happyCritic);
    insertCriticFindingsRunMock.mockResolvedValueOnce({ runId: 'critic-run-uuid-5' });
    insertOrBumpBacklogMock.mockResolvedValueOnce(undefined);  // helper handles early return internally

    const inputBio = { ...baseInput, sector: '바이오' };
    const { orchestrateFullReport } = await import('@/lib/report/full-report-orchestrator');
    const result = await orchestrateFullReport(inputBio);
    expect(insertOrBumpBacklogMock).toHaveBeenCalledWith('바이오', { client: undefined });
    expect(result.reportId).toBe('r-uuid-1');
  });
});
