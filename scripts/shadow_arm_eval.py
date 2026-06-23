#!/usr/bin/env python3
# noqa: SIZE_OK - PR-A5 sibling evaluator is intentionally isolated from frozen validate_tier0_ic funcs.
"""주픽(JooPick) — Track 1 in-pool 30-reranking forward VERDICT evaluator (PR-A5).

SoT: docs/superpowers/specs/2026-06-23-pathA-track1-pra5-verdict-evaluator.md (CONVERGED)
     + parent docs/superpowers/specs/2026-06-19-pathA-forward-shadow-sector-layer.md §6/§6.1~§6.6/§10(PR-A5).

WHAT THIS IS: a post-process forward-VERDICT evaluator for the Track 1 worker-pool in-pool
30-reranking shadow (shadow_arm_log, migration 0038). It reads owner/service-role-psql-extracted
arm facts (JSON ARRAY of per-period objects), recomputes per-pick forward returns on the KRX PIT
panel via the ALREADY-BUILT validate_tier0_ic forward engine, and produces the USER-locked
**per-timeframe paired arm-vs-production-snapshot return-lift + hit-rate** verdict. Emits a report
FILE. Never writes a DB. Never emits PASS before the floors + survivorship + beta-orthogonalization.

ARCHITECTURE: SIBLING module (NOT inlined into validate_tier0_ic.py — PR-B5 §3.3 / shadow_eval.py
pattern). It imports validate_tier0_ic as V to REUSE its leaf functions verbatim (compute_forward_return,
top_decile_winners, panel_trading_days, _ci90, _mean, _first_price_from, F.quantile/spearman_ic).
validate_tier0_ic's frozen B+C path (process_month/aggregate_harvest/harvest_pit_months) is
byte-unchanged; the only edit there is the --shadow-arm-eval argparse flags + a thin early-return
dispatch into this module (default OFF).

INVARIANTS (do NOT violate — parent §0/§1/§6, PR-A5 §0):
  - production effect 0: no production write, no shadow write; owner/service-role psql JSON is operator-fed.
  - forward-only: shadow_arm_log exists only for FORWARD_SHADOW_ENABLED periods; no PIT backfill.
  - NOT 150-recall: Track 1 measures worker-pool IN-POOL 30-reranking only — metric vocab is
    per-timeframe mean forward return lift + market-winner hit-rate (precision); NEVER "recall".
  - production K=0: arm == production-snapshot (K=0/absent plumbing) ⇒ NOT_APPLICABLE_PLUMBING_ONLY
    (structural lift 0; NOT "no effect").
  - DATA floor n>=6 ; VERDICT floor pre-registered power_floor_n (n<power_floor_n ⇒ DIRECTIONAL never PASS).
  - Gate B full (rank skill) is structurally NOT_APPLICABLE in Stage-1 (no baseline/sleeve metadata) ⇒
    full triple-gate PASS is structurally unreachable; cell ceiling = DIRECTIONAL_GATE_B_NA.
  - regime/beta confound is a HARD blocker: single-regime OR non-positive beta-orthogonalized lift ⇒ no PASS.
  - claim discipline (parent §6.6): pre valid-PASS vocab cap = "in-pool 30-reranking forward observation
    (verification pending)". Stage-1 ⇒ DIRECTIONAL observation is the ceiling.
This module performs NO DB write.
"""
from __future__ import annotations

import json
import math
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Optional, Sequence

import validate_tier0_ic as V          # leaf reuse (forward engine, winners, CI, mean, quantile)
import tier0_factors as F              # spearman_ic / quantile

_NAN = math.nan
_PICKS_PER_TF = 10                     # §0.1 each (arm,timeframe) carries exactly 10 picks
_WINNERS_FLOOR = 10                    # §5 per-period |winners|>=10 (top_decile_winners needs >=10)
_DATA_FLOOR = 6                        # §4 n_periods>=6 data-existence floor
_BASELINE = "production-snapshot"      # §0.1 paired baseline arm (immutable)
_NON_BASELINE = ("sector-soft-reserve", "regime-sector-soft-reserve", "candidate-pool-hard-gate")
_ALL_ARMS = (_BASELINE, *_NON_BASELINE)
_HARD_GATE = "candidate-pool-hard-gate"
_CANONICAL_TIMEFRAMES = ("short", "mid", "long")
# §0.1 / 0038 selected purity: short track carries only the `short` timeframe; midlong carries mid+long.
_TIMEFRAMES_BY_TRACK: dict[str, tuple[str, ...]] = {"short": ("short",), "midlong": ("mid", "long")}
PANEL_ABSENT_MAX = 0.10                # §2.2 panel-integrity tripwire (PR-B5 §14.3 parity); probe binding.
_CANONICAL_SECTORS = frozenset((
    "바이오", "반도체", "건설", "금융", "2차전지", "자동차", "IT/SW", "유통/소비재",
    "에너지", "엔터/미디어", "통신", "철강/소재", "운송/물류", "보험/증권",
))

# §6.5 closed reason-code set — every §5 branch maps to exactly one of these. (Spec §6.5 listed
# `power_floor_n_below` under INCOMPLETE_RUN, but §4/§5 are authoritative that n<power_floor_n ⇒
# DIRECTIONAL_POWER_FLOOR, never INCOMPLETE — the doc carries a §6.5 correction note; the code emits
# DIRECTIONAL_POWER_FLOOR. `winners_below_floor` and `arm_incomplete_run` are reachable cell reasons
# (see _insufficiency_reason). The INVALID_INPUT-family entries are ShadowArmEvalInputError message
# prefixes [different namespace from cell reason_codes]; gate_c_claimed_no_metadata is the reserved
# INVALID_INPUT guard for a future sleeve-claim path.)
REASON_CODES = frozenset((
    # INCOMPLETE_RUN family (cell + run level)
    "n_below_data_floor", "winners_below_floor", "arm_incomplete_run", "forward_insufficient",
    "asof_stale", "run_date_stale", "survivorship_failed", "panel_survivorship_unverified",
    "no_eligible_periods", "reconcile_partial", "reconcile_missing", "reconcile_anomaly",
    # terminal/run-level
    "INCOMPLETE_RUN_PLUMBING_ONLY",
    # DIRECTIONAL family
    "DIRECTIONAL_POWER_FLOOR", "DIRECTIONAL_GATE_B_NA",
    "DIRECTIONAL_BETA_UNVERIFIED", "DIRECTIONAL_BETA_BLOCKED",
    # NOT_APPLICABLE
    "NOT_APPLICABLE_PLUMBING_ONLY",
    # INVALID_INPUT family (ShadowArmEvalInputError message prefixes)
    "malformed_row", "cross_period", "regime_unregistered", "triple_gate_inconsistent",
    "gate_c_claimed_no_metadata",
))


class ShadowArmEvalInputError(ValueError):
    """PR-A5 fail-closed boundary: malformed owner/service-role psql JSON facts / kill-rule / artifact.
    Mirrors shadow_eval.ShadowEvalInputError + shadow_arm_reconcile.ShadowArmReconcileInputError.
    The dispatch in validate_tier0_ic.main() treats it as a hard abort (no verdict, never coerce)."""


# ===========================================================================
# fail-closed extractors (feedback_failclosed_symmetric_completion): type-check
# every boundary field BEFORE use; no truthiness `or {}`; reject wrong type.
# ===========================================================================
def _require_dict(v: Any, what: str) -> dict:
    if not isinstance(v, dict):
        raise ShadowArmEvalInputError(f"{what} must be dict, got {type(v).__name__}")
    return v


def _require_list(v: Any, what: str) -> list:
    if not isinstance(v, list):
        raise ShadowArmEvalInputError(f"{what} must be list, got {type(v).__name__}")
    return v


def _get(d: dict, k: str, what: str) -> Any:
    if k not in d:
        raise ShadowArmEvalInputError(f"{what}: missing '{k}'")
    return d[k]


def _str(d: dict, k: str, what: str) -> str:
    v = _get(d, k, what)
    if not isinstance(v, str):
        raise ShadowArmEvalInputError(f"{what}: '{k}' must be str, got {type(v).__name__}")
    return v


def _nonempty_str(d: dict, k: str, what: str) -> str:
    v = _str(d, k, what)
    if v == "":
        raise ShadowArmEvalInputError(f"{what}: '{k}' must not be empty")
    return v


def _str_or_none(d: dict, k: str, what: str) -> Optional[str]:
    v = _get(d, k, what)
    if v is None or isinstance(v, str):
        return v
    raise ShadowArmEvalInputError(f"{what}: '{k}' must be str|null, got {type(v).__name__}")


def _nonempty_str_or_none(d: dict, k: str, what: str) -> Optional[str]:
    v = _str_or_none(d, k, what)
    if v == "":
        raise ShadowArmEvalInputError(f"{what}: '{k}' must not be empty")
    return v


def _int(d: dict, k: str, what: str) -> int:
    v = _get(d, k, what)
    if isinstance(v, bool) or not isinstance(v, int):   # bool is an int subclass — reject
        raise ShadowArmEvalInputError(f"{what}: '{k}' must be int, got {type(v).__name__}")
    if v < 0:
        raise ShadowArmEvalInputError(f"{what}: '{k}' must be >=0, got {v}")
    return v


def _number(d: dict, k: str, what: str) -> float:
    v = _get(d, k, what)
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        raise ShadowArmEvalInputError(f"{what}: '{k}' must be number, got {type(v).__name__}")
    f = float(v)
    if not math.isfinite(f):
        raise ShadowArmEvalInputError(f"{what}: '{k}' must be finite, got {v}")
    return f


