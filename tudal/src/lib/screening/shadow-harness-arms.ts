// tudal/src/lib/screening/shadow-harness-arms.ts
//
// Track 1 — Forward-Shadow 섹터 레이어 / PR-A1 순수 compute 코어.
//
// SoT: docs/superpowers/specs/2026-06-19-pathA-forward-shadow-sector-layer.md
//      §1(I-1~I-9) · §3(arm semantics) · §4(computeArmSelections contract) · §5.2/§5.4(0038 row shape)
//      · §6.4(Gate A 명칭) · §10(PR-A1) · §11(checklist)
// Track 2 parity 참조(arm/fail-closed/KST/no-mutation/counterfactual_cut): scripts/shadow_gen_core.py
//
// 이 모듈은 **순수 함수**만 담는다 — DB 없음, LLM 없음, 입력 mutation 없음, 결정론.
// production runtime effect = NONE (PR-A2가 default-OFF로 배선하기 전까지 어떤 모듈도 import 안 함).
//
// 측정 대상 = **worker-pool in-pool 30-reranking**(Gate A = "worker-pool in-pool rerank lift").
// 생성 단계 150-recall은 측정하지 **않는다**(§0/§I-9 정직 scope). PASS/FAIL·claim 산출 금지(stage 0 관측).
//
// HARDENED (Phase-1 design 루프 D-1~D-11):
// - D-1: 재정렬 substrate = TickerAggregate(weighted_scores + consensus_badges 보유)뿐. Tier1Candidate는
//        mis-wiring 가드 전용(weighted_scores/badge 부재 → compareForTimeframe에 절대 전달 안 함).
// - D-2: hard-gate는 gated aggregate subset 위에서 production의 argmax-primary + global-backfill 시퀀스 재현
//        (primary_timeframe는 재계산 않고 aggregate에서 읽음).
// - D-3/D-4: periodAnchorInstant(throwing, KST explicit-field → UTC) + asOf STRICT `<` anchor.
// - D-5: 모든 container/subfield/element를 access 전에 type-check → ShadowArmInputError(symmetric fail-closed).
// - D-6: hard-gate incomplete_run 출력은 production schema가 아니라 looser shadow-row 체크(count 미강제).
// - D-8: hard-gate I-6 = pool-containment(⊆ candidate pool ∧ sector∈leading), NOT ⊆ production.selected.
// - D-9: REGIME_K_MULTIPLIER_V1은 Track-1 전용 frozen 사전등록(freeze 규율만 SOFT_TILT_V1과 닮음; 알고리즘
//        parity 아님). bear→0=plumbing, shadowEvalK=0=dormant.
// - D-10: 열화(⚪) ticker는 reserve/gate eligibility에서 제외(랭킹 침몰 ≠ 부적격).

import {
  type Timeframe,
  type SelectionTrack,
  type TickerAggregate,
  type Tier1ScreeningResult,
  TIMEFRAMES,
  TRACK_TIMEFRAMES,
  makeTier1ScreeningResultSchema,
} from './tier1-schema';
import { type CanonicalSector, CANONICAL_SECTORS } from './canonical-sectors';
import { type Tier1Candidate, compareForTimeframe } from './persona-eval';

// ============================================================================
// 상수 / 타입
// ============================================================================

/** 4 shadow arms (spec §3.1). production-snapshot은 immutable baseline. */
export const SHADOW_ARMS = [
  'production-snapshot',
  'sector-soft-reserve',
  'regime-sector-soft-reserve',
  'candidate-pool-hard-gate',
] as const;
export type ShadowArm = (typeof SHADOW_ARMS)[number];

export type ShadowRegimeStage = 'bear' | 'sideways' | 'bull';
const REGIME_STAGES: readonly ShadowRegimeStage[] = ['bear', 'sideways', 'bull'];

