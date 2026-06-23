// Track 1 PR-A2 — shadow-arm-logger 테스트 (env gating, config parse, per-arm RPC payload).
import { describe, it, expect, vi } from 'vitest';
import {
  createShadowArmLoggerFromEnv,
  readShadowConfigFromEnv,
  logShadowArmsWithConfig,
  type LogShadowArmsInput,
} from '../shadow-arm-logger';
import type { Timeframe, TickerAggregate, Tier1ScreeningResult } from '../tier1-schema';
import type { CanonicalSector } from '../canonical-sectors';
import type { Tier1Candidate } from '../persona-eval';

// ---- fixtures: valid short-track productionResult (10 selected + 40 notSelected) ----
function ws(short: number): Record<Timeframe, number> { return { short, mid: 0, long: 0 }; }
function agg(ticker: string, sector: CanonicalSector | null, s: number, assigned: boolean): TickerAggregate {
  return {
    ticker, sector, weighted_scores: ws(s), primary_timeframe: 'short',
    consensus_badges_by_timeframe: { short: '🟡', mid: '🟡', long: '🟡' },
    assigned_by: assigned ? 'primary' : null,
    assigned_timeframe: assigned ? 'short' : null,
    prompt_version_id: 'p-v1', personas_version_id: 'k-v1',
  };
}
function tk(n: number): string { return String(n).padStart(6, '0'); }

function shortInput(overrides: Partial<LogShadowArmsInput> = {}): LogShadowArmsInput {
  const selected: TickerAggregate[] = [];
  for (let n = 1; n <= 10; n++) selected.push(agg(tk(n), n % 2 === 0 ? '반도체' : '자동차', 91 - n, true));
  const notSelected: TickerAggregate[] = [];
  for (let n = 11; n <= 50; n++) notSelected.push(agg(tk(n), '바이오', 80 - n, false)); // 바이오 reserves for manual tests
  const all = [...selected, ...notSelected];
  const candidates: Tier1Candidate[] = all.map((a) => ({
    ticker: a.ticker, sector: a.sector,
    tier0_buckets: { short: true, mid: false, long: false },
    tier0_scores: { short: 1, mid: null, long: null },
  }));
  const productionResult: Tier1ScreeningResult = {
    selected, notSelected,
    selectionMeta: {
      shortCount: 10, midCount: 0, longCount: 0,
      backfillCounts: { short: 0, mid: 0, long: 0 },
      promptVersionId: 'p-v1', personasVersionId: 'k-v1', generatedAt: '2026-06-15T00:00:00.000Z',
    },
  };
  return {
    month: '2026-06', track: 'short', periodKey: 's:2026-06-15', runId: 'r1',
    productionResult, candidates, incumbentTickers: new Set(), judgeScoresByTicker: {},
    client: makeRpcClient().client,
    ...overrides,
  };
}

function makeRpcClient(error: { code?: string } | null = null) {
  const calls: Array<{ name: string; payload: Record<string, unknown> }> = [];
  const client = {
    rpc: vi.fn(async (name: string, args: { p_payload: Record<string, unknown> }) => {
      calls.push({ name, payload: args.p_payload });
      return { data: error ? null : '00000000-0000-0000-0000-000000000001', error };
    }),
  };
  return { client: client as unknown as LogShadowArmsInput['client'], calls };
}

describe('shadow-arm-logger — env gating', () => {
  it('FORWARD_SHADOW_ENABLED unset/≠true → undefined (default OFF)', () => {
    expect(createShadowArmLoggerFromEnv({})).toBeUndefined();
    expect(createShadowArmLoggerFromEnv({ FORWARD_SHADOW_ENABLED: 'false' })).toBeUndefined();
    expect(createShadowArmLoggerFromEnv({ FORWARD_SHADOW_ENABLED: '1' })).toBeUndefined();
  });
  it('FORWARD_SHADOW_ENABLED=true → logger function', () => {
    expect(typeof createShadowArmLoggerFromEnv({ FORWARD_SHADOW_ENABLED: 'true' })).toBe('function');
  });
});

