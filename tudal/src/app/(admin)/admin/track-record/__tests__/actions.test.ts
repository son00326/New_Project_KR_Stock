// tudal/src/app/(admin)/admin/track-record/__tests__/actions.test.ts
//
// Step 3c — Tier 2 caller wiring unit tests (omxy 53차 §3 D4 R1~R4 4 BLOCKERS 정정 박제).
//
// Spec SoT: docs/superpowers/specs/2026-05-21-step3c-caller-wiring.md §5.1
// Plan SoT: docs/superpowers/plans/2026-05-21-step3c-caller-wiring.md §Task 1.2
//
// 8 test cases:
//   1. shouldRunTier2 exported unit (5 sub-asserts: env undef / false / true × badge 🟢 / 🔵 / ⚪)
//   2. env false baseline → commitSectorReport not called, skippedGate > 0
//   3. env true + sector NULL → skippedSector > 0
//   4. env true + sector unknown ('한전') → skippedSector > 0
//   5. env true + sector canonical + sub_tags NULL → subTags=[] → commit, committed=1
//   6. env true + sector canonical + sub_tags malformed (string OR object) → fallback [] → commit
//   7. env true + sector canonical + tier2.available=false (degraded) → skippedUnavailable > 0
//   8. happy path strict verify: commitSectorReport args + length + regex pattern + sub_tag matched ID
//
// 기존 actions.e2e.test.ts는 변경 0 — Tier 2 wiring은 별도 unit test file로 분리.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { CallPersonaInput, CallPersonaResult } from '@/lib/ai/anthropic-client';

// --- callPersona mock (per-test 재정의 가능) ---
const mockCallPersona = vi.fn();
vi.mock('@/lib/ai/anthropic-client', () => ({
  callPersona: (input: CallPersonaInput) => mockCallPersona(input),
}));

// --- runMonthlyPersonaEval + runSectorEval mock (caller path 격리) ---
const mockRunMonthlyPersonaEval = vi.fn();
const mockRunSectorEval = vi.fn();
vi.mock('@/lib/screening/persona-eval', () => ({
  runMonthlyPersonaEval: (input: unknown) => mockRunMonthlyPersonaEval(input),
  runSectorEval: (input: unknown) => mockRunSectorEval(input),
}));

// --- writer mock (commit 호출 여부 + 인자 strict verify) ---
const mockCommitTickerReport = vi.fn();
const mockCommitBadgeOnly = vi.fn();
const mockCommitSectorReport = vi.fn();
vi.mock('@/lib/report/writer', () => ({
  commitTickerReport: (input: unknown) => mockCommitTickerReport(input),
  commitBadgeOnly: (input: unknown) => mockCommitBadgeOnly(input),
  commitSectorReport: (input: unknown) => mockCommitSectorReport(input),
}));

// --- batch lock mock (runMonthlyPersonaEval은 어차피 mock이므로 호출 안 되지만 import 격리 안전망) ---
vi.mock('@/lib/data/admin-batch-runs', () => ({
  acquireBatchLock: vi.fn(async () => ({ acquired: true, resumed: false })),
  releaseBatchLock: vi.fn(async () => undefined),
}));

// --- Supabase mock — fluent chain + table dispatch ---
interface QueryResult<T> {
  data: T | null;
  error: { code?: string; message: string } | null;
}

interface SelectChain<T> {
  select: (cols?: string) => SelectChain<T>;
  eq: (col: string, val: unknown) => SelectChain<T>;
  order: (col: string, opts?: { ascending?: boolean }) => SelectChain<T>;
  single: () => Promise<QueryResult<T>>;
  then: <R>(onFulfilled: (v: QueryResult<T>) => R) => Promise<R>;
}

interface UpdateChain {
  eq: (col: string, val: unknown) => Promise<QueryResult<null>>;
}

interface TableMock {
  select?: () => SelectChain<unknown>;
  update?: (payload: unknown) => UpdateChain;
}

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

// shortlist row builder — 1 ticker fixture (sector/sub_tags 시나리오 controllable).
interface FixtureShortlistRow {
  ticker: string;
  bucket: 'short' | 'mid' | 'long';
  composite_score: number;
  sector: string | null;
  sub_tags: unknown;
}

let currentShortlist: FixtureShortlistRow[] = [];

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
          select: () => makeSelectChain({ data: currentShortlist, error: null }),
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
      throw new Error(`unexpected_from_table:${table}`);
    },
    rpc: vi.fn(),
  })),
}));

