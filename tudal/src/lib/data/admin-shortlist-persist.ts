// PR1 Task 3 — upsertShortList30 helper.
// runTier1Screening 산출 30 selected를 short_list_30 (month, ticker) 유니크 키로 UPSERT.
// B4 fix (omxy R1): delta_status NOT NULL constraint 통과 — 모든 row 'new' (전월 diff는 후속 PR scope).
// MF1 fix (deep-review #1, 3-track Fix-First): supabase client DI — cron path는 service-role, server action은 session-based.
// MF2 fix (deep-review #2): month-level idempotency — 신규 30 set 외 기존 row DELETE (stale row 누적 차단).
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TickerAggregate } from '@/lib/screening/tier1-schema';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

interface ShortListRow {
  month: string; // YYYY-MM-01 date literal
  ticker: string;
  bucket: 'short' | 'mid' | 'long';
  rank: number;
  assigned_by: 'primary' | 'backfill' | null;
  prompt_version_id: string;
  personas_version_id: string;
  // B4 fix (omxy R1) — 마이그 0002 `delta_status text not null check ('new','hold','removed')`
  delta_status: 'new' | 'hold' | 'removed';
  delta_reason: string | null;
}

function toMonthDate(monthYM: string): string {
  if (!MONTH_RE.test(monthYM)) {
    throw new Error(`invalid_month_format:${monthYM}`);
  }
  return `${monthYM}-01`;
}

/**
 * MF1 fix: 선택적 DI supabase client. 미지정 시 session-based createClient (admin server action 경로).
 * cron route는 service-role client를 명시 주입 — RLS bypass + auth.uid()=null 환경 호환.
 */
export async function upsertShortList30(
  monthYM: string,
  selected: readonly TickerAggregate[],
  options: { client?: SupabaseClient } = {},
): Promise<void> {
  if (selected.length !== 30) {
    throw new Error(
      `shortlist_must_have_30_rows (got ${selected.length})`,
    );
  }
  const monthDate = toMonthDate(monthYM);

  const byTf: Record<'short' | 'mid' | 'long', TickerAggregate[]> = {
    short: [],
    mid: [],
    long: [],
  };
  for (const agg of selected) {
    if (agg.assigned_timeframe === null) {
      throw new Error(
        `assigned_timeframe_null_for_selected:${agg.ticker}`,
      );
    }
    byTf[agg.assigned_timeframe].push(agg);
  }

  const rows: ShortListRow[] = [];
  const newTickers: string[] = [];
  for (const tf of ['short', 'mid', 'long'] as const) {
    byTf[tf].forEach((agg, idx) => {
      rows.push({
        month: monthDate,
        ticker: agg.ticker,
        bucket: tf,
        rank: idx + 1,
        assigned_by: agg.assigned_by,
        prompt_version_id: agg.prompt_version_id,
        personas_version_id: agg.personas_version_id,
        // B4 fix — delta_status NOT NULL. PR1 첫 실행 모두 'new'.
        delta_status: 'new',
        delta_reason: null,
      });
      newTickers.push(agg.ticker);
    });
  }

  const supabase = options.client ?? (await createClient());

  // MF2 fix — 신규 30 외 기존 row DELETE (prior failed run의 stale ticker 차단).
  // 동일 month + ticker NOT IN new set.
  const { error: delError } = await supabase
    .from('short_list_30')
    .delete()
    .eq('month', monthDate)
    .not('ticker', 'in', `(${newTickers.map((t) => `"${t}"`).join(',')})`);
  if (delError) {
    throw new Error(`shortlist_persist_failed:${delError.code ?? 'unknown'}`);
  }

  const { error } = await supabase
    .from('short_list_30')
    .upsert(rows, { onConflict: 'month,ticker' });
  if (error) {
    throw new Error(`shortlist_persist_failed:${error.code ?? 'unknown'}`);
  }
}
