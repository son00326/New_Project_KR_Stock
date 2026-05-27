// B65-P3 Test 2~6 + Test 8 (orchestrator seam) — UPSERT feature flag RPC dispatch invariants.
// plan: docs/superpowers/plans/2026-05-26-b65-p3-feature-flag-impl.md §5.
//
// caller DI seam (full-report-orchestrator-caller-di.test.ts 패턴) — options.client 주입 +
// LLM/helper deps mock으로 RPC dispatch branch까지 도달.
//
// Test 2: same-month 재호출 — 두 호출 모두 upsert RPC name.
// Test 3+4a: payload key set 11 keys exact (p_section_8/p_consensus_badge/p_version/regen 누설 0).
// Test 5: callerKind × flag matrix → rpcName (5 cases).
// Test 6: error literal substring preserve + cross-path leak 차단 (omxy R1 Schop B3).
// Test 8: env cleanup (afterEach) — flag 누수 0.
//
// DB-dependent smokes (Test 4b 2-phase INSERT/UPDATE + Test 7 auth 3-branch matrix)는
// vitest node 환경(pure logic only)에서 실행 불가 → PR body acceptance criteria + plan §3.3/§5에
// USER production pseudo-smoke로 박제.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validFullReportJson } from '@/test/fixtures/full-report-valid';

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

const passVerdict = {
  factuality: { verdict: 'PASS' as const, reason: 'ok' },
  logic: { verdict: 'PASS' as const, reason: 'ok' },
  completeness: { verdict: 'PASS' as const, reason: 'ok' },
  structure: { verdict: 'PASS' as const, reason: 'ok' },
  bias: { verdict: 'PASS' as const, reason: 'ok' },
  reader_level: { verdict: 'PASS' as const, reason: 'ok' },
};

const usage = {
  input_tokens: 1,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
  output_tokens: 1,
};

async function loadOrchestrateWithMocks(rpc: ReturnType<typeof vi.fn>) {
  const fakeClient = { rpc };
  vi.doMock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
  vi.doMock('@/lib/cost/cost-logger', () => ({
    preflightHardcap: vi.fn().mockResolvedValue(undefined),
    insertCostLog: vi.fn().mockResolvedValue(undefined),
  }));
  vi.doMock('@/lib/ai/full-report-client', () => ({
    callFullReport: vi.fn().mockResolvedValue({ content: validFullReportJson(), usage, costKrw: 1 }),
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
    insertCriticFindingsRun: vi.fn().mockResolvedValue({ runId: 'crit-run-1' }),
  }));
  vi.doMock('@/lib/data/sector-reference-backlog', () => ({
    insertOrBumpBacklog: vi.fn().mockResolvedValue(undefined),
  }));
  const { orchestrateFullReport } = await import('@/lib/report/full-report-orchestrator');
  return { orchestrateFullReport, fakeClient };
}

const okRpc = () =>
  vi.fn().mockResolvedValue({ data: { success: true, report_id: 'rpt-1' }, error: null });

