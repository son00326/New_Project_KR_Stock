// Track 1 PR-A1 — computeArmSelections 순수 코어 테스트.
// SoT: docs/superpowers/specs/2026-06-19-pathA-forward-shadow-sector-layer.md §4/§10/§11 + Phase-1 design 루프 §3d.

import { describe, it, expect } from 'vitest';
import {
  computeArmSelections,
  ShadowArmInputError,
  REGIME_K_MULTIPLIER_V1,
  SHADOW_ARMS,
  type ComputeArmSelectionsInput,
  type ArmSelectionResult,
  type SelectedRow,
} from '../shadow-harness-arms';
import type { Timeframe, TickerAggregate, SelectionTrack } from '../tier1-schema';
import type { CanonicalSector } from '../canonical-sectors';
import type { Tier1Candidate } from '../persona-eval';

// ============================================================================
// fixtures
// ============================================================================

type WS = Record<Timeframe, number>;
function ws(short: number, mid: number, long: number): WS {
  return { short, mid, long };
}
const ZERO: WS = { short: 0, mid: 0, long: 0 };

type Badge = '🟢' | '🔵' | '🟣' | '🟡' | '⚪';
function badges(b: Badge = '🟡'): Record<Timeframe, Badge> {
  return { short: b, mid: b, long: b };
}

function tk(n: number): string {
  return String(n).padStart(6, '0');
}

/** base aggregate (notSelected form: assigned null). primary = argmax(ws) unless overridden. */
function agg(
  ticker: string,
  sector: CanonicalSector | null,
  scores: WS,
  opts: { primary?: Timeframe; badge?: Badge } = {}
): TickerAggregate {
  const primary =
    opts.primary ??
    (scores.short >= scores.mid && scores.short >= scores.long
      ? 'short'
      : scores.mid >= scores.long
        ? 'mid'
        : 'long');
  return {
    ticker,
    sector,
    weighted_scores: scores,
    primary_timeframe: primary,
    consensus_badges_by_timeframe: badges(opts.badge),
    assigned_by: null,
    assigned_timeframe: null,
    prompt_version_id: 'p-v1',
    personas_version_id: 'k-v1',
  };
}

function degraded(ticker: string, sector: CanonicalSector | null): TickerAggregate {
  return {
    ticker,
    sector,
    weighted_scores: ZERO,
    primary_timeframe: 'short',
    consensus_badges_by_timeframe: badges('⚪'),
    assigned_by: null,
    assigned_timeframe: null,
    prompt_version_id: 'p-v1',
    personas_version_id: 'k-v1',
  };
}

function selectRow(
  a: TickerAggregate,
  tf: Timeframe,
  by: 'primary' | 'backfill'
): TickerAggregate {
  return { ...a, assigned_by: by, assigned_timeframe: tf };
}

/** candidates = mis-wiring guard용. tier0 필드는 검증 통과용 최소값(computeArmSelections는 미사용). */
function candidatesFor(track: SelectionTrack, all: TickerAggregate[]): Tier1Candidate[] {
  return all.map((a) => ({
    ticker: a.ticker,
    sector: a.sector,
    tier0_buckets:
      track === 'short'
        ? { short: true, mid: false, long: false }
        : { short: false, mid: true, long: false },
    tier0_scores:
      track === 'short'
        ? { short: 1, mid: null, long: null }
        : { short: null, mid: 1, long: null },
  }));
}

/** 트랙별 valid productionResult + candidates 조립. selectionMeta는 selected에서 계산(항상 정합). */
function buildInput(
  track: SelectionTrack,
  selected: TickerAggregate[],
  notSelected: TickerAggregate[],
  overrides: Partial<ComputeArmSelectionsInput> = {}
): ComputeArmSelectionsInput {
  const cnt = (tf: Timeframe) =>
    selected.filter((a) => a.assigned_timeframe === tf).length;
  const bf = (tf: Timeframe) =>
    selected.filter((a) => a.assigned_by === 'backfill' && a.assigned_timeframe === tf).length;
  const all = [...selected, ...notSelected];
  return {
    track,
    periodKey: track === 'short' ? 's:2026-06-15' : 'm:2026-06',
    productionResult: {
      selected,
      notSelected,
      selectionMeta: {
        shortCount: cnt('short'),
        midCount: cnt('mid'),
        longCount: cnt('long'),
        backfillCounts: { short: bf('short'), mid: bf('mid'), long: bf('long') },
        promptVersionId: 'p-v1',
        personasVersionId: 'k-v1',
        generatedAt: '2026-06-15T00:00:00.000Z',
      },
    },
    candidates: candidatesFor(track, all),
    sectorView: { source: 'absent', leadingSectors: [], asOf: '' },
    shadowEvalK: 0,
    ...overrides,
  };
}

function armOf(res: { arms: ArmSelectionResult[] }, arm: string): ArmSelectionResult {
  const a = res.arms.find((x) => x.arm === arm);
  if (!a) throw new Error(`arm not found: ${arm}`);
  return a;
}
function tickersOf(rows: SelectedRow[]): string[] {
  return rows.map((r) => r.ticker).sort();
}
function rowSignatures(rows: SelectedRow[]): string[] {
  return rows
    .map((r) => `${r.ticker}|${r.assigned_timeframe}|${r.assigned_by}|${r.weighted_score}|${r.sector}`)
    .sort();
}

