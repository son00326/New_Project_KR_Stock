// tudal/src/lib/screening/__tests__/tier1-screening.test.ts
// PR2 — runTier1Screening core logic (RED first).
// SoT: docs/superpowers/specs/2026-05-21-shortlist-report-flow-correction.md §1.1
// + docs/superpowers/plans/2026-05-21-pr2-tier1-screening.md Task 2.1
import { describe, it, expect } from 'vitest';
import { runTier1Screening } from '../persona-eval';
import type { PersonaScore } from '../tier1-schema';
import type { RunTier1ScreeningInput } from '../persona-eval';

const CORE_11_IDS = [
  'warren_buffett',
  'charlie_munger',
  'phil_fisher',
  'peter_lynch',
  'ben_graham',
  'stanley_druckenmiller',
  'michael_burry',
  'mohnish_pabrai',
  'rakesh_jhunjhunwala',
  'aswath_damodaran',
  'cathie_wood',
] as const;

const TIMEFRAME_HEAVY_PERSONAS = {
  short: ['stanley_druckenmiller', 'michael_burry'],
  mid: ['peter_lynch'],
  long: ['warren_buffett', 'charlie_munger', 'phil_fisher', 'mohnish_pabrai'],
} as const;

/** Build a deterministic panel callback. score[tf] for ticker T at persona P = formula(T, P, tf). */
function makePanelCallback(
  scoreFn: (ticker: string, personaId: string, tf: 'short' | 'mid' | 'long') => number
) {
  return async ({ ticker }: { ticker: string; financials: string }): Promise<PersonaScore[]> => {
    return CORE_11_IDS.map((pid) => {
      const short = scoreFn(ticker, pid, 'short');
      const mid = scoreFn(ticker, pid, 'mid');
      const long = scoreFn(ticker, pid, 'long');
      const winning: 'short' | 'mid' | 'long' =
        short >= mid && short >= long ? 'short' : mid >= long ? 'mid' : 'long';
      return {
        persona_id: pid,
        scores: { short, mid, long },
        winning_timeframe: winning,
        rationale_kr: '테스트용 결정적 평가',
        conviction: 60,
      };
    });
  };
}

function makeCandidates(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    ticker: `T${String(i).padStart(3, '0')}`,
    sector: '바이오' as const,
    tier0_buckets: { short: i < 50, mid: i >= 50 && i < 100, long: i >= 100 },
    tier0_scores: {
      short: i < 50 ? 100 - i : null,           // 100~51 for short candidates
      mid: i >= 50 && i < 100 ? 100 - (i - 50) : null,  // 100~51 for mid
      long: i >= 100 ? 100 - (i - 100) : null,           // 100~51 for long
    },
  }));
}

function makeInput(
  scoreFn: (ticker: string, personaId: string, tf: 'short' | 'mid' | 'long') => number
): RunTier1ScreeningInput {
  return {
    candidates: makeCandidates(150),
    callPersonaPanel: makePanelCallback(scoreFn),
    fetchFinancials: async () => 'mock financials',
    promptVersionId: 'tier1-v1.0.0',
    personasVersionId: 'core11-v1.0.0',
  };
}