// happy CallPersonaResult fixture
const happyResponse: CallPersonaResult = {
  content: '{"vote":"BUY","one_line":"강함","argument_excerpt":"근거 200자 이내"}',
  usage: { input_tokens: 100, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 50 },
  costKrw: 100,
  promptCacheEnabled: false,
};

/**
 * runMonthlyPersonaEval mock helper — 1 ticker happy path (Core 11 success → badge 🟢 base).
 * tier1Available=true / 11 persona responses all BUY → tier1IsTop=true / tier0IsTop=true → badge='🟢'.
 */
function mockCore11Happy(ticker: string): void {
  mockRunMonthlyPersonaEval.mockImplementationOnce(async () => ({
    byTicker: { [ticker]: Array.from({ length: 11 }, () => happyResponse) },
    tier1AvailableByTicker: { [ticker]: true },
    totalCalls: 11,
  }));
}

/**
 * runSectorEval mock helper — 14 persona success (available=true).
 */
function mockSectorEvalAvailable(personaIds: string[]): void {
  mockRunSectorEval.mockImplementationOnce(async () => ({
    ticker: 'TEST',
    sector: 'IT/SW',
    personaIds,
    results: Array.from({ length: 14 }, () => happyResponse),
    available: true,
    degradedCount: 0,
    totalCalls: 14,
  }));
}

/**
 * runSectorEval mock helper — degraded (available=false, degradedCount=3).
 */
