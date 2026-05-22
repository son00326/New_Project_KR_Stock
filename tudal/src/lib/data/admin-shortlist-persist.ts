// PR1 Task 3 — upsertShortList30 helper.
// runTier1Screening 산출 30 selected를 short_list_30 (month, ticker) 유니크 키로 UPSERT.
// B4 fix (omxy R1): delta_status NOT NULL constraint 통과 — 모든 row 'new' (전월 diff는 후속 PR scope).
import { createClient } from '@/lib/supabase/server';
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

export async function upsertShortList30(
  monthYM: string,
  selected: readonly TickerAggregate[],
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
    });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('short_list_30')
    .upsert(rows, { onConflict: 'month,ticker' });
  if (error) {
    throw new Error(`shortlist_persist_failed:${error.code ?? 'unknown'}`);
  }
}
