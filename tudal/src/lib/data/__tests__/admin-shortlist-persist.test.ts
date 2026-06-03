import { describe, expect, it, vi, beforeEach } from 'vitest';

const {
  upsertMock,
  deleteEqNotMock,
  deleteEqMock,
  deleteMock,
  tier0InMock,
  tier0EqMock,
  tier0SelectMock,
  fromMock,
} = vi.hoisted(() => {
  const upsertMock = vi.fn();
  const deleteEqNotMock = vi.fn();
  const deleteEqMock = vi.fn(() => ({ not: deleteEqNotMock }));
  const deleteMock = vi.fn(() => ({ eq: deleteEqMock }));
  // SHORTLIST-PERSIST-METADATA-1 — tier0_candidates_150 display-meta best-effort lookup
  // chain: .select('ticker, name, tier0_score, signal_label').eq('month', ...).in('ticker', [...]).
  const tier0InMock = vi.fn();
  const tier0EqMock = vi.fn(() => ({ in: tier0InMock }));
  const tier0SelectMock = vi.fn(() => ({ eq: tier0EqMock }));
  const fromMock = vi.fn((table: string) =>
    table === 'tier0_candidates_150'
      ? { select: tier0SelectMock }
      : { upsert: upsertMock, delete: deleteMock },
  );
  return {
    upsertMock,
    deleteEqNotMock,
    deleteEqMock,
    deleteMock,
    tier0InMock,
    tier0EqMock,
    tier0SelectMock,
    fromMock,
  };
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
  tier0InMock.mockReset();
  tier0EqMock.mockClear();
  tier0SelectMock.mockClear();
  // 기본 delete 성공 (DI 없는 test에서는 stale delete가 먼저 실행됨)
  deleteEqNotMock.mockResolvedValue({ error: null });
  // SHORTLIST-PERSIST-METADATA-1 — 기본 tier0 lookup은 빈 결과 (메타 없음 → name/composite/signal null).
  tier0InMock.mockResolvedValue({ data: [], error: null });
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
    // SHORTLIST-PERSIST-METADATA-1 — 주입 client도 tier0 lookup chain 제공 (빈 결과).
    const customTier0In = vi.fn().mockResolvedValue({ data: [], error: null });
    const customTier0Eq = vi.fn(() => ({ in: customTier0In }));
    const customTier0Select = vi.fn(() => ({ eq: customTier0Eq }));
    const customFrom = vi.fn((table: string) =>
      table === 'tier0_candidates_150'
        ? { select: customTier0Select }
        : { upsert: customUpsert, delete: customDelete },
    );
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

  // PR-E (마이그 0029 / ADR D-7) — AI 컬럼 매핑.
  it('PR-E: maps AI columns (badge/ai_score/weighted_scores/winning_timeframe) + commentsByTicker', async () => {
    upsertMock.mockResolvedValue({ error: null });
    const selected = buildSelected30();
    const firstTicker = selected[0].ticker; // '000000' (short, primary=short)
    await upsertShortList30('2026-06', selected, {
      commentsByTicker: {
        [firstTicker]: { comment_kr: '강력 매수', conviction: 82.5 },
      },
    });
    const rows = upsertMock.mock.calls[0][0] as Array<Record<string, unknown>>;
    const r0 = rows.find((r) => r.ticker === firstTicker)!;
    expect(r0.consensus_badge).toBe('🟢');
    expect(r0.ai_score).toBe(70); // weighted_scores[assigned_tf=short]
    expect(r0.weighted_score_short).toBe(70);
    expect(r0.weighted_score_mid).toBe(70);
    expect(r0.weighted_score_long).toBe(70);
    expect(r0.winning_timeframe).toBe('short'); // primary_timeframe
    expect(r0.conviction).toBe(82.5);
    expect(r0.ai_comment_kr).toBe('강력 매수');
    // comment 부재 ticker → conviction/ai_comment_kr null, 배지는 항상 매핑.
    const rOther = rows.find((r) => r.ticker !== firstTicker)!;
    expect(rOther.conviction).toBeNull();
    expect(rOther.ai_comment_kr).toBeNull();
    expect(rOther.consensus_badge).toBe('🟢');
  });

  // SHORTLIST-PERSIST-METADATA-1 fix (omxy 교차검증 ROUND 1 P1) — Tier0/display 메타 carry.
  it('SHORTLIST-PERSIST-METADATA-1: patches name/composite_score/signal_label from tier0_candidates_150 + sector from aggregate', async () => {
    upsertMock.mockResolvedValue({ error: null });
    const selected = buildSelected30();
    selected[0] = {
      ...selected[0],
      sector: '반도체' as TickerAggregate['sector'],
    };
    const ticker0 = selected[0].ticker; // '000000'
    tier0InMock.mockResolvedValue({
      data: [
        // PostgREST는 numeric을 string으로 반환할 수 있다 — parseFloat 검증.
        { ticker: ticker0, name: '삼성전자', tier0_score: '87.5', signal_label: '강한 모멘텀' },
      ],
      error: null,
    });

    await upsertShortList30('2026-06', selected);

    // tier0 lookup이 올바른 table/컬럼/필터로 호출됨
    expect(fromMock).toHaveBeenCalledWith('tier0_candidates_150');
    expect(tier0SelectMock).toHaveBeenCalledWith(
      'ticker, name, tier0_score, signal_label',
    );
    expect(tier0EqMock).toHaveBeenCalledWith('month', '2026-06-01');
    const inArgs = tier0InMock.mock.calls[0];
    expect(inArgs[0]).toBe('ticker');
    expect(inArgs[1]).toContain(ticker0);

    const rows = upsertMock.mock.calls[0][0] as Array<Record<string, unknown>>;
    const r0 = rows.find((r) => r.ticker === ticker0)!;
    expect(r0.name).toBe('삼성전자');
    expect(r0.composite_score).toBe(87.5); // string tier0_score → number
    expect(r0.signal_label).toBe('강한 모멘텀');
    expect(r0.sector).toBe('반도체'); // agg.sector 직접 carry (lookup 아님)

    // lookup 결과에 없는 ticker → name/composite/signal null (graceful), sector는 agg(null)
    const rOther = rows.find((r) => r.ticker !== ticker0)!;
    expect(rOther.name).toBeNull();
    expect(rOther.composite_score).toBeNull();
    expect(rOther.signal_label).toBeNull();
    expect(rOther.sector).toBeNull();
  });

  it('SHORTLIST-PERSIST-METADATA-1: tier0 lookup returned error does NOT fail persist (best-effort, rows still upserted with null meta)', async () => {
    upsertMock.mockResolvedValue({ error: null });
    // lookup이 error + data:null → patch skip, persist는 정상 진행 (fail-open on display meta).
    tier0InMock.mockResolvedValue({ data: null, error: { code: '42501' } });

    await expect(
      upsertShortList30('2026-06', buildSelected30()),
    ).resolves.toBeUndefined();

    expect(upsertMock).toHaveBeenCalledTimes(1);
    const rows = upsertMock.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(30);
    for (const row of rows) {
      expect(row.name).toBeNull();
      expect(row.composite_score).toBeNull();
      expect(row.signal_label).toBeNull();
    }
  });

  it('SHORTLIST-PERSIST-METADATA-1: tier0 lookup rejection does NOT fail persist', async () => {
    upsertMock.mockResolvedValue({ error: null });
    tier0InMock.mockRejectedValue(new Error('network'));

    await expect(
      upsertShortList30('2026-06', buildSelected30()),
    ).resolves.toBeUndefined();

    expect(upsertMock).toHaveBeenCalledTimes(1);
    const rows = upsertMock.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(30);
    for (const row of rows) {
      expect(row.name).toBeNull();
      expect(row.composite_score).toBeNull();
      expect(row.signal_label).toBeNull();
    }
  });
});
