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
      const selected = Array.from({ length: selectedCount }, (_, i) =>
        makeTickerAggregate(`S${String(i).padStart(3, '0')}`)
      );
      const notSelected = Array.from({ length: notSelectedCount }, (_, i) =>
        makeTickerAggregate(`N${String(i).padStart(3, '0')}`)
      );
      return {
        selected,
        notSelected,
        selectionMeta: {
          shortCount: 10,
          midCount: 10,
          longCount: 10,
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
});
