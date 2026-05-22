import { describe, expect, it, vi, beforeEach } from 'vitest';

const { upsertMock, deleteEqNotMock, deleteEqMock, deleteMock, fromMock } = vi.hoisted(() => {
  const upsertMock = vi.fn();
  const deleteEqNotMock = vi.fn();
  const deleteEqMock = vi.fn(() => ({ not: deleteEqNotMock }));
  const deleteMock = vi.fn(() => ({ eq: deleteEqMock }));
  const fromMock = vi.fn(() => ({ upsert: upsertMock, delete: deleteMock }));
  return { upsertMock, deleteEqNotMock, deleteEqMock, deleteMock, fromMock };
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
        // B23 fix (omxy R11): 6-digit ticker로 fixture 갱신 (TICKER_RE=^\d{6}$ 통과).
        // tf-index encoding: short=0, mid=1, long=2 → "${prefix}${index 2-digit}${00}".
        ticker: `${({ short: '00', mid: '01', long: '02' } as const)[tf]}${String(i).padStart(2, '0')}00`,
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
  deleteEqNotMock.mockReset();
  deleteEqMock.mockClear();
  deleteMock.mockClear();
  fromMock.mockClear();
  // 기본 delete 성공 (DI 없는 test에서는 stale delete가 먼저 실행됨)
  deleteEqNotMock.mockResolvedValue({ error: null });
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

  // MF1 fix — supabase client DI (cron path service-role 주입)
  it('MF1: accepts injected supabase client via options.client (DI for cron)', async () => {
    upsertMock.mockResolvedValue({ error: null });
    const customUpsert = vi.fn().mockResolvedValue({ error: null });
    const customDeleteEqNot = vi.fn().mockResolvedValue({ error: null });
    const customDeleteEq = vi.fn(() => ({ not: customDeleteEqNot }));
    const customDelete = vi.fn(() => ({ eq: customDeleteEq }));
    const customFrom = vi.fn(() => ({
      upsert: customUpsert,
      delete: customDelete,
    }));
    const injectedClient = { from: customFrom } as unknown as NonNullable<
      Parameters<typeof upsertShortList30>[2]
    >['client'];

    await upsertShortList30('2026-06', buildSelected30(), {
      client: injectedClient,
    });
    expect(customFrom).toHaveBeenCalledWith('short_list_30');
    expect(customUpsert).toHaveBeenCalledTimes(1);
    // 주입 client 사용 시 default createClient/fromMock은 호출되지 않음
    expect(fromMock).not.toHaveBeenCalled();
  });

  // MF2 fix — stale row delete (month-level idempotency)
  it('MF2: deletes stale rows for the month (ticker NOT IN new set) before upsert', async () => {
    upsertMock.mockResolvedValue({ error: null });
    await upsertShortList30('2026-06', buildSelected30());
    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(deleteEqMock).toHaveBeenCalledWith('month', '2026-06-01');
    expect(deleteEqNotMock).toHaveBeenCalledTimes(1);
    const [col, op, value] = deleteEqNotMock.mock.calls[0];
    expect(col).toBe('ticker');
    expect(op).toBe('in');
    expect(value).toMatch(/^\(.*\)$/);
    // 모든 30 새 ticker가 NOT IN 절에 포함 (B23 fix: 6-digit format)
    for (const tf of ['short', 'mid', 'long'] as const) {
      const prefix = ({ short: '00', mid: '01', long: '02' } as const)[tf];
      for (let i = 0; i < 10; i++) {
        const ticker = `${prefix}${String(i).padStart(2, '0')}00`;
        expect(value).toContain(`"${ticker}"`);
      }
    }
  });

  // B23 fix (omxy R11): malicious ticker (PostgREST filter injection) reject
  it('B23: rejects ticker with non-6-digit format (PostgREST injection guard)', async () => {
    const rows = buildSelected30();
    // PostgREST filter break attempt
    rows[0] = { ...rows[0], ticker: '005930")...)' };
    await expect(upsertShortList30('2026-06', rows)).rejects.toThrow(
      /invalid_ticker:/,
    );
    // DELETE/UPSERT 모두 0회 호출 (early throw)
    expect(deleteMock).not.toHaveBeenCalled();
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it('B23: rejects ticker with letters (e.g., short-000 legacy format)', async () => {
    const rows = buildSelected30();
    rows[5] = { ...rows[5], ticker: 'short-000' };
    await expect(upsertShortList30('2026-06', rows)).rejects.toThrow(
      /invalid_ticker:short-000/,
    );
  });

  it('MF2: delete failure surfaces as shortlist_persist_failed', async () => {
    deleteEqNotMock.mockResolvedValue({ error: { code: '42501' } });
    await expect(
      upsertShortList30('2026-06', buildSelected30()),
    ).rejects.toThrow(/shortlist_persist_failed:42501/);
  });
});