// ---- SHORT 기본 시나리오 ----------------------------------------------------
// selected 10 (000001..000010, 모두 primary short, 점수 90..81),
// notSelected 40 (000011..000050).
function shortSelected(): TickerAggregate[] {
  const out: TickerAggregate[] = [];
  for (let n = 1; n <= 10; n++) {
    // 000003,000007 = 비-leading 저점수(displaceable 후보); 나머지 mixed.
    const sector: CanonicalSector = n % 2 === 0 ? '반도체' : '자동차';
    out.push(selectRow(agg(tk(n), sector, ws(91 - n, 0, 0)), 'short', 'primary'));
  }
  return out;
}
function shortNotSelected(): TickerAggregate[] {
  const out: TickerAggregate[] = [];
  for (let n = 11; n <= 50; n++) {
    out.push(agg(tk(n), '에너지', ws(80 - n, 0, 0)));
  }
  return out;
}

// ---- MIDLONG 기본 시나리오 --------------------------------------------------
// selected 20 (10 mid + 10 long, primary 일치), notSelected 80.
function midlongSelected(): TickerAggregate[] {
  const out: TickerAggregate[] = [];
  for (let n = 1; n <= 10; n++) {
    out.push(selectRow(agg(tk(n), '반도체', ws(0, 91 - n, 0), { primary: 'mid' }), 'mid', 'primary'));
  }
  for (let n = 11; n <= 20; n++) {
    out.push(selectRow(agg(tk(n), '바이오', ws(0, 0, 91 - n), { primary: 'long' }), 'long', 'primary'));
  }
  return out;
}
function midlongNotSelected(): TickerAggregate[] {
  const out: TickerAggregate[] = [];
  for (let n = 21; n <= 100; n++) {
    const tf: Timeframe = n % 2 === 0 ? 'mid' : 'long';
    out.push(agg(tk(n), '에너지', tf === 'mid' ? ws(0, 50 - (n - 20) / 2, 0) : ws(0, 0, 50 - (n - 20) / 2), { primary: tf }));
  }
  return out;
}

// ============================================================================
// 기본 구조 / production-snapshot
// ============================================================================

describe('computeArmSelections — structure', () => {
  it('returns all 4 arms in declared order, K/regime metadata', () => {
    const res = computeArmSelections(buildInput('short', shortSelected(), shortNotSelected()));
    expect(res.arms.map((a) => a.arm)).toEqual([...SHADOW_ARMS]);
    expect(res.track).toBe('short');
    expect(res.poolSize).toBe(50);
    expect(res.effectiveK).toBe(0);
    expect(res.regimeEffectiveK).toBe(0);
  });

  it('production-snapshot = production.selected projected (full 5-field set, incl. weighted_score=scores[assigned_tf])', () => {
    const sel = shortSelected();
    const res = computeArmSelections(buildInput('short', sel, shortNotSelected()));
    const snap = armOf(res, 'production-snapshot');
    expect(snap.status).toBe('logged');
    expect(snap.selected).toHaveLength(10);
    const projected = snap.selected
      .map((r) => `${r.ticker}|${r.assigned_timeframe}|${r.assigned_by}|${r.weighted_score}|${r.sector}`)
      .sort();
    const expected = sel
      .map(
        (a) =>
          `${a.ticker}|${a.assigned_timeframe}|${a.assigned_by}|${a.weighted_scores[a.assigned_timeframe!]}|${a.sector}`
      )
      .sort();
    expect(projected).toEqual(expected);
    expect(snap.counterfactualCut).toEqual([]);
    expect(snap.reservePicks).toEqual([]);
  });

  it('production-snapshot preserves assigned_tf score for a BACKFILL pick (D-7)', () => {
    // 9 primary short + 1 backfill short (primary_timeframe='mid', assigned short).
    const sel: TickerAggregate[] = [];
    for (let n = 1; n <= 9; n++) sel.push(selectRow(agg(tk(n), '자동차', ws(90 - n, 0, 0)), 'short', 'primary'));
    // backfill: primary mid(value 70) but assigned short(value 40) → snapshot must record 40, not 70.
    sel.push(selectRow(agg(tk(10), '에너지', ws(40, 70, 0), { primary: 'mid' }), 'short', 'backfill'));
    const res = computeArmSelections(buildInput('short', sel, shortNotSelected()));
    const row = armOf(res, 'production-snapshot').selected.find((r) => r.ticker === tk(10))!;
    expect(row.assigned_by).toBe('backfill');
    expect(row.weighted_score).toBe(40); // assigned-tf score, NOT primary 70
  });
});

// ============================================================================
// sector-soft-reserve
// ============================================================================

