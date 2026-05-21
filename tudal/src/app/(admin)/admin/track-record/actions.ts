// tudal/src/app/(admin)/admin/track-record/actions.ts (또는 별도 모듈)
'use server';

import { createClient } from '@/lib/supabase/server';
import { runMonthlyPersonaEval, runSectorEval } from '@/lib/screening/persona-eval';
import { assignBadge, isTopTier, type ConsensusBadge } from '@/lib/screening/consensus';
import { commitTickerReport, commitBadgeOnly, commitSectorReport } from '@/lib/report/writer';
import { CORE_11_PERSONAS } from '@/lib/ai/prompts/personas';
import { isCanonicalSector } from '@/lib/screening/canonical-sectors';

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

/**
 * Step 3c Tier 2 counter contract (omxy 53차 §3 D4 R1 BLOCKER 1 정정 — silent no-op vs counter-backed skip).
 *
 * operator/admin이 dashboard/log에서 "왜 Tier 2 안 돌았나" 진단 가능.
 * skippedGate는 shouldRunTier2 false 케이스 — env off OR badge ⚪ coalesced (R2 BLOCKER 3 박제).
 */
export interface Tier2Counters {
  attempted: number;
  committed: number;
  skippedGate: number;        // shouldRunTier2 false (env off OR badge ⚪ coalesced)
  skippedSector: number;      // sector NULL/undefined/non-canonical
  skippedUnavailable: number; // tier2.available === false (degraded/partial)
}

/**
 * Step 3c action return type (additive — omxy R2 BLOCKER 4 backward-compatible).
 * 기존 caller (`result.ok` / `result.totalCalls` only read)는 영향 0.
 */
export type TriggerMonthlyPersonaEvalActionResult =
  | { ok: true; totalCalls: number; tier2: Tier2Counters }
  | { ok: false; error: string };

/**
 * Tier 2 cost gate (omxy 53차 §3 R3 D6 cost gate (1) — env flag single safety gate).
 *
 * **billing 신호일 뿐 billing 가능 자체 보장 아님** (omxy D4 R1 non-blocker note 박제) —
 * Anthropic SDK 호출 실패는 runSectorEval 자체에서 degradedCount++로 처리.
 *
 * ⚪ 케이스는 Core 11 자체 미진입 → Tier 2도 무의미.
 *
 * exported for unit test (omxy D4 R1 BLOCKER 4 정정).
 */
export function shouldRunTier2(badge: ConsensusBadge): boolean {
  if (badge === '⚪') return false;
  // strict 'true' literal match — 'TRUE' / '1' / 'yes' / ' true ' (case+whitespace) do NOT enable.
  // Vercel env vars are exposed verbatim; operator는 정확히 'true' string으로 세팅 필요.
  return process.env.AI_COST_LOG_REAL_INSERT_ENABLED === 'true';
}

export async function triggerMonthlyPersonaEvalAction(
  month: string,
): Promise<TriggerMonthlyPersonaEvalActionResult> {
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

  // Step 3c: sector + sub_tags 추가 (마이그 0012 name/sector + 0018 sub_tags jsonb production apply 박제).
  // typed Supabase client에 sub_tags 컬럼 미반영 시 narrow cast fallback (Database type stale 안전망).
  const { data: shortlistRaw } = await supabase
    .from('short_list_30')
    .select('ticker, bucket, composite_score, sector, sub_tags')
    .eq('month', month)
    .order('rank', { ascending: true });
  const shortlist = shortlistRaw as Array<{
    ticker: string;
    bucket: 'short' | 'mid' | 'long';
    composite_score: number;
    sector: string | null;
    sub_tags: unknown; // jsonb — null / string[] / string / object 가능 (Step 3c omxy R1 BLOCKER 2 박제)
  }> | null;
  if (!shortlist || shortlist.length === 0) {
    return { ok: false, error: 'shortlist_empty' };
  }

  const tickers = shortlist.map((r) => r.ticker);
  const personaIds = CORE_11_PERSONAS.map((p) => p.id);

  // Step 3c: Tier 2 counter (omxy D4 R1 BLOCKER 1 정정 — silent no-op vs counter-backed skip).
  const tier2Counters: Tier2Counters = {
    attempted: 0,
    committed: 0,
    skippedGate: 0,
    skippedSector: 0,
    skippedUnavailable: 0,
  };

  // Step 3c: Tier 2도 동일 financials fetcher 재사용 (closure).
  const fetchFinancials = async (ticker: string): Promise<string> => {
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
  };

  try {
    const evalResult = await runMonthlyPersonaEval({
      month,
      tickers,
      adminUserId: user.id,
      fetchFinancials,
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

        // Step 3c: Tier 2 branch — Core 11 success commit 직후 (omxy 53차 §3 R3 D6 cost gate + D4 R1 4 BLOCKERS 정정).
        if (shouldRunTier2(badge)) {
          tier2Counters.attempted++;
          const sectorRow = shortlist?.find((s) => s.ticker === ticker);
          const sectorRaw = sectorRow?.sector;
          // omxy R1 BLOCKER 3: isCanonicalSector type guard 사용 (CANONICAL_SECTORS.includes cast 대신).
          // NULL/undefined도 typeof 'string' 검사로 차단.
          if (typeof sectorRaw !== 'string' || !isCanonicalSector(sectorRaw)) {
            tier2Counters.skippedSector++;
            continue;
          }
          // omxy R1 BLOCKER 2: sub_tags jsonb는 null/string/object/mixed array 가능 → strict array+string filter.
          const rawSubTags = sectorRow?.sub_tags;
          const subTags: readonly string[] = Array.isArray(rawSubTags)
            ? rawSubTags.filter((x): x is string => typeof x === 'string')
            : [];
          const tier2 = await runSectorEval({
            month,
            ticker,
            sector: sectorRaw,
            sub_tags: subTags,
            adminUserId: user.id,
            fetchFinancials,
          });
          if (!tier2.available) {
            // omxy D6 (2): degraded/partial 1~13 → DB write 0
            tier2Counters.skippedUnavailable++;
            continue;
          }
          await commitSectorReport({
            month,
            ticker,
            sector: sectorRaw,
            sub_tags: subTags,
            sectorPersonaResults: tier2.results,
            sectorPersonaIds: tier2.personaIds,
          });
          tier2Counters.committed++;
        } else {
          tier2Counters.skippedGate++; // shouldRunTier2 false (env off OR badge ⚪ coalesced — R2 BLOCKER 3 박제)
        }
      } else {
        // 응답 불완전 (일부 fan-out 실패 등) — 안전한 fallback = ⚪
        await commitBadgeOnly({ month, ticker });
      }
    }

    // Step 3c: return contract additive (omxy D4 R2 BLOCKER 4 정정 — backward-compatible).
    // 기존 caller (`result.ok` / `result.totalCalls` only read)는 영향 0.
    return { ok: true, totalCalls: evalResult.totalCalls, tier2: tier2Counters };
  } catch (err) {
    const code = err instanceof Error ? err.message : 'unknown';
    return { ok: false, error: code };
  }
}