describe('orchestrateFullReport — B65-P3 UPSERT feature flag (orchestrator seam)', () => {
  // Test 8 — env cleanup (omxy R1 Kepler W2 + Mencius flake-guard): before+after 모두 delete
  // (shell env에 PR4_TRIGGER_UPSERT_ENABLED=true 잔존 시 'unset' 테스트 flake 차단).
  beforeEach(() => {
    vi.resetModules();
    delete process.env.PR4_TRIGGER_UPSERT_ENABLED;
  });
  afterEach(() => {
    delete process.env.PR4_TRIGGER_UPSERT_ENABLED;
  });

  // ── Test 5: callerKind × flag matrix → rpcName ──────────────────────────────
  it('Test 5a: callerKind=admin + flag=true → upsert_report_sections_0_7_admin', async () => {
    process.env.PR4_TRIGGER_UPSERT_ENABLED = 'true';
    const rpc = okRpc();
    const { orchestrateFullReport, fakeClient } = await loadOrchestrateWithMocks(rpc);
    await orchestrateFullReport(validInput, { client: fakeClient as never, callerKind: 'admin' });
    expect(rpc).toHaveBeenCalledWith('upsert_report_sections_0_7_admin', expect.any(Object));
  });

  it('Test 5b: callerKind=admin + flag=false → update_report_sections_0_7', async () => {
    process.env.PR4_TRIGGER_UPSERT_ENABLED = 'false';
    const rpc = okRpc();
    const { orchestrateFullReport, fakeClient } = await loadOrchestrateWithMocks(rpc);
    await orchestrateFullReport(validInput, { client: fakeClient as never, callerKind: 'admin' });
    expect(rpc).toHaveBeenCalledWith('update_report_sections_0_7', expect.any(Object));
  });

  it('Test 5c: callerKind=admin + flag unset → update_report_sections_0_7 (safe default)', async () => {
    const rpc = okRpc();
    const { orchestrateFullReport, fakeClient } = await loadOrchestrateWithMocks(rpc);
    await orchestrateFullReport(validInput, { client: fakeClient as never, callerKind: 'admin' });
    expect(rpc).toHaveBeenCalledWith('update_report_sections_0_7', expect.any(Object));
  });

  it('Test 5d: callerKind=cron + flag=true → update_report_sections_0_7 (cron never uses new RPC)', async () => {
    process.env.PR4_TRIGGER_UPSERT_ENABLED = 'true';
    const rpc = okRpc();
    const { orchestrateFullReport, fakeClient } = await loadOrchestrateWithMocks(rpc);
    await orchestrateFullReport(validInput, { client: fakeClient as never, callerKind: 'cron' });
    expect(rpc).toHaveBeenCalledWith('update_report_sections_0_7', expect.any(Object));
  });

  it('Test 5e: callerKind undefined + flag=true → update_report_sections_0_7 (safe default)', async () => {
    process.env.PR4_TRIGGER_UPSERT_ENABLED = 'true';
    const rpc = okRpc();
    const { orchestrateFullReport, fakeClient } = await loadOrchestrateWithMocks(rpc);
    await orchestrateFullReport(validInput, { client: fakeClient as never });
    expect(rpc).toHaveBeenCalledWith('update_report_sections_0_7', expect.any(Object));
  });

  // ── Test 2: same-month 재호출 ───────────────────────────────────────────────
  it('Test 2: admin + flag=true 동일 (ticker,month) 2회 호출 → 두 호출 모두 upsert RPC', async () => {
    process.env.PR4_TRIGGER_UPSERT_ENABLED = 'true';
    const rpc = okRpc();
    const { orchestrateFullReport, fakeClient } = await loadOrchestrateWithMocks(rpc);
    await orchestrateFullReport(validInput, { client: fakeClient as never, callerKind: 'admin' });
    await orchestrateFullReport(validInput, { client: fakeClient as never, callerKind: 'admin' });
    expect(rpc).toHaveBeenNthCalledWith(1, 'upsert_report_sections_0_7_admin', expect.any(Object));
    expect(rpc).toHaveBeenNthCalledWith(2, 'upsert_report_sections_0_7_admin', expect.any(Object));
  });

  // ── Test 3 + 4a: payload key set 11 keys exact ─────────────────────────────
  it('Test 3+4a: payload key set = 11 keys exact (p_section_8/p_consensus_badge/p_version/regen 누설 0)', async () => {
    process.env.PR4_TRIGGER_UPSERT_ENABLED = 'true';
    const rpc = okRpc();
    const { orchestrateFullReport, fakeClient } = await loadOrchestrateWithMocks(rpc);
    await orchestrateFullReport(validInput, { client: fakeClient as never, callerKind: 'admin' });
    const payload = rpc.mock.calls[0][1] as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual([
      'p_appendix',
      'p_month',
      'p_section_0',
      'p_section_1',
      'p_section_2',
      'p_section_3',
      'p_section_4',
      'p_section_5',
      'p_section_6',
      'p_section_7',
      'p_ticker',
    ]);
    // 보존 컬럼 (cron path/versioning/regen) 누설 0.
    expect(payload).not.toHaveProperty('p_section_8');
    expect(payload).not.toHaveProperty('p_consensus_badge');
    expect(payload).not.toHaveProperty('p_version');
    expect(payload).not.toHaveProperty('p_schema_version');
    expect(payload).not.toHaveProperty('p_is_latest');
    // regen counter 누설 0 (Schopenhauer critic WATCH — spec가 regen 컬럼 명시).
    expect(payload).not.toHaveProperty('p_regen_auto_count');
    expect(payload).not.toHaveProperty('p_regen_manual_count');
  });

  // ── Test 6: error literal substring preserve + cross-path leak 차단 ──────────
  it('Test 6a: upsert path + no_returning error → throw upsert literal', async () => {
    process.env.PR4_TRIGGER_UPSERT_ENABLED = 'true';
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'upsert_report_sections_0_7_admin_failed_no_returning', code: 'P0001' },
    });
    const { orchestrateFullReport, fakeClient } = await loadOrchestrateWithMocks(rpc);
    await expect(
      orchestrateFullReport(validInput, { client: fakeClient as never, callerKind: 'admin' }),
    ).rejects.toThrow('upsert_report_sections_0_7_admin_failed_no_returning');
  });

  it('Test 6b: legacy path + report_not_found error → throw legacy literal', async () => {
    // flag unset → rpcName=update_report_sections_0_7 (legacy).
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'report_not_found_for_section_0_7_update', code: 'P0002' },
    });
    const { orchestrateFullReport, fakeClient } = await loadOrchestrateWithMocks(rpc);
    await expect(
      orchestrateFullReport(validInput, { client: fakeClient as never, callerKind: 'admin' }),
    ).rejects.toThrow('report_not_found_for_section_0_7_update');
  });

  it('Test 6c: cross-path leak 차단 — upsert path + legacy error msg → generic upsert_*_failed (NOT legacy literal)', async () => {
    process.env.PR4_TRIGGER_UPSERT_ENABLED = 'true';
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'report_not_found_for_section_0_7_update', code: '23505' },
    });
    const { orchestrateFullReport, fakeClient } = await loadOrchestrateWithMocks(rpc);
    await expect(
      orchestrateFullReport(validInput, { client: fakeClient as never, callerKind: 'admin' }),
    ).rejects.toThrow('upsert_report_sections_0_7_admin_failed:23505');
  });
});