describe('computeArmSelections — sector-soft-reserve', () => {
  it('K=0 → mirror (== production-snapshot selected)', () => {
    const res = computeArmSelections(
      buildInput('short', shortSelected(), shortNotSelected(), {
        sectorView: { source: 'manual_pre_registered', leadingSectors: ['바이오'], asOf: '2026-06-01' },
        shadowEvalK: 0,
      })
    );
    const soft = armOf(res, 'sector-soft-reserve');
    expect(tickersOf(soft.selected)).toEqual(tickersOf(armOf(res, 'production-snapshot').selected));
    expect(soft.reservePicks).toEqual([]);
  });

  it('absent sectorView → mirror even with K>0', () => {
    const res = computeArmSelections(
      buildInput('short', shortSelected(), shortNotSelected(), { shadowEvalK: 3 })
    );
    const soft = armOf(res, 'sector-soft-reserve');
    expect(tickersOf(soft.selected)).toEqual(tickersOf(armOf(res, 'production-snapshot').selected));
    expect(soft.reservePicks).toEqual([]);
  });

  it('K>0 substitutes worst non-leading pick for best leading reserve; count preserved; disjoint', () => {
    // selected: 9 non-leading(자동차/반도체) + nothing leading. notSelected has a high-score 바이오.
    const sel = shortSelected(); // 자동차/반도체, scores 90..81
    const notSel = shortNotSelected();
    // inject a high-score 바이오 reserve into notSelected (replace one filler).
    notSel[0] = agg(tk(11), '바이오', ws(85, 0, 0)); // score 85 > worst selected (81 @ 000010)
    const res = computeArmSelections(
      buildInput('short', sel, notSel, {
        sectorView: { source: 'manual_pre_registered', leadingSectors: ['바이오'], asOf: '2026-06-01' },
        shadowEvalK: 1,
      })
    );
    const soft = armOf(res, 'sector-soft-reserve');
    expect(soft.selected).toHaveLength(10);
    expect(new Set(soft.selected.map((r) => r.ticker)).size).toBe(10); // disjoint
    // 000011 (바이오, 85) swapped in; worst non-leading (000010, 81) swapped out.
    expect(soft.selected.some((r) => r.ticker === tk(11) && r.assigned_by === 'reserve')).toBe(true);
    expect(soft.selected.some((r) => r.ticker === tk(10))).toBe(false);
    expect(soft.reservePicks).toEqual([{ ticker: tk(11), assigned_timeframe: 'short' }]);
  });

  it('degenerate guard: all leading-sector reserves are ⚪ → no swap (== production)', () => {
    const sel = shortSelected();
    const notSel = shortNotSelected();
    notSel[0] = degraded(tk(11), '바이오'); // leading but degraded ⚪
    const res = computeArmSelections(
      buildInput('short', sel, notSel, {
        sectorView: { source: 'manual_pre_registered', leadingSectors: ['바이오'], asOf: '2026-06-01' },
        shadowEvalK: 2,
      })
    );
    const soft = armOf(res, 'sector-soft-reserve');
    expect(tickersOf(soft.selected)).toEqual(tickersOf(armOf(res, 'production-snapshot').selected));
    expect(soft.reservePicks).toEqual([]);
  });

  it('midlong sibling-tf: a long-assigned production pick is NOT eligible as a mid reserve (PAR-4)', () => {
    // production: 10 mid(반도체) + 10 long(바이오). leadingSectors=바이오.
    // A 바이오 production long-pick must NOT be reservable into the mid track (it is already a track pick).
    const sel = midlongSelected();
    const notSel = midlongNotSelected();
    const res = computeArmSelections(
      buildInput('midlong', sel, notSel, {
        sectorView: { source: 'manual_pre_registered', leadingSectors: ['바이오'], asOf: '2026-05-15' },
        shadowEvalK: 3,
      })
    );
    const soft = armOf(res, 'sector-soft-reserve');
    // no reserve pick may be an existing production-selected ticker.
    const prodTickers = new Set(sel.map((a) => a.ticker));
    for (const rp of soft.reservePicks) expect(prodTickers.has(rp.ticker)).toBe(false);
    // mid track still 10, long still 10, all disjoint.
    expect(soft.selected.filter((r) => r.assigned_timeframe === 'mid')).toHaveLength(10);
    expect(soft.selected.filter((r) => r.assigned_timeframe === 'long')).toHaveLength(10);
    expect(new Set(soft.selected.map((r) => r.ticker)).size).toBe(20);
  });
});

// ============================================================================
// regime-sector-soft-reserve
// ============================================================================