def _number_or_none(d: dict, k: str, what: str) -> Optional[float]:
    v = _get(d, k, what)
    if v is None:
        return None
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        raise ShadowArmEvalInputError(f"{what}: '{k}' must be number|null, got {type(v).__name__}")
    f = float(v)
    if not math.isfinite(f):
        raise ShadowArmEvalInputError(f"{what}: '{k}' must be finite|null, got {v}")
    return f


def _list_of_str(d: dict, k: str, what: str) -> tuple:
    v = _get(d, k, what)
    if not isinstance(v, list):
        raise ShadowArmEvalInputError(f"{what}: '{k}' must be list, got {type(v).__name__}")
    out: list[str] = []
    for i, el in enumerate(v):
        if not isinstance(el, str):
            raise ShadowArmEvalInputError(f"{what}: '{k}'[{i}] must be str, got {type(el).__name__}")
        out.append(el)
    return tuple(out)


def _parse_iso_day(value: str, what: str) -> date:
    if not isinstance(value, str):
        raise ShadowArmEvalInputError(f"{what} must be a string")
    if value == "":
        raise ShadowArmEvalInputError(f"{what} must not be empty")
    try:
        if len(value) == 10:
            return date.fromisoformat(value)
        return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
    except ValueError as exc:
        raise ShadowArmEvalInputError(f"{what} must be ISO date/timestamp, got {value!r}") from exc


# ===========================================================================
# period_key helpers (0038 CHECK: short `s:YYYY-MM-DD`, midlong `m:YYYY-MM`)
# ===========================================================================
def _is_short_pk(pk: str) -> bool:
    if not (pk.startswith("s:") and len(pk) == 12):
        return False
    body = pk[2:]
    return len(body) == 10 and body[4] == "-" and body[7] == "-" and body.replace("-", "").isdigit()


def _is_midlong_pk(pk: str) -> bool:
    if not (pk.startswith("m:") and len(pk) == 9):
        return False
    body = pk[2:]
    return len(body) == 7 and body[4] == "-" and body.replace("-", "").isdigit()


def _track_of(pk: str) -> str:
    if _is_short_pk(pk):
        return "short"
    if _is_midlong_pk(pk):
        return "midlong"
    raise ShadowArmEvalInputError(f"bad period_key {pk!r}")


def _selection_date(pk: str) -> str:
    """Selection anchor (= period start) → YYYY-MM-DD. short `s:YYYY-MM-DD` is the KST Monday;
    midlong `m:YYYY-MM` anchors at the 1st (parity shadow-harness-arms periodAnchorInstant)."""
    if _is_short_pk(pk):
        return pk[2:]
    if _is_midlong_pk(pk):
        return f"{pk[2:]}-01"
    raise ShadowArmEvalInputError(f"bad period_key {pk!r}")


# ===========================================================================
# Query — owner/service-role psql shadow-arm extract (per period; $1=period_key)
# ===========================================================================
SHADOW_ARM_EXTRACT_SQL = """\
-- PR-A5 owner/service-role-psql shadow-arm extract for ONE period ($1=period_key).
-- RAW FACTS only; classification/scoring in pure Python (shadow_arm_eval). 0038 grants service_role
-- SELECT (Track-1 §5.2), so this runs on owner OR service-role psql. READ-ONLY (no INSERT/UPDATE/DELETE,
-- no SKIP LOCKED, no FOR UPDATE). period_key alone determines track (0038 CHECK enforces prefix↔track),
-- so the 0038 `month` column is intentionally NOT selected — period_key is the sole authority for
-- track/selection-date and month carries no metric signal (the parser re-derives both from period_key).
with arm_rows as materialized (
  select period_key, track, arm, status, run_date, shadow_eval_k,
         sector_view, regime_context, selected, counterfactual_cut
  from public.shadow_arm_log
  where period_key = $1
)
select json_build_object(
  'period_key', $1,
  'arms', coalesce((select json_agg(arm_rows) from arm_rows), '[]'::json)
);
"""


def shadow_arm_sql_inline() -> str:
    """Single-line (comment-stripped, no trailing ';') form for json_agg wrapping / smoke."""
    body = [ln for ln in SHADOW_ARM_EXTRACT_SQL.splitlines() if not ln.lstrip().startswith("--")]
    return " ".join(ln.strip() for ln in body if ln.strip()).rstrip(";")


# ===========================================================================
# parsed shapes
# ===========================================================================
@dataclass
class _ArmFacts:
    arm: str
    status: str                        # logged | invalid_input | incomplete_run
    picks_by_tf: dict                  # tf -> tuple[str] (ordered selected tickers)
    score_by_tf: dict                  # tf -> {ticker: weighted_score}  (co-gate IC input)
    counterfactual_cut: set            # hard-gate only
    sector_source: str                 # sector_view.source ('absent'|'manual_pre_registered')


@dataclass
class ShadowArmExtract:
    period_key: str
    track: str
    per_arm: dict                      # arm -> _ArmFacts
    sector_source: str                 # period-level (production-snapshot's, else absent)
    leading_sectors: tuple
    sector_as_of: Optional[str]
    regime_source: str
    regime_stage: Optional[str]
    regime_as_of: Optional[str]
    run_date: Optional[str]            # min run_date across logged rows (legacy summary)
    sector_as_ofs: tuple = ()          # all manual sector asOf dates (staleness: ANY stale excludes period)
    regime_as_ofs: tuple = ()          # all manual regime asOf dates (staleness: ANY stale excludes period)
    run_dates: tuple = ()              # all logged-row run_date dates (staleness: ANY stale excludes period)


def _parse_selected(raw: Any, *, arm: str, track: str, status: str) -> tuple[dict, dict]:
    """selected jsonb (SelectedRow[]) → (picks_by_tf {tf: tuple}, score_by_tf {tf: {tk: ws}}).
    Validates ticker/assigned_timeframe/weighted_score/sector/assigned_by + active-tf purity + distinct.
    For status='logged' enforces per-tf count==10 (0038 RPC parity); looser otherwise."""
    rows = _require_list(raw, f"{arm}.selected")
    valid_tfs = _TIMEFRAMES_BY_TRACK[track]
    picks: dict[str, list[str]] = {tf: [] for tf in valid_tfs}
    scores: dict[str, dict[str, float]] = {tf: {} for tf in valid_tfs}
    seen: set[str] = set()
    for i, r in enumerate(rows):
        what = f"{arm}.selected[{i}]"
        _require_dict(r, what)
        tk = _str(r, "ticker", what)
        if not (len(tk) == 6 and tk.isdigit()):
            raise ShadowArmEvalInputError(f"{what}: ticker must be 6-digit, got {tk!r}")
        tf = _str(r, "assigned_timeframe", what)
        if tf not in _CANONICAL_TIMEFRAMES:
            raise ShadowArmEvalInputError(f"{what}: bad assigned_timeframe {tf!r}")
        if tf not in valid_tfs:                          # active-tf purity vs track (0038 CHECK parity)
            raise ShadowArmEvalInputError(f"malformed_row: {what} timeframe {tf!r} not active in track {track!r}")
        assigned_by = _str(r, "assigned_by", what)
        if assigned_by not in ("primary", "backfill", "reserve"):
            raise ShadowArmEvalInputError(f"{what}: bad assigned_by {assigned_by!r}")
        ws = _number(r, "weighted_score", what)
        sec = _get(r, "sector", what)
        if not (sec is None or (isinstance(sec, str) and sec in _CANONICAL_SECTORS)):
            raise ShadowArmEvalInputError(f"{what}: sector must be canonical|null, got {sec!r}")
        if tk in seen:
            raise ShadowArmEvalInputError(f"malformed_row: {arm} duplicate ticker {tk!r}")
        seen.add(tk)
        picks[tf].append(tk)
        scores[tf][tk] = ws
    if status == "logged":
        for tf in valid_tfs:
            if len(picks[tf]) != _PICKS_PER_TF:
                raise ShadowArmEvalInputError(
                    f"malformed_row: logged {arm} timeframe {tf!r} has {len(picks[tf])} picks, expected {_PICKS_PER_TF}")
    return {tf: tuple(picks[tf]) for tf in valid_tfs}, scores