describe('shadow-arm-logger — readShadowConfigFromEnv', () => {
  it('default = absent sector + absent regime + K 0', () => {
    const c = readShadowConfigFromEnv({});
    expect(c.sectorView.source).toBe('absent');
    expect(c.regime).toEqual({ source: 'absent' });
    expect(c.shadowEvalK).toBe(0);
  });
  it('manual sector parses comma-sep leadingSectors + asOf', () => {
    const c = readShadowConfigFromEnv({
      SHADOW_SECTOR_SOURCE: 'manual_pre_registered',
      SHADOW_LEADING_SECTORS: '바이오, 반도체 ,자동차',
      SHADOW_SECTOR_ASOF: '2026-06-01',
      SHADOW_EVAL_K: '2',
    });
    expect(c.sectorView).toEqual({ source: 'manual_pre_registered', leadingSectors: ['바이오', '반도체', '자동차'], asOf: '2026-06-01' });
    expect(c.shadowEvalK).toBe(2);
  });
  it('manual regime parses stage + asOf', () => {
    const c = readShadowConfigFromEnv({
      SHADOW_REGIME_SOURCE: 'manual_pre_registered', SHADOW_REGIME_STAGE: 'bull', SHADOW_REGIME_ASOF: '2026-06-01',
    });
    expect(c.regime).toEqual({ source: 'manual_pre_registered', stage: 'bull', asOf: '2026-06-01' });
  });
  it('unknown sector/regime source and partial numeric K fail closed at logger runtime', async () => {
    const { client } = makeRpcClient();
    const cfg = readShadowConfigFromEnv({
      SHADOW_SECTOR_SOURCE: 'llm_future',
      SHADOW_REGIME_SOURCE: 'llm_future',
      SHADOW_EVAL_K: '2abc',
    });
    await expect(logShadowArmsWithConfig(shortInput({ client }), cfg)).rejects.toThrow(
      /bad SHADOW_SECTOR_SOURCE: llm_future; bad SHADOW_REGIME_SOURCE: llm_future; bad SHADOW_EVAL_K: 2abc/,
    );
  });
});

describe('shadow-arm-logger — logShadowArmsWithConfig RPC mapping', () => {
  it('absent config → 4 arms each upserted, all logged, production_k=0, K=0', async () => {
    const { client, calls } = makeRpcClient();
    await logShadowArmsWithConfig(shortInput({ client }), readShadowConfigFromEnv({}));
    expect(calls).toHaveLength(4);
    expect(calls.map((c) => c.payload.arm)).toEqual([
      'production-snapshot', 'sector-soft-reserve', 'regime-sector-soft-reserve', 'candidate-pool-hard-gate',
    ]);
    for (const c of calls) {
      expect(c.name).toBe('upsert_shadow_arm_log');
      expect(c.payload.production_k).toBe(0);
      expect(c.payload.shadow_eval_k).toBe(0); // K=0
      expect(c.payload.status).toBe('logged'); // absent → all mirror, hard-gate==production
      expect(c.payload.month).toBe('2026-06');
      expect(c.payload.period_key).toBe('s:2026-06-15');
      expect(Array.isArray(c.payload.selected)).toBe(true);
      expect((c.payload.selected as unknown[]).length).toBe(10);
    }
  });

  it('manual sector + K>0 → soft-reserve shadow_eval_k=K, regime=0(absent), hard-gate counterfactual_cut', async () => {
    const { client, calls } = makeRpcClient();
    const cfg = readShadowConfigFromEnv({
      SHADOW_SECTOR_SOURCE: 'manual_pre_registered', SHADOW_LEADING_SECTORS: '바이오', SHADOW_SECTOR_ASOF: '2026-06-01', SHADOW_EVAL_K: '2',
    });
    await logShadowArmsWithConfig(shortInput({ client }), cfg);
    const byArm = Object.fromEntries(calls.map((c) => [c.payload.arm, c.payload]));
    expect(byArm['sector-soft-reserve'].shadow_eval_k).toBe(2);
    expect(byArm['regime-sector-soft-reserve'].shadow_eval_k).toBe(0); // regime absent → 0
    expect(byArm['production-snapshot'].shadow_eval_k).toBe(0);
    // hard-gate: 바이오 gate cut = non-바이오 tickers (the 10 selected 자동차/반도체 are cut).
    expect(Array.isArray(byArm['candidate-pool-hard-gate'].counterfactual_cut)).toBe(true);
    expect((byArm['candidate-pool-hard-gate'].counterfactual_cut as string[]).length).toBeGreaterThan(0);
  });

  it('RPC error → throws (seam이 흡수)', async () => {
    const { client } = makeRpcClient({ code: 'XX000' });
    await expect(
      logShadowArmsWithConfig(shortInput({ client }), readShadowConfigFromEnv({})),
    ).rejects.toThrow(/shadow_arm_log_upsert_failed/);
  });

  it('bad config (non-canonical sector) → computeArmSelections throws (seam 흡수)', async () => {
    const { client } = makeRpcClient();
    const cfg = readShadowConfigFromEnv({
      SHADOW_SECTOR_SOURCE: 'manual_pre_registered', SHADOW_LEADING_SECTORS: 'NotASector', SHADOW_SECTOR_ASOF: '2026-06-01',
    });
    await expect(logShadowArmsWithConfig(shortInput({ client }), cfg)).rejects.toThrow(/non-canonical/);
  });
});