describe('computeArmSelections — regime arm', () => {
  function highBioReserves(notSel: TickerAggregate[]): TickerAggregate[] {
    // 4 high-score 바이오 reserves so multiplier differences are observable.
    const copy = [...notSel];
    for (let j = 0; j < 4; j++) copy[j] = agg(tk(11 + j), '바이오', ws(86 - j, 0, 0));
    return copy;
  }

  it('regime absent → regime arm == production', () => {
    const res = computeArmSelections(
      buildInput('short', shortSelected(), highBioReserves(shortNotSelected()), {
        sectorView: { source: 'manual_pre_registered', leadingSectors: ['바이오'], asOf: '2026-06-01' },
        shadowEvalK: 2,
      })
    );
    const reg = armOf(res, 'regime-sector-soft-reserve');
    expect(tickersOf(reg.selected)).toEqual(tickersOf(armOf(res, 'production-snapshot').selected));
    expect(res.regimeEffectiveK).toBe(0);
  });

  it('regime bull multiplier ×2 → more swaps than soft-reserve(K)', () => {
    const sv = { source: 'manual_pre_registered' as const, leadingSectors: ['바이오' as CanonicalSector], asOf: '2026-06-01' };
    const res = computeArmSelections(
      buildInput('short', shortSelected(), highBioReserves(shortNotSelected()), {
        sectorView: sv,
        regime: { stage: 'bull', asOf: '2026-06-01', source: 'manual_pre_registered' },
        shadowEvalK: 1,
      })
    );
    expect(res.regimeEffectiveK).toBe(2);
    const soft = armOf(res, 'sector-soft-reserve');
    const reg = armOf(res, 'regime-sector-soft-reserve');
    expect(soft.reservePicks).toHaveLength(1); // K=1
    expect(reg.reservePicks).toHaveLength(2); // K×2
    // T1 (ce-* R3): assert the regime arm's SELECTED SET, not just reservePicks.length.
    // reserves 000011(86)/000012(85) swap IN; worst non-leading 000010(81)/000009(82) swap OUT.
    expect(reg.selected).toHaveLength(10);
    expect(new Set(reg.selected.map((r) => r.ticker)).size).toBe(10); // distinct
    const regTickers = new Set(reg.selected.map((r) => r.ticker));
    expect(regTickers.has(tk(11))).toBe(true);
    expect(regTickers.has(tk(12))).toBe(true);
    expect(regTickers.has(tk(10))).toBe(false); // displaced
    expect(regTickers.has(tk(9))).toBe(false); // displaced
    for (const t of [tk(11), tk(12)]) {
      const row = reg.selected.find((r) => r.ticker === t)!;
      expect(row.assigned_by).toBe('reserve');
      expect(row.assigned_timeframe).toBe('short');
    }
  });

  it('regime bear → regimeEffectiveK=0 → == production, reservePicks=[]', () => {
    const res = computeArmSelections(
      buildInput('short', shortSelected(), highBioReserves(shortNotSelected()), {
        sectorView: { source: 'manual_pre_registered', leadingSectors: ['바이오'], asOf: '2026-06-01' },
        regime: { stage: 'bear', asOf: '2026-06-01', source: 'manual_pre_registered' },
        shadowEvalK: 3,
      })
    );
    expect(res.regimeEffectiveK).toBe(0);
    const reg = armOf(res, 'regime-sector-soft-reserve');
    expect(tickersOf(reg.selected)).toEqual(tickersOf(armOf(res, 'production-snapshot').selected));
    expect(reg.reservePicks).toEqual([]);
  });

  it('regime sideways → multiplier 1 → matches soft-reserve(K)', () => {
    const base = {
      sectorView: { source: 'manual_pre_registered' as const, leadingSectors: ['바이오' as CanonicalSector], asOf: '2026-06-01' },
      shadowEvalK: 2,
    };
    const res = computeArmSelections(
      buildInput('short', shortSelected(), highBioReserves(shortNotSelected()), {
        ...base,
        regime: { stage: 'sideways', asOf: '2026-06-01', source: 'manual_pre_registered' },
      })
    );
    expect(res.regimeEffectiveK).toBe(2);
    expect(tickersOf(armOf(res, 'regime-sector-soft-reserve').selected)).toEqual(
      tickersOf(armOf(res, 'sector-soft-reserve').selected)
    );
  });

  it('multiplier gated on shadowEvalK>0 (K=0 + bull → still mirror)', () => {
    const res = computeArmSelections(
      buildInput('short', shortSelected(), highBioReserves(shortNotSelected()), {
        sectorView: { source: 'manual_pre_registered', leadingSectors: ['바이오'], asOf: '2026-06-01' },
        regime: { stage: 'bull', asOf: '2026-06-01', source: 'manual_pre_registered' },
        shadowEvalK: 0,
      })
    );
    expect(res.regimeEffectiveK).toBe(0);
    expect(armOf(res, 'regime-sector-soft-reserve').reservePicks).toEqual([]);
  });

  it('REGIME_K_MULTIPLIER_V1 is frozen {bear:0,sideways:1,bull:2}', () => {
    expect(REGIME_K_MULTIPLIER_V1).toEqual({ bear: 0, sideways: 1, bull: 2 });
  });
});

// ============================================================================
// candidate-pool-hard-gate
// ============================================================================