def _parse_extract_one(obj: dict) -> ShadowArmExtract:
    _require_dict(obj, "extract period")
    period_key = _str(obj, "period_key", "extract")
    track = _track_of(period_key)                         # raises on bad pk
    arms_raw = _require_list(_get(obj, "arms", "extract"), "extract.arms")

    per_arm: dict[str, _ArmFacts] = {}
    sector_source = "absent"
    leading_sectors: tuple = ()
    sector_as_of: Optional[str] = None
    sector_keys: set[tuple[tuple, str]] = set()
    sector_as_ofs: list[str] = []
    regime_source = "absent"
    regime_stage: Optional[str] = None
    regime_as_of: Optional[str] = None
    regime_keys: set[tuple[str, str]] = set()
    regime_as_ofs: list[str] = []
    run_dates: list[str] = []

    for j, row in enumerate(arms_raw):
        what = f"extract.arms[{j}]"
        _require_dict(row, what)
        arm = _str(row, "arm", what)
        if arm not in _ALL_ARMS:
            raise ShadowArmEvalInputError(f"{what}: bad arm {arm!r}")
        if arm in per_arm:
            raise ShadowArmEvalInputError(f"malformed_row: duplicate arm {arm!r} in {period_key!r}")
        row_track = _str(row, "track", what)
        if row_track != track:
            raise ShadowArmEvalInputError(f"cross_period: {what} track {row_track!r} != period track {track!r}")
        status = _str(row, "status", what)
        if status not in ("logged", "invalid_input", "incomplete_run"):
            raise ShadowArmEvalInputError(f"{what}: bad status {status!r}")
        picks_by_tf, score_by_tf = _parse_selected(_get(row, "selected", what),
                                                   arm=arm, track=track, status=status)
        # sector_view (source + leadingSectors + asOf)
        sv = _require_dict(_get(row, "sector_view", what), f"{what}.sector_view")
        sv_source = _str(sv, "source", f"{what}.sector_view")
        if sv_source not in ("absent", "manual_pre_registered"):
            raise ShadowArmEvalInputError(f"{what}.sector_view: bad source {sv_source!r}")
        sv_leading = _list_of_str(sv, "leadingSectors", f"{what}.sector_view")
        for s in sv_leading:
            if s not in _CANONICAL_SECTORS:
                raise ShadowArmEvalInputError(f"{what}.sector_view: non-canonical sector {s!r}")
        sv_asof = _nonempty_str_or_none(sv, "asOf", f"{what}.sector_view") if "asOf" in sv else None
        if sv_source == "absent" and sv_leading:
            raise ShadowArmEvalInputError(f"{what}.sector_view: absent source must have empty leadingSectors")
        if sv_source == "manual_pre_registered":
            if not sv_leading:
                raise ShadowArmEvalInputError(f"{what}.sector_view: manual source requires leadingSectors")
            if sv_asof is None:
                raise ShadowArmEvalInputError(f"{what}.sector_view: manual source requires asOf")
            sv_asof_day = _parse_iso_day(sv_asof, f"{what}.sector_view.asOf").isoformat()
            sector_keys.add((sv_leading, sv_asof_day))
            sector_as_ofs.append(sv_asof_day)
        # counterfactual_cut (hard-gate only; symmetric type-check regardless)
        cut_raw = _get(row, "counterfactual_cut", what)
        cut: set[str] = set()
        if cut_raw is not None:
            cut_list = _require_list(cut_raw, f"{what}.counterfactual_cut")
            for ci, el in enumerate(cut_list):
                if not isinstance(el, str):
                    raise ShadowArmEvalInputError(
                        f"{what}.counterfactual_cut[{ci}] must be str, got {type(el).__name__}")
                if not (len(el) == 6 and el.isdigit()):
                    raise ShadowArmEvalInputError(
                        f"malformed_row: {what}.counterfactual_cut[{ci}] must be 6-digit ticker, got {el!r}")
                if el in cut:
                    raise ShadowArmEvalInputError(
                        f"malformed_row: {what}.counterfactual_cut duplicate ticker {el!r}")
                cut.add(el)
        if cut and arm != _HARD_GATE:
            raise ShadowArmEvalInputError(f"malformed_row: non-hard-gate arm {arm!r} carries counterfactual_cut")
        # regime_context (optional; only the regime arm/baseline carry it but type-check uniformly)
        rc_raw = _get(row, "regime_context", what) if "regime_context" in row else None
        if rc_raw is not None:
            rc = _require_dict(rc_raw, f"{what}.regime_context")
            rc_source = _str(rc, "source", f"{what}.regime_context")
            if rc_source not in ("absent", "manual_pre_registered"):
                raise ShadowArmEvalInputError(f"{what}.regime_context: bad source {rc_source!r}")
            if rc_source == "manual_pre_registered":
                rc_stage = _str(rc, "stage", f"{what}.regime_context")
                if rc_stage not in ("bear", "sideways", "bull"):
                    raise ShadowArmEvalInputError(f"{what}.regime_context: bad stage {rc_stage!r}")
                rc_asof = _nonempty_str(rc, "asOf", f"{what}.regime_context")
                rc_asof_day = _parse_iso_day(rc_asof, f"{what}.regime_context.asOf").isoformat()
                regime_keys.add((rc_stage, rc_asof_day))
                regime_as_ofs.append(rc_asof_day)
        # run_date: 0038 column is NOT NULL — fail closed if a logged arm row omits it (a hand-fed
        # extract dropping run_date must NOT silently disable the run_date_stale guard, §6.5).
        if status == "logged":
            run_date = _nonempty_str(row, "run_date", what)
            run_dates.append(_parse_iso_day(run_date, f"{what}.run_date").isoformat())
        per_arm[arm] = _ArmFacts(arm=arm, status=status, picks_by_tf=picks_by_tf,
                                 score_by_tf=score_by_tf, counterfactual_cut=cut, sector_source=sv_source)

    # The SQL json_agg has no ORDER BY; if arm metadata diverges, choosing "first manual row" would make
    # the verdict input-order dependent. The production logger writes one run-level sector/regime config to
    # every arm, so divergence is malformed/tampered hand-fed input and must fail closed.
    if len(sector_keys) > 1:
        raise ShadowArmEvalInputError("malformed_row: sector_view_mismatch_across_arms")
    if len(regime_keys) > 1:
        raise ShadowArmEvalInputError("malformed_row: regime_context_mismatch_across_arms")
    if sector_keys:
        leading_sectors, sector_as_of = next(iter(sector_keys))
        sector_source = "manual_pre_registered"
    if regime_keys:
        regime_stage, regime_as_of = next(iter(regime_keys))
        regime_source = "manual_pre_registered"

    return ShadowArmExtract(
        period_key=period_key, track=track, per_arm=per_arm,
        sector_source=sector_source, leading_sectors=leading_sectors, sector_as_of=sector_as_of,
        regime_source=regime_source, regime_stage=regime_stage, regime_as_of=regime_as_of,
        run_date=(min(run_dates) if run_dates else None),
        sector_as_ofs=tuple(sorted(set(sector_as_ofs))),
        regime_as_ofs=tuple(sorted(set(regime_as_ofs))),
        run_dates=tuple(sorted(set(run_dates))))


def parse_shadow_arm_extract(arr: Any) -> dict:
    """Top-level JSON = ARRAY of per-period extract objects → {period_key: ShadowArmExtract}."""
    arr = _require_list(arr, "shadow-arm-extract-json")
    out: dict = {}
    for obj in arr:
        ext = _parse_extract_one(obj)
        if ext.period_key in out:
            raise ShadowArmEvalInputError(f"duplicate period_key in extract: {ext.period_key!r}")
        out[ext.period_key] = ext
    return out


# ===========================================================================
# reconcile coverage (PR-A4 classify_coverage_row output) → eligible 'complete' set
# ===========================================================================
def _eligible_set(coverage: Any) -> dict:
    """PR-A4 reconcile report → {period_key: status} for ALL rows; only 'complete' periods score.
    PR-A4 statuses = complete|partial|missing|anomaly (NOTE: superset of PR-B5's complete|missing|anomaly)."""
    cov = _require_dict(coverage, "coverage")
    rows = _require_list(_get(cov, "rows", "coverage"), "coverage.rows")
    out: dict[str, str] = {}
    for i, p in enumerate(rows):
        row = _require_dict(p, f"coverage.rows[{i}]")
        pk = _str(row, "period_key", f"coverage.rows[{i}]")
        pk_track = _track_of(pk)
        if "track" in row:
            row_track = _str(row, "track", f"coverage.rows[{i}]")
            if row_track != pk_track:
                raise ShadowArmEvalInputError(
                    f"cross_period: coverage.rows[{i}] track {row_track!r} != period track {pk_track!r}")
        status = _str(row, "status", f"coverage.rows[{i}]")
        if status not in ("complete", "partial", "missing", "anomaly"):
            raise ShadowArmEvalInputError(f"coverage.rows[{i}]: bad status {status!r}")
        if pk in out:                                    # fail-closed: no last-write-wins on conflicting dup
            raise ShadowArmEvalInputError(f"malformed_row: duplicate period_key in coverage.rows: {pk!r}")
        out[pk] = status
    return out


# ===========================================================================
# kill-rule (frozen pre-registration, §6.5)
# ===========================================================================
def _track_config(kill_rule: dict, track: str) -> int:
    kr = _require_dict(kill_rule, "kill_rule")
    tracks = _require_dict(_get(kr, "tracks", "kill_rule"), "kill_rule.tracks")
    if track not in tracks:
        raise ShadowArmEvalInputError(f"kill_rule.tracks missing track {track!r}")
    cfg = _require_dict(tracks[track], f"kill_rule.tracks[{track}]")
    power_floor_n = _int(cfg, "power_floor_n", f"kill_rule.tracks[{track}]")
    if power_floor_n < _DATA_FLOOR:
        raise ShadowArmEvalInputError(f"kill_rule.tracks[{track}]: power_floor_n must be >= {_DATA_FLOOR}")
    return power_floor_n


def _fwer_family_m(kill_rule: dict) -> int:
    kr = _require_dict(kill_rule, "kill_rule")
    m = _int(kr, "fwer_family_m", "kill_rule")
    if m < 1:
        raise ShadowArmEvalInputError("kill_rule.fwer_family_m must be >= 1")
    return m


def _run_date_stale_max_days(kill_rule: dict) -> int:
    return _int(_require_dict(kill_rule, "kill_rule"), "run_date_stale_max_days", "kill_rule")


def _require_regime(kill_rule: dict, period_key: str) -> str:
    kr = _require_dict(kill_rule, "kill_rule")
    rbp = _get(kr, "regime_by_period_key", "kill_rule")
    vocab = _get(kr, "regime_vocab", "kill_rule")
    if not isinstance(rbp, dict) or not isinstance(vocab, list):
        raise ShadowArmEvalInputError("kill_rule.regime_by_period_key/regime_vocab missing or wrong-type")
    for i, v in enumerate(vocab):
        if not isinstance(v, str):
            raise ShadowArmEvalInputError(f"kill_rule.regime_vocab[{i}] must be str, got {type(v).__name__}")
    if period_key not in rbp:
        raise ShadowArmEvalInputError(f"regime_unregistered: {period_key!r}")
    reg = rbp[period_key]
    if not isinstance(reg, str):
        raise ShadowArmEvalInputError(f"kill_rule.regime_by_period_key[{period_key!r}] must be str")
    if reg not in vocab:
        raise ShadowArmEvalInputError(f"regime_unregistered: {reg!r} not in vocab")
    return reg