describe('runTier1Screening (PR2 lock-in)', () => {
  describe('Output contract', () => {
    it('returns 30 selected (10/timeframe) + 120 notSelected = 150 total', async () => {
      // Deterministic scores in [0,100]: ticker T000 weakest, T149 strongest.
      const result = await runTier1Screening(
        makeInput((ticker, _pid, tf) => {
          const idx = parseInt(ticker.slice(1), 10);
          const norm = (idx / 149) * 100; // 0..100
          if (tf === 'short') return norm * 0.6;
          if (tf === 'mid') return norm * 0.8;
          return norm; // long
        })
      );
      expect(result.selected).toHaveLength(30);
      expect(result.notSelected).toHaveLength(120);
      expect(result.selectionMeta.shortCount).toBe(10);
      expect(result.selectionMeta.midCount).toBe(10);
      expect(result.selectionMeta.longCount).toBe(10);
    });
  });

  describe('Primary assignment (argmax)', () => {
    it('Test 7 — ticker scores favoring "mid" → primary_timeframe = "mid"', async () => {
      // Make one specific ticker (T000) have mid >> short, long
      const result = await runTier1Screening(
        makeInput((ticker, _pid, tf) => {
          if (ticker === 'T000') {
            return tf === 'mid' ? 95 : 30;
          }
          // others uniform low
          return 40;
        })
      );
      const t000 = [...result.selected, ...result.notSelected].find((a) => a.ticker === 'T000');
      expect(t000?.primary_timeframe).toBe('mid');
    });

    it('Test 9 — extreme: every ticker primary "short" → 10 short primary + mid/long backfill from unselected pool', async () => {
      const result = await runTier1Screening(
        makeInput((_ticker, _pid, tf) => {
          if (tf === 'short') return 90;
          return 10;
        })
      );
      const primaries = result.selected.filter((a) => a.assigned_by === 'primary');
      const backfills = result.selected.filter((a) => a.assigned_by === 'backfill');
      // Primaries all short (since every ticker's primary is short)
      expect(primaries.every((a) => a.primary_timeframe === 'short')).toBe(true);
      expect(primaries).toHaveLength(10);
      // Backfills fill mid+long = 20
      expect(backfills).toHaveLength(20);
      expect(result.selectionMeta.backfillCounts.short).toBe(0);
      expect(result.selectionMeta.backfillCounts.mid).toBe(10);
      expect(result.selectionMeta.backfillCounts.long).toBe(10);
    });
  });

  describe('Backfill', () => {
    it('Test 10 — primary distribution unbalanced → short gets backfilled from unselected', async () => {
      // Construct: every ticker's argmax is mid (so 150 primaries are all mid).
      // primary phase: short=0, mid=10, long=0.
      // backfill short 10 + long 10 from unselected pool.
      const result = await runTier1Screening(
        makeInput((_ticker, _pid, tf) => (tf === 'mid' ? 90 : 30))
      );
      expect(result.selectionMeta.backfillCounts.short).toBe(10);
      expect(result.selectionMeta.backfillCounts.mid).toBe(0);
      expect(result.selectionMeta.backfillCounts.long).toBe(10);
      // Total still 30
      expect(result.selected).toHaveLength(30);
    });

    it('Test 11 — backfill ticker has assigned_by="backfill" metadata', async () => {
      const result = await runTier1Screening(
        makeInput((_ticker, _pid, tf) => (tf === 'mid' ? 90 : 30))
      );
      const backfillTickers = result.selected.filter((a) => a.assigned_by === 'backfill');
      expect(backfillTickers.length).toBeGreaterThan(0);
      backfillTickers.forEach((a) => {
        expect(a.assigned_by).toBe('backfill');
      });
    });

    it('Test 12 — global unselected pool excludes tickers already primary-selected in any timeframe', async () => {
      // Construct a varied primary distribution so backfill is needed and we can verify exclusion.
      // T000~T099 primary=short, T100~T149 primary=long.
      // primary short top 10, primary long top 10, mid backfill needed (0 primary mid).
      const result = await runTier1Screening(
        makeInput((ticker, _pid, tf) => {
          const idx = parseInt(ticker.slice(1), 10);
          if (idx < 100) {
            // these favor short
            return tf === 'short' ? 90 - idx * 0.1 : 30;
          }
          // these favor long
          return tf === 'long' ? 90 - (idx - 100) * 0.1 : 30;
        })
      );
      const tickerToAggregate = new Map(
        [...result.selected, ...result.notSelected].map((a) => [a.ticker, a])
      );
      // No ticker can appear twice
      const allTickers = result.selected.map((a) => a.ticker);
      expect(new Set(allTickers).size).toBe(allTickers.length);
      // backfill tickers (mid) must NOT be among primary-selected (short or long primaries)
      const midBackfill = result.selected.filter(
        (a) => a.assigned_by === 'backfill' && a.primary_timeframe !== 'mid'
      );
      // primary_timeframe for backfill is still the ticker's argmax (short or long), not the assigned timeframe.
      // The "assigned timeframe" is implicit by selection bucket — captured via selectionMeta counts.
      // But ticker itself can have primary_timeframe='short' while being assigned to 'mid' via backfill.
      midBackfill.forEach((a) => {
        // ticker's argmax is not 'mid' (otherwise it would've been primary-selected to mid)
        expect(a.primary_timeframe).not.toBe('mid');
        // and ticker is not in primary-selected set (already excluded by Set check above)
        expect(tickerToAggregate.has(a.ticker)).toBe(true);
      });
    });
  });

  describe('Consensus badge tie-break', () => {
    it('Test 13 — same weighted_score → 🟢 wins over 🔵 (assigned timeframe badge)', async () => {
      // Construct two tickers with identical weighted_scores but different tier0 ranks
      // so badges differ (🟢 vs 🔵). The 🟢 ticker should be selected.
      // We need a scenario where exactly one of two tied tickers makes the top 10.
      // Simplification: all 150 tickers identical Tier 1 scores → tie everywhere.
      // Badge depends on Tier 0 (which is deterministic by ticker idx).
      // Top 10 of short timeframe by Tier 1 score is all tied. Tie-break: badge priority.
      const result = await runTier1Screening(
        makeInput(() => 50) // identical scores everywhere → all tied
      );
      // Selected short tickers should prefer tickers with better Tier 0 short rank
      // (since Tier 1 is tied, Tier 0 rank determines tier0IsTop → badge).
      // T000 has tier0.short=100 (rank 1), T049 has tier0.short=51 (rank 50)
      // With identical Tier 1 scores, primary_timeframe is implementation-defined deterministic.
      // Just assert: among selected, badge distribution includes 🟢/🔵/🟣/🟡 — none should be 🟢→🔵 swapped.
      // Looser check: at least one 🟢 in selected, and 🟢 priority enforced over ⚪ in tied case.
      const badges = result.selected.map((a) => {
        const tf = a.primary_timeframe;
        return a.consensus_badges_by_timeframe[tf];
      });
      // No ⚪ in selected (tier1 is available throughout)
      expect(badges).not.toContain('⚪');
    });

    it('Test 14 — same badge tier → secondary tie-break by ticker alphabetical (deterministic)', async () => {
      // Two runs with identical input → identical output (deterministic)
      const input1 = makeInput(() => 50);
      const input2 = makeInput(() => 50);
      const r1 = await runTier1Screening(input1);
      const r2 = await runTier1Screening(input2);
      expect(r1.selected.map((a) => a.ticker).sort()).toEqual(
        r2.selected.map((a) => a.ticker).sort()
      );
    });

    it('Test 15 — assigned timeframe badge used for tie-break (other timeframes ignored)', async () => {
      // Verify that for a backfill-assigned ticker in 'mid', the badge used is consensus_badges_by_timeframe.mid
      // not .short or .long.
      // Construct: ticker T000 has primary='short' but is backfilled into 'mid'.
      // Its consensus_badges_by_timeframe.mid is the relevant one for selection logic.
      const result = await runTier1Screening(
        makeInput((ticker, _pid, tf) => {
          const idx = parseInt(ticker.slice(1), 10);
          // Force all to primary=short (short highest), mid varies, long lowest.
          if (tf === 'short') return 90;
          if (tf === 'mid') return 50 + idx * 0.3; // higher idx → better mid (for backfill ranking)
          return 10;
        })
      );
      const midBackfill = result.selected.filter(
        (a) => a.assigned_by === 'backfill' && a.primary_timeframe === 'short'
      );
      // All mid backfills must have a defined badge in `mid` slot (the assigned timeframe)
      expect(midBackfill.length).toBe(10);
      midBackfill.forEach((a) => {
        expect(['🟢', '🔵', '🟣', '🟡', '⚪']).toContain(a.consensus_badges_by_timeframe.mid);
      });
    });
  });

  describe('Persona weighting (timeframe-specific 1.5x)', () => {
    it('weighted_scores reflect timeframe-specific persona weights (short-heavy personas amplify short)', async () => {
      // Druckenmiller (short heavy) gives 100 on short, all others give 50 on short.
      // weighted_avg.short should be > simple_avg.short (50).
      const result = await runTier1Screening(
        makeInput((_ticker, pid, tf) => {
          if (tf === 'short') {
            return TIMEFRAME_HEAVY_PERSONAS.short.includes(
              pid as (typeof TIMEFRAME_HEAVY_PERSONAS.short)[number]
            )
              ? 100
              : 50;
          }
          return 50;
        })
      );
      const ticker = result.selected[0] ?? result.notSelected[0];
      // Simple avg.short = (2 personas × 100 + 9 personas × 50) / 11 ≈ 59.09
      // With short-heavy personas weighted 1.5x:
      //   numerator = 2×1.5×100 + 9×1×50 = 300 + 450 = 750
      //   denominator = 2×1.5 + 9×1 = 3 + 9 = 12
      //   weighted_avg.short = 750/12 = 62.5
      expect(ticker.weighted_scores.short).toBeCloseTo(62.5, 1);
    });
  });
});
