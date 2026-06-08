import { describe, it, expect } from 'vitest';

import { getActiveShortList } from '@/lib/data/admin-shortlist';
import {
  callPortfolioProposal,
  renderPortfolioShortlistSummary,
  type PortfolioShortlistItem,
} from '@/lib/ai/portfolio-proposal-client';
import { preflightHardcap, isCostLoggingEnabled } from '@/lib/cost/cost-logger';
import { getRoleWorstCaseMaxCostPerCallKrw } from '@/lib/ai/model-registry';
import { runGuardedReportChunk } from '@/lib/report/full-report-batch-worker';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { SHORTLIST_TARGET_COUNT, type ShortListItem } from '@/types/admin';

// ---------------------------------------------------------------------------
// P1 micro-canary (65차 MVP 엔진 — AI 키 실검증 P1). env-gated, 실 API + prod Supabase.
//
// ⚠️ 실 Opus 호출 + 실 cost_log/stock_reports insert (prod). CI/test:ci에서는 항상 skip.
//   실행 (USER 비용 승인 + omxy catch-only 리뷰 후 — --bail=1 필수: P1a 실패 시 P1b spend 차단):
//     cd tudal && set -a && source .env.local && set +a
//     PR5_CRON_AUTO_ENABLED=true AI_COST_LOG_REAL_INSERT_ENABLED=true \
//     CRON_SYSTEM_USER_ID=<uuid> P1_LIVE_CANARY=true \
//     npx vitest run --bail=1 --disable-console-intercept src/lib/__tests__/p1-canary.live.test.ts
//   예상 비용: 제안 1콜(Opus) + 리포트 1종목(chunk 1) ≈ ₩1-2천.
//
// production proposePortfolio 액션 데이터-prep을 정확히 미러 (actions.ts:930-1002).
// omxy P1 리뷰 반영: HIGH1 preflight callerKind:'service-role' / HIGH2 호출 전 flag+UUID+auth assert
//   + cost_log before/after delta / MED3 P1b result+done>=1 필수.
// ---------------------------------------------------------------------------

const LIVE = process.env.P1_LIVE_CANARY === 'true';
const MONTH = '2026-05'; // 현 최신 short_list_30 (Tier-0 fallback)
const MONTH_DATE = '2026-05-01';
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe.skipIf(!LIVE)('P1 micro-canary (live, USER 비용 승인 + omxy 리뷰 후)', () => {
  it('P1a — callPortfolioProposal: 실 Opus 제안 + cost_log delta + positions⊆universe', async () => {
    // HIGH2 — spend 전 fail-fast 검증 (flag off면 insertCostLog noop = Opus 과금되나 cost_log 0).
    expect(isCostLoggingEnabled()).toBe(true);
    const adminUserId = process.env.CRON_SYSTEM_USER_ID ?? '';
    expect(UUID_RE.test(adminUserId)).toBe(true); // cost_log.called_by FK

    const client = createServiceRoleClient();

    // adminUserId auth.users 존재 확인 (FK + attribution).
    const { data: userData, error: userErr } =
      await client.auth.admin.getUserById(adminUserId);
    expect(userErr).toBeNull();
    expect(userData?.user?.id).toBe(adminUserId);

    const shortlist = (await getActiveShortList({
      month: MONTH_DATE,
      client,
    })) as ShortListItem[];
    // actions.ts:88 filterActiveShortlist 복제 (deltaStatus !== 'removed')
    const active = shortlist.filter((i) => i.deltaStatus !== 'removed');
    expect(active.length).toBe(SHORTLIST_TARGET_COUNT); // exact-30 계약

    const summary = renderPortfolioShortlistSummary(
      active.map(
        (item): PortfolioShortlistItem => ({
          ticker: item.ticker,
          name: item.name,
          consensusBadge: item.consensusBadge ?? null,
          aiScore: item.aiScore ?? null,
          winningTimeframe: item.winningTimeframe ?? null,
          conviction: item.conviction ?? null,
        }),
      ),
    );

    // cost_log before count (delta 검증용) — persona_id='portfolio-proposal'.
    const countProposalCostLog = async (): Promise<number> => {
      const { count, error } = await client
        .from('cost_log')
        .select('*', { count: 'exact', head: true })
        .eq('month', MONTH)
        .eq('persona_id', 'portfolio-proposal');
      if (error) throw new Error(`cost_log count failed: ${error.code}`);
      return count ?? 0;
    };
    const before = await countProposalCostLog();

    // preflightHardcap (actions.ts:962-973) — HIGH1: callerKind:'service-role' (admin RPC는 0030서 service_role revoke).
    await preflightHardcap(
      {
        month: MONTH,
        lines: [
          {
            callCount: 1,
            maxCostPerCallKrw: getRoleWorstCaseMaxCostPerCallKrw('portfolio'),
          },
        ],
      },
      { client, callerKind: 'service-role' },
    );

    const proposal = await callPortfolioProposal({
      month: MONTH,
      shortlistSummary: summary,
      adminUserId,
      costClient: client,
    });

    // cost_log 실제 insert 확인 (noop 아님) — delta +1.
    const after = await countProposalCostLog();
    expect(after).toBe(before + 1);

    // positions ⊆ active universe (actions.ts:996-1002)
    const universe = new Set(active.map((i) => i.ticker));
    expect(proposal.positions.length).toBeGreaterThan(0);
    for (const p of proposal.positions) {
      expect(universe.has(p.ticker)).toBe(true);
    }
    // schema refine 재확인: weights + cash ≈ 1
    const weightSum =
      proposal.positions.reduce((s, p) => s + p.weight, 0) + proposal.cashWeight;
    expect(weightSum).toBeGreaterThan(0.98);
    expect(weightSum).toBeLessThan(1.02);

    console.log(
      `[P1a] proposal: ${proposal.positions.length} positions, cash ${proposal.cashWeight}, ` +
        `cost_log +${after - before}, rationale "${proposal.rationale_kr.slice(0, 80)}"`,
    );
  }, 120_000);

  it('P1b — report worker: 1종목 리포트(Section 0~7) 생성 (chunkSize 1, result+done≥1 필수)', async () => {
    const client = createServiceRoleClient();
    const out = await runGuardedReportChunk({ month: MONTH, client, chunkSize: 1 });
    console.log('[P1b] guarded chunk output:', JSON.stringify(out));

    // MED3 — skipped('already_running') / dormant abort는 canary 실패로 간주 (0리포트=성공 위장 차단).
    if (!('result' in out) || !out.result) {
      throw new Error(`P1b expected a result chunk, got: ${JSON.stringify(out)}`);
    }
    expect(out.result.done).toBeGreaterThanOrEqual(1);
  }, 180_000);
});
