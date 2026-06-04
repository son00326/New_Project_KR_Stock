// tudal/src/lib/screening/__tests__/tier1-screening.test.ts
// PR2 — runTier1Screening core logic (RED first).
// W2a Task 3 — track 파라미터화: short(50 후보 → 10 selected) / midlong(100 후보 → 20 selected).
// SoT: docs/superpowers/specs/2026-05-21-shortlist-report-flow-correction.md §1.1
// + docs/superpowers/plans/2026-05-21-pr2-tier1-screening.md Task 2.1
// + docs/superpowers/plans/2026-06-04-w2a-weekly-monthly-split.md Task 3
import { describe, it, expect } from 'vitest';
import { runTier1Screening } from '../persona-eval';
import type { PersonaScore } from '../tier1-schema';
import type { RunTier1ScreeningInput, Tier1Candidate } from '../persona-eval';

// 53차 §5 reviewer WR-04 정정 박제 — production persona ID (kebab-case) 동기.
// Source: tudal/src/lib/ai/prompts/personas/*.ts id 필드.
const CORE_11_IDS = [
  'warren-buffett',
  'stanley-druckenmiller',
  'cathie-wood',
  'peter-lynch',
  'charlie-munger',
  'phil-fisher',
  'rakesh-jhunjhunwala',
  'mohnish-pabrai',
  'michael-burry',
  'nassim-taleb',
  'chair',
] as const;

