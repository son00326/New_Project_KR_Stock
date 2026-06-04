import { describe, expect, it, vi, beforeEach } from 'vitest';

// W2a Task 6 — upsertShortListTrack: 선검증 후 replace_shortlist_track RPC 단일 호출.
// carry(midlong)·atomic DELETE+INSERT·cross-bucket overlap·p_rows 내부검증·authz는 전부 RPC(Task 5) 내부.
// TS 단위테스트는 (1) 호출 계약 (단일 RPC, p_month/p_track/p_rows) + (2) 선검증 (count/bucket purity/ticker)을 커버.
// feedback_test_mock_typing 준수 — any 금지. RpcChain/SelectChain/QueryResult 인터페이스 정의 후 사용.

interface QueryResult<T = unknown> {
  data: T | null;
  error: { code?: string } | null;
}

interface RpcCall {
  fn: string;
  args: Record<string, unknown>;
}

const { rpcMock, rpcSpy, tier0InMock, tier0EqMock, tier0SelectMock, fromMock } =
  vi.hoisted(() => {
    const rpcSpy: { calls: RpcCall[] } = { calls: [] };
    const rpcMock = vi.fn(
      async (fn: string, args: Record<string, unknown>): Promise<QueryResult> => {
        rpcSpy.calls.push({ fn, args });
        return { data: null, error: null };
      },
    );
    // SHORTLIST-PERSIST-METADATA-1 — tier0_candidates_150 display-meta best-effort lookup chain.
    const tier0InMock = vi.fn();
    const tier0EqMock = vi.fn(() => ({ in: tier0InMock }));
    const tier0SelectMock = vi.fn(() => ({ eq: tier0EqMock }));
    const fromMock = vi.fn((table: string) =>
      table === 'tier0_candidates_150'
        ? { select: tier0SelectMock }
        : {},
    );
    return { rpcMock, rpcSpy, tier0InMock, tier0EqMock, tier0SelectMock, fromMock };
  });

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({ from: fromMock, rpc: rpcMock }),
}));

import { upsertShortListTrack } from '../admin-shortlist-persist';
import type { TickerAggregate } from '@/lib/screening/tier1-schema';

type SupabaseClientArg = NonNullable<
  Parameters<typeof upsertShortListTrack>[3]
>['client'];