/**
 * D-9 — Track-1 전용 FROZEN 사전등록. Track 2와 알고리즘 parity 없음(Track 2는 regime arm 없고
 * additive soft-TILT를 씀; 여기는 K-bounded soft-RESERVE). freeze "규율"(immutable·params-override
 * 금지)만 PR-B1 SOFT_TILT_V1_ADDEND를 닮음. 근거(사전등록): bull 장세 sector 신호 최강 → 2× 허용,
 * bear 최약 → 0(tilt off). bull=2는 frozen-before-observation 정수 선택이지 +0.72 수치 파생 아님.
 * 변경 시 새 _v2 + clock reset(post-hoc 금지).
 */
export const REGIME_K_MULTIPLIER_V1: Readonly<Record<ShadowRegimeStage, number>> = {
  bear: 0,
  sideways: 1,
  bull: 2,
};

const _CANONICAL_SET: ReadonlySet<string> = new Set(CANONICAL_SECTORS);
const _KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 잘못된 config/inputs (spec §4). PR-A2 worker는 이를 잡아 status='invalid_input' row로 기록. */
export class ShadowArmInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShadowArmInputError';
  }
}

/**
 * sector hypothesis (MAINT-1: discriminated union on `source` → validateInput의 `asserts`가 sound +
 * compiler가 source-guard를 강제). validator는 leadingSectors를 항상 array로 요구하므로 두 variant 공통
 * 필수. asOf는 manual에서만 검증되므로 absent는 optional.
 */
export type ShadowSectorView =
  | { source: 'absent'; leadingSectors: readonly CanonicalSector[]; asOf?: string }
  | { source: 'manual_pre_registered'; leadingSectors: readonly CanonicalSector[]; asOf: string };

/** regime context (MAINT-1: 동일). absent는 stage/asOf 부재(validator가 absent의 stage 동반을 거부, §3.5). */
export type ShadowRegime =
  | { source: 'absent' }
  | { source: 'manual_pre_registered'; stage: ShadowRegimeStage; asOf: string };

export interface ComputeArmSelectionsInput {
  track: SelectionTrack;
  /** short: `s:YYYY-MM-DD`(KST 월요일) · midlong: `m:YYYY-MM`. */
  periodKey: string;
  /** track-scoped runTier1Screening 결과(selected 10/20). cloned input only — 절대 mutate 안 함. */
  productionResult: Tier1ScreeningResult;
  /** fresh ∪ incumbents worker pool(sleeve/mcap metadata 없음). mis-wiring 가드 전용. */
  candidates: readonly Tier1Candidate[];
  /** present 가능하나 stage 0 재정렬에 미사용(production이 judge를 weighted_scores에 이미 반영) — provenance용. */
  judgeScoresByTicker?: Readonly<Record<string, Record<Timeframe, number>>>;
  sectorView: ShadowSectorView;
  /** stage 0 기본 absent(→mirror). manual_pre_registered만 multiplier 활성(§3.5). */
  regime?: ShadowRegime;
  /** soft-reserve 기본 K. 정수 ≥0. 0 = plumbing(reserve arm == production). */
  shadowEvalK: number;
}

/** arm 산출 pick (0038 row `selected`의 in-memory 형태; §5.2 RPC가 ticker/assigned_timeframe/count/distinct 검증). */
export interface SelectedRow {
  ticker: string;
  assigned_timeframe: Timeframe;
  /** 'reserve'는 Track-1 shadow 전용 provenance(production TickerAggregate enum엔 없음, §5.4/D-11). */
  assigned_by: 'primary' | 'backfill' | 'reserve';
  /** 배정된 timeframe의 weighted_score(primary tf 아님, D-7). */
  weighted_score: number;
  sector: CanonicalSector | null;
}

export interface ReservePick {
  ticker: string;
  assigned_timeframe: Timeframe;
}

export interface ArmSelectionResult {
  arm: ShadowArm;
  status: 'logged' | 'incomplete_run';
  selected: SelectedRow[];
  reservePicks: ReservePick[];
  /** hard-gate: sector∉leading로 잘린 ticker(sorted) — 잘린 리더 가시화(§6.4). 그 외 []. */
  counterfactualCut: string[];
  sectorDistribution: Record<string, number>;
  error: string | null;
}