def _benchmark_return(kill_rule: dict, period_key: str, tf: str) -> Optional[float]:
    """§4 leading-sector cap-weighted benchmark forward return x_p, pre-registered per (period, tf).
    Absent (missing period/tf or explicit null) → None ⇒ the beta co-metric is unverified."""
    kr = _require_dict(kill_rule, "kill_rule")
    if "leading_sectors_benchmark" not in kr:
        return None
    lsb = _require_dict(_get(kr, "leading_sectors_benchmark", "kill_rule"), "kill_rule.leading_sectors_benchmark")
    by_pk = _require_dict(_get(lsb, "by_period_key", "kill_rule.leading_sectors_benchmark"),
                          "kill_rule.leading_sectors_benchmark.by_period_key")
    if period_key not in by_pk:
        return None
    per_tf = _require_dict(by_pk[period_key], f"leading_sectors_benchmark.by_period_key[{period_key!r}]")
    if tf not in per_tf:
        return None
    return _number_or_none(per_tf, tf, f"leading_sectors_benchmark.by_period_key[{period_key!r}]")


# ===========================================================================
# survivorship artifact (§2) — bracket assertion, fail-closed (PR-B5 read_survivorship_artifact parity)
# ===========================================================================
def _yyyymmdd(d: str) -> str:
    try:
        if len(d) == 8 and d.isdigit():
            date.fromisoformat(f"{d[:4]}-{d[4:6]}-{d[6:8]}")
            return d
        if len(d) == 10 and d[4] == "-" and d[7] == "-":
            return date.fromisoformat(d).strftime("%Y%m%d")
    except ValueError as exc:
        raise ShadowArmEvalInputError(f"survivorship date must be YYYYMMDD or YYYY-MM-DD, got {d!r}") from exc
    raise ShadowArmEvalInputError(f"survivorship date must be YYYYMMDD or YYYY-MM-DD, got {d!r}")


def read_survivorship_artifact(arr: Any, *, forward_window: tuple) -> dict:
    """probe_pit_survivorship --emit-artifact per-market list → {exit_status, label}. The shadow path
    NEVER inherits a hardcoded 'clean…' label (PR-B5 §5.2 anchor): the label is probe-derived here.
    exit_status 0=PASS; 1/2=biased; 9=stale (OLD/RECENT do not bracket the evaluation forward window)."""
    arr = _require_list(arr, "survivorship artifact")
    if not arr:
        raise ShadowArmEvalInputError("survivorship artifact must be a non-empty list")
    start_m, end_m = forward_window
    win_lo = start_m.strftime("%Y%m%d")
    win_hi = end_m.strftime("%Y%m%d")
    parsed_rows: list[dict] = []
    markets: set[str] = set()
    for o in arr:
        _require_dict(o, "survivorship row")
        market = _str(o, "market", "survivorship")
        if market not in ("KOSPI", "KOSDAQ"):
            raise ShadowArmEvalInputError(f"survivorship: bad market {market!r}")
        if market in markets:
            raise ShadowArmEvalInputError(f"survivorship: duplicate market {market!r}")
        markets.add(market)
        _int(o, "old_count", "survivorship")
        _int(o, "recent_count", "survivorship")
        _int(o, "schema_version", "survivorship")
        old = _yyyymmdd(_str(o, "old_date", "survivorship"))
        recent = _yyyymmdd(_str(o, "recent_date", "survivorship"))
        st = _int(o, "exit_status", "survivorship")
        if st not in (0, 1, 2, 9):
            raise ShadowArmEvalInputError(f"survivorship: bad exit_status {st}")
        parsed_rows.append({"market": market, "old": old, "recent": recent, "exit_status": st})
    if markets != {"KOSPI", "KOSDAQ"}:
        raise ShadowArmEvalInputError(f"survivorship artifact must cover KOSPI and KOSDAQ, got {sorted(markets)}")
    worst = 0
    for row in parsed_rows:
        if not (row["old"] <= win_lo and row["recent"] >= win_hi):  # OLD/RECENT must bracket the window
            return {"exit_status": 9, "label": "survivorship-stale: returns=upper-bound"}
        if row["exit_status"] == 9:
            return {"exit_status": 9, "label": "survivorship-stale: returns=upper-bound"}
        worst = max(worst, row["exit_status"])
    if worst != 0:
        return {"exit_status": worst, "label": "survivorship-biased: returns=upper-bound"}
    return {"exit_status": 0, "label": "clean (probe PASS, dates bracket forward window)"}


def shadow_arm_panel_days(start_month: date, end_month: date) -> list:
    """DUPLICATE of validate_tier0_ic _build_real_providers panel-day logic — NOT a refactor of the
    frozen provider builder (PR-B5 shadow_panel_days parity). lookback(BPP_LOOKBACK_CALENDAR_DAYS) +
    +210d forward tail (load-bearing for the long 126-bar horizon maturity, §2). weekday filter."""
    import screen_shortlist_tier0 as S          # lazy, like the frozen path
    panel_start = date(start_month.year, start_month.month, 1) - timedelta(days=S.BPP_LOOKBACK_CALENDAR_DAYS)
    panel_end = min(date.today(), end_month + timedelta(days=210))
    span = (panel_end - panel_start).days + 1
    all_days = [panel_end - timedelta(days=o) for o in range(span)]
    return sorted(d.strftime("%Y%m%d") for d in all_days if d.weekday() < 5)


def shadow_arm_forward_window(extract: dict, panel, fallback: tuple[date, date]) -> tuple[date, date]:
    """min selection day → max (selection + entry + longest matured horizon) over eligible periods,
    for the survivorship bracket. Uses the LONGEST timeframe of each track (most demanding maturity)."""
    dates = V.panel_trading_days(panel)
    lo, hi = fallback
    for pk in extract:
        track = _track_of(pk)
        tfs = _TIMEFRAMES_BY_TRACK[track]
        sel_idx = _sel_idx(dates, _selection_date(pk))
        if sel_idx < 0:
            continue
        lo = min(lo, _date_of(dates[sel_idx]))
        longest = max(tfs, key=lambda t: V.HORIZON_DAYS[t])
        target_idx = sel_idx + V.ENTRY_OFFSET_DAYS + V.HORIZON_DAYS[longest] + V.ENTRY_GAP_DAYS
        if target_idx < len(dates):
            hi = max(hi, _date_of(dates[target_idx]))
    return lo, hi


# ===========================================================================
# forward engine reuse (panel + winners) — all REUSE V.*
# ===========================================================================
def _date_of(key: str) -> date:
    return date.fromisoformat(f"{key[:4]}-{key[4:6]}-{key[6:8]}")


def _sel_idx(dates: Sequence[str], sel_date_str: str) -> int:
    import bisect
    return bisect.bisect_right(list(dates), _yyyymmdd(sel_date_str)) - 1


def _horizon_matured(dates: Sequence[str], sel_idx: int, tf: str) -> bool:
    """§2: (period,tf) is evaluable only after entry(t+1)+HORIZON_DAYS[tf]+ENTRY_GAP trading bars exist."""
    need = sel_idx + V.ENTRY_OFFSET_DAYS + V.HORIZON_DAYS[tf] + V.ENTRY_GAP_DAYS
    return need < len(dates)


def _panel_universe_at(panel, dates, sel_idx: int) -> set:
    """Market-winner universe basis = tickers tradable within the entry window [t+1, t+1+ENTRY_GAP]
    (PIT-safe; no look-ahead beyond the entry-price search compute_forward_return itself uses)."""
    entry = sel_idx + V.ENTRY_OFFSET_DAYS
    lo = entry
    hi = min(entry + V.ENTRY_GAP_DAYS, len(dates) - 1)
    u: set[str] = set()
    for j in range(lo, hi + 1):
        if 0 <= j < len(dates):
            u |= set(panel.get(dates[j], {}).keys())
    return u


def _selection_universe_at(panel, dates, sel_idx: int) -> set:
    """Survivorship-gate universe = tickers TRADING AT the selection bar (sel_idx). This is the analog of
    PR-B5's logged snapshot universe (which PR-A5 has no table for). The §2.2 absent-fraction tripwire MUST
    use this (not the entry-window universe): a ticker present at selection but with no entry price (delisted
    at the turn) shows up as status='absent' here, whereas the entry-window universe is by construction the
    set that already HAS entry prices (absent≡0 there → the gate would be vacuous). PR-A5 review fix."""
    if 0 <= sel_idx < len(dates):
        return set(panel.get(dates[sel_idx], {}).keys())
    return set()


def _panel_row(panel, dates, ticker: str, idx: int):
    if idx < 0 or idx >= len(dates):
        return None
    return panel.get(dates[idx], {}).get(ticker)