describe('computeArmSelections — candidate-pool-hard-gate', () => {
  it('counterfactualCut = sorted non-leading tickers (incl. truncated production leaders)', () => {
    const sel = shortSelected(); // 자동차(odd) / 반도체(even)
    const notSel = shortNotSelected(); // 에너지
    const res = computeArmSelections(
      buildInput('short', sel, notSel, {
        sectorView: { source: 'manual_pre_registered', leadingSectors: ['자동차'], asOf: '2026-06-01' },
        shadowEvalK: 0,
      })
    );
    const gate = armOf(res, 'candidate-pool-hard-gate');
    // cut = every non-자동차 ticker (반도체 selected + 에너지 notSelected).
    const expectedCut = [...sel, ...notSel]
      .filter((a) => a.sector !== '자동차')
      .map((a) => a.ticker)
      .sort();
    expect(gate.counterfactualCut).toEqual(expectedCut);
  });

  it('pool-containment: every gated pick has sector∈leading AND ⊆ candidate pool (D-8, NOT ⊆ production)', () => {
    const sel = shortSelected();
    const notSel = shortNotSelected();
    // make some notSelected 자동차 with HIGH score → the gate can RESCUE a within-pool leader prod dropped.
    notSel[0] = agg(tk(11), '자동차', ws(88, 0, 0)); // higher than some selected
    const res = computeArmSelections(
      buildInput('short', sel, notSel, {
        sectorView: { source: 'manual_pre_registered', leadingSectors: ['자동차'], asOf: '2026-06-01' },
      })
    );
    const gate = armOf(res, 'candidate-pool-hard-gate');
    const poolTickers = new Set(candidatesFor('short', [...sel, ...notSel]).map((c) => c.ticker));
    for (const r of gate.selected) {
      expect(r.sector).toBe('자동차');
      expect(poolTickers.has(r.ticker)).toBe(true);
    }
    // rescued 000011 may appear in gate.selected even though it was NOT in production.selected.
    const prodTickers = new Set(sel.map((a) => a.ticker));
    const rescued = gate.selected.some((r) => !prodTickers.has(r.ticker));
    expect(rescued).toBe(true); // in-pool reshuffle ≠ subset-of-production
  });

  it('incomplete_run when gated pool < 10 for an active tf (no throw; other arms still logged)', () => {
    // only 3 자동차 tickers in the whole pool → short needs 10 → underfill.
    const sel: TickerAggregate[] = [];
    for (let n = 1; n <= 3; n++) sel.push(selectRow(agg(tk(n), '자동차', ws(90 - n, 0, 0)), 'short', 'primary'));
    for (let n = 4; n <= 10; n++) sel.push(selectRow(agg(tk(n), '반도체', ws(90 - n, 0, 0)), 'short', 'primary'));
    const notSel: TickerAggregate[] = [];
    for (let n = 11; n <= 50; n++) notSel.push(agg(tk(n), '에너지', ws(80 - n, 0, 0)));
    const res = computeArmSelections(
      buildInput('short', sel, notSel, {
        sectorView: { source: 'manual_pre_registered', leadingSectors: ['자동차'], asOf: '2026-06-01' },
      })
    );
    const gate = armOf(res, 'candidate-pool-hard-gate');
    expect(gate.status).toBe('incomplete_run');
    expect(gate.selected.length).toBeLessThan(10);
    expect(gate.error).toMatch(/underfill/i);
    // other arms unaffected
    expect(armOf(res, 'production-snapshot').status).toBe('logged');
    expect(armOf(res, 'sector-soft-reserve').status).toBe('logged');
  });

  it('absent sectorView → no cut, gate == production (plumbing mirror)', () => {
    const res = computeArmSelections(buildInput('short', shortSelected(), shortNotSelected()));
    const gate = armOf(res, 'candidate-pool-hard-gate');
    expect(gate.counterfactualCut).toEqual([]);
    expect(gate.status).toBe('logged');
    expect(tickersOf(gate.selected)).toEqual(tickersOf(armOf(res, 'production-snapshot').selected));
  });

  it('GOLDEN parity: all-leading pool → gated==full → hard-gate reproduces production selection (omxy R1)', () => {
    // every ticker is in a leading sector → no cut → the re-selection sequence (primary argmax + global
    // backfill over the FULL aggregate pool) must reproduce production.selected exactly. This pins the
    // hard-gate's production-sequence parity (the comparator-export safety hook) with a golden vector.
    const sel = shortSelected(); // 자동차/반도체
    const notSel = shortNotSelected(); // 에너지
    const res = computeArmSelections(
      buildInput('short', sel, notSel, {
        sectorView: { source: 'manual_pre_registered', leadingSectors: ['자동차', '반도체', '에너지'], asOf: '2026-06-01' },
      })
    );
    const gate = armOf(res, 'candidate-pool-hard-gate');
    expect(gate.status).toBe('logged');
    expect(gate.counterfactualCut).toEqual([]); // nothing cut
    expect(rowSignatures(gate.selected)).toEqual(rowSignatures(armOf(res, 'production-snapshot').selected));
  });

  it('GOLDEN parity (midlong): all-leading pool → hard-gate reproduces production 20-pick selection (omxy R1)', () => {
    const sel = midlongSelected(); // 반도체(mid) + 바이오(long)
    const notSel = midlongNotSelected(); // 에너지
    const res = computeArmSelections(
      buildInput('midlong', sel, notSel, {
        sectorView: { source: 'manual_pre_registered', leadingSectors: ['반도체', '바이오', '에너지'], asOf: '2026-05-15' },
      })
    );
    const gate = armOf(res, 'candidate-pool-hard-gate');
    expect(gate.status).toBe('logged');
    expect(rowSignatures(gate.selected)).toEqual(rowSignatures(armOf(res, 'production-snapshot').selected));
    // assigned_timeframe distribution preserved (10 mid + 10 long).
    expect(gate.selected.filter((r) => r.assigned_timeframe === 'mid')).toHaveLength(10);
    expect(gate.selected.filter((r) => r.assigned_timeframe === 'long')).toHaveLength(10);
  });

  it('midlong: a gated candidate whose primary_timeframe=short is selected ONLY via backfill (D-2)', () => {
    // leading=바이오. Build a 바이오 pool: 8 primary-mid, 8 primary-long, 1 primary-SHORT, + fillers.
    const sel = midlongSelected(); // includes 바이오 long picks
    const notSel = midlongNotSelected();
    // inject a 바이오 ticker with primary_timeframe='short' but decent mid/long scores → backfill candidate.
    // reuse notSel[0]'s ticker (tk(21)) so the candidate pool stays unique (tk(99) already exists in the pool).
    notSel[0] = agg(tk(21), '바이오', ws(95, 40, 40), { primary: 'short' });
    // ensure mid track needs backfill: reduce primary-mid 바이오 count by making notSel mids non-바이오 (default 에너지) —
    // production mid picks are 반도체, so gated(바이오) has few mid-primaries → backfill kicks in.
    const res = computeArmSelections(
      buildInput('midlong', sel, notSel, {
        sectorView: { source: 'manual_pre_registered', leadingSectors: ['바이오'], asOf: '2026-05-15' },
      })
    );
    const gate = armOf(res, 'candidate-pool-hard-gate');
    const row = gate.selected.find((r) => r.ticker === tk(21));
    if (row) {
      // if selected at all, it must be via backfill (its primary is 'short', not an active midlong tf).
      expect(row.assigned_by).toBe('backfill');
    }
    // all gate picks are 바이오 regardless.
    for (const r of gate.selected) expect(r.sector).toBe('바이오');
  });
});

// ============================================================================
// badge tie-break parity
// ============================================================================