export interface ComputeArmSelectionsResult {
  track: SelectionTrack;
  periodKey: string;
  poolSize: number;
  /** soft-reserve effective K(= shadowEvalK). */
  effectiveK: number;
  /** regime arm effective K(= shadowEvalK × multiplier[stage]; absent/bear → 0). */
  regimeEffectiveK: number;
  arms: ArmSelectionResult[];
}

// ============================================================================
// 순수 헬퍼
// ============================================================================

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * periodKey → period 시작 instant(Date, UTC). D-3.
 * short `s:YYYY-MM-DD` → 그 날 00:00:00 KST · midlong `m:YYYY-MM` → 1일 00:00:00 KST → UTC.
 * KST explicit-field 구성(절대 `new Date('YYYY-MM')` 금지 — bare 문자열은 UTC-자정 파싱 → +9h skew).
 * 구조적 오류/존재하지 않는 날짜(2026-13 / 2026-02-30 / 빈 body / cross-track)는 throw.
 */
function periodAnchorInstant(track: SelectionTrack, periodKey: string): Date {
  let y: number;
  let mo: number;
  let d: number;
  if (track === 'short') {
    const m = /^s:(\d{4})-(\d{2})-(\d{2})$/.exec(periodKey);
    if (!m) throw new ShadowArmInputError(`bad period_key for short track: ${periodKey}`);
    y = Number(m[1]);
    mo = Number(m[2]);
    d = Number(m[3]);
  } else {
    const m = /^m:(\d{4})-(\d{2})$/.exec(periodKey);
    if (!m) throw new ShadowArmInputError(`bad period_key for midlong track: ${periodKey}`);
    y = Number(m[1]);
    mo = Number(m[2]);
    d = 1;
  }
  // KST 자정 = UTC-15:00 전날. explicit-field로 UTC instant 구성 후 검증(round-trip로 invalid date 거부).
  const utcMs = Date.UTC(y, mo - 1, d, 0, 0, 0, 0) - _KST_OFFSET_MS;
  const anchor = new Date(utcMs);
  // round-trip: 구성한 (y,mo,d)가 KST에서 그대로 복원되는지 → 2026-02-30(=03-02) 같은 overflow 거부.
  const back = new Date(anchor.getTime() + _KST_OFFSET_MS);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() + 1 !== mo || back.getUTCDate() !== d) {
    throw new ShadowArmInputError(`non-existent date in period_key: ${periodKey}`);
  }
  return anchor;
}

/**
 * asOf 문자열 → instant(Date). lexical 비교 금지(instant 비교만). 파싱 불가 시 throw.
 * naive(`YYYY-MM-DD`)는 KST 자정으로 해석(parity shadow_gen_core `_normalize_datetime`); tz-aware(`Z`/offset)는 그 instant.
 */
/** Y-M-D 캘린더 round-trip 검증(2026-02-30 같은 overflow 거부). 유효하면 (y,mo,d) 반환. */
function assertCalendarDate(y: number, mo: number, d: number, field: string, value: string): void {
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() + 1 !== mo || probe.getUTCDate() !== d) {
    throw new ShadowArmInputError(`${field} is not a valid date: ${value}`);
  }
}

function parseAsOfInstant(value: string, field: string): Date {
  // (a) bare date `YYYY-MM-DD` → KST 자정.
  const bare = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (bare) {
    const y = Number(bare[1]);
    const mo = Number(bare[2]);
    const d = Number(bare[3]);
    assertCalendarDate(y, mo, d, field, value);
    return new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0) - _KST_OFFSET_MS);
  }
  // (b) tz-aware ISO `YYYY-MM-DDThh:mm[:ss[.sss]](Z|±hh:mm)`. naive-with-time(no tz)은 거부(forward-integrity).
  // BLOCKER fix(omxy R1): Date.parse 단독은 2026-02-30T00:00:00Z를 Mar 2로 silent coerce → 캘린더/시간
  // component를 명시 검증한 뒤에만 instant 파싱(symmetric fail-closed, bare-date 경로와 대칭).
  const iso =
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})$/.exec(value);
  if (!iso) {
    throw new ShadowArmInputError(`${field} must be a bare date or a tz-aware ISO timestamp: ${value}`);
  }
  const y = Number(iso[1]);
  const mo = Number(iso[2]);
  const d = Number(iso[3]);
  const h = Number(iso[4]);
  const min = Number(iso[5]);
  const s = iso[6] !== undefined ? Number(iso[6]) : 0;
  assertCalendarDate(y, mo, d, field, value);
  if (h > 23 || min > 59 || s > 59) {
    throw new ShadowArmInputError(`${field} has out-of-range time: ${value}`);
  }
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    throw new ShadowArmInputError(`${field} is not an ISO timestamp: ${value}`);
  }
  return new Date(ms);
}

