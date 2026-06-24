import type { SupabaseClient } from '@supabase/supabase-js';

import { fetchFinancialsSummary } from '@/lib/data/dart-financials';
import { isCanonicalSector } from '@/lib/screening/canonical-sectors';
import { runSectorEval } from '@/lib/screening/persona-eval';

import { isAiBadge } from './section8-step';
import { commitSectorReportCron } from './writer';

// ---------------------------------------------------------------------------
// PR-T2a (Tier 2 섹터 보드 → live 리포트 경로) — report-time per-ticker step.
//   spec: docs/superpowers/specs/2026-06-23-tier2-sector-persona-report-wiring.md §4 PR-T2a.
//   dangling action(track-record/actions.ts triggerMonthlyPersonaEvalAction)의 게이트/가드/카운터
//   로직을 live cron 경로로 이식. commitSection8Step(Core-11)과 동일 위상 — Section 8 commit 직후 호출.
//   - badge 게이트 = isAiBadge(⚪/null → skip, spend 0) — Core 11 미진입은 섹터 보드 무의미.
//   - sector/sub_tags = short_list_30(month,ticker) 권위(dangling action 정합). isCanonicalSector 가드.
//   - runSectorEval(costClient=service-role) → available(14/14) 시만 commitSectorReportCron(0040).
//   - degraded(1~13) → DB write 0 (R2 B1 partial-commit 금지).
// ---------------------------------------------------------------------------

export type CommitSectorBoardStatus =
  | 'sector_board_not_ready' // badge ⚪/null — Core 11 미진입, 섹터 보드 무의미 (no spend)
  | 'sector_unresolved' // short_list_30.sector 비-canonical/null — skip (Tier1Candidate canonical-14 정합 위반 방지)
  | 'sector_board_unavailable' // runSectorEval degraded(<14) — partial commit 금지 (no DB write)
  | 'committed';

export interface CommitSectorBoardResult {
  status: CommitSectorBoardStatus;
  reportId?: string;
}

export async function commitSectorBoardStep(input: {
  ticker: string;
  month: string; // 'YYYY-MM'
  badge: string | null; // short_list_30.consensus_badge (canonical)
  adminUserId: string; // cron-system user (p_called_by + cost_log.called_by)
  client: SupabaseClient; // service-role
}): Promise<CommitSectorBoardResult> {
  // 배지 게이트 — ⚪/null이면 Core 11 미진입이라 섹터 보드 무의미 (commitSection8Step과 동일 게이트).
  if (!isAiBadge(input.badge)) {
    return { status: 'sector_board_not_ready' };
  }

  // sector + sub_tags = short_list_30(month,ticker) 권위 (dangling action 정합 — enriched엔 sub_tags 없음).
  const monthDate = `${input.month}-01`;
  const { data: row, error } = await input.client
    .from('short_list_30')
    .select('sector, sub_tags')
    .eq('month', monthDate)
    .eq('ticker', input.ticker)
    .maybeSingle();
  if (error) {
    throw new Error(`sector_board_shortlist_query_failed:${error.code ?? 'unknown'}`);
  }
  const sectorRaw = (row as { sector?: unknown } | null)?.sector;
  // dangling action 정합: typeof 'string' + isCanonicalSector (NULL/비-canonical 차단).
  if (typeof sectorRaw !== 'string' || !isCanonicalSector(sectorRaw)) {
    return { status: 'sector_unresolved' };
  }
  // sub_tags jsonb는 null/string/object/mixed array 가능 → strict array+string filter (dangling action 정합).
  const rawSubTags = (row as { sub_tags?: unknown } | null)?.sub_tags;
  const subTags: readonly string[] = Array.isArray(rawSubTags)
    ? rawSubTags.filter((x): x is string => typeof x === 'string')
    : [];

  const tier2 = await runSectorEval({
    month: input.month,
    ticker: input.ticker,
    sector: sectorRaw,
    sub_tags: subTags,
    adminUserId: input.adminUserId,
    fetchFinancials: (t) => fetchFinancialsSummary(t, { client: input.client }),
    costClient: input.client, // cron service-role cost DI
  });
  if (!tier2.available) {
    return { status: 'sector_board_unavailable' };
  }

  const { reportId } = await commitSectorReportCron(
    {
      month: input.month,
      ticker: input.ticker,
      sector: sectorRaw,
      sub_tags: subTags,
      sectorPersonaResults: tier2.results,
      sectorPersonaIds: tier2.personaIds,
    },
    { client: input.client, calledBy: input.adminUserId },
  );
  return { status: 'committed', reportId };
}
