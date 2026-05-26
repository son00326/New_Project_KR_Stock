// tudal/src/app/(admin)/admin/track-record/actions.ts (또는 별도 모듈)
'use server';

import { createClient } from '@/lib/supabase/server';
import { runMonthlyPersonaEval, runSectorEval } from '@/lib/screening/persona-eval';
import { assignBadge, isTopTier } from '@/lib/screening/consensus';
import { commitTickerReport, commitBadgeOnly, commitSectorReport } from '@/lib/report/writer';
import { CORE_11_PERSONAS } from '@/lib/ai/prompts/personas';
import { isCanonicalSector } from '@/lib/screening/canonical-sectors';
// PR4 Task 3 분리 (Next.js 16 'use server' sync export 차단 — shouldRunTier2 sync helper).
import { shouldRunTier2 } from '@/lib/screening/tier2-gate';
// PR4 Task 3 (Group F): Track Record 누적 vs 월별 아카이브 탭 분리.
import {
  getPerformanceSummary,
  getMonthlyPerformance,
  getBucketPerformance,
  getCounterfactual,
  type PerformanceSummary,
  type MonthlyPerformanceRow,
  type BucketPerformanceRow,
  type CounterfactualComparison,
} from '@/lib/data/admin-performance';
import { getDecisionTreeSnapshot } from '@/lib/data/admin-decision-tree';
import { computeCapMonths } from '@/lib/performance/cap-months';
import type { BucketKind } from '@/types/admin';

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

// shouldRunTier2 — PR4 Task 3 분리 박제: 'use server' sync export 차단 회피.
// 신규 위치: @/lib/screening/tier2-gate (test에서도 본 경로로 import).

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

// ---------------------------------------------------------------------------
// PR4 Task 3 (Group A + F 해소) — Track Record 누적 vs 월별 아카이브 탭 분리.
// SoT plan: docs/superpowers/plans/2026-05-25-pr4-ui-caller-wire.md §Step 3.1 (lines 1052-1066).
// ---------------------------------------------------------------------------

/**
 * Track Record 누적 성과 번들 — 기존 5 fetch를 Promise.all로 묶어 1회 호출.
 *
 * Server Component (page.tsx)가 TrackRecordTabs(client island)에 props 전달용으로 사용.
 */
export interface TrackRecordCumulative {
  summary: PerformanceSummary | null;
  monthly: MonthlyPerformanceRow[];
  buckets: BucketPerformanceRow[];
  counterfactual: CounterfactualComparison | null;
  /** decisionTree.monthlyVerdicts 기반 현재 ○ 연속 스트릭 (decisionTree null → 0) */
  capMonths: number;
}

export async function fetchTrackRecordCumulative(): Promise<TrackRecordCumulative> {
  const [summary, monthly, buckets, counterfactual, decisionTree] = await Promise.all([
    getPerformanceSummary(),
    getMonthlyPerformance(),
    getBucketPerformance(),
    getCounterfactual(),
    getDecisionTreeSnapshot(),
  ]);
  // decisionTree null → capMonths=0 (computeCapMonths 미호출 invariant — early branch).
  const capMonths = decisionTree
    ? computeCapMonths(decisionTree.monthlyVerdicts).currentStreak
    : 0;
  return { summary, monthly, buckets, counterfactual, capMonths };
}

// ---------------------------------------------------------------------------
// fetchTrackRecordArchive — 월별 stock_reports + approval 결과 (Group F 아카이브 탭).
// ---------------------------------------------------------------------------

export interface ArchiveReport {
  ticker: string;
  bucket: BucketKind | null;
  name: string | null;
  sector: string | null;
}

export interface ArchiveApproval {
  approvalType: 'accept' | 'reject';
  isFinal: boolean;
  approvedAt: string;
}

export interface TrackRecordArchiveEntry {
  /** 'YYYY-MM-01' (DB month 형식 그대로) */
  month: string;
  reports: ArchiveReport[];
  approval: ArchiveApproval | null;
}

/**
 * 월별 stock_reports + approval 그룹화.
 *
 * @param options.month - 단일 month drill-in (없으면 전체 month).
 * @returns sorted desc by month. 각 entry는 reports[] + approval (is_final 우선, 없으면 null).
 *
 * Approval 우선순위 (omxy R0 invariant — 동월 final + non-final 공존 시):
 *   1. is_final=true 우선
 *   2. 동급이면 approved_at desc (먼저 들어온 것)
 */
