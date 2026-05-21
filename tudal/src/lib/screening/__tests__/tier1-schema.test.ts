// tudal/src/lib/screening/__tests__/tier1-schema.test.ts
// PR2 — Tier 1 AI 30 선정 screening schema validation (RED first).
// SoT: docs/superpowers/specs/2026-05-21-shortlist-report-flow-correction.md §1.1
// + docs/superpowers/plans/2026-05-21-pr2-tier1-screening.md Task 1.1
import { describe, it, expect } from 'vitest';
import {
  PersonaScoreSchema,
  TickerAggregateSchema,
  Tier1ScreeningResultSchema,
  TIMEFRAMES,
  TIMEFRAME_HEAVY_PERSONAS,
} from '../tier1-schema';
import type { TickerAggregate } from '../tier1-schema';
import { CORE_11_PERSONAS } from '@/lib/ai/prompts/personas';

function makePersonaScore(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    persona_id: 'warren_buffett',
    scores: { short: 50, mid: 75, long: 90 },
    winning_timeframe: 'long' as const,
    rationale_kr: '장기 복리 사업 모델, 경영 양호.',
    conviction: 80,
    ...overrides,
  };
}

function makeTickerAggregate(
  ticker = 'A001',
  overrides: Partial<TickerAggregate> = {}
): TickerAggregate {
  return {
    ticker,
    sector: '바이오',
    weighted_scores: { short: 50, mid: 60, long: 80 },
    primary_timeframe: 'long',
    consensus_badges_by_timeframe: { short: '🟡', mid: '🟡', long: '🟢' },
    assigned_by: 'primary',
    assigned_timeframe: 'long',
    prompt_version_id: 'tier1-v1.0.0',
    personas_version_id: 'core11-v1.0.0',
    ...overrides,
  };
}