def _gap_return_has_trdval(panel, dates, ticker: str, sel_idx: int, tf: str) -> bool:
    """PR-B5 parity: a 'gap' winner-basis ticker counts only if the resolved bar had trdval>0
    (silent thin-print delisting ghosts must not inflate the market-winner basket)."""
    entry_idx = sel_idx + V.ENTRY_OFFSET_DAYS
    p0, used_entry = V._first_price_from(panel, dates, ticker, entry_idx, entry_idx + V.ENTRY_GAP_DAYS)
    if V._is_nan(p0):
        return False
    target_idx = used_entry + V.HORIZON_DAYS[tf]
    for j in range(min(target_idx, len(dates) - 1), used_entry, -1):
        row = _panel_row(panel, dates, ticker, j)
        if row is not None and row.close > 0:
            return row.trdval > 0
    for j in range(target_idx + 1, len(dates)):
        row = _panel_row(panel, dates, ticker, j)
        if row is not None and row.close > 0:
            return row.trdval > 0
    return False


def _winner_universe_returns(panel, dates, tickers, sel_idx: int, tf: str) -> tuple[dict, int, int]:
    """Market-winner basis returns over the panel universe (FIX-I non-NaN, thin-gap excluded).
    Returns ({ticker: ret}, gap_count, thin_gap_excluded). PR-B5 _winner_returns parity."""
    out: dict = {}
    gap = 0
    thin = 0
    for tk in tickers:
        ret, st = V.compute_forward_return(panel, dates, tk, sel_idx, V.HORIZON_DAYS[tf])
        if st == "gap":
            gap += 1
            if not _gap_return_has_trdval(panel, dates, tk, sel_idx, tf):
                thin += 1
                continue
        if st in ("ok", "gap") and not V._is_nan(ret):
            out[tk] = ret
    return out, gap, thin


def _arm_pick_returns(panel, dates, picks: Sequence[str], sel_idx: int, tf: str) -> tuple[Optional[dict], int]:
    """Arm-pick forward returns over the FIXED 10 picks (§2 mean rule). Accept ok/gap/delisted
    (delisted value possibly DELISTING_RETURN_NO_PRICE=-1.0). Any absent/insufficient pick ⇒ (None, 0)
    (cell INCOMPLETE_RUN; never shrink the denominator below 10). Returns (returns, delisted_count) —
    delisted_count is surfaced per cell so an operator can see when a paired lift is delisting-driven
    (delisting avoidance IS real selection skill, but a single -1.0 shifts a 10-pick mean by 0.1; the
    metric stays symmetric across arms, only the transparency is added — PR-A5 review)."""
    out: dict = {}
    delisted = 0
    for tk in picks:
        ret, st = V.compute_forward_return(panel, dates, tk, sel_idx, V.HORIZON_DAYS[tf])
        if st in ("absent", "insufficient"):
            return None, 0
        if V._is_nan(ret):                                # ok/gap/delisted should be finite; guard anyway
            return None, 0
        if st == "delisted":
            delisted += 1
        out[tk] = ret
    return out, delisted


def _panel_forward_status_counts(panel, dates, tickers, sel_idx: int, tf: str) -> dict:
    counts = {st: 0 for st in ("ok", "gap", "delisted", "insufficient", "absent")}
    for tk in tickers:
        _ret, st = V.compute_forward_return(panel, dates, tk, sel_idx, V.HORIZON_DAYS[tf])
        if st not in counts:
            raise ShadowArmEvalInputError(f"unknown_forward_status: {st!r}")
        counts[st] += 1
    return counts


def _spearman_ic(score_by_ticker: dict, fwd: dict) -> float:
    """per-period co-gate rank-IC = spearman(arm selected-row weighted_score, forward return) over
    the arm's own picks present in both maps (§4 Gate-B co-gate diagnostic)."""
    common = [tk for tk in score_by_ticker if tk in fwd and not V._is_nan(fwd[tk])]
    if len(common) < 3:
        return _NAN
    return F.spearman_ic([score_by_ticker[tk] for tk in common], [fwd[tk] for tk in common])


def _ic_ir_ddof1(per_period_ics: Sequence[float]) -> float:
    """ddof=1 small-sample IR over per-period co-gate ICs (PR-B5 §4.4 parity; NOT V.ic_information_ratio)."""
    present = [v for v in per_period_ics if not V._is_nan(v)]
    if len(present) < 2:
        return _NAN
    mean = sum(present) / len(present)
    var = sum((v - mean) ** 2 for v in present) / (len(present) - 1)
    sd = math.sqrt(var)
    if sd < 1e-12:
        return math.inf if mean > 0 else (-math.inf if mean < 0 else _NAN)
    return mean / sd


# ===========================================================================
# per-period result
# ===========================================================================
@dataclass
class _ArmTfCell:
    mean_return: float = _NAN          # NaN ⇒ INCOMPLETE for this (arm,tf,period)
    hit_rate: float = _NAN
    ic: float = _NAN
    picks: frozenset = field(default_factory=frozenset)
    complete: bool = False
    status: str = "absent"             # arm row status in this period (logged|incomplete_run|invalid_input|absent)
    delisted_count: int = 0            # # of the 10 picks scored as 'delisted' (transparency, §2)


@dataclass
class ShadowArmPeriodResult:
    period_key: str
    track: str
    regime: str
    eligible: bool
    sel_idx: int = -1
    matured_tfs: set = field(default_factory=set)
    winners_by_tf: dict = field(default_factory=dict)            # tf -> set
    n_winners_by_tf: dict = field(default_factory=dict)          # tf -> int
    fwd_panel_by_tf: dict = field(default_factory=dict)          # tf -> {ticker: ret} (winner-universe)
    per_arm_tf: dict = field(default_factory=dict)               # arm -> {tf: _ArmTfCell}
    arm_status: dict = field(default_factory=dict)               # arm -> row status (for arm_incomplete_run)
    counterfactual_cut: set = field(default_factory=set)         # hard-gate
    gap_winner_count: int = 0
    thin_gap_excluded_count: int = 0
    panel_status_counts: dict = field(default_factory=dict)
    delisted_fraction: float = _NAN
    absent_fraction: float = _NAN
    reason_code: Optional[str] = None


def _period_stale_reason(ext: ShadowArmExtract, kill_rule: dict) -> Optional[str]:
    """asof_stale = a pre-registration hypothesis asOf is NOT strictly before the period anchor
    (forward-integrity; the 0038 RPC blocks this but a hand-fed extract can carry it).
    run_date_stale = the shadow row was logged > run_date_stale_max_days after the period anchor."""
    anchor = _date_of(_yyyymmdd(_selection_date(ext.period_key)))
    asofs = list(ext.sector_as_ofs or (() if ext.sector_as_of is None else (ext.sector_as_of,)))
    asofs += list(ext.regime_as_ofs or (() if ext.regime_as_of is None else (ext.regime_as_of,)))
    for asof in asofs:
        if _parse_iso_day(asof, "asOf") >= anchor:
            return "asof_stale"
    max_age = _run_date_stale_max_days(kill_rule)
    for run_date in (ext.run_dates or (() if ext.run_date is None else (ext.run_date,))):
        age = (_parse_iso_day(run_date, "run_date") - anchor).days
        if age > max_age or age < 0:
            return "run_date_stale"
    return None


def _validate_arms(arms: Sequence[str], kill_rule: Optional[dict] = None) -> tuple[str, ...]:
    raw = list(arms)
    if not raw:
        raise ShadowArmEvalInputError("malformed_row: active arms must not be empty")
    for i, arm in enumerate(raw):
        if not isinstance(arm, str):
            raise ShadowArmEvalInputError(f"malformed_row: active arms[{i}] must be str")
        if arm not in _ALL_ARMS:
            raise ShadowArmEvalInputError(f"malformed_row: unknown active arm {arm!r}")
    if len(set(raw)) != len(raw):
        raise ShadowArmEvalInputError("malformed_row: duplicate active arm")
    if _BASELINE not in raw:
        raise ShadowArmEvalInputError("malformed_row: active arms must include production-snapshot baseline")
    if not any(a != _BASELINE for a in raw):
        raise ShadowArmEvalInputError("malformed_row: active arms must include at least one non-baseline arm")
    if kill_rule is not None:
        kr = _require_dict(kill_rule, "kill_rule")
        if "arms" in kr:
            declared = _list_of_str(kr, "arms", "kill_rule")
            for arm in declared:
                if arm not in _ALL_ARMS:
                    raise ShadowArmEvalInputError(f"malformed_row: kill_rule arms contains unknown arm {arm!r}")
            missing = [arm for arm in raw if arm not in declared]
            if missing:
                raise ShadowArmEvalInputError(f"malformed_row: active arms not declared in kill_rule: {missing}")
    return tuple(raw)