describe('computeArmSelections — comparator parity', () => {
  it('equal weighted_score, different badge → reserve sort uses badge priority (matches production comparator)', () => {
    // two 바이오 reserves, equal short score 85, badges 🟢(higher) vs 🟡(lower). 🟢 should be chosen first.
    const sel = shortSelected();
    const notSel = shortNotSelected();
    notSel[0] = agg(tk(11), '바이오', ws(85, 0, 0), { badge: '🟡' });
    notSel[1] = { ...agg(tk(12), '바이오', ws(85, 0, 0)), consensus_badges_by_timeframe: badges('🟢') };
    const res = computeArmSelections(
      buildInput('short', sel, notSel, {
        sectorView: { source: 'manual_pre_registered', leadingSectors: ['바이오'], asOf: '2026-06-01' },
        shadowEvalK: 1,
      })
    );
    const soft = armOf(res, 'sector-soft-reserve');
    // 🟢 000012 wins the single reserve slot over 🟡 000011 (badge tie-break).
    expect(soft.reservePicks).toEqual([{ ticker: tk(12), assigned_timeframe: 'short' }]);
  });
});

// ============================================================================
// no-mutation / determinism
// ============================================================================

describe('computeArmSelections — purity', () => {
  it('does not mutate deeply-frozen inputs (with a REAL soft-reserve swap exercising the rerank path)', () => {
    // T3 (ce-* R3): inject high-score 바이오 reserves so the soft-reserve filter/sort/push path actually
    // runs against the frozen aggregate pool (prior fixture had all-에너지 reserves → 0 swaps → empty path).
    const notSel = shortNotSelected();
    for (let j = 0; j < 3; j++) notSel[j] = agg(tk(11 + j), '바이오', ws(86 - j, 0, 0));
    const input = buildInput('short', shortSelected(), notSel, {
      sectorView: { source: 'manual_pre_registered', leadingSectors: ['바이오'], asOf: '2026-06-01' },
      shadowEvalK: 2,
    });
    const deepFreeze = (o: unknown): void => {
      if (o && typeof o === 'object') {
        Object.values(o).forEach(deepFreeze);
        Object.freeze(o);
      }
    };
    deepFreeze(input);
    expect(() => computeArmSelections(input)).not.toThrow();
  });

  it('is deterministic across repeated calls', () => {
    const mk = () =>
      buildInput('short', shortSelected(), shortNotSelected(), {
        sectorView: { source: 'manual_pre_registered', leadingSectors: ['반도체'], asOf: '2026-06-01' },
        shadowEvalK: 2,
      });
    expect(computeArmSelections(mk())).toEqual(computeArmSelections(mk()));
  });

  it('midlong full valid input yields 20-pick arms', () => {
    const res = computeArmSelections(buildInput('midlong', midlongSelected(), midlongNotSelected()));
    expect(res.poolSize).toBe(100);
    expect(armOf(res, 'production-snapshot').selected).toHaveLength(20);
    expect(armOf(res, 'sector-soft-reserve').selected).toHaveLength(20);
  });
});

// ============================================================================
// periodAnchor / asOf forward-integrity (via input validation)
// ============================================================================

describe('computeArmSelections — period anchor & asOf forward-integrity', () => {
  it('manual asOf strictly before period start is accepted; asOf == anchor rejected (D-4)', () => {
    const base = (asOf: string) =>
      buildInput('midlong', midlongSelected(), midlongNotSelected(), {
        periodKey: 'm:2026-06',
        sectorView: { source: 'manual_pre_registered', leadingSectors: ['반도체'], asOf },
      });
    // anchor = 2026-06-01 00:00 KST. asOf == anchor → reject.
    expect(() => computeArmSelections(base('2026-06-01T00:00:00+09:00'))).toThrow(ShadowArmInputError);
    // 1ms before → accept.
    expect(() => computeArmSelections(base('2026-05-31T23:59:59.999+09:00'))).not.toThrow();
    // bare date before month start → accept (KST midnight 2026-05-31 < 2026-06-01).
    expect(() => computeArmSelections(base('2026-05-31'))).not.toThrow();
  });

  it('weekly vs monthly anchors differ (a weekly asOf accepted that a monthly would reject)', () => {
    // weekly s:2026-06-15 anchor = 2026-06-15 KST. asOf 2026-06-10 < that → accept.
    const wk = buildInput('short', shortSelected(), shortNotSelected(), {
      periodKey: 's:2026-06-15',
      sectorView: { source: 'manual_pre_registered', leadingSectors: ['반도체'], asOf: '2026-06-10' },
    });
    expect(() => computeArmSelections(wk)).not.toThrow();
  });

  it('rejects non-existent date in period_key', () => {
    const bad = buildInput('short', shortSelected(), shortNotSelected(), { periodKey: 's:2026-02-30' });
    expect(() => computeArmSelections(bad)).toThrow(/non-existent|bad period_key/i);
  });

  it('rejects tz-aware asOf with non-existent calendar date / out-of-range time (BLOCKER omxy R1)', () => {
    const mk = (asOf: string, regime = false) =>
      buildInput('short', shortSelected(), shortNotSelected(), {
        periodKey: 's:2026-06-15',
        sectorView: regime
          ? { source: 'manual_pre_registered', leadingSectors: ['바이오'], asOf: '2026-06-01' }
          : { source: 'manual_pre_registered', leadingSectors: ['바이오'], asOf },
        ...(regime ? { regime: { stage: 'bull' as const, asOf, source: 'manual_pre_registered' as const } } : {}),
      });
    // 2026-02-30T..Z must NOT silently coerce to Mar 2 (Date.parse foot-gun).
    expect(() => computeArmSelections(mk('2026-02-30T00:00:00Z'))).toThrow(/not a valid date/);
    expect(() => computeArmSelections(mk('2026-02-30T00:00:00Z', true))).toThrow(/not a valid date/);
    // out-of-range time
    expect(() => computeArmSelections(mk('2026-06-01T25:00:00Z'))).toThrow(/out-of-range|not an ISO/);
    // naive-with-time (no tz) → rejected (forward-integrity requires tz or bare date)
    expect(() => computeArmSelections(mk('2026-06-01T00:00:00'))).toThrow(/bare date or a tz-aware/);
    // garbage
    expect(() => computeArmSelections(mk('not-a-date'))).toThrow(/bare date or a tz-aware/);
  });
});

