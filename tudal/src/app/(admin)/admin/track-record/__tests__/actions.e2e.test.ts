// Mock e2e — flag-off 경로 (실 Anthropic 호출 없음, mock callPersona)
// Plan SoT: docs/superpowers/plans/2026-05-19-s7a-anthropic-wrapper.md §Task 16
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerMonthlyPersonaEvalAction } from '../actions';
import type { CallPersonaInput, CallPersonaResult } from '@/lib/ai/anthropic-client';

// --- callPersona mock (per-test 재정의 가능) ---
const mockCallPersona = vi.fn();
vi.mock('@/lib/ai/anthropic-client', () => ({
  callPersona: (input: CallPersonaInput) => mockCallPersona(input),
}));

// --- Supabase mock — fluent chain + table/rpc dispatch ---
interface QueryResult<T> {
  data: T | null;
  error: { code?: string; message: string } | null;
}

interface SelectChain<T> {
  select: (cols?: string) => SelectChain<T>;
  eq: (col: string, val: unknown) => SelectChain<T>;
  order: (col: string, opts?: { ascending?: boolean }) => SelectChain<T>;
  single: () => Promise<QueryResult<T>>;
  then: <R>(onFulfilled: (v: QueryResult<T>) => R) => Promise<R>; // awaitable terminal
}

interface UpdateChain {
  eq: (col: string, val: unknown) => Promise<QueryResult<null>>;
}

interface TableMock {
  select?: () => SelectChain<unknown>;
  update?: (payload: unknown) => UpdateChain;
}

const happyResponse: CallPersonaResult = {
  content: '{"vote":"BUY","one_line":"강함","argument_excerpt":"근거 200자 이내"}',
  usage: { input_tokens: 100, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 50 },
  costKrw: 100,
  promptCacheEnabled: false,
};

// Generate 30 tickers: 10 short + 10 mid + 10 long
function buildShortlistRows() {
  const rows: Array<{ ticker: string; bucket: 'short' | 'mid' | 'long'; composite_score: number }> = [];
  const buckets: Array<'short' | 'mid' | 'long'> = ['short', 'mid', 'long'];
  for (let bi = 0; bi < 3; bi++) {
    for (let i = 0; i < 10; i++) {
      const idx = bi * 10 + i;
      rows.push({
        ticker: String(idx).padStart(6, '0'),
        bucket: buckets[bi],
        composite_score: 100 - idx,
      });
    }
  }
  return rows;
}

const mockRpc = vi.fn();
const mockUpdate = vi.fn();

function makeSelectChain<T>(result: QueryResult<T>): SelectChain<T> {
  const chain: SelectChain<T> = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    single: () => Promise.resolve(result),
    then: (onFulfilled) => Promise.resolve(result).then(onFulfilled),
  };
  return chain;
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: 'admin-uuid', email: 'admin@example.com' } },
      })),
    },
    from: (table: string): TableMock => {
      if (table === 'admin_emails') {
        return {
          select: () => makeSelectChain({ data: { email: 'admin@example.com' }, error: null }),
        };
      }
      if (table === 'short_list_30') {
        return {
          select: () => makeSelectChain({ data: buildShortlistRows(), error: null }),
        };
      }
      if (table === 'dart_financial_cache') {
        return {
          select: () =>
            makeSelectChain({
              data: { quarter_revenue: 1, trailing_revenue: 1, quality_score: 1 },
              error: null,
            }),
        };
      }
      if (table === 'cost_log') {
        // preflightHardcap → getMonthlyTotal → .select().eq() awaited
        return {
          select: () => makeSelectChain({ data: [], error: null }),
        };
      }
      if (table === 'monthly_batch_runs') {
        return {
          update: (payload: unknown) => {
            mockUpdate(payload);
            return {
              eq: async () => ({ data: null, error: null }),
            };
          },
        };
      }
      throw new Error(`unexpected_from_table:${table}`);
    },
    rpc: (name: string, args: unknown) => mockRpc(name, args),
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockCallPersona.mockImplementation(async () => happyResponse);
  // RPC default routing
  mockRpc.mockImplementation(async (name: string) => {
    if (name === 'acquire_batch_lock') return { data: { acquired: true, resumed: false }, error: null };
    if (name === 'commit_persona_eval') return { data: { success: true, report_id: 'rpt-1' }, error: null };
    if (name === 'commit_badge_only') return { data: { success: true }, error: null };
    return { data: null, error: { message: `unexpected_rpc:${name}` } };
  });
});

describe('S7a e2e mock (Plan §16 — Design R4 + Plan R3 BLOCKER 7)', () => {
  it('admin trigger → 330 callPersona + 30 commitTickerReport + lock success', async () => {
    const result = await triggerMonthlyPersonaEvalAction('2026-05');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.totalCalls).toBe(330); // 11 persona × 30 ticker

    // callPersona invoked 330 times
    expect(mockCallPersona).toHaveBeenCalledTimes(330);

    // commit_persona_eval RPC invoked 30 times (모두 happy → ⚪ 없음)
    const commitPersonaCalls = mockRpc.mock.calls.filter((c) => c[0] === 'commit_persona_eval');
    expect(commitPersonaCalls).toHaveLength(30);

    // commit_badge_only NOT called
    const commitBadgeCalls = mockRpc.mock.calls.filter((c) => c[0] === 'commit_badge_only');
    expect(commitBadgeCalls).toHaveLength(0);

    // lock release: status='succeeded'
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'succeeded', call_count_done: 330 }),
    );
  });

  it('⚪ ticker는 commit_badge_only / 정상 ticker는 commit_persona_eval 분기 (ai_call_failed 5건)', async () => {
    const rows = buildShortlistRows();
    const failingTickers = new Set(rows.slice(0, 5).map((r) => r.ticker));

    mockCallPersona.mockImplementation(async (input: CallPersonaInput) => {
      if (failingTickers.has(input.ticker)) {
        throw new Error('ai_call_failed');
      }
      return happyResponse;
    });

    const result = await triggerMonthlyPersonaEvalAction('2026-05');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');

    // commit 분기 검증
    const commitBadgeCalls = mockRpc.mock.calls.filter((c) => c[0] === 'commit_badge_only');
    const commitPersonaCalls = mockRpc.mock.calls.filter((c) => c[0] === 'commit_persona_eval');
    expect(commitBadgeCalls).toHaveLength(5); // ⚪ × 5
    expect(commitPersonaCalls).toHaveLength(25); // 정상 × 25

    // lock release: status='succeeded' (5건 ai_call_failed는 ⚪ fallback이지 fatal 아님)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'succeeded' }),
    );
  });
});