/** 열화(⚪) 판정 보조: tier1 available iff NOT(weighted_score===0 AND badge==='⚪'). D-10. */
function isTier1Available(a: TickerAggregate, tf: Timeframe): boolean {
  return !(a.weighted_scores[tf] === 0 && a.consensus_badges_by_timeframe[tf] === '⚪');
}

/** worst-first 정렬(arg-swap, NOT return-negation — localeCompare tie-break 반전 일관). D-11/F12. */
function worstFirst(a: TickerAggregate, b: TickerAggregate, tf: Timeframe): number {
  return compareForTimeframe(b, a, tf);
}

function projectRow(
  a: TickerAggregate,
  tf: Timeframe,
  assignedBy: SelectedRow['assigned_by']
): SelectedRow {
  return {
    ticker: a.ticker,
    assigned_timeframe: tf,
    assigned_by: assignedBy,
    weighted_score: a.weighted_scores[tf],
    sector: a.sector,
  };
}

function sectorDistributionOf(rows: SelectedRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const key = r.sector ?? 'null';
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

/** production.selected를 SelectedRow[]로 projection (production-snapshot arm + hard-gate absent mirror 공용, SIMP-2). */
function projectProductionSelected(productionResult: Tier1ScreeningResult): SelectedRow[] {
  // selected items: assigned_by + assigned_timeframe 모두 non-null(schema 보장).
  return productionResult.selected.map((a) =>
    projectRow(a, a.assigned_timeframe as Timeframe, a.assigned_by as 'primary' | 'backfill')
  );
}

// ============================================================================
// 입력 검증 (throw ShadowArmInputError; 첫 실패에서 raise; access 전 type-check; coerce 금지)
// ============================================================================

function validateInput(input: unknown): asserts input is ComputeArmSelectionsInput {
  // 0. top-level
  if (!isPlainObject(input)) {
    throw new ShadowArmInputError('input must be a non-null object');
  }
  const i = input as Record<string, unknown>;

  // 1. track
  if (i.track !== 'short' && i.track !== 'midlong') {
    throw new ShadowArmInputError(`bad track: ${String(i.track)}`);
  }
  const track = i.track as SelectionTrack;

  // 2. periodKey (type → track regex → anchor parse)
  if (typeof i.periodKey !== 'string') {
    throw new ShadowArmInputError('periodKey must be a string');
  }
  const periodRe = track === 'short' ? /^s:\d{4}-\d{2}-\d{2}$/ : /^m:\d{4}-\d{2}$/;
  if (!periodRe.test(i.periodKey)) {
    throw new ShadowArmInputError(`periodKey does not match ${track} form: ${i.periodKey}`);
  }
  const anchor = periodAnchorInstant(track, i.periodKey); // throws on non-existent date

  // 3. shadowEvalK
  if (typeof i.shadowEvalK !== 'number' || !Number.isInteger(i.shadowEvalK) || i.shadowEvalK < 0) {
    // 큰 K는 min()으로 clamp(거부 아님). 정수·음수만 거부.
    throw new ShadowArmInputError(`shadowEvalK must be a non-negative integer: ${String(i.shadowEvalK)}`);
  }

  // 4. candidates (array → 비어있지 않음 → 각 element shape → ticker/sector/buckets/scores → dedup)
  if (!Array.isArray(i.candidates) || i.candidates.length === 0) {
    throw new ShadowArmInputError('candidates must be a non-empty array');
  }
  const candTickers: string[] = [];
  for (const c of i.candidates) {
    if (!isPlainObject(c)) throw new ShadowArmInputError('candidate must be an object');
    if (typeof c.ticker !== 'string' || !/^\d{6}$/.test(c.ticker)) {
      throw new ShadowArmInputError(`candidate.ticker must be a 6-digit string: ${String(c.ticker)}`);
    }
    if (!(c.sector === null || (typeof c.sector === 'string' && _CANONICAL_SET.has(c.sector)))) {
      throw new ShadowArmInputError(`candidate.sector must be canonical or null: ${String(c.sector)}`);
    }
    if (!isPlainObject(c.tier0_buckets) || !isPlainObject(c.tier0_scores)) {
      throw new ShadowArmInputError(`candidate.tier0_buckets/tier0_scores must be objects: ${c.ticker}`);
    }
    candTickers.push(c.ticker);
  }
  const candSet = new Set(candTickers);
  if (candSet.size !== candTickers.length) {
    throw new ShadowArmInputError('candidates contain duplicate ticker(s)');
  }

  // 5. productionResult — 객체 확인 후 production schema로 full 검증(count/disjoint/active-tf purity).
  if (!isPlainObject(i.productionResult)) {
    throw new ShadowArmInputError('productionResult must be an object');
  }
  const pr = i.productionResult as Record<string, unknown>;
  const selLen = Array.isArray(pr.selected) ? pr.selected.length : 0;
  const notSelLen = Array.isArray(pr.notSelected) ? pr.notSelected.length : 0;
  const poolSize = selLen + notSelLen; // D-6: poolSize는 productionResult에서 파생(candidates.length 아님).
  try {
    makeTier1ScreeningResultSchema(track, poolSize).parse(i.productionResult);
  } catch (e) {
    throw new ShadowArmInputError(`productionResult invalid: ${e instanceof Error ? e.message : String(e)}`);
  }
  const result = i.productionResult as Tier1ScreeningResult;

  // 6. pool mis-wiring (자신의 distinct 에러 — count-mismatch 혼동 방지). schema가 result 내부 unique/disjoint 보장.
  const unionTickers = new Set<string>([
    ...result.selected.map((a) => a.ticker),
    ...result.notSelected.map((a) => a.ticker),
  ]);
  if (unionTickers.size !== candSet.size || ![...candSet].every((t) => unionTickers.has(t))) {
    throw new ShadowArmInputError(
      `pool mismatch: productionResult ticker-set != candidates ticker-set (` +
        `result=${unionTickers.size}, candidates=${candSet.size})`
    );
  }

  // 7. sectorView
  if (!isPlainObject(i.sectorView)) throw new ShadowArmInputError('sectorView must be an object');
  const sv = i.sectorView as Record<string, unknown>;
  if (sv.source !== 'absent' && sv.source !== 'manual_pre_registered') {
    throw new ShadowArmInputError(`bad sectorView.source: ${String(sv.source)}`);
  }
  if (!Array.isArray(sv.leadingSectors)) {
    throw new ShadowArmInputError('sectorView.leadingSectors must be an array');
  }
  for (const s of sv.leadingSectors) {
    if (typeof s !== 'string') {
      throw new ShadowArmInputError('sectorView.leadingSectors elements must be strings');
    }
    if (!_CANONICAL_SET.has(s)) {
      throw new ShadowArmInputError(`non-canonical leading sector: ${s}`);
    }
  }
  if (new Set(sv.leadingSectors as string[]).size !== sv.leadingSectors.length) {
    throw new ShadowArmInputError('sectorView.leadingSectors contains duplicate(s)');
  }
  if (sv.source === 'absent' && sv.leadingSectors.length > 0) {
    throw new ShadowArmInputError('absent sectorView must have empty leadingSectors');
  }
  if (sv.source === 'manual_pre_registered') {
    if (sv.leadingSectors.length === 0) {
      throw new ShadowArmInputError('manual_pre_registered sectorView requires non-empty leadingSectors');
    }
    if (typeof sv.asOf !== 'string') {
      throw new ShadowArmInputError('manual_pre_registered sectorView requires asOf string');
    }
    const asOf = parseAsOfInstant(sv.asOf, 'sectorView.asOf');
    if (asOf.getTime() >= anchor.getTime()) {
      throw new ShadowArmInputError('sectorView.asOf must be strictly before period start (forward-integrity)');
    }
  }

  // 8. regime (optional)
  if (i.regime !== undefined) {
    if (!isPlainObject(i.regime)) throw new ShadowArmInputError('regime must be an object');
    const rg = i.regime as Record<string, unknown>;
    if (rg.source !== 'absent' && rg.source !== 'manual_pre_registered') {
      throw new ShadowArmInputError(`bad regime.source: ${String(rg.source)}`);
    }
    if (rg.source === 'absent') {
      if (rg.stage !== undefined && rg.stage !== null) {
        throw new ShadowArmInputError('absent regime must not carry a stage');
      }
    } else {
      if (typeof rg.stage !== 'string' || !REGIME_STAGES.includes(rg.stage as ShadowRegimeStage)) {
        throw new ShadowArmInputError(`bad regime.stage: ${String(rg.stage)}`);
      }
      if (typeof rg.asOf !== 'string') {
        throw new ShadowArmInputError('manual_pre_registered regime requires asOf string');
      }
      const asOf = parseAsOfInstant(rg.asOf, 'regime.asOf');
      if (asOf.getTime() >= anchor.getTime()) {
        throw new ShadowArmInputError('regime.asOf must be strictly before period start (forward-integrity)');
      }
    }
  }

  // 9. judgeScoresByTicker (재정렬 미사용이나 public 타입 → 검증 필수)
  if (i.judgeScoresByTicker !== undefined) {
    if (!isPlainObject(i.judgeScoresByTicker)) {
      throw new ShadowArmInputError('judgeScoresByTicker must be an object');
    }
    for (const [tk, scores] of Object.entries(i.judgeScoresByTicker)) {
      if (!isPlainObject(scores)) {
        throw new ShadowArmInputError(`judgeScoresByTicker[${tk}] must be an object`);
      }
      for (const tf of TIMEFRAMES) {
        // 모든 timeframe 키가 finite number여야 함(Record<Timeframe, number>).
        if (typeof scores[tf] !== 'number' || !Number.isFinite(scores[tf])) {
          throw new ShadowArmInputError(`judgeScoresByTicker[${tk}].${tf} must be a finite number`);
        }
      }
    }
  }
}

// ============================================================================
// arm 계산 (검증 후 호출 — 입력은 유효)
// ============================================================================

/** production-snapshot (immutable baseline) — production.selected의 lossy projection. status 항상 'logged'. */
function armProductionSnapshot(productionResult: Tier1ScreeningResult): ArmSelectionResult {
  const selected = projectProductionSelected(productionResult);
  return {
    arm: 'production-snapshot',
    status: 'logged',
    selected,
    reservePicks: [],
    counterfactualCut: [],
    sectorDistribution: sectorDistributionOf(selected),
    error: null,
  };
}

/** soft-reserve 공통 엔진(arm 2·3). effectiveK·arm 이름만 다름. D-1/D-10/PAR-4. */
function softReserveArm(
  arm: 'sector-soft-reserve' | 'regime-sector-soft-reserve',
  productionResult: Tier1ScreeningResult,
  aggregatePool: Map<string, TickerAggregate>,
  activeTfs: readonly Timeframe[],
  leadingSet: ReadonlySet<string>,
  effectiveK: number
): ArmSelectionResult {
  // production picks를 assigned_timeframe별로 group(원본 assigned_by 보존).
  const prodByTf: Record<Timeframe, TickerAggregate[]> = { short: [], mid: [], long: [] };
  const prodAssignedBy = new Map<string, 'primary' | 'backfill'>();
  for (const a of productionResult.selected) {
    const tf = a.assigned_timeframe as Timeframe;
    prodByTf[tf].push(a);
    prodAssignedBy.set(a.ticker, a.assigned_by as 'primary' | 'backfill');
  }
  const trackPicks = new Set(productionResult.selected.map((a) => a.ticker)); // PAR-4: reserve는 전 track pick 제외
  const allAgg = [...aggregatePool.values()];

  const used = new Set<string>();
  const selected: SelectedRow[] = [];
  const reservePicks: ReservePick[] = [];

  for (const tf of activeTfs) {
    const currentTf = prodByTf[tf]; // 이 tf의 production picks(10)
    const displaceable = currentTf
      .filter((a) => !(a.sector !== null && leadingSet.has(a.sector)))
      .sort((a, b) => worstFirst(a, b, tf)); // 최악 먼저
    const reserve = allAgg
      .filter(
        (a) =>
          a.sector !== null &&
          leadingSet.has(a.sector) &&
          !trackPicks.has(a.ticker) &&
          !used.has(a.ticker) &&
          isTier1Available(a, tf) // D-10: 열화 ⚪ 제외
      )
      .sort((a, b) => compareForTimeframe(a, b, tf)); // 최고 먼저

    const nSwaps = Math.min(effectiveK, displaceable.length, reserve.length);
    const removed = new Set(displaceable.slice(0, nSwaps).map((a) => a.ticker));
    const added = reserve.slice(0, nSwaps);

    const keptRows = currentTf
      .filter((a) => !removed.has(a.ticker))
      .map((a) => projectRow(a, tf, prodAssignedBy.get(a.ticker) ?? 'primary'));
    const addedRows = added.map((a) => projectRow(a, tf, 'reserve'));

    for (const r of [...keptRows, ...addedRows]) {
      selected.push(r);
      used.add(r.ticker);
    }
    for (const a of added) reservePicks.push({ ticker: a.ticker, assigned_timeframe: tf });
  }

  return {
    arm,
    status: 'logged',
    selected,
    reservePicks,
    counterfactualCut: [],
    sectorDistribution: sectorDistributionOf(selected),
    error: null,
  };
}

/**
 * candidate-pool-hard-gate (DIAGNOSTIC) — pool을 sector∈leading로 절단 후 production 시퀀스 재선정.
 * counterfactualCut = sector∉leading ticker(잘린 리더 포함). underfill → status='incomplete_run'(throw 아님).
 * shrink-only → 생성단계 150-recall 못 올림(I-6); in-pool reshuffle은 다른 의미(§6.4).
 */
function hardGateArm(
  productionResult: Tier1ScreeningResult,
  aggregatePool: Map<string, TickerAggregate>,
  activeTfs: readonly Timeframe[],
  leadingSet: ReadonlySet<string>
): ArmSelectionResult {
  // absent/빈 leading: sector 가설 없음 → 절단 없음 = production mirror(plumbing, spec §3b/parity PR-B1).
  if (leadingSet.size === 0) {
    const selected = projectProductionSelected(productionResult);
    return {
      arm: 'candidate-pool-hard-gate',
      status: 'logged',
      selected,
      reservePicks: [],
      counterfactualCut: [],
      sectorDistribution: sectorDistributionOf(selected),
      error: null,
    };
  }
  const allAgg = [...aggregatePool.values()];
  // counterfactual cut = sector∉leading (null sector 포함). availability와 무관한 sector-gate 절단.
  const counterfactualCut = allAgg
    .filter((a) => !(a.sector !== null && leadingSet.has(a.sector)))
    .map((a) => a.ticker)
    .sort((x, y) => x.localeCompare(y));

  // gated = sector∈leading AND 비-열화(active tf 중 하나라도 available). D-2/D-10.
  const gated = allAgg.filter(
    (a) =>
      a.sector !== null &&
      leadingSet.has(a.sector) &&
      activeTfs.some((tf) => isTier1Available(a, tf))
  );

  // production 시퀀스 재현: primary(기존 primary_timeframe로 group) → global backfill.
  const byPrimary: Record<Timeframe, TickerAggregate[]> = { short: [], mid: [], long: [] };
  for (const a of gated) byPrimary[a.primary_timeframe].push(a);

  const primarySelected: Record<Timeframe, TickerAggregate[]> = { short: [], mid: [], long: [] };
  for (const tf of activeTfs) {
    primarySelected[tf] = [...byPrimary[tf]].sort((a, b) => compareForTimeframe(a, b, tf)).slice(0, 10);
  }
  const primaryTickers = new Set(activeTfs.flatMap((tf) => primarySelected[tf]).map((a) => a.ticker));
  const globalPool = gated.filter((a) => !primaryTickers.has(a.ticker));

  const backfilled: Record<Timeframe, TickerAggregate[]> = { short: [], mid: [], long: [] };
  for (const tf of activeTfs) {
    const needed = 10 - primarySelected[tf].length;
    if (needed <= 0) continue;
    globalPool.sort((a, b) => compareForTimeframe(a, b, tf));
    backfilled[tf] = globalPool.splice(0, needed);
  }

  const selected: SelectedRow[] = [];
  let underfill = false;
  for (const tf of activeTfs) {
    for (const a of primarySelected[tf]) selected.push(projectRow(a, tf, 'primary'));
    for (const a of backfilled[tf]) selected.push(projectRow(a, tf, 'backfill'));
    if (primarySelected[tf].length + backfilled[tf].length < 10) underfill = true;
  }

  return {
    arm: 'candidate-pool-hard-gate',
    status: underfill ? 'incomplete_run' : 'logged',
    selected,
    reservePicks: [],
    counterfactualCut,
    sectorDistribution: sectorDistributionOf(selected),
    error: underfill ? 'hard-gate underfilled active timeframe(s) after sector cut' : null,
  };
}

// ============================================================================
// Public entry — computeArmSelections
// ============================================================================

/**
 * Track 1 in-pool 30-reranking shadow의 순수 compute (spec §4). 4 arm 모두 1회 호출에 산출.
 *
 * DB/LLM/입력 mutation 없음. 결정론. PASS/FAIL·claim 산출 안 함(stage 0 관측).
 *
 * @throws ShadowArmInputError — 잘못된 config/inputs(§4 검증). hard-gate underfill은 throw가 아니라
 *   해당 arm의 status='incomplete_run'(다른 arm은 계속 logged).
 */
export function computeArmSelections(input: unknown): ComputeArmSelectionsResult {
  validateInput(input);
  const { track, periodKey, productionResult, candidates, sectorView, regime, shadowEvalK } = input;

  const activeTfs = TRACK_TIMEFRAMES[track];
  const leadingSet: ReadonlySet<string> = new Set(sectorView.leadingSectors);

  // 단일 재정렬 substrate(D-1) = selected ∪ notSelected의 TickerAggregate map.
  const aggregatePool = new Map<string, TickerAggregate>();
  for (const a of productionResult.selected) aggregatePool.set(a.ticker, a);
  for (const a of productionResult.notSelected) aggregatePool.set(a.ticker, a);

  const effectiveK = shadowEvalK;
  // regime arm effective K: absent → 0(mirror). manual → shadowEvalK × multiplier[stage](bear=0=plumbing).
  const regimeEffectiveK =
    regime && regime.source === 'manual_pre_registered'
      ? shadowEvalK * REGIME_K_MULTIPLIER_V1[regime.stage]
      : 0;

  const arms: ArmSelectionResult[] = [
    armProductionSnapshot(productionResult),
    softReserveArm('sector-soft-reserve', productionResult, aggregatePool, activeTfs, leadingSet, effectiveK),
    softReserveArm(
      'regime-sector-soft-reserve',
      productionResult,
      aggregatePool,
      activeTfs,
      leadingSet,
      regimeEffectiveK
    ),
    hardGateArm(productionResult, aggregatePool, activeTfs, leadingSet),
  ];

  return {
    track,
    periodKey,
    poolSize: candidates.length,
    effectiveK,
    regimeEffectiveK,
    arms,
  };
}