// midlong track: mid 10 + long 10 = 20 (assigned_timeframe ∈ {mid, long}).
function buildMidLong20(): TickerAggregate[] {
  const rows: TickerAggregate[] = [];
  const tfs: Array<'mid' | 'long'> = ['mid', 'long'];
  for (const tf of tfs) {
    for (let i = 0; i < 10; i++) {
      rows.push({
        ticker: `${({ mid: '01', long: '02' } as const)[tf]}${String(i).padStart(2, '0')}00`,
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

// short track: short 10 (assigned_timeframe = short).
function buildShort10(): TickerAggregate[] {
  const rows: TickerAggregate[] = [];
  for (let i = 0; i < 10; i++) {
    rows.push({
      ticker: `00${String(i).padStart(2, '0')}00`,
      sector: null,
      weighted_scores: { short: 70, mid: 70, long: 70 },
      primary_timeframe: 'short',
      consensus_badges_by_timeframe: { short: '🟢', mid: '🟢', long: '🟢' },
      assigned_by: i === 9 ? 'backfill' : 'primary',
      assigned_timeframe: 'short',
      prompt_version_id: 'render-user-prompt@v1',
      personas_version_id: 'core11@v3.1',
    });
  }
  return rows;
}

beforeEach(() => {
  rpcMock.mockClear();
  rpcSpy.calls = [];
  fromMock.mockClear();
  tier0InMock.mockReset();
  tier0EqMock.mockClear();
  tier0SelectMock.mockClear();
  // 기본 tier0 lookup은 빈 결과 (메타 없음 → name/composite/signal null).
  tier0InMock.mockResolvedValue({ data: [], error: null });
});

describe('upsertShortListTrack', () => {
  it('writer = replace_shortlist_track 단일 RPC (carry는 server-side 내부) — midlong', async () => {
    await upsertShortListTrack('2026-06', 'midlong', buildMidLong20());
    // 단일 RPC만 호출 (carry는 RPC 내부 — TS에서 별도 호출 안 함, R2 HIGH-2).
    expect(rpcSpy.calls.map((c) => c.fn)).toEqual(['replace_shortlist_track']);
    expect(rpcSpy.calls[0].args).toMatchObject({
      p_month: '2026-06-01',
      p_track: 'midlong',
    });
    const rows = rpcSpy.calls[0].args.p_rows as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(20);
    for (const row of rows) {
      expect(['mid', 'long']).toContain(row.bucket);
      expect(row.month).toBe('2026-06-01');
      expect(row.delta_status).toBe('new');
    }
  });

  it('writer = replace_shortlist_track 단일 RPC — short', async () => {
    await upsertShortListTrack('2026-06', 'short', buildShort10());
    expect(rpcSpy.calls.map((c) => c.fn)).toEqual(['replace_shortlist_track']);
    expect(rpcSpy.calls[0].args).toMatchObject({
      p_month: '2026-06-01',
      p_track: 'short',
    });
    const rows = rpcSpy.calls[0].args.p_rows as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(10);
    for (const row of rows) {
      expect(row.bucket).toBe('short');
    }
  });

  it('rejects count mismatch (short selected=9) — RPC 미호출 (선검증)', async () => {
    const nine = buildShort10().slice(0, 9);
    await expect(
      upsertShortListTrack('2026-06', 'short', nine),
    ).rejects.toThrow(/shortlist_track_count_mismatch:short:9!=10/);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('rejects count mismatch (midlong selected=19) — RPC 미호출', async () => {
    const nineteen = buildMidLong20().slice(0, 19);
    await expect(
      upsertShortListTrack('2026-06', 'midlong', nineteen),
    ).rejects.toThrow(/shortlist_track_count_mismatch:midlong:19!=20/);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('rejects bucket impurity (short track contains mid) — RPC 미호출', async () => {
    const rows = buildShort10();
    rows[0] = { ...rows[0], assigned_timeframe: 'mid' };
    await expect(
      upsertShortListTrack('2026-06', 'short', rows),
    ).rejects.toThrow(/shortlist_track_bucket_impurity:short:/);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('rejects bucket impurity (midlong track contains short) — RPC 미호출', async () => {
    const rows = buildMidLong20();
    rows[0] = { ...rows[0], assigned_timeframe: 'short' };
    await expect(
      upsertShortListTrack('2026-06', 'midlong', rows),
    ).rejects.toThrow(/shortlist_track_bucket_impurity:midlong:/);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('rejects assigned_timeframe null as bucket impurity — RPC 미호출', async () => {
    const rows = buildShort10();
    rows[0] = { ...rows[0], assigned_timeframe: null };
    await expect(
      upsertShortListTrack('2026-06', 'short', rows),
    ).rejects.toThrow(/shortlist_track_bucket_impurity:short:/);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('rejects ticker format violation (TICKER_RE) — RPC 미호출', async () => {
    const rows = buildShort10();
    rows[0] = { ...rows[0], ticker: '005930")...)' };
    await expect(
      upsertShortListTrack('2026-06', 'short', rows),
    ).rejects.toThrow(/invalid_ticker:/);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('throws on invalid month format — RPC 미호출', async () => {
    await expect(
      upsertShortListTrack('2026-6', 'short', buildShort10()),
    ).rejects.toThrow(/invalid_month_format/);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('degraded ticker (no comment) → row ai_comment_kr null', async () => {
    const selected = buildShort10();
    const ticker0 = selected[0].ticker;
    await upsertShortListTrack('2026-06', 'short', selected, {
      commentsByTicker: {
        [ticker0]: { comment_kr: '강력 매수', conviction: 80 },
      },
    });
    const rows = rpcSpy.calls[0].args.p_rows as Array<Record<string, unknown>>;
    const r0 = rows.find((r) => r.ticker === ticker0)!;
    expect(r0.ai_comment_kr).toBe('강력 매수');
    expect(r0.conviction).toBe(80);
    const rOther = rows.find((r) => r.ticker !== ticker0)!;
    expect(rOther.ai_comment_kr).toBeNull();
    expect(rOther.conviction).toBeNull();
  });

  it('surfaces RPC error as shortlist_persist_failed:<code>', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: '42501' } });
    await expect(
      upsertShortListTrack('2026-06', 'short', buildShort10()),
    ).rejects.toThrow(/shortlist_persist_failed:42501/);
  });

  it('accepts injected supabase client via options.client (DI for cron)', async () => {
    const customRpcCalls: RpcCall[] = [];
    const customRpc = vi.fn(
      async (fn: string, args: Record<string, unknown>): Promise<QueryResult> => {
        customRpcCalls.push({ fn, args });
        return { data: null, error: null };
      },
    );
    const customTier0In = vi.fn().mockResolvedValue({ data: [], error: null });
    const customTier0Eq = vi.fn(() => ({ in: customTier0In }));
    const customTier0Select = vi.fn(() => ({ eq: customTier0Eq }));
    const customFrom = vi.fn((table: string) =>
      table === 'tier0_candidates_150' ? { select: customTier0Select } : {},
    );
    const injectedClient = {
      from: customFrom,
      rpc: customRpc,
    } as unknown as SupabaseClientArg;

    await upsertShortListTrack('2026-06', 'short', buildShort10(), {
      client: injectedClient,
    });
    expect(customRpc).toHaveBeenCalledTimes(1);
    expect(customRpcCalls[0].fn).toBe('replace_shortlist_track');
    // 주입 client 사용 시 default createClient/rpcMock은 호출되지 않음.
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('patches name/composite_score/signal_label from tier0_candidates_150 + sector from aggregate', async () => {
    const selected = buildShort10();
    selected[0] = {
      ...selected[0],
      sector: '반도체' as TickerAggregate['sector'],
    };
    const ticker0 = selected[0].ticker;
    tier0InMock.mockResolvedValue({
      data: [
        { ticker: ticker0, name: '삼성전자', tier0_score: '87.5', signal_label: '강한 모멘텀' },
      ],
      error: null,
    });

    await upsertShortListTrack('2026-06', 'short', selected);

    expect(fromMock).toHaveBeenCalledWith('tier0_candidates_150');
    expect(tier0SelectMock).toHaveBeenCalledWith(
      'ticker, name, tier0_score, signal_label',
    );
    expect(tier0EqMock).toHaveBeenCalledWith('month', '2026-06-01');

    const rows = rpcSpy.calls[0].args.p_rows as Array<Record<string, unknown>>;
    const r0 = rows.find((r) => r.ticker === ticker0)!;
    expect(r0.name).toBe('삼성전자');
    expect(r0.composite_score).toBe(87.5);
    expect(r0.signal_label).toBe('강한 모멘텀');
    expect(r0.sector).toBe('반도체');

    const rOther = rows.find((r) => r.ticker !== ticker0)!;
    expect(rOther.name).toBeNull();
    expect(rOther.composite_score).toBeNull();
    expect(rOther.signal_label).toBeNull();
    expect(rOther.sector).toBeNull();
  });
});