describe('tier1-schema (PR2 lock-in)', () => {
  describe('TIMEFRAMES constant', () => {
    it('exports readonly tuple [short, mid, long]', () => {
      expect(TIMEFRAMES).toEqual(['short', 'mid', 'long']);
    });
  });

  describe('PersonaScoreSchema', () => {
    it('Test 1 — valid persona score parses', () => {
      const result = PersonaScoreSchema.parse(makePersonaScore());
      expect(result.persona_id).toBe('warren_buffett');
      expect(result.scores.long).toBe(90);
      expect(result.winning_timeframe).toBe('long');
    });

    it('Test 2 — rationale_kr >80자 throws rationale_kr_too_long', () => {
      // 81 chars
      const tooLong = 'ㄱ'.repeat(81);
      expect(() => PersonaScoreSchema.parse(makePersonaScore({ rationale_kr: tooLong }))).toThrow(
        /rationale_kr_too_long/
      );
    });

    it('rejects scores out of range (>100)', () => {
      expect(() =>
        PersonaScoreSchema.parse(
          makePersonaScore({ scores: { short: 101, mid: 50, long: 50 } })
        )
      ).toThrow();
    });
  });

  describe('TickerAggregateSchema', () => {
    it('Test 3 — consensus_badges_by_timeframe 누락 throws', () => {
      const { consensus_badges_by_timeframe: _omit, ...partial } = makeTickerAggregate();
      void _omit;
      expect(() => TickerAggregateSchema.parse(partial)).toThrow();
    });

    it('Test 6 — assigned_by enum 외 ("manual") throws', () => {
      expect(() =>
        TickerAggregateSchema.parse(
          makeTickerAggregate('A001', { assigned_by: 'manual' as unknown as 'primary' })
        )
      ).toThrow();
    });

    it('accepts valid primary assignment', () => {
      const ok = TickerAggregateSchema.parse(makeTickerAggregate('A001'));
      expect(ok.assigned_by).toBe('primary');
      expect(ok.primary_timeframe).toBe('long');
    });
  });

  describe('Tier1ScreeningResultSchema', () => {
    function buildResult(selectedCount: number, notSelectedCount: number) {
      // 30 selected = 10 short + 10 mid + 10 long primary (R6 BLOCKER 2 refinement 만족).
      const selected = Array.from({ length: selectedCount }, (_, i) => {
        const tf: 'short' | 'mid' | 'long' =
          i < Math.floor(selectedCount / 3)
            ? 'short'
            : i < Math.floor((2 * selectedCount) / 3)
              ? 'mid'
              : 'long';
        return makeTickerAggregate(`S${String(i).padStart(3, '0')}`, {
          primary_timeframe: tf,
          assigned_by: 'primary',
          assigned_timeframe: tf,
        });
      });
      const notSelected = Array.from({ length: notSelectedCount }, (_, i) =>
        makeTickerAggregate(`N${String(i).padStart(3, '0')}`, {
          assigned_by: null,
          assigned_timeframe: null,
        })
      );
      const shortCount = selected.filter((a) => a.assigned_timeframe === 'short').length;
      const midCount = selected.filter((a) => a.assigned_timeframe === 'mid').length;
      const longCount = selected.filter((a) => a.assigned_timeframe === 'long').length;
      return {
        selected,
        notSelected,
        selectionMeta: {
          shortCount,
          midCount,
          longCount,
          backfillCounts: { short: 0, mid: 0, long: 0 },
          promptVersionId: 'tier1-v1.0.0',
          personasVersionId: 'core11-v1.0.0',
          generatedAt: '2026-05-21T15:00:00.000Z',
        },
      };
    }

    it('Test 4 — selected.length=30 + notSelected.length=120 parses', () => {
      const ok = Tier1ScreeningResultSchema.parse(buildResult(30, 120));
      expect(ok.selected).toHaveLength(30);
      expect(ok.notSelected).toHaveLength(120);
    });

    it('Test 5 — selected.length=29 throws', () => {
      expect(() => Tier1ScreeningResultSchema.parse(buildResult(29, 121))).toThrow();
    });

    it('selectionMeta.shortCount+midCount+longCount must equal selected.length=30', () => {
      const bad = buildResult(30, 120);
      bad.selectionMeta.shortCount = 9;
      expect(() => Tier1ScreeningResultSchema.parse(bad)).toThrow();
    });

    it('CR-02 reviewer fix — duplicate ticker in selected throws', () => {
      const bad = buildResult(30, 120);
      bad.selected[1] = { ...bad.selected[0] }; // first two identical ticker
      expect(() => Tier1ScreeningResultSchema.parse(bad)).toThrow(
        /selected_tickers_must_be_unique/
      );
    });

    it('CR-02 reviewer fix — duplicate ticker in notSelected throws', () => {
      const bad = buildResult(30, 120);
      bad.notSelected[1] = { ...bad.notSelected[0] };
      expect(() => Tier1ScreeningResultSchema.parse(bad)).toThrow(
        /notSelected_tickers_must_be_unique/
      );
    });

    it('omxy R5 BLOCKER 3 fix — selected ∩ notSelected ≠ ∅ throws', () => {
      const bad = buildResult(30, 120);
      // S000 appears in both selected and notSelected
      bad.notSelected[0] = { ...bad.selected[0], assigned_by: null, assigned_timeframe: null };
      expect(() => Tier1ScreeningResultSchema.parse(bad)).toThrow(
        /selected_and_notSelected_must_be_disjoint/
      );
    });

    it('omxy R5 BLOCKER 1 fix — selected without assigned_timeframe throws', () => {
      const bad = buildResult(30, 120);
      bad.selected[0] = { ...bad.selected[0], assigned_timeframe: null };
      expect(() => Tier1ScreeningResultSchema.parse(bad)).toThrow(
        /selected_must_have_assigned_metadata/
      );
    });

    it('omxy R5 BLOCKER 1 fix — notSelected with non-null assigned_timeframe throws', () => {
      const bad = buildResult(30, 120);
      bad.notSelected[0] = {
        ...bad.notSelected[0],
        assigned_by: 'primary',
        assigned_timeframe: 'short',
      };
      expect(() => Tier1ScreeningResultSchema.parse(bad)).toThrow(
        /notSelected_must_have_null_assigned_metadata/
      );
    });
  });

  describe('PersonaPanelSchema (omxy R5 BLOCKER 2 fix)', () => {
    function makeValidPanel() {
      const ids = [
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
      ];
      return ids.map((id) => ({
        persona_id: id,
        scores: { short: 50, mid: 50, long: 50 },
        winning_timeframe: 'short' as const,
        rationale_kr: 'mock',
        conviction: 50,
      }));
    }

    it('accepts exactly 11 unique personas', async () => {
      const { PersonaPanelSchema } = await import('../tier1-schema');
      expect(() => PersonaPanelSchema.parse(makeValidPanel())).not.toThrow();
    });

    it('rejects panel of length 10 (panel_must_have_11_personas)', async () => {
      const { PersonaPanelSchema } = await import('../tier1-schema');
      expect(() => PersonaPanelSchema.parse(makeValidPanel().slice(0, 10))).toThrow(
        /panel_must_have_11_personas/
      );
    });

    it('rejects panel of length 12', async () => {
      const { PersonaPanelSchema } = await import('../tier1-schema');
      const panel12 = [...makeValidPanel(), { ...makeValidPanel()[0], persona_id: 'extra' }];
      expect(() => PersonaPanelSchema.parse(panel12)).toThrow();
    });

    it('rejects duplicate persona_id (panel_persona_ids_must_be_unique)', async () => {
      const { PersonaPanelSchema } = await import('../tier1-schema');
      const dup = makeValidPanel();
      dup[1] = { ...dup[0] }; // duplicate persona_id
      expect(() => PersonaPanelSchema.parse(dup)).toThrow(
        /panel_persona_ids_must_be_unique/
      );
    });
  });

  describe('TIMEFRAME_HEAVY_PERSONAS production invariant (CR-01 reviewer fix)', () => {
    it('every heavy-list ID exists in production CORE_11_PERSONAS', () => {
      const productionIds = new Set(CORE_11_PERSONAS.map((p) => p.id));
      const allHeavy = [
        ...TIMEFRAME_HEAVY_PERSONAS.short,
        ...TIMEFRAME_HEAVY_PERSONAS.mid,
        ...TIMEFRAME_HEAVY_PERSONAS.long,
      ];
      for (const id of allHeavy) {
        expect(productionIds.has(id)).toBe(true);
      }
    });

    it('production CORE_11_PERSONAS has exactly 11 entries', () => {
      expect(CORE_11_PERSONAS).toHaveLength(11);
    });
  });

  describe('assertPanelMatchesCore11 (omxy R6 BLOCKER 1 fix)', () => {
    function makeUniqueButWrongPanel(ids: string[]) {
      return ids.map((id) => ({
        persona_id: id,
        scores: { short: 50, mid: 50, long: 50 },
        winning_timeframe: 'short' as const,
        rationale_kr: 'mock',
        conviction: 50,
      }));
    }
    const productionIds = CORE_11_PERSONAS.map((p) => p.id);

    it('accepts exact production CORE_11 set', async () => {
      const { assertPanelMatchesCore11, PersonaPanelSchema } = await import('../tier1-schema');
      const panel = PersonaPanelSchema.parse(makeUniqueButWrongPanel(productionIds));
      expect(() => assertPanelMatchesCore11(panel, productionIds)).not.toThrow();
    });

    it('rejects 11 unique but unknown persona IDs (sector persona IDs)', async () => {
      const { assertPanelMatchesCore11, PersonaPanelSchema } = await import('../tier1-schema');
      const sectorIds = Array.from({ length: 11 }, (_, i) => `sector-바이오-slot-${i + 1}`);
      const panel = PersonaPanelSchema.parse(makeUniqueButWrongPanel(sectorIds));
      expect(() => assertPanelMatchesCore11(panel, productionIds)).toThrow(
        /panel_persona_ids_must_match_core11/
      );
    });

    it('rejects 11 unique IDs with one missing core (10 production + 1 unknown)', async () => {
      const { assertPanelMatchesCore11, PersonaPanelSchema } = await import('../tier1-schema');
      const mixed = [...productionIds.slice(0, 10), 'unknown-persona'];
      const panel = PersonaPanelSchema.parse(makeUniqueButWrongPanel(mixed));
      expect(() => assertPanelMatchesCore11(panel, productionIds)).toThrow(
        /panel_persona_ids_must_match_core11/
      );
    });
  });

  describe('SelectionMeta count consistency (omxy R6 BLOCKER 2 fix)', () => {
    function buildResultWithTfs(tfDistribution: { short: number; mid: number; long: number }) {
      let i = 0;
      const tfArr: ('short' | 'mid' | 'long')[] = [
        ...Array(tfDistribution.short).fill('short'),
        ...Array(tfDistribution.mid).fill('mid'),
        ...Array(tfDistribution.long).fill('long'),
      ];
      const selected = tfArr.map((tf) =>
        makeTickerAggregate(`S${String(i++).padStart(3, '0')}`, {
          primary_timeframe: tf,
          assigned_by: 'primary',
          assigned_timeframe: tf,
        })
      );
      const notSelected = Array.from({ length: 120 }, (_, idx) =>
        makeTickerAggregate(`N${String(idx).padStart(3, '0')}`, {
          assigned_by: null,
          assigned_timeframe: null,
        })
      );
      return {
        selected,
        notSelected,
        selectionMeta: {
          shortCount: tfDistribution.short,
          midCount: tfDistribution.mid,
          longCount: tfDistribution.long,
          backfillCounts: { short: 0, mid: 0, long: 0 },
          promptVersionId: 'tier1-v1.0.0',
          personasVersionId: 'core11-v1.0.0',
          generatedAt: '2026-05-21T15:00:00.000Z',
        },
      };
    }

    it('rejects shortCount=10/mid=10/long=10 but all selected.assigned_timeframe="short"', () => {
      const bad = buildResultWithTfs({ short: 30, mid: 0, long: 0 });
      bad.selectionMeta.shortCount = 10;
      bad.selectionMeta.midCount = 10;
      bad.selectionMeta.longCount = 10;
      expect(() => Tier1ScreeningResultSchema.parse(bad)).toThrow(
        /selectionMeta_counts_must_match_assigned_timeframe/
      );
    });

    it('rejects backfillCounts mismatch with assigned_by="backfill" actuals', () => {
      const bad = buildResultWithTfs({ short: 10, mid: 10, long: 10 });
      bad.selectionMeta.backfillCounts = { short: 5, mid: 0, long: 0 };
      expect(() => Tier1ScreeningResultSchema.parse(bad)).toThrow(
        /selectionMeta_backfillCounts_must_match_assigned/
      );
    });

    it('rejects primary selected with assigned_timeframe ≠ primary_timeframe', () => {
      const bad = buildResultWithTfs({ short: 10, mid: 10, long: 10 });
      bad.selected[0] = {
        ...bad.selected[0],
        primary_timeframe: 'short',
        assigned_by: 'primary',
        assigned_timeframe: 'mid',
      };
      expect(() => Tier1ScreeningResultSchema.parse(bad)).toThrow(
        /primary_assigned_timeframe_must_equal_primary_timeframe/
      );
    });
  });
});