// ============================================================================
// fail-closed matrix
// ============================================================================

describe('computeArmSelections — fail-closed validation', () => {
  const valid = () => buildInput('short', shortSelected(), shortNotSelected());

  it('rejects non-object input', () => {
    for (const bad of [null, undefined, 42, 'x', [], true]) {
      expect(() => computeArmSelections(bad)).toThrow(ShadowArmInputError);
    }
  });

  it('rejects bad track', () => {
    expect(() => computeArmSelections({ ...valid(), track: 'weekly' })).toThrow(/bad track/);
  });

  it('rejects cross-track periodKey form', () => {
    expect(() => computeArmSelections({ ...valid(), periodKey: 'm:2026-06' })).toThrow(/does not match short/);
  });

  it('rejects bad shadowEvalK (float / negative / NaN / non-number)', () => {
    for (const k of [1.5, -1, NaN, '2' as unknown as number]) {
      expect(() => computeArmSelections({ ...valid(), shadowEvalK: k })).toThrow(/shadowEvalK/);
    }
  });

  it('rejects malformed candidates (empty / non-array / bad element / dup / non-canonical sector)', () => {
    expect(() => computeArmSelections({ ...valid(), candidates: [] })).toThrow(/non-empty array/);
    expect(() => computeArmSelections({ ...valid(), candidates: 'x' as unknown as Tier1Candidate[] })).toThrow(
      /non-empty array/
    );
    const v = valid();
    expect(() =>
      computeArmSelections({ ...v, candidates: [...v.candidates.slice(1), v.candidates[1]] })
    ).toThrow(/duplicate/);
    expect(() =>
      computeArmSelections({
        ...v,
        candidates: [{ ...v.candidates[0], ticker: 'ABCDEF' }, ...v.candidates.slice(1)],
      })
    ).toThrow(/6-digit/);
    expect(() =>
      computeArmSelections({
        ...v,
        candidates: [{ ...v.candidates[0], sector: 'NotASector' as CanonicalSector }, ...v.candidates.slice(1)],
      })
    ).toThrow(/canonical/);
  });

  it('rejects pool mismatch (candidates ticker-set != productionResult ticker-set)', () => {
    const v = valid();
    const mutated = [...v.candidates];
    mutated[0] = { ...mutated[0], ticker: '999999' }; // not in productionResult
    expect(() => computeArmSelections({ ...v, candidates: mutated })).toThrow(/pool mismatch/);
  });

  it('rejects productionResult with wrong selected count', () => {
    const sel = shortSelected().slice(0, 9); // only 9
    // pad notSelected so candidates count is consistent but schema selected!=10 fires.
    const v = buildInput('short', sel, shortNotSelected());
    expect(() => computeArmSelections(v)).toThrow(/productionResult invalid/);
  });

  it('rejects bad sectorView (source / non-array / non-string elem / non-canonical / dup / absent-with-sectors / manual-empty)', () => {
    const v = valid();
    expect(() => computeArmSelections({ ...v, sectorView: { source: 'x', leadingSectors: [], asOf: '' } as never })).toThrow(/sectorView.source/);
    expect(() => computeArmSelections({ ...v, sectorView: { source: 'absent', leadingSectors: 'x' as never, asOf: '' } })).toThrow(/must be an array/);
    expect(() =>
      computeArmSelections({ ...v, sectorView: { source: 'manual_pre_registered', leadingSectors: [1 as never], asOf: '2026-06-01' } })
    ).toThrow(/must be strings/);
    expect(() =>
      computeArmSelections({ ...v, sectorView: { source: 'manual_pre_registered', leadingSectors: ['없는섹터' as never], asOf: '2026-06-01' } })
    ).toThrow(/non-canonical/);
    expect(() =>
      computeArmSelections({ ...v, sectorView: { source: 'manual_pre_registered', leadingSectors: ['바이오', '바이오'] as never, asOf: '2026-06-01' } })
    ).toThrow(/duplicate/);
    expect(() =>
      computeArmSelections({ ...v, sectorView: { source: 'absent', leadingSectors: ['바이오'] as never, asOf: '' } })
    ).toThrow(/absent sectorView must have empty/);
    expect(() =>
      computeArmSelections({ ...v, sectorView: { source: 'manual_pre_registered', leadingSectors: [], asOf: '2026-06-01' } })
    ).toThrow(/requires non-empty/);
  });

  it('rejects manual sectorView without asOf / with asOf not before period', () => {
    const v = valid(); // periodKey s:2026-06-15
    expect(() =>
      computeArmSelections({ ...v, sectorView: { source: 'manual_pre_registered', leadingSectors: ['바이오'], asOf: '' } })
    ).toThrow(/asOf string|not a valid date|bare date or a tz-aware/);
    expect(() =>
      computeArmSelections({ ...v, sectorView: { source: 'manual_pre_registered', leadingSectors: ['바이오'], asOf: '2026-06-20' } })
    ).toThrow(/strictly before/);
  });

  it('rejects bad regime (source / absent-with-stage / bad stage / asOf not before)', () => {
    const sv = { source: 'manual_pre_registered' as const, leadingSectors: ['바이오' as CanonicalSector], asOf: '2026-06-01' };
    const v = () => buildInput('short', shortSelected(), shortNotSelected(), { sectorView: sv });
    expect(() => computeArmSelections({ ...v(), regime: { source: 'x' } as never })).toThrow(/regime.source/);
    expect(() =>
      computeArmSelections({ ...v(), regime: { source: 'absent', stage: 'bull' } as never })
    ).toThrow(/absent regime must not carry/);
    expect(() =>
      computeArmSelections({ ...v(), regime: { source: 'manual_pre_registered', stage: 'boom' as never, asOf: '2026-06-01' } })
    ).toThrow(/regime.stage/);
    expect(() =>
      computeArmSelections({ ...v(), regime: { source: 'manual_pre_registered', stage: 'bull', asOf: '2026-06-20' } })
    ).toThrow(/strictly before/);
  });

  it('rejects malformed judgeScoresByTicker (despite being unused for rerank)', () => {
    const v = valid();
    expect(() => computeArmSelections({ ...v, judgeScoresByTicker: 'x' as never })).toThrow(/judgeScoresByTicker/);
    expect(() =>
      computeArmSelections({ ...v, judgeScoresByTicker: { '000001': { short: 1, mid: 2 } as never } })
    ).toThrow(/finite number/);
  });
});