def harvest_shadow_arm_periods(*, panel, extract: dict, coverage: Any, kill_rule: dict,
                               arms: Sequence[str]) -> list:
    """Per eligible 'complete' period: build SHARED frozen market-winner baskets on the panel universe
    (identical object across arms), compute per-(arm,tf) mean return / hit-rate / co-gate IC. No DB write."""
    arms = _validate_arms(arms, kill_rule)
    dates = V.panel_trading_days(panel)
    cov_status = _eligible_set(coverage)
    out: list = []
    for pk, ext in extract.items():
        track = ext.track
        # reconcile-status FIRST (before _require_regime) so an incomplete (partial/missing/anomaly) period
        # that legitimately lacks a pre-registered regime is EXCLUDED (INCOMPLETE, never 0) rather than
        # aborting the whole run as INVALID_INPUT (PR-A5 review: regime is required only for 'complete').
        status = cov_status.get(pk)
        if status is None:
            raise ShadowArmEvalInputError(f"malformed_row: coverage missing period_key {pk!r}")
        if status != "complete":                          # partial/missing/anomaly → INCOMPLETE, never 0
            reason = {"partial": "reconcile_partial", "missing": "reconcile_missing",
                      "anomaly": "reconcile_anomaly"}[status]
            out.append(ShadowArmPeriodResult(pk, track, "", eligible=False, reason_code=reason))
            continue
        missing_raw = [a for a in _ALL_ARMS if a not in ext.per_arm]
        if missing_raw or ext.per_arm[_BASELINE].status != "logged":
            raise ShadowArmEvalInputError(
                f"malformed_row: coverage complete but extract is not a complete 4-arm logged-baseline period: "
                f"missing={missing_raw}, baseline_status={ext.per_arm.get(_BASELINE).status if _BASELINE in ext.per_arm else None}")
        regime = _require_regime(kill_rule, pk)           # only complete periods must be pre-registered
        stale = _period_stale_reason(ext, kill_rule)
        if stale is not None:
            out.append(ShadowArmPeriodResult(pk, track, regime, eligible=False, reason_code=stale))
            continue
        sel_idx = _sel_idx(dates, _selection_date(pk))
        if sel_idx < 0:
            out.append(ShadowArmPeriodResult(pk, track, regime, eligible=False,
                                             reason_code="forward_insufficient"))
            continue
        tfs = _TIMEFRAMES_BY_TRACK[track]
        matured = {tf for tf in tfs if _horizon_matured(dates, sel_idx, tf)}
        universe = _panel_universe_at(panel, dates, sel_idx)          # winner basis (entry-tradable)
        sel_universe = _selection_universe_at(panel, dates, sel_idx)  # survivorship-gate basis (at selection)
        # no matured tf, or a degenerate empty universe (real KRX gap / partial harvest near the panel tail)
        # → forward_insufficient, NOT silently eligible-with-NaN (the §2.2 survivorship gate must never be
        # bypassed by an empty universe; PR-A5 review).
        if not matured or not universe or not sel_universe:
            out.append(ShadowArmPeriodResult(pk, track, regime, eligible=False, sel_idx=sel_idx,
                                             reason_code="forward_insufficient"))
            continue
        # panel-coverage survivorship gate (§2.2) over the SELECTION-bar universe on the longest matured tf
        # (so a selection-time ticker silently absent at entry = delisted-at-turn is detectable).
        longest = max(matured, key=lambda t: V.HORIZON_DAYS[t])
        panel_counts = _panel_forward_status_counts(panel, dates, sel_universe, sel_idx, longest)
        delisted_fraction = panel_counts["delisted"] / len(sel_universe)
        absent_fraction = panel_counts["absent"] / len(sel_universe)
        if absent_fraction > PANEL_ABSENT_MAX:
            out.append(ShadowArmPeriodResult(
                pk, track, regime, eligible=False, sel_idx=sel_idx,
                panel_status_counts=panel_counts, delisted_fraction=delisted_fraction,
                absent_fraction=absent_fraction, reason_code="panel_survivorship_unverified"))
            continue
        win_by_tf: dict = {}
        n_win_by_tf: dict = {}
        fwd_panel_by_tf: dict = {}
        gap_total = 0
        thin_total = 0
        for tf in tfs:
            fwd_panel, gap, thin = _winner_universe_returns(panel, dates, universe, sel_idx, tf)
            gap_total += gap
            thin_total += thin
            fwd_panel_by_tf[tf] = fwd_panel
            win_by_tf[tf] = V.top_decile_winners(fwd_panel)
            n_win_by_tf[tf] = len(win_by_tf[tf])
        per_arm_tf: dict = {}
        arm_status: dict = {}
        cut: set = set()
        for arm in arms:
            af = ext.per_arm.get(arm)
            if af is None:
                continue
            arm_status[arm] = af.status
            if arm == _HARD_GATE:
                cut = af.counterfactual_cut
            cells: dict = {}
            for tf in tfs:
                cell = _ArmTfCell(picks=frozenset(af.picks_by_tf.get(tf, ())), status=af.status)
                picks = af.picks_by_tf.get(tf, ())
                if af.status == "logged" and len(picks) == _PICKS_PER_TF:
                    rets, delisted = _arm_pick_returns(panel, dates, picks, sel_idx, tf)
                    if rets is not None:
                        cell.mean_return = sum(rets.values()) / _PICKS_PER_TF
                        cell.hit_rate = len(set(picks) & win_by_tf[tf]) / _PICKS_PER_TF
                        cell.ic = _spearman_ic(af.score_by_tf.get(tf, {}), rets)
                        cell.delisted_count = delisted
                        cell.complete = True
                cells[tf] = cell
            per_arm_tf[arm] = cells
        out.append(ShadowArmPeriodResult(
            pk, track, regime, eligible=True, sel_idx=sel_idx, matured_tfs=matured,
            winners_by_tf=win_by_tf, n_winners_by_tf=n_win_by_tf, fwd_panel_by_tf=fwd_panel_by_tf,
            per_arm_tf=per_arm_tf, arm_status=arm_status, counterfactual_cut=cut,
            gap_winner_count=gap_total, thin_gap_excluded_count=thin_total,
            panel_status_counts=panel_counts, delisted_fraction=delisted_fraction,
            absent_fraction=absent_fraction))
    return out


# ===========================================================================
# aggregation → verdict (NEW; reuses _ci90 / _mean / F.quantile)
# ===========================================================================
def _decimate_nonoverlap(rows: list, tf: str) -> list:
    """§4 greedy non-overlapping forward windows for timeframe tf: keep a period only if its sel_idx
    >= prior kept sel_idx + HORIZON_DAYS[tf]. Counters use the post-decimation n (the verdict-floor n)."""
    kept: list = []
    last = None
    for r in sorted(rows, key=lambda r: r.sel_idx):
        if last is None or r.sel_idx >= last + V.HORIZON_DAYS[tf]:
            kept.append(r)
            last = r.sel_idx
    return kept


def _ols_intercept_slope(xs: Sequence[float], ys: Sequence[float]) -> Optional[tuple[float, float]]:
    """OLS y = a + b·x → (a, b). None if n<3 or var(x)==0 (unfittable). a = y at x=0."""
    n = len(xs)
    if n < 3:
        return None
    mx = sum(xs) / n
    my = sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    if sxx < 1e-12:
        return None
    sxy = sum((xs[i] - mx) * (ys[i] - my) for i in range(n))
    b = sxy / sxx
    a = my - b * mx
    return a, b


def _beta_orthogonalized_lift(kept: list, arm: str, tf: str, kill_rule: dict) -> tuple[Optional[float], bool]:
    """§4 REQUIRED co-metric + hard blocker: strip the leading-sector beta from the paired return lift.

    AS-BUILT CORRECTION OF §4's LITERAL FORMULA (surfaced in PR-A5 review): the spec wrote
    `ortho_lift_p = eps_arm_p - eps_snap_p` after fitting arm/snapshot SEPARATELY, then
    `beta_orthogonalized_ret_lift = mean(ortho_lift_p)`. With per-arm OLS this is **identically 0**
    (each residual series sums to 0 by the normal equations, over the SAME paired periods), so it can
    never act as a hard blocker. We implement the unambiguous statistical intent instead: regress the
    PAIRED per-period lift `L_p = mean_return_arm_p − mean_return_snapshot_p` on the pre-registered
    benchmark `x_p`, and take the **INTERCEPT a** of `L = a + b·x + e`. `a` = the lift at zero benchmark
    exposure = the sector-beta-orthogonalized lift; `a > 0` ⇒ residual edge beyond benchmark co-movement
    (the §4 intent: "단일 regime 주도-섹터 tilt의 양 lift는 정의상 sector-beta"). The metric is per
    (arm,track,timeframe) over the decimated periods carrying a pre-registered benchmark.

    The intercept is the lift EXTRAPOLATED to x=0; if every observed benchmark sits on one side of 0
    (e.g. leading sectors rose in every sampled period), x=0 is outside the data and the intercept is an
    unreliable extrapolation that could mis-clear (slope drags a beta-only edge to a positive intercept)
    or mis-block. So we additionally require the observed benchmark range to BRACKET 0 (min<=0<=max) —
    otherwise alpha and beta are not separable in-sample → DIRECTIONAL_BETA_UNVERIFIED (PR-A5 review fix).

    Returns (beta_orthogonalized_ret_lift | None, unverified). unverified=True when any kept period lacks
    benchmark x_p / fit n<3 / x variance 0 / x does not bracket 0 (⇒ DIRECTIONAL_BETA_UNVERIFIED)."""
    xs: list[float] = []
    lifts: list[float] = []
    for r in kept:
        x = _benchmark_return(kill_rule, r.period_key, tf)
        if x is None:
            return None, True
        arm_cell = r.per_arm_tf.get(arm, {}).get(tf)
        snap_cell = r.per_arm_tf.get(_BASELINE, {}).get(tf)
        if arm_cell is None or snap_cell is None or not arm_cell.complete or not snap_cell.complete:
            continue
        xs.append(x)
        lifts.append(arm_cell.mean_return - snap_cell.mean_return)
    if xs and not (min(xs) <= 0.0 <= max(xs)):           # x=0 extrapolation → can't separate alpha/beta
        return None, True
    coef = _ols_intercept_slope(xs, lifts)
    if coef is None:
        return None, True
    return coef[0], False


def _contributing_rows(elig: list, arm: str, track: str, tf: str) -> list:
    """Eligible periods that contribute to (arm,track,tf): matured tf + |winners|>=floor + arm&baseline
    cells both complete. Pre-decimation set (used for both plumbing detection and the lift series)."""
    rows: list = []
    for r in elig:
        if r.track != track or tf not in r.matured_tfs:
            continue
        if r.n_winners_by_tf.get(tf, 0) < _WINNERS_FLOOR:
            continue
        arm_cell = r.per_arm_tf.get(arm, {}).get(tf)
        snap_cell = r.per_arm_tf.get(_BASELINE, {}).get(tf)
        if arm_cell is None or snap_cell is None or not arm_cell.complete or not snap_cell.complete:
            continue
        rows.append(r)
    return rows