function mockSectorEvalDegraded(): void {
  mockRunSectorEval.mockImplementationOnce(async () => ({
    ticker: 'TEST',
    sector: 'IT/SW',
    personaIds: Array.from({ length: 14 }, (_, i) => `sector-IT/SW-slot-${i + 1}`),
    results: Array.from({ length: 11 }, () => happyResponse),
    available: false,
    degradedCount: 3,
    totalCalls: 11,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCallPersona.mockImplementation(async () => happyResponse);
  currentShortlist = [];
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Step 3c — shouldRunTier2 (omxy R1 BLOCKER 4 — exported helper unit)', () => {
  it('5 sub-asserts: env undef/false/true × badge 🟢/🔵/⚪', async () => {
    // dynamic import to ensure env stubs are picked up per-test
    const { shouldRunTier2 } = await import('../actions');

    // env undefined → false
    vi.stubEnv('AI_COST_LOG_REAL_INSERT_ENABLED', '');
    expect(shouldRunTier2('🟢')).toBe(false);
    vi.unstubAllEnvs();

    // env 'false' → false
    vi.stubEnv('AI_COST_LOG_REAL_INSERT_ENABLED', 'false');
    expect(shouldRunTier2('🟢')).toBe(false);
    vi.unstubAllEnvs();

    // env 'true' + badge '🟢' → true
    vi.stubEnv('AI_COST_LOG_REAL_INSERT_ENABLED', 'true');
    expect(shouldRunTier2('🟢')).toBe(true);

    // env 'true' + badge '🔵' → true (non-🟢 non-⚪ case, omxy R2 권장)
    expect(shouldRunTier2('🔵')).toBe(true);

    // env 'true' + badge '⚪' → false (badge 자체 차단)
    expect(shouldRunTier2('⚪')).toBe(false);
  });
});

describe('Step 3c — Tier 2 branch (omxy 53차 §3 R3 D6 cost gate + D4 R1~R4 BLOCKERS 정정)', () => {
  it('env false (baseline) → commitSectorReport never called, skippedGate > 0', async () => {
    // env explicitly unset → shouldRunTier2 returns false
    vi.stubEnv('AI_COST_LOG_REAL_INSERT_ENABLED', 'false');
    const ticker = '000001';
    currentShortlist = [
      { ticker, bucket: 'short', composite_score: 100, sector: 'IT/SW', sub_tags: [] },
    ];
    mockCore11Happy(ticker);

    const { triggerMonthlyPersonaEvalAction } = await import('../actions');
    const result = await triggerMonthlyPersonaEvalAction('2026-05');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(mockCommitSectorReport).not.toHaveBeenCalled();
    expect(mockRunSectorEval).not.toHaveBeenCalled();
    expect(result.tier2).toBeDefined();
    expect(result.tier2.skippedGate).toBeGreaterThan(0);
    expect(result.tier2.committed).toBe(0);
  });

  it('env true + sector NULL → skippedSector > 0 (omxy R1 BLOCKER 3)', async () => {
    vi.stubEnv('AI_COST_LOG_REAL_INSERT_ENABLED', 'true');
    const ticker = '000002';
    currentShortlist = [
      { ticker, bucket: 'short', composite_score: 100, sector: null, sub_tags: [] },
    ];
    mockCore11Happy(ticker);

    const { triggerMonthlyPersonaEvalAction } = await import('../actions');
    const result = await triggerMonthlyPersonaEvalAction('2026-05');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(mockRunSectorEval).not.toHaveBeenCalled();
    expect(mockCommitSectorReport).not.toHaveBeenCalled();
    expect(result.tier2.skippedSector).toBeGreaterThan(0);
    expect(result.tier2.committed).toBe(0);
  });

  it('env true + sector unknown (non-canonical) → skippedSector > 0', async () => {
    vi.stubEnv('AI_COST_LOG_REAL_INSERT_ENABLED', 'true');
    const ticker = '000003';
    currentShortlist = [
      { ticker, bucket: 'short', composite_score: 100, sector: '한전', sub_tags: [] },
    ];
    mockCore11Happy(ticker);

    const { triggerMonthlyPersonaEvalAction } = await import('../actions');
    const result = await triggerMonthlyPersonaEvalAction('2026-05');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(mockRunSectorEval).not.toHaveBeenCalled();
    expect(mockCommitSectorReport).not.toHaveBeenCalled();
    expect(result.tier2.skippedSector).toBeGreaterThan(0);
    expect(result.tier2.committed).toBe(0);
  });

  it('env true + sector canonical + sub_tags NULL → subTags=[] → committed=1', async () => {
    vi.stubEnv('AI_COST_LOG_REAL_INSERT_ENABLED', 'true');
    const ticker = '000004';
    currentShortlist = [
      { ticker, bucket: 'short', composite_score: 100, sector: 'IT/SW', sub_tags: null },
    ];
    mockCore11Happy(ticker);
    const personaIds = Array.from({ length: 14 }, (_, i) => `sector-IT/SW-slot-${i + 1}`);
    mockSectorEvalAvailable(personaIds);

    const { triggerMonthlyPersonaEvalAction } = await import('../actions');
    const result = await triggerMonthlyPersonaEvalAction('2026-05');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(mockRunSectorEval).toHaveBeenCalledTimes(1);
    expect(mockCommitSectorReport).toHaveBeenCalledTimes(1);
    expect(result.tier2.committed).toBe(1);
    expect(result.tier2.attempted).toBe(1);
    // sub_tags=[] verified via runSectorEval call args
    const runSectorEvalArgs = mockRunSectorEval.mock.calls[0][0] as { sub_tags: readonly string[] };
    expect(runSectorEvalArgs.sub_tags).toEqual([]);
  });

  it('env true + sector canonical + sub_tags malformed (string OR object) → fallback [] (omxy R1 BLOCKER 2)', async () => {
    vi.stubEnv('AI_COST_LOG_REAL_INSERT_ENABLED', 'true');

    // case A: sub_tags = "string-not-array" (non-array jsonb)
    const tickerA = '000005';
    currentShortlist = [
      { ticker: tickerA, bucket: 'short', composite_score: 100, sector: 'IT/SW', sub_tags: 'string-not-array' },
    ];
    mockCore11Happy(tickerA);
    const personaIds = Array.from({ length: 14 }, (_, i) => `sector-IT/SW-slot-${i + 1}`);
    mockSectorEvalAvailable(personaIds);

    const { triggerMonthlyPersonaEvalAction } = await import('../actions');
    const resultA = await triggerMonthlyPersonaEvalAction('2026-05');
    expect(resultA.ok).toBe(true);
    if (!resultA.ok) throw new Error('unreachable');
    expect(resultA.tier2.committed).toBe(1);
    const argsA = mockRunSectorEval.mock.calls[0][0] as { sub_tags: readonly string[] };
    expect(argsA.sub_tags).toEqual([]); // fallback

    // case B: sub_tags = { not: 'array' } (object jsonb)
    vi.clearAllMocks();
    const tickerB = '000006';
    currentShortlist = [
      { ticker: tickerB, bucket: 'short', composite_score: 100, sector: 'IT/SW', sub_tags: { not: 'array' } },
    ];
    mockCore11Happy(tickerB);
    mockSectorEvalAvailable(personaIds);

    const resultB = await triggerMonthlyPersonaEvalAction('2026-05');
    expect(resultB.ok).toBe(true);
    if (!resultB.ok) throw new Error('unreachable');
    expect(resultB.tier2.committed).toBe(1);
    const argsB = mockRunSectorEval.mock.calls[0][0] as { sub_tags: readonly string[] };
    expect(argsB.sub_tags).toEqual([]); // fallback
  });

  it('env true + sector canonical + tier2.available=false (degraded) → skippedUnavailable > 0', async () => {
    vi.stubEnv('AI_COST_LOG_REAL_INSERT_ENABLED', 'true');
    const ticker = '000007';
    currentShortlist = [
      { ticker, bucket: 'short', composite_score: 100, sector: 'IT/SW', sub_tags: [] },
    ];
    mockCore11Happy(ticker);
    mockSectorEvalDegraded();

    const { triggerMonthlyPersonaEvalAction } = await import('../actions');
    const result = await triggerMonthlyPersonaEvalAction('2026-05');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(mockRunSectorEval).toHaveBeenCalledTimes(1);
    expect(mockCommitSectorReport).not.toHaveBeenCalled();
    expect(result.tier2.skippedUnavailable).toBeGreaterThan(0);
    expect(result.tier2.committed).toBe(0);
  });

  it('happy path strict verify — commitSectorReport args length + regex pattern + sub_tag matched ID (omxy R3+R4)', async () => {
    vi.stubEnv('AI_COST_LOG_REAL_INSERT_ENABLED', 'true');
    const ticker = '000008';
    const sector = '운송/물류';
    const sub_tags = ['조선'];
    currentShortlist = [
      { ticker, bucket: 'short', composite_score: 100, sector, sub_tags },
    ];
    mockCore11Happy(ticker);

    // 14 persona IDs with at least 1 sub_tag matched (slot 13 + slot 14 carry -subtag-조선 suffix per runSectorEval contract)
    const personaIds: string[] = [];
    for (let i = 1; i <= 12; i++) {
      personaIds.push(`sector-${sector}-slot-${i}`);
    }
    personaIds.push(`sector-${sector}-slot-13-subtag-조선`);
    personaIds.push(`sector-${sector}-slot-14-subtag-조선`);
    expect(personaIds.length).toBe(14);

    mockRunSectorEval.mockImplementationOnce(async () => ({
      ticker,
      sector,
      personaIds,
      results: Array.from({ length: 14 }, () => happyResponse),
      available: true,
      degradedCount: 0,
      totalCalls: 14,
    }));

    const { triggerMonthlyPersonaEvalAction } = await import('../actions');
    const result = await triggerMonthlyPersonaEvalAction('2026-05');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(mockCommitSectorReport).toHaveBeenCalledTimes(1);

    // strict args verify
    const commitArgs = mockCommitSectorReport.mock.calls[0][0] as {
      month: string;
      ticker: string;
      sector: string;
      sub_tags: readonly string[];
      sectorPersonaResults: unknown[];
      sectorPersonaIds: string[];
    };
    expect(commitArgs.month).toBe('2026-05');
    expect(commitArgs.ticker).toBe(ticker);
    expect(commitArgs.sector).toBe(sector);
    expect(commitArgs.sub_tags).toEqual(sub_tags);

    // length checks (omxy R3 strict)
    expect(commitArgs.sectorPersonaResults.length).toBe(14);
    expect(commitArgs.sectorPersonaIds.length).toBe(14);

    // regex pattern: each ID matches ^sector-운송/물류-slot-(1[0-4]|[1-9])(-subtag-.+)?$
    // (.+) matches Korean chars in JS — omxy R4 박제
    const pattern = /^sector-운송\/물류-slot-(1[0-4]|[1-9])(-subtag-.+)?$/;
    for (const id of commitArgs.sectorPersonaIds) {
      expect(id).toMatch(pattern);
    }

    // at least one persona ID with -subtag-조선 suffix (omxy R4 sub_tag matched case verify)
    const subTagMatched = commitArgs.sectorPersonaIds.filter((id) => id.includes('-subtag-조선'));
    expect(subTagMatched.length).toBeGreaterThanOrEqual(1);

    // counter check
    expect(result.tier2.committed).toBe(1);
    expect(result.tier2.attempted).toBe(1);
  });
});