export async function fetchTrackRecordArchive(
  options?: { month?: string },
): Promise<TrackRecordArchiveEntry[]> {
  const supabase = await createClient();

  // B32 fix (omxy R1): 3 query 실제 병렬화 — PostgREST query builder는 thenable이라
  // Promise.all에 넣으면 concurrent 실행. 기존 sequential await였음 (self-review claim drift).
  type StockReportsRow = { month: string; ticker: string };
  type ShortlistRow = {
    month: string;
    ticker: string;
    name: string | null;
    sector: string | null;
    bucket: BucketKind | null;
  };
  type ApprovalRow = {
    month: string;
    approval_type: 'accept' | 'reject';
    is_final: boolean;
    approved_at: string;
  };

  // 1) stock_reports — month + ticker (is_latest=true)
  let reportsQ = supabase.from('stock_reports').select('month, ticker').eq('is_latest', true);
  if (options?.month) {
    reportsQ = reportsQ.eq('month', options.month);
  }

  // 2) short_list_30 — month + ticker + name + sector + bucket (메타 join 용)
  let shortlistQ = supabase
    .from('short_list_30')
    .select('month, ticker, name, sector, bucket');
  if (options?.month) {
    shortlistQ = shortlistQ.eq('month', options.month);
  }

  // 3) portfolio_approval — month + type + is_final + approved_at
  let approvalsQ = supabase
    .from('portfolio_approval')
    .select('month, approval_type, is_final, approved_at');
  if (options?.month) {
    approvalsQ = approvalsQ.eq('month', options.month);
  }

  // Promise.all로 3 query concurrent 실행 (B32 fix omxy R1).
  const [reportsResult, shortlistResult, approvalsResult] = await Promise.all([
    reportsQ.order('month', { ascending: false }),
    shortlistQ,
    approvalsQ.order('approved_at', { ascending: false }),
  ]);

  const { data: reportsRows, error: reportsErr } = reportsResult;
  if (reportsErr) {
    throw new Error(
      `stock_reports_archive_query_failed:${reportsErr.code ?? reportsErr.message ?? 'unknown'}`,
    );
  }
  const { data: shortlistRows, error: shortlistErr } = shortlistResult;
  if (shortlistErr) {
    throw new Error(
      `short_list_30_archive_query_failed:${shortlistErr.code ?? shortlistErr.message ?? 'unknown'}`,
    );
  }
  const { data: approvalRows, error: approvalErr } = approvalsResult;
  if (approvalErr) {
    throw new Error(
      `portfolio_approval_archive_query_failed:${approvalErr.code ?? approvalErr.message ?? 'unknown'}`,
    );
  }

  // Build lookup map: (month, ticker) → {name, sector, bucket}
  const shortlistByKey = new Map<
    string,
    { name: string | null; sector: string | null; bucket: BucketKind | null }
  >();
  for (const row of (shortlistRows ?? []) as ShortlistRow[]) {
    shortlistByKey.set(`${row.month}|${row.ticker}`, {
      name: row.name,
      sector: row.sector,
      bucket: row.bucket,
    });
  }

  // Pick authoritative approval per month: is_final=true 우선, 동급이면 approved_at desc (정렬 first row).
  const approvalByMonth = new Map<string, ArchiveApproval>();
  for (const row of (approvalRows ?? []) as ApprovalRow[]) {
    const existing = approvalByMonth.get(row.month);
    // approved_at desc로 정렬된 입력 → 같은 month 첫 행 = latest. is_final=true는 우선권.
    if (!existing) {
      approvalByMonth.set(row.month, {
        approvalType: row.approval_type,
        isFinal: row.is_final,
        approvedAt: row.approved_at,
      });
      continue;
    }
    if (row.is_final && !existing.isFinal) {
      approvalByMonth.set(row.month, {
        approvalType: row.approval_type,
        isFinal: row.is_final,
        approvedAt: row.approved_at,
      });
    }
  }

  // Group reports by month
  const reportsByMonth = new Map<string, ArchiveReport[]>();
  for (const row of (reportsRows ?? []) as StockReportsRow[]) {
    const meta = shortlistByKey.get(`${row.month}|${row.ticker}`) ?? {
      name: null,
      sector: null,
      bucket: null,
    };
    const list = reportsByMonth.get(row.month) ?? [];
    list.push({
      ticker: row.ticker,
      bucket: meta.bucket,
      name: meta.name,
      sector: meta.sector,
    });
    reportsByMonth.set(row.month, list);
  }

  // Sorted desc by month (string compare — 'YYYY-MM-01' format works lexicographically).
  const months = Array.from(reportsByMonth.keys()).sort((a, b) => b.localeCompare(a));
  return months.map((month) => ({
    month,
    reports: reportsByMonth.get(month)!,
    approval: approvalByMonth.get(month) ?? null,
  }));
}