def _insufficiency_reason(elig: list, arm: str, track: str, tf: str) -> str:
    """When a (arm,track,tf) cell has ZERO contributing periods, pick the most specific closed reason
    (§5/§6.5): arm_incomplete_run (the arm exists in the track's periods but was logged incomplete
    everywhere — §1/§5 hard-gate incomplete_run case) > winners_below_floor (every matured period had
    |winners|<10) > n_below_data_floor (generic shortfall: baseline incomplete / picks absent / no period)."""
    track_periods = [r for r in elig if r.track == track]
    arm_present = [r for r in track_periods if arm in r.arm_status]
    if arm_present and all(r.arm_status.get(arm) != "logged" for r in arm_present):
        return "arm_incomplete_run"
    matured_periods = [r for r in track_periods if tf in r.matured_tfs]
    if matured_periods and all(r.n_winners_by_tf.get(tf, 0) < _WINNERS_FLOOR for r in matured_periods):
        return "winners_below_floor"
    return "n_below_data_floor"


def _gate_cut_return(kept: list, tf: str) -> Optional[dict]:
    """§1/PRA5-04 hard-gate diagnostic: forward returns of sector-gate cut tickers that became
    market winners ("did the gate truncate future winners?"). DIAGNOSTIC ONLY (no pass gate, §7)."""
    periods: list = []
    cut_winner_rets: list[float] = []
    total = 0
    for r in kept:
        cut = r.counterfactual_cut & r.winners_by_tf.get(tf, set())
        fwd = r.fwd_panel_by_tf.get(tf, {})
        leaders = []
        for tk in sorted(cut):
            ret = fwd.get(tk)
            leaders.append({"ticker": tk, "forward_return": (None if (ret is None or V._is_nan(ret)) else ret)})
            if ret is not None and not V._is_nan(ret):
                cut_winner_rets.append(ret)
        total += len(leaders)
        if leaders:
            periods.append({"period_key": r.period_key, "timeframe": tf,
                            "gate_cut_winner_count": len(leaders), "gate_cut_winners": leaders})
    if total == 0:
        return None
    return {"claim_discipline": "counterfactual observation only; no production apply; gate not 'wrong'",
            "total_gate_cut_winner_count": total,
            "mean_gate_cut_winner_return": (V._mean(cut_winner_rets) if cut_winner_rets else None),
            "periods": periods}


def _na_gates() -> dict:
    # §6.5 frozen verdict-report schema: gate_b:{verdict:NOT_APPLICABLE, reason:DIRECTIONAL_GATE_B_NA}
    # (key is `reason`, not `reason_code`); gate_c:{verdict:NOT_APPLICABLE} (no reason key).
    return {"gate_b": {"verdict": "NOT_APPLICABLE", "reason": "DIRECTIONAL_GATE_B_NA"},
            "gate_c": {"verdict": "NOT_APPLICABLE"}}


def _score_cell(elig: list, arm: str, track: str, tf: str, kill_rule: dict,
                survivorship: Optional[dict]) -> dict:
    power_floor_n = _track_config(kill_rule, track)
    m = _fwer_family_m(kill_rule)
    alpha_cell = 0.10 / m
    base = {"arm": arm, "track": track, "timeframe": tf, **_na_gates()}
    # survivorship hard refusal first (§5).
    if not isinstance(survivorship, dict) or survivorship.get("exit_status") != 0:
        return {**base, "verdict": "INCOMPLETE_RUN", "reason_code": "survivorship_failed",
                "gate_a": {"pass": False}}
    rows = _contributing_rows(elig, arm, track, tf)
    is_hard_gate = arm == _HARD_GATE
    # plumbing: arm picks == baseline picks in EVERY contributing period (K=0/absent mirror) ⇒ structural 0.
    if rows and all(r.per_arm_tf[arm][tf].picks == r.per_arm_tf[_BASELINE][tf].picks for r in rows):
        return {**base, "verdict": "NOT_APPLICABLE_PLUMBING_ONLY", "reason_code": "NOT_APPLICABLE_PLUMBING_ONLY",
                "n_periods": len(rows), "gate_a": {"pass": False},
                "gate_cut_return": (_gate_cut_return(rows, tf) if is_hard_gate else None)}
    n_obs = len(rows)                                     # pre-decimation contributing periods (reported)
    kept = _decimate_nonoverlap(rows, tf)
    ret_series: list[float] = []
    hit_series: list[float] = []
    ics: list[float] = []
    regime_lifts: dict[str, list[float]] = {}
    arm_delisted = 0
    snap_delisted = 0
    for r in kept:
        arm_cell = r.per_arm_tf[arm][tf]
        snap_cell = r.per_arm_tf[_BASELINE][tf]
        ret_lift = arm_cell.mean_return - snap_cell.mean_return
        hit_lift = arm_cell.hit_rate - snap_cell.hit_rate
        ret_series.append(ret_lift)
        hit_series.append(hit_lift)
        regime_lifts.setdefault(r.regime, []).append(ret_lift)
        ics.append(arm_cell.ic)
        arm_delisted += arm_cell.delisted_count
        snap_delisted += snap_cell.delisted_count
    n = len(ret_series)                                   # = len(kept), the verdict-floor (independent) n
    gate_cut = _gate_cut_return(kept, tf) if is_hard_gate else None
    if n < _DATA_FLOOR:                                   # data floor on the post-decimation independent n
        reason = _insufficiency_reason(elig, arm, track, tf) if n_obs == 0 else "n_below_data_floor"
        return {**base, "verdict": "INCOMPLETE_RUN", "reason_code": reason,
                "n_periods": n_obs, "n_nonoverlap": n, "gate_a": {"pass": False},
                "gate_cut_return": gate_cut}
    ret_lift_mean = V._mean(ret_series)
    hit_lift_mean = V._mean(hit_series)
    ci = V._ci90(ret_series)                              # descriptive LOCKED 5/95 (PR-B5 _ci90)
    adj_lower = _adjusted_lower(ret_series, alpha_cell)   # BINDING Bonferroni one-sided lower quantile
    ic_ir = _ic_ir_ddof1(ics)
    regime_stratified = {reg: V._mean(vals) for reg, vals in sorted(regime_lifts.items())}
    beta_lift, beta_unverified = _beta_orthogonalized_lift(kept, arm, tf, kill_rule)
    single_regime = len({r.regime for r in kept}) < 2
    common = {
        "n_periods": n_obs, "n_nonoverlap": n, "ret_lift_mean": ret_lift_mean,
        "ci90": ci, "adj_lower": adj_lower, "alpha_cell": alpha_cell, "fwer_family_m": m,
        "hit_lift_mean": hit_lift_mean, "ic_ir": ic_ir,
        "regime_stratified_lift": regime_stratified,
        "beta_orthogonalized_ret_lift": beta_lift,
        "arm_delisted_picks": arm_delisted, "snap_delisted_picks": snap_delisted,
        "gate_cut_return": gate_cut,
    }
    # gate_a predicate (binding lower bound; reported but full PASS is structurally unreachable in Stage-1).
    ga_pass = (not V._is_nan(adj_lower)) and adj_lower > 0
    if n < power_floor_n:                                 # VERDICT floor → DIRECTIONAL, never PASS
        return {**base, "verdict": "DIRECTIONAL", "reason_code": "DIRECTIONAL_POWER_FLOOR",
                "gate_a": {"pass": False}, "advisory_flags": ["below_power_floor"], **common}
    if beta_unverified:                                   # PASS hard-block (§4)
        return {**base, "verdict": "DIRECTIONAL", "reason_code": "DIRECTIONAL_BETA_UNVERIFIED",
                "gate_a": {"pass": ga_pass}, "advisory_flags": ["beta_benchmark_unverified"], **common}
    if single_regime or not (beta_lift is not None and beta_lift > 0):  # PASS hard-block (§4/§7)
        flags = (["single_regime"] if single_regime else []) + (
            ["beta_orthogonalized_non_positive"] if not (beta_lift is not None and beta_lift > 0) else [])
        return {**base, "verdict": "DIRECTIONAL", "reason_code": "DIRECTIONAL_BETA_BLOCKED",
                "gate_a": {"pass": ga_pass}, "advisory_flags": flags, **common}
    # All non-Gate-B floors clear; full Gate B NOT_APPLICABLE ⇒ structural ceiling DIRECTIONAL_GATE_B_NA.
    advisory = [] if (not V._is_nan(ic_ir) and ic_ir >= V.GATE_B_IC_IR_MIN) else ["low_selected_row_ic_ir"]
    if arm_delisted or snap_delisted:                     # transparency: lift partly driven by -1.0 delistings
        advisory.append("lift_includes_delisted_picks")
    return {**base, "verdict": "DIRECTIONAL", "reason_code": "DIRECTIONAL_GATE_B_NA",
            "gate_a": {"pass": ga_pass}, "advisory_flags": advisory, **common}


def _adjusted_lower(values: Sequence[float], alpha_cell: float) -> float:
    """BINDING PASS lower bound: Bonferroni-adjusted one-sided empirical lower quantile at alpha_cell.
    Reuses F.quantile (linear-interp, numpy parity) — the SAME estimator V._ci90 uses for 5/95."""
    present = sorted(v for v in values if not V._is_nan(v))
    if len(present) < 2:
        return _NAN
    return round(F.quantile(present, alpha_cell), 6)