const TIMEFRAME_HEAVY_PERSONAS = {
  short: ['stanley-druckenmiller', 'michael-burry'],
  mid: ['peter-lynch'],
  long: ['warren-buffett', 'charlie-munger', 'phil-fisher', 'mohnish-pabrai'],
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

/**
 * W2a — short 트랙 후보 50개. 전부 bucket='short' (tier0_scores.short만 non-null).
 */
function makeShortCandidates(count = 50): Tier1Candidate[] {
  return Array.from({ length: count }, (_, i) => ({
    ticker: `T${String(i).padStart(3, '0')}`,
    sector: '바이오' as const,
    tier0_buckets: { short: true, mid: false, long: false },
    tier0_scores: {
      short: 100 - i, // 100~51 for short candidates
      mid: null,
      long: null,
    },
  }));
}

/**
 * W2a — midlong 트랙 후보 100개. 앞 50 = mid bucket, 뒤 50 = long bucket.
 */
function makeMidlongCandidates(count = 100): Tier1Candidate[] {
  return Array.from({ length: count }, (_, i) => ({
    ticker: `T${String(i).padStart(3, '0')}`,
    sector: '바이오' as const,
    tier0_buckets: { short: false, mid: i < 50, long: i >= 50 },
    tier0_scores: {
      short: null,
      mid: i < 50 ? 100 - i : null, // 100~51 for mid
      long: i >= 50 ? 100 - (i - 50) : null, // 100~51 for long
    },
  }));
}

function makeShortInput(
  scoreFn: (ticker: string, personaId: string, tf: 'short' | 'mid' | 'long') => number
): RunTier1ScreeningInput {
  return {
    track: 'short',
    candidates: makeShortCandidates(),
    callPersonaPanel: makePanelCallback(scoreFn),
    fetchFinancials: async () => 'mock financials',
    promptVersionId: 'tier1-v1.0.0',
    personasVersionId: 'core11-v1.0.0',
  };
}

function makeMidlongInput(
  scoreFn: (ticker: string, personaId: string, tf: 'short' | 'mid' | 'long') => number
): RunTier1ScreeningInput {
  return {
    track: 'midlong',
    candidates: makeMidlongCandidates(),
    callPersonaPanel: makePanelCallback(scoreFn),
    fetchFinancials: async () => 'mock financials',
    promptVersionId: 'tier1-v1.0.0',
    personasVersionId: 'core11-v1.0.0',
  };
}

describe('runTier1Screening (W2a track 파라미터화)', () => {
  describe('Output contract — short track', () => {
    it('short: returns 10 selected (전부 short) + 40 notSelected = 50 total', async () => {
      const result = await runTier1Screening(
        makeShortInput((ticker, _pid, tf) => {
          const idx = parseInt(ticker.slice(1), 10);
          const norm = (idx / 49) * 100; // 0..100
          return tf === 'short' ? norm : 0;
        })
      );
      expect(result.selected).toHaveLength(10);
      expect(result.notSelected).toHaveLength(40);
      expect(result.selectionMeta.shortCount).toBe(10);
      expect(result.selectionMeta.midCount).toBe(0);
      expect(result.selectionMeta.longCount).toBe(0);
      // 트랙 purity: selected는 전부 assigned_timeframe='short'.
      expect(result.selected.every((a) => a.assigned_timeframe === 'short')).toBe(true);
    });
  });

  describe('Output contract — midlong track', () => {
    it('midlong: returns 20 selected (mid10+long10) + 80 notSelected = 100 total', async () => {
      const result = await runTier1Screening(
        makeMidlongInput((ticker, _pid, tf) => {
          const idx = parseInt(ticker.slice(1), 10);
          const norm = (idx / 99) * 100; // 0..100
          if (tf === 'mid') return norm * 0.8;
          if (tf === 'long') return norm;
          return 0; // short ignored
        })
      );
      expect(result.selected).toHaveLength(20);
      expect(result.notSelected).toHaveLength(80);
      expect(result.selectionMeta.midCount).toBe(10);
      expect(result.selectionMeta.longCount).toBe(10);
      expect(result.selectionMeta.shortCount).toBe(0);
      // 트랙 purity: selected에 short bucket 없음.
      expect(result.selected.some((a) => a.assigned_timeframe === 'short')).toBe(false);
    });
  });

  // W1b (D4) — judge 최종 점수 seam
  describe('W1b judgeScoresByTicker seam', () => {
    it('judge 점수 주입 ticker는 weighted_scores=judge (랭킹/selected 반영), 미주입은 consensus 유지', async () => {
      // panel 점수는 전부 낮게(10), judge가 T049(최하위 consensus)에 최고점 부여 → selected 진입
      const input: RunTier1ScreeningInput = {
        track: 'short',
        candidates: makeShortCandidates(50),
        callPersonaPanel: makePanelCallback(() => 10),
        fetchFinancials: async () => 'mock',
        promptVersionId: 'tier1-v1.0.0',
        personasVersionId: 'core11-v1.0.0',
        judgeScoresByTicker: { T049: { short: 99, mid: 0, long: 0 } },
      };
      const result = await runTier1Screening(input);
      const t49 = result.selected.find((a) => a.ticker === 'T049');
      expect(t49).toBeDefined();
      expect(t49!.weighted_scores.short).toBe(99); // judge SoT
      const other = [...result.selected, ...result.notSelected].find((a) => a.ticker === 'T000')!;
      expect(other.weighted_scores.short).toBe(10); // consensus fallback
    });

    it('degraded(panel null) ticker는 judge 점수 있어도 ⚪/0 유지 (available=false 우선)', async () => {
      const input: RunTier1ScreeningInput = {
        track: 'short',
        candidates: makeShortCandidates(50),
        callPersonaPanel: async ({ ticker }) => {
          if (ticker === 'T010') throw new Error('panel_missing');
          return makePanelCallback(() => 50)({ ticker, financials: '' });
        },
        fetchFinancials: async () => 'mock',
        promptVersionId: 'tier1-v1.0.0',
        personasVersionId: 'core11-v1.0.0',
        judgeScoresByTicker: { T010: { short: 99, mid: 99, long: 99 } },
      };
      const result = await runTier1Screening(input);
      const t10 = [...result.selected, ...result.notSelected].find((a) => a.ticker === 'T010')!;
      expect(t10.weighted_scores.short).toBe(0); // degraded 우선 — judge 무시
      expect(t10.consensus_badges_by_timeframe.short).toBe('⚪');
    });
  });

  describe('Input validation', () => {
    // W2b (D27 Q5) — incumbent 합성 후보 (tier0_scores 전부 null, 직전 bucket만 true).
    function makeIncumbentSynths(
      count: number,
      bucket: 'short' | 'mid' | 'long',
    ): Tier1Candidate[] {
      return Array.from({ length: count }, (_, i) => ({
        ticker: `I${String(i).padStart(3, '0')}`,
        sector: '바이오' as const,
        tier0_buckets: { short: bucket === 'short', mid: bucket === 'mid', long: bucket === 'long' },
        tier0_scores: { short: null, mid: null, long: null },
      }));
    }

    it('short: pool < fresh(50) → throw tier1_candidates_pool_out_of_range', async () => {
      const badInput: RunTier1ScreeningInput = {
        track: 'short',
        candidates: makeShortCandidates(49),
        callPersonaPanel: makePanelCallback(() => 50),
        fetchFinancials: async () => 'mock',
        promptVersionId: 'tier1-v1.0.0',
        personasVersionId: 'core11-v1.0.0',
      };
      await expect(runTier1Screening(badInput)).rejects.toThrow(
        'tier1_candidates_pool_out_of_range:short:49',
      );
    });

    it('midlong: pool < fresh(100) → throw', async () => {
      const badInput: RunTier1ScreeningInput = {
        track: 'midlong',
        candidates: makeMidlongCandidates(99),
        callPersonaPanel: makePanelCallback(() => 50),
        fetchFinancials: async () => 'mock',
        promptVersionId: 'tier1-v1.0.0',
        personasVersionId: 'core11-v1.0.0',
      };
      await expect(runTier1Screening(badInput)).rejects.toThrow(
        'tier1_candidates_pool_out_of_range:midlong:99',
      );
    });

    it('W2b — short: fresh 50 + incumbent 7 = 57 pool 허용 → selected 10 + notSelected 47', async () => {
      const input: RunTier1ScreeningInput = {
        track: 'short',
        candidates: [...makeShortCandidates(50), ...makeIncumbentSynths(7, 'short')],
        callPersonaPanel: makePanelCallback(() => 50),
        fetchFinancials: async () => 'mock',
        promptVersionId: 'tier1-v1.0.0',
        personasVersionId: 'core11-v1.0.0',
      };
      const result = await runTier1Screening(input);
      expect(result.selected).toHaveLength(10);
      expect(result.notSelected).toHaveLength(47);
    });

    it('W2b — short: pool > fresh+selectCount(60) → throw', async () => {
      const input: RunTier1ScreeningInput = {
        track: 'short',
        candidates: [...makeShortCandidates(50), ...makeIncumbentSynths(11, 'short')],
        callPersonaPanel: makePanelCallback(() => 50),
        fetchFinancials: async () => 'mock',
        promptVersionId: 'tier1-v1.0.0',
        personasVersionId: 'core11-v1.0.0',
      };
      await expect(runTier1Screening(input)).rejects.toThrow(
        'tier1_candidates_pool_out_of_range:short:61',
      );
    });

    it('W2b — midlong: 100+20=120 허용 / 121 throw', async () => {
      const ok: RunTier1ScreeningInput = {
        track: 'midlong',
        candidates: [...makeMidlongCandidates(100), ...makeIncumbentSynths(20, 'mid')],
        callPersonaPanel: makePanelCallback(() => 50),
        fetchFinancials: async () => 'mock',
        promptVersionId: 'tier1-v1.0.0',
        personasVersionId: 'core11-v1.0.0',
      };
      const result = await runTier1Screening(ok);
      expect(result.selected).toHaveLength(20);
      expect(result.notSelected).toHaveLength(100);

      const tooMany: RunTier1ScreeningInput = {
        ...ok,
        candidates: [...makeMidlongCandidates(100), ...makeIncumbentSynths(21, 'mid')],
      };
      await expect(runTier1Screening(tooMany)).rejects.toThrow(
        'tier1_candidates_pool_out_of_range:midlong:121',
      );
    });

    it('CR-02 reviewer fix — throws on duplicate ticker', async () => {
      const dups = makeShortCandidates(50);
      dups[1] = { ...dups[0] }; // T000 repeated
      const dupInput: RunTier1ScreeningInput = {
        track: 'short',
        candidates: dups,
        callPersonaPanel: makePanelCallback(() => 50),
        fetchFinancials: async () => 'mock',
        promptVersionId: 'tier1-v1.0.0',
        personasVersionId: 'core11-v1.0.0',
      };
      await expect(runTier1Screening(dupInput)).rejects.toThrow(
        /tier1_candidates_have_duplicate_tickers/
      );
    });

    it('short: rejects cross-track candidate bucket before selection', async () => {
      const mixed = makeShortCandidates(50);
      mixed[0] = {
        ...mixed[0],
        tier0_buckets: { short: false, mid: true, long: false },
        tier0_scores: { short: null, mid: 99, long: null },
      };
      await expect(
        runTier1Screening({
          track: 'short',
          candidates: mixed,
          callPersonaPanel: makePanelCallback(() => 50),
          fetchFinancials: async () => 'mock',
          promptVersionId: 'tier1-v1.0.0',
          personasVersionId: 'core11-v1.0.0',
        })
      ).rejects.toThrow(/tier1_candidates_track_bucket_impurity:short/);
    });

    it('midlong: rejects short bucket candidate before selection', async () => {
      const mixed = makeMidlongCandidates(100);
      mixed[0] = {
        ...mixed[0],
        tier0_buckets: { short: true, mid: false, long: false },
        tier0_scores: { short: 99, mid: null, long: null },
      };
      await expect(
        runTier1Screening({
          track: 'midlong',
          candidates: mixed,
          callPersonaPanel: makePanelCallback(() => 50),
          fetchFinancials: async () => 'mock',
          promptVersionId: 'tier1-v1.0.0',
          personasVersionId: 'core11-v1.0.0',
        })
      ).rejects.toThrow(/tier1_candidates_track_bucket_impurity:midlong/);
    });
  });

  describe('Primary assignment (argmax) — midlong track', () => {
    it('Test 7 — ticker scores favoring "mid" → primary_timeframe = "mid"', async () => {
      const result = await runTier1Screening(
        makeMidlongInput((ticker, _pid, tf) => {
          if (ticker === 'T000') {
            return tf === 'mid' ? 95 : 30;
          }
          return 40;
        })
      );
      const t000 = [...result.selected, ...result.notSelected].find((a) => a.ticker === 'T000');
      expect(t000?.primary_timeframe).toBe('mid');
    });

    it('Test 9 — every ticker primary "mid" → 10 mid primary + long backfill from unselected pool', async () => {
      const result = await runTier1Screening(
        makeMidlongInput((_ticker, _pid, tf) => {
          if (tf === 'mid') return 90;
          return 10;
        })
      );
      const primaries = result.selected.filter((a) => a.assigned_by === 'primary');
      const backfills = result.selected.filter((a) => a.assigned_by === 'backfill');
      // Primaries all mid (since every ticker's primary is mid among active timeframes)
      expect(primaries.every((a) => a.assigned_timeframe === 'mid')).toBe(true);
      expect(primaries).toHaveLength(10);
      // Backfills fill long = 10
      expect(backfills).toHaveLength(10);
      expect(result.selectionMeta.backfillCounts.mid).toBe(0);
      expect(result.selectionMeta.backfillCounts.long).toBe(10);
      expect(result.selectionMeta.backfillCounts.short).toBe(0);
    });
  });

  describe('Backfill — midlong track', () => {
    it('Test 10 — primary distribution unbalanced → long gets backfilled from unselected', async () => {
      // every ticker's argmax (among active mid/long) is mid → 10 mid primary, 0 long primary.
      // backfill long 10 from unselected pool.
      const result = await runTier1Screening(
        makeMidlongInput((_ticker, _pid, tf) => (tf === 'mid' ? 90 : 30))
      );
      expect(result.selectionMeta.backfillCounts.mid).toBe(0);
      expect(result.selectionMeta.backfillCounts.long).toBe(10);
      expect(result.selectionMeta.backfillCounts.short).toBe(0);
      expect(result.selected).toHaveLength(20);
    });

    it('Test 11 — backfill ticker has assigned_by="backfill" + non-null assigned_timeframe', async () => {
      const result = await runTier1Screening(
        makeMidlongInput((_ticker, _pid, tf) => (tf === 'mid' ? 90 : 30))
      );
      const backfillTickers = result.selected.filter((a) => a.assigned_by === 'backfill');
      expect(backfillTickers.length).toBeGreaterThan(0);
      backfillTickers.forEach((a) => {
        expect(a.assigned_by).toBe('backfill');
        expect(a.assigned_timeframe).not.toBeNull();
      });
    });

    it('omxy R5 BLOCKER 1 fix — backfill ticker assigned_timeframe = filled bucket (not primary_timeframe)', async () => {
      // Every ticker primary=mid → long needs backfill.
      const result = await runTier1Screening(
        makeMidlongInput((_ticker, _pid, tf) => (tf === 'mid' ? 90 : 30))
      );
      const longBackfill = result.selected.filter(
        (a) => a.assigned_by === 'backfill' && a.assigned_timeframe === 'long'
      );
      expect(longBackfill).toHaveLength(10);
      // Backfill tickers' primary_timeframe is 'mid' (their argmax) but assigned_timeframe = long.
      longBackfill.forEach((a) => expect(a.primary_timeframe).toBe('mid'));
    });

    it('omxy R5 BLOCKER 1 fix — primary selected has assigned_timeframe == primary_timeframe', async () => {
      const result = await runTier1Screening(
        makeMidlongInput((ticker, _pid, tf) => {
          const idx = parseInt(ticker.slice(1), 10);
          const norm = (idx / 99) * 100;
          if (tf === 'mid') return norm * 0.8;
          if (tf === 'long') return norm;
          return 0;
        })
      );
      const primarySelected = result.selected.filter((a) => a.assigned_by === 'primary');
      primarySelected.forEach((a) => {
        expect(a.assigned_timeframe).toBe(a.primary_timeframe);
      });
    });

    it('omxy R5 BLOCKER 1 fix — notSelected items have null assigned metadata', async () => {
      const result = await runTier1Screening(makeMidlongInput(() => 50));
      result.notSelected.forEach((a) => {
        expect(a.assigned_by).toBeNull();
        expect(a.assigned_timeframe).toBeNull();
      });
    });

    it('Test 12 — global unselected pool excludes tickers already primary-selected in any active timeframe', async () => {
      // T000~T049 primary=mid (mid bucket), T050~T099 primary=long (long bucket).
      const result = await runTier1Screening(
        makeMidlongInput((ticker, _pid, tf) => {
          const idx = parseInt(ticker.slice(1), 10);
          if (idx < 50) {
            return tf === 'mid' ? 90 - idx * 0.1 : 30;
          }
          return tf === 'long' ? 90 - (idx - 50) * 0.1 : 30;
        })
      );
      // No ticker can appear twice
      const allTickers = result.selected.map((a) => a.ticker);
      expect(new Set(allTickers).size).toBe(allTickers.length);
    });
  });

  describe('Backfill — short track (단일 timeframe)', () => {
    it('short: primary < 10 not possible (단일 tf 50 후보) → 전부 primary, backfill 0', async () => {
      // 50 short candidates, all primary=short (only short non-zero) → top 10 primary, backfill 0.
      const result = await runTier1Screening(
        makeShortInput((ticker, _pid, tf) => {
          const idx = parseInt(ticker.slice(1), 10);
          return tf === 'short' ? 100 - idx : 0;
        })
      );
      const primaries = result.selected.filter((a) => a.assigned_by === 'primary');
      expect(primaries).toHaveLength(10);
      expect(result.selectionMeta.backfillCounts.short).toBe(0);
      expect(result.selected.every((a) => a.assigned_timeframe === 'short')).toBe(true);
    });
  });

  describe('Consensus badge tie-break — midlong track', () => {
    it('Test 13 — no ⚪ in selected when tier1 is available throughout', async () => {
      const result = await runTier1Screening(
        makeMidlongInput(() => 50) // identical scores everywhere → all tied
      );
      const badges = result.selected.map((a) => {
        const tf = a.assigned_timeframe!;
        return a.consensus_badges_by_timeframe[tf];
      });
      expect(badges).not.toContain('⚪');
    });

    it('Test 14 — deterministic: same input → same selected set', async () => {
      const r1 = await runTier1Screening(makeMidlongInput(() => 50));
      const r2 = await runTier1Screening(makeMidlongInput(() => 50));
      expect(r1.selected.map((a) => a.ticker).sort()).toEqual(
        r2.selected.map((a) => a.ticker).sort()
      );
    });
  });

  describe('Tier 1 availability seam (WR-02 reviewer fix)', () => {
    it('callPersonaPanel rejection → ticker tier1Available=false → ⚪ badge', async () => {
      const result = await runTier1Screening({
        track: 'short',
        candidates: makeShortCandidates(50),
        callPersonaPanel: async ({ ticker }) => {
          if (ticker === 'T000') throw new Error('ai_call_failed');
          return CORE_11_IDS.map((pid) => ({
            persona_id: pid,
            scores: { short: 50, mid: 50, long: 50 },
            winning_timeframe: 'short' as const,
            rationale_kr: 'mock',
            conviction: 50,
          }));
        },
        fetchFinancials: async () => 'mock',
        promptVersionId: 'tier1-v1.0.0',
        personasVersionId: 'core11-v1.0.0',
      });
      const t000 = [...result.selected, ...result.notSelected].find((a) => a.ticker === 'T000');
      expect(t000?.consensus_badges_by_timeframe.short).toBe('⚪');
    });

    it('tier1AvailableByTicker override forces ⚪ for caller-marked degraded tickers', async () => {
      const result = await runTier1Screening({
        ...makeShortInput(() => 50),
        tier1AvailableByTicker: { T005: false },
      });
      const t005 = [...result.selected, ...result.notSelected].find((a) => a.ticker === 'T005');
      expect(t005?.consensus_badges_by_timeframe.short).toBe('⚪');
    });
  });

  describe('Persona weighting (timeframe-specific 1.5x)', () => {
    it('weighted_scores reflect timeframe-specific persona weights (short-heavy personas amplify short)', async () => {
      const result = await runTier1Screening(
        makeShortInput((_ticker, pid, tf) => {
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
      // weighted_avg.short = 750/12 = 62.5 (2 heavy personas × 1.5 × 100 + 9 × 1 × 50).
      expect(ticker.weighted_scores.short).toBeCloseTo(62.5, 1);
    });
  });

  describe('PR-E commentsByTicker (AI 코멘트/conviction carry)', () => {
    it('comment_kr = top-conviction persona rationale + conviction = panel avg (available ticker)', async () => {
      const result = await runTier1Screening({
        track: 'short',
        candidates: makeShortCandidates(50),
        callPersonaPanel: async ({ ticker }) =>
          CORE_11_IDS.map((pid) => ({
            persona_id: pid,
            scores: { short: 50, mid: 50, long: 50 },
            winning_timeframe: 'short' as const,
            rationale_kr: pid === 'warren-buffett' ? `${ticker} 강력 매수` : '보통',
            conviction: pid === 'warren-buffett' ? 90 : 50,
          })),
        fetchFinancials: async () => 'mock',
        promptVersionId: 'tier1-v1.0.0',
        personasVersionId: 'core11-v1.0.0',
      });
      const c = result.commentsByTicker?.['T000'];
      expect(c).toBeDefined();
      expect(c?.comment_kr).toBe('T000 강력 매수');
      // avg = (90 + 50×10) / 11 = 590/11 ≈ 53.64
      expect(c?.conviction).toBeCloseTo(53.64, 1);
    });

    it('omits degraded (panel reject) tickers', async () => {
      const result = await runTier1Screening({
        track: 'short',
        candidates: makeShortCandidates(50),
        callPersonaPanel: async ({ ticker }) => {
          if (ticker === 'T000') throw new Error('ai_call_failed');
          return CORE_11_IDS.map((pid) => ({
            persona_id: pid,
            scores: { short: 50, mid: 50, long: 50 },
            winning_timeframe: 'short' as const,
            rationale_kr: 'ok',
            conviction: 50,
          }));
        },
        fetchFinancials: async () => 'mock',
        promptVersionId: 'tier1-v1.0.0',
        personasVersionId: 'core11-v1.0.0',
      });
      expect(result.commentsByTicker?.['T000']).toBeUndefined();
      expect(result.commentsByTicker?.['T001']).toBeDefined();
    });

    it('omits tier1AvailableByTicker override-false tickers', async () => {
      const result = await runTier1Screening({
        ...makeShortInput(() => 50),
        tier1AvailableByTicker: { T005: false },
      });
      expect(result.commentsByTicker?.['T005']).toBeUndefined();
      expect(result.commentsByTicker?.['T000']).toBeDefined();
    });
  });
});