// ============================================================================
// coverage hardening (ce-* R3): sectorDistribution / clamp terms / judge happy-path
// ============================================================================

describe('computeArmSelections — coverage hardening', () => {
  it('T2: sectorDistribution counts every arm + the null-sector → "null" string key', () => {
    // K=1 swap: 바이오 000011(85) in, worst non-leading 000010(반도체,81) out.
    // shortSelected odd(1,3,5,7,9)=자동차(5), even(2,4,6,8,10)=반도체(5); remove 000010 → 반도체 4; add 바이오 1.
    const notSel = shortNotSelected();
    notSel[0] = agg(tk(11), '바이오', ws(85, 0, 0));
    const res = computeArmSelections(
      buildInput('short', shortSelected(), notSel, {
        sectorView: { source: 'manual_pre_registered', leadingSectors: ['바이오'], asOf: '2026-06-01' },
        shadowEvalK: 1,
      })
    );
    expect(armOf(res, 'production-snapshot').sectorDistribution).toEqual({ 자동차: 5, 반도체: 5 });
    expect(armOf(res, 'sector-soft-reserve').sectorDistribution).toEqual({ 자동차: 5, 반도체: 4, 바이오: 1 });

    // null-sector pick → 'null' string key (sectorDistributionOf contract).
    const sel = shortSelected();
    sel[0] = selectRow(agg(tk(1), null, ws(91, 0, 0)), 'short', 'primary'); // 000001 자동차 → null
    const res2 = computeArmSelections(buildInput('short', sel, shortNotSelected()));
    const dist = armOf(res2, 'production-snapshot').sectorDistribution;
    expect(dist['null']).toBe(1);
    expect(dist['자동차']).toBe(4); // 000003,5,7,9 remain
    expect(dist['반도체']).toBe(5);
  });

  it('T4: soft-reserve swap count clamps to reserve.length when K exceeds eligible reserves', () => {
    // K=5 but only ONE eligible non-⚪ 바이오 reserve → exactly 1 swap, count preserved.
    const notSel = shortNotSelected(); // all 에너지
    notSel[0] = agg(tk(11), '바이오', ws(85, 0, 0)); // single eligible leading reserve
    const res = computeArmSelections(
      buildInput('short', shortSelected(), notSel, {
        sectorView: { source: 'manual_pre_registered', leadingSectors: ['바이오'], asOf: '2026-06-01' },
        shadowEvalK: 5,
      })
    );
    const soft = armOf(res, 'sector-soft-reserve');
    expect(soft.reservePicks).toHaveLength(1); // clamped by reserve.length, not K=5
    expect(soft.selected).toHaveLength(10);
  });

  it('T4: soft-reserve makes 0 swaps when all production picks are leading (0 displaceable)', () => {
    // every selected pick is 바이오 → displaceable empty → no swap regardless of K or reserves.
    const sel: TickerAggregate[] = [];
    for (let n = 1; n <= 10; n++) sel.push(selectRow(agg(tk(n), '바이오', ws(91 - n, 0, 0)), 'short', 'primary'));
    const notSel: TickerAggregate[] = [];
    for (let n = 11; n <= 46; n++) notSel.push(agg(tk(n), '에너지', ws(60 - n, 0, 0)));
    for (let n = 47; n <= 50; n++) notSel.push(agg(tk(n), '바이오', ws(70, 0, 0))); // high 바이오 reserves exist...
    const res = computeArmSelections(
      buildInput('short', sel, notSel, {
        sectorView: { source: 'manual_pre_registered', leadingSectors: ['바이오'], asOf: '2026-06-01' },
        shadowEvalK: 5,
      })
    );
    const soft = armOf(res, 'sector-soft-reserve');
    expect(soft.reservePicks).toEqual([]); // ...but 0 displaceable → no swap
    expect(tickersOf(soft.selected)).toEqual(tickersOf(armOf(res, 'production-snapshot').selected));
  });

  it('T5: a fully valid judgeScoresByTicker passes and every arm reports error=null', () => {
    const res = computeArmSelections(
      buildInput('short', shortSelected(), shortNotSelected(), {
        judgeScoresByTicker: { [tk(1)]: { short: 80, mid: 10, long: 5 }, [tk(2)]: { short: 70, mid: 20, long: 1 } },
      })
    );
    for (const a of res.arms) expect(a.error).toBeNull();
  });
});