def _warning_summary(period_results: Sequence) -> list:
    gap_total = sum(r.gap_winner_count for r in period_results)
    thin_total = sum(r.thin_gap_excluded_count for r in period_results)
    delisted = [
        {"period_key": r.period_key, "track": r.track, "delisted_fraction": r.delisted_fraction,
         "absent_fraction": r.absent_fraction, "panel_status_counts": r.panel_status_counts}
        for r in period_results if r.panel_status_counts
    ]
    warnings: list = []
    if gap_total or thin_total or delisted:
        warnings.append({"code": "forward_panel_status_counts", "gap_winner_count": gap_total,
                         "thin_gap_excluded_count": thin_total, "delisted_fraction_by_period": delisted})
    excluded = [{"period_key": r.period_key, "track": r.track, "reason_code": r.reason_code}
                for r in period_results if not r.eligible and r.reason_code]
    if excluded:
        warnings.append({"code": "excluded_periods", "periods": excluded})
    return warnings


def _rollup(cells: list, tracks_seen: Sequence[str]) -> dict:
    order = {"PASS": 3, "DIRECTIONAL": 2, "INCOMPLETE_RUN": 1, "INVALID_INPUT": 0}
    # NOT_APPLICABLE_PLUMBING_ONLY is excluded from the min (structural 0, not a graded outcome).
    advisory_flags: list = []
    per_track: dict = {}
    for tr in tracks_seen:
        tcells = [c for c in cells if c["track"] == tr and c["verdict"] != "NOT_APPLICABLE_PLUMBING_ONLY"]
        per_track[tr] = (min((c["verdict"] for c in tcells), key=lambda v: order.get(v, 1))
                         if tcells else "INCOMPLETE_RUN")
    if any(c["verdict"] == "INVALID_INPUT" for c in cells):
        top = "INVALID_INPUT"
    else:
        scored = [c for c in cells if c["verdict"] != "NOT_APPLICABLE_PLUMBING_ONLY"]
        if not scored:                                   # every endpoint plumbing-only (§5)
            top = "INCOMPLETE_RUN"
        else:
            top = min((c["verdict"] for c in scored), key=lambda v: order.get(v, 1))
    for c in cells:
        for fl in c.get("advisory_flags", []):
            if fl not in advisory_flags:
                advisory_flags.append(fl)
    # triple_gate_all_pass: AND-of-per-cell-gate-fields (gate_b is structurally NA ⇒ False in Stage-1).
    tga = bool(cells) and all(
        c.get("gate_a", {}).get("pass") and c["gate_b"]["verdict"] == "PASS"
        and c["gate_c"]["verdict"] == "PASS" for c in cells)
    only_plumbing = bool(cells) and all(c["verdict"] == "NOT_APPLICABLE_PLUMBING_ONLY" for c in cells)
    user_review = bool(advisory_flags) and top in ("PASS", "DIRECTIONAL")
    return {"verdict": top, "per_track": per_track, "advisory_flags": advisory_flags,
            "triple_gate_all_pass": tga, "user_review_required": user_review,
            "only_plumbing": only_plumbing}


def _run_incomplete(reason: str, kill_rule: dict, generated_at: str) -> dict:
    return {
        "run_verdict": "INCOMPLETE_RUN", "reason_code": reason, "user_review_required": False,
        "advisory_flags": [], "triple_gate_all_pass": False, "cells": [], "per_track_verdict": {},
        "generated_at": generated_at,
        "parameter_lock_commit_hash": kill_rule.get("parameter_lock_commit_hash") if isinstance(kill_rule, dict) else None,
        "freeze_tag": kill_rule.get("freeze_tag") if isinstance(kill_rule, dict) else None,
        "claim_discipline": "in-pool 30-reranking forward observation (verification pending)",
        "no_apply": True,
    }


def aggregate_shadow_arm_verdict(period_results: Sequence, *, kill_rule: dict, arms: Sequence[str],
                                 generated_at: str, survivorship: Optional[dict] = None) -> dict:
    arms = _validate_arms(arms, kill_rule)
    kr = _require_dict(kill_rule, "kill_rule")
    tracks_cfg = _require_dict(_get(kr, "tracks", "kill_rule"), "kill_rule.tracks")
    if not isinstance(survivorship, dict) or survivorship.get("exit_status") != 0:
        rep = _run_incomplete("survivorship_failed", kr, generated_at)
        rep["survivorship_label"] = (survivorship or {}).get("label", "survivorship-unknown: blocked")
        rep["warnings"] = _warning_summary(period_results)
        return rep
    elig = [r for r in period_results if r.eligible]
    if not elig:
        rep = _run_incomplete("no_eligible_periods", kr, generated_at)
        rep["survivorship_label"] = survivorship.get("label", "")
        rep["warnings"] = _warning_summary(period_results)
        return rep
    non_baseline = [a for a in arms if a != _BASELINE]
    # Only emit cells for tracks that actually have ≥1 eligible period (a short-only verdict run must not
    # flood midlong endpoints with n_below_data_floor noise; §5 INCOMPLETE is per real data, not phantom).
    tracks = [t for t in tracks_cfg if any(r.track == t for r in elig)]
    cells: list = []
    for track in tracks:
        for tf in _TIMEFRAMES_BY_TRACK.get(track, ()):
            for arm in non_baseline:
                cells.append(_score_cell(elig, arm, track, tf, kr, survivorship))
    roll = _rollup(cells, tracks)
    run_verdict = roll["verdict"]
    reason = None
    if roll["only_plumbing"]:                             # §5 zero non-plumbing endpoints
        run_verdict = "INCOMPLETE_RUN"
        reason = "INCOMPLETE_RUN_PLUMBING_ONLY"
    return {
        "run_verdict": run_verdict, "reason_code": reason,
        "per_track_verdict": roll["per_track"], "user_review_required": roll["user_review_required"],
        "advisory_flags": roll["advisory_flags"], "triple_gate_all_pass": roll["triple_gate_all_pass"],
        "cells": cells, "n_arms": len(arms), "fwer_family_m": _fwer_family_m(kr),
        "alpha_cell": 0.10 / _fwer_family_m(kr), "fwer_via_power_floor_n": True,
        "warnings": _warning_summary(period_results),
        "generated_at": generated_at,
        "parameter_lock_commit_hash": kr.get("parameter_lock_commit_hash"),
        "freeze_tag": kr.get("freeze_tag"),
        "return_contract": kr.get("return_contract"),
        "survivorship_label": survivorship.get("label", ""),
        "claim_discipline": "in-pool 30-reranking forward observation (verification pending)",
        "no_apply": True,
    }


def assert_verdict_integrity(report: dict) -> None:
    """Re-derive triple_gate_all_pass from the per-cell gate fields and refuse a report whose claimed
    top-level boolean disagrees (feedback_workflow_verify_false_convergence: never trust an aggregate
    boolean; re-derive from raw findings). Raise ShadowArmEvalInputError(triple_gate_inconsistent)."""
    cells = report.get("cells", [])
    derived = bool(cells) and all(
        c.get("gate_a", {}).get("pass") and c.get("gate_b", {}).get("verdict") == "PASS"
        and c.get("gate_c", {}).get("verdict") == "PASS" for c in cells)
    if bool(report.get("triple_gate_all_pass")) != derived:
        raise ShadowArmEvalInputError("triple_gate_inconsistent: claimed != AND-of-gate-fields")


def _json_safe(value: Any) -> Any:
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if isinstance(value, dict):
        return {k: _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(v) for v in value]
    if isinstance(value, (set, frozenset)):
        return sorted(_json_safe(v) for v in value)
    return value


def emit_shadow_arm_verdict(report: dict, out_path: Path) -> None:
    safe_report = _json_safe(report)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(safe_report, ensure_ascii=False, indent=2, allow_nan=False))
    out_path.with_suffix(".md").write_text(_markdown_verdict(safe_report), encoding="utf-8")


def _markdown_verdict(report: dict) -> str:
    lines = [
        "# PR-A5 Track 1 In-Pool 30-Reranking Forward Verdict",
        "",
        f"- run_verdict: {report.get('run_verdict')}  (reason: {report.get('reason_code')})",
        f"- per_track: {report.get('per_track_verdict', {})}",
        f"- survivorship_label: {report.get('survivorship_label', '')}",
        f"- claim_discipline: {report.get('claim_discipline', '')}",
        f"- triple_gate_all_pass: {report.get('triple_gate_all_pass')}  ·  no_apply: {report.get('no_apply')}",
        "",
        "| arm | track | tf | verdict | reason | n | ret_lift | ci90 | adj_lower | hit_lift | ic_ir | beta_ortho | gate_a | gate_b | gate_c |",
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    for c in report.get("cells", []):
        lines.append(
            "| {arm} | {track} | {tf} | {verdict} | {reason} | {n} | {rl} | {ci} | {al} | {hl} | {ir} | {bo} | {ga} | {gb} | {gc} |".format(
                arm=c.get("arm"), track=c.get("track"), tf=c.get("timeframe"),
                verdict=c.get("verdict"), reason=c.get("reason_code"), n=c.get("n_periods"),
                rl=c.get("ret_lift_mean"), ci=c.get("ci90"), al=c.get("adj_lower"),
                hl=c.get("hit_lift_mean"), ir=c.get("ic_ir"), bo=c.get("beta_orthogonalized_ret_lift"),
                ga=c.get("gate_a", {}).get("pass"), gb=c.get("gate_b", {}).get("verdict"),
                gc=c.get("gate_c", {}).get("verdict")))
    lines.append("")
    return "\n".join(lines)
