import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { runSectorEval, type SectorEvalResult } from '@/lib/screening/persona-eval';
import { fetchFinancialsSummary } from '@/lib/data/dart-financials';
import { commitSectorReportCron } from '../writer';
import { commitSectorBoardStep } from '../sector-board-step';

// PR-T2a — Tier 2 섹터 보드 step 단위 테스트 (0 live, gate/guard/DI 계약).
vi.mock('@/lib/screening/persona-eval', () => ({ runSectorEval: vi.fn() }));
vi.mock('@/lib/data/dart-financials', () => ({ fetchFinancialsSummary: vi.fn() }));
vi.mock('../writer', () => ({ commitSectorReportCron: vi.fn() }));

// short_list_30(month,ticker).maybeSingle() chain fake → {client (DI 주입용), from (assert용)}.
function fakeClient(row: unknown, error: unknown = null) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => ({ data: row, error })),
  };
  const from = vi.fn(() => chain);
  return { client: { from } as unknown as SupabaseClient, from };
}

const base = {
  ticker: '042700',
  month: '2026-06',
  adminUserId: '39202d8b-1042-48a6-8da0-df14a52fabea',
};

function mkSectorEvalOk(): SectorEvalResult {
  return {
    ticker: '042700',
    sector: '반도체' as SectorEvalResult['sector'],
    personaIds: Array.from({ length: 14 }, (_, i) => `sector-반도체-slot-${i + 1}`),
    results: Array.from({ length: 14 }, () => ({
      content: '{"vote":"BUY","one_line":"x","argument_excerpt":"y"}',
      usage: { input_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 1 },
      costKrw: 1,
      promptCacheEnabled: false,
    })),
    available: true,
    degradedCount: 0,
    totalCalls: 14,
  };
}

describe('commitSectorBoardStep (PR-T2a)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('⚪/null badge → sector_board_not_ready (no client/eval/commit)', async () => {
    const { client, from } = fakeClient({ sector: '반도체', sub_tags: [] });
    for (const badge of ['⚪', null]) {
      const r = await commitSectorBoardStep({ ...base, badge, client });
      expect(r.status).toBe('sector_board_not_ready');
    }
    expect(from).not.toHaveBeenCalled();
    expect(runSectorEval).not.toHaveBeenCalled();
    expect(commitSectorReportCron).not.toHaveBeenCalled();
  });

  it('non-canonical/null sector → sector_unresolved (no eval/commit)', async () => {
    for (const sector of ['unresolved', null, 'NotASector']) {
      const { client } = fakeClient({ sector, sub_tags: [] });
      const r = await commitSectorBoardStep({ ...base, badge: '🟣', client });
      expect(r.status).toBe('sector_unresolved');
    }
    expect(runSectorEval).not.toHaveBeenCalled();
    expect(commitSectorReportCron).not.toHaveBeenCalled();
  });

  it('canonical sector + available(14/14) → committed + cron commit (service-role DI)', async () => {
    vi.mocked(runSectorEval).mockResolvedValue(mkSectorEvalOk());
    vi.mocked(fetchFinancialsSummary).mockResolvedValue('fin');
    vi.mocked(commitSectorReportCron).mockResolvedValue({ reportId: 'rid-1', votesInserted: 14 });
    const { client } = fakeClient({ sector: '반도체', sub_tags: ['HBM'] });

    const r = await commitSectorBoardStep({ ...base, badge: '🟣', client });

    expect(r.status).toBe('committed');
    expect(r.reportId).toBe('rid-1');
    // runSectorEval gets service-role costClient + sector + filtered sub_tags
    expect(runSectorEval).toHaveBeenCalledWith(
      expect.objectContaining({ ticker: '042700', month: '2026-06', sector: '반도체', sub_tags: ['HBM'], costClient: client }),
    );
    // cron writer gets service-role client + calledBy
    expect(commitSectorReportCron).toHaveBeenCalledWith(
      expect.objectContaining({ ticker: '042700', sector: '반도체' }),
      { client, calledBy: base.adminUserId },
    );
  });

  it('degraded (<14, available=false) → sector_board_unavailable (no commit, no DB write)', async () => {
    vi.mocked(runSectorEval).mockResolvedValue({ ...mkSectorEvalOk(), available: false, degradedCount: 3 });
    vi.mocked(fetchFinancialsSummary).mockResolvedValue('fin');
    const { client } = fakeClient({ sector: '반도체', sub_tags: [] });

    const r = await commitSectorBoardStep({ ...base, badge: '🟢', client });

    expect(r.status).toBe('sector_board_unavailable');
    expect(commitSectorReportCron).not.toHaveBeenCalled();
  });

  it('sub_tags non-array (jsonb null/string/object) → filtered to []', async () => {
    vi.mocked(runSectorEval).mockResolvedValue(mkSectorEvalOk());
    vi.mocked(fetchFinancialsSummary).mockResolvedValue('fin');
    vi.mocked(commitSectorReportCron).mockResolvedValue({ reportId: 'rid', votesInserted: 14 });
    const { client } = fakeClient({ sector: '반도체', sub_tags: 'oops-not-array' });

    await commitSectorBoardStep({ ...base, badge: '🟣', client });
    expect(runSectorEval).toHaveBeenCalledWith(expect.objectContaining({ sub_tags: [] }));
  });

  it('short_list_30 query error → throws', async () => {
    const { client } = fakeClient(null, { code: 'PGRST500' });
    await expect(commitSectorBoardStep({ ...base, badge: '🟣', client })).rejects.toThrow(
      /sector_board_shortlist_query_failed/,
    );
  });
});
