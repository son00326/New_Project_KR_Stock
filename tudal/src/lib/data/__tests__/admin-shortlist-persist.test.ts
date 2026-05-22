import { describe, expect, it, vi, beforeEach } from 'vitest';

const { upsertMock, fromMock } = vi.hoisted(() => {
  const upsertMock = vi.fn();
  const fromMock = vi.fn(() => ({ upsert: upsertMock }));
  return { upsertMock, fromMock };
});

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({ from: fromMock }),
}));

import { upsertShortList30 } from '../admin-shortlist-persist';
import type { TickerAggregate } from '@/lib/screening/tier1-schema';

function buildSelected30(): TickerAggregate[] {
  const rows: TickerAggregate[] = [];
  const timeframes: Array<'short' | 'mid' | 'long'> = ['short', 'mid', 'long'];
  for (const tf of timeframes) {
    for (let i = 0; i < 10; i++) {
      rows.push({
        ticker: `${tf}-${String(i).padStart(3, '0')}`,
        sector: null,
        weighted_scores: { short: 70, mid: 70, long: 70 },
        primary_timeframe: tf,
        consensus_badges_by_timeframe: { short: '🟢', mid: '🟢', long: '🟢' },
        assigned_by: i === 9 ? 'backfill' : 'primary',
        assigned_timeframe: tf,
        prompt_version_id: 'render-user-prompt@v1',
        personas_version_id: 'core11@v3.1',
      });
    }
  }
  return rows;
}

beforeEach(() => {
  upsertMock.mockReset();
  fromMock.mockClear();
});

describe('upsertShortList30', () => {
  it('rejects selected.length != 30', async () => {
    await expect(upsertShortList30('2026-06', [])).rejects.toThrow(
      /shortlist_must_have_30_rows/,
    );
  });

  it('throws on invalid month format', async () => {
    upsertMock.mockResolvedValue({ error: null });
    await expect(
      upsertShortList30('2026-6', buildSelected30()),
    ).rejects.toThrow(/invalid_month_format/);
  });

  it('B4 fix: every row includes delta_status="new" + delta_reason=null', async () => {
    upsertMock.mockResolvedValue({ error: null });
    await upsertShortList30('2026-06', buildSelected30());
    expect(fromMock).toHaveBeenCalledWith('short_list_30');
    expect(upsertMock).toHaveBeenCalledTimes(1);
    const rows = upsertMock.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(30);
    for (const row of rows) {
      expect(row.delta_status).toBe('new');
      expect(row.delta_reason).toBeNull();
      expect(row.month).toBe('2026-06-01');
      expect(['short', 'mid', 'long']).toContain(row.bucket);
    }
    // onConflict matches the unique index from 0002.
    expect(upsertMock).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ onConflict: 'month,ticker' }),
    );
  });

  it('rejects when any selected row has assigned_timeframe null', async () => {
    const rows = buildSelected30();
    rows[0] = { ...rows[0], assigned_timeframe: null };
    await expect(upsertShortList30('2026-06', rows)).rejects.toThrow(
      /assigned_timeframe_null_for_selected/,
    );
  });

  it('surfaces supabase error as shortlist_persist_failed:<code>', async () => {
    upsertMock.mockResolvedValue({ error: { code: '23505' } });
    await expect(
      upsertShortList30('2026-06', buildSelected30()),
    ).rejects.toThrow(/shortlist_persist_failed:23505/);
  });
});
