// tudal/src/app/(admin)/admin/track-record/actions.ts (또는 별도 모듈)
'use server';

import { createClient } from '@/lib/supabase/server';
import { runMonthlyPersonaEval } from '@/lib/screening/persona-eval';
import { assignBadge, isTopTier } from '@/lib/screening/consensus';
import { commitTickerReport, commitBadgeOnly } from '@/lib/report/writer';
import { CORE_11_PERSONAS } from '@/lib/ai/prompts/personas';

interface ParsedVote { vote: 'BUY' | 'HOLD' | 'SELL' }
function parseVote(content: string): ParsedVote {
  try {
    const p = JSON.parse(content);
    if (p.vote === 'BUY' || p.vote === 'HOLD' || p.vote === 'SELL') return { vote: p.vote };
  } catch { /* fallthrough */ }
  return { vote: 'HOLD' };
}
function scoreOf(vote: 'BUY' | 'HOLD' | 'SELL'): number {
  return vote === 'BUY' ? 2 : vote === 'HOLD' ? 1 : 0;
}

export async function triggerMonthlyPersonaEvalAction(month: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'auth_unavailable' };
  }
  const { data: adminRow } = await supabase
    .from('admin_emails')
    .select('email')
    .eq('email', user.email)
    .single();
  if (!adminRow) {
    return { ok: false, error: 'admin_required' };
  }

  const { data: shortlist } = await supabase
    .from('short_list_30')
    .select('ticker, bucket, composite_score')
    .eq('month', month)
    .order('rank', { ascending: true });
  if (!shortlist || shortlist.length === 0) {
    return { ok: false, error: 'shortlist_empty' };
  }

  const tickers = shortlist.map((r) => r.ticker);
  const personaIds = CORE_11_PERSONAS.map((p) => p.id);

  try {
    const evalResult = await runMonthlyPersonaEval({
      month,
      tickers,
      adminUserId: user.id,
      fetchFinancials: async (ticker) => {
        // omxy R1 BLOCKER: schema mismatch (실 0014는 corp_code 키, quarter/trailing/quality 컬럼 미존재)는
        // billing-on smoke (HANDOFF §C, 별도 PR)에서 실 컬럼 매핑. 본 PR은 silent bad input 방지만 보장.
        const { data, error } = await supabase
          .from('dart_financial_cache')
          .select('quarter_revenue, trailing_revenue, quality_score')
          .eq('ticker', ticker)
          .single();
        if (error) {
          throw new Error(`financials_fetch_failed:${error.code ?? 'unknown'}`);
        }
        return JSON.stringify(data ?? {});
      },
    });

    // Plan R2 BLOCKER 3: ticker별 Tier 1 score (BUY=2/HOLD=1/SELL=0 합계) → bucket 내 rank → isTopTier
    const tier1ScoreByTicker: Record<string, number> = {};
    for (const ticker of tickers) {
      const responses = evalResult.byTicker[ticker] ?? [];
      tier1ScoreByTicker[ticker] = responses.reduce((sum, r) => sum + scoreOf(parseVote(r.content).vote), 0);
    }

    for (const ticker of tickers) {
      const tier1Available = evalResult.tier1AvailableByTicker[ticker];
      const personaResults = evalResult.byTicker[ticker] ?? [];

      // Tier 0 rank: bucket 내 composite_score desc rank
      const bucket = shortlist.find((s) => s.ticker === ticker)?.bucket;
      const tier0Bucket = shortlist.filter((r) => r.bucket === bucket);
      const tier0RankedDesc = [...tier0Bucket].sort((a, b) => b.composite_score - a.composite_score);
      const tier0Rank = tier0RankedDesc.findIndex((r) => r.ticker === ticker) + 1;
      const tier0IsTop = isTopTier(tier0Rank, tier0Bucket.length);

      // Tier 1 rank: bucket 내 tier1 score desc rank (Plan R2 BLOCKER 3 — Q5 일관)
      const tier1Bucket = tier0Bucket.map((t) => ({ ticker: t.ticker, score: tier1ScoreByTicker[t.ticker] ?? 0 }));
      const tier1RankedDesc = [...tier1Bucket].sort((a, b) => b.score - a.score);
      const tier1Rank = tier1RankedDesc.findIndex((r) => r.ticker === ticker) + 1;
      const tier1IsTop = tier1Available && isTopTier(tier1Rank, tier1Bucket.length);

      const badge = assignBadge({ tier1Available, tier0IsTop, tier1IsTop });

      // Plan R3 BLOCKER 7: ⚪ 케이스는 commit_badge_only / 그 외 4종은 commit_persona_eval
      if (badge === '⚪') {
        await commitBadgeOnly({ month, ticker });
      } else if (personaResults.length === 11) {
        await commitTickerReport({
          month,
          ticker,
          personaResults,
          personaIds,
          badge,
        });
      } else {
        // 응답 불완전 (일부 fan-out 실패 등) — 안전한 fallback = ⚪
        await commitBadgeOnly({ month, ticker });
      }
    }

    return { ok: true, totalCalls: evalResult.totalCalls };
  } catch (err) {
    const code = err instanceof Error ? err.message : 'unknown';
    return { ok: false, error: code };
  }
}
