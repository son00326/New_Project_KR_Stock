#!/usr/bin/env python3
# noqa: SIZE_OK - PR-B5 sibling evaluator is intentionally isolated from frozen validate_tier0_ic funcs.
"""주픽(JooPick) — Track 2 generator-shadow Stage 1 forward recall evaluator (PR-B5).

SoT: docs/superpowers/specs/2026-06-22-pathA-track2-prb5-forward-recall-evaluator.md (CONVERGED)
     + parent docs/superpowers/specs/2026-06-20-pathA-track2-generator-shadow.md §6.

WHAT THIS IS: a post-process forward-recall evaluator. It reads owner-psql-extracted shadow facts
(JSON), computes forward winners on the universe-wide snapshot ticker set via the ALREADY-BUILT
validate_tier0_ic forward engine, and produces the PRIMARY paired arm-vs-mirror recall lift
verdict. Emits a report FILE. Never writes a DB. Never emits PASS before the floors + survivorship.

ARCHITECTURE: this is a SIBLING module (not inlined into validate_tier0_ic.py) — it imports
validate_tier0_ic as V to REUSE its leaf functions verbatim. validate_tier0_ic's frozen B+C path
(process_month/aggregate_harvest/harvest_pit_months) is byte-unchanged; the only edit there is the
--shadow-eval argparse flags + a thin early-return dispatch into this module (default OFF).

INVARIANTS (do NOT violate): production effect 0 (no production write, no service_role shadow read —
owner-psql JSON is operator-fed); forward-only; n>=6 = DATA floor, pre-registered power_floor_n =
VERDICT floor (n<power_floor_n -> DIRECTIONAL never PASS); analytic N/M baseline (no seeded MC);
PRIMARY lift = recall(arm)-recall(mirror) at one pre-registered primary horizon (NEW; gate predicate
reused threshold-only); claim discipline §6.7. This module performs NO DB write.
"""
from __future__ import annotations

import json
import math
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Any, Optional, Sequence

import validate_tier0_ic as V          # leaf reuse (forward engine, gates, CI)
import tier0_factors as F              # StockRaw, spearman_ic
import shadow_gen_runner as SR         # _is_monthly_period_key / _is_weekly_period_key (single source)

_NAN = math.nan
_WINNERS_FLOOR = 10                    # §4.6 per-period |winners|>=10 (top_decile_winners needs >=10)
_DATA_FLOOR = 6                        # §6.1 n_periods>=6 data-existence floor
_MIRROR = "production-mirror"
_NON_MIRROR = ("sector-soft-tilt", "sector-hard-gate")
PANEL_ABSENT_MAX = 0.10                # Gross panel-integrity tripwire; probe remains binding (§5.2.4).


class ShadowEvalInputError(ValueError):
    """PR-B5 fail-closed boundary: malformed owner-psql JSON facts / kill-rule / artifact.
    Mirrors shadow_reconcile.ReconcileInputError. main() treats it as a hard abort (no verdict)."""


# ===========================================================================
# fail-closed extractors (feedback_failclosed_symmetric_completion): type-check
# every boundary field BEFORE use; no truthiness `or {}`; reject wrong type.
# ===========================================================================
def _se_require_dict(v: Any, what: str) -> dict:
    if not isinstance(v, dict):
        raise ShadowEvalInputError(f"{what} must be dict, got {type(v).__name__}")
    return v


def _se_require_list(v: Any, what: str) -> list:
    if not isinstance(v, list):
        raise ShadowEvalInputError(f"{what} must be list, got {type(v).__name__}")
    return v


def _se_get(d: dict, k: str, what: str) -> Any:
    if k not in d:
        raise ShadowEvalInputError(f"{what}: missing '{k}'")
    return d[k]


def _se_str(d: dict, k: str, what: str) -> str:
    v = _se_get(d, k, what)
    if not isinstance(v, str):
        raise ShadowEvalInputError(f"{what}: '{k}' must be str, got {type(v).__name__}")
    return v


def _se_str_or_none(d: dict, k: str, what: str) -> Optional[str]:
    v = _se_get(d, k, what)
    if v is None or isinstance(v, str):
        return v
    raise ShadowEvalInputError(f"{what}: '{k}' must be str|null, got {type(v).__name__}")


def _se_int(d: dict, k: str, what: str) -> int:
    v = _se_get(d, k, what)
    if isinstance(v, bool) or not isinstance(v, int):   # bool is an int subclass — reject
        raise ShadowEvalInputError(f"{what}: '{k}' must be int, got {type(v).__name__}")
    if v < 0:
        raise ShadowEvalInputError(f"{what}: '{k}' must be >=0, got {v}")
    return v


def _se_int_or_none(d: dict, k: str, what: str) -> Optional[int]:
    v = _se_get(d, k, what)
    if v is None:
        return None
    if isinstance(v, bool) or not isinstance(v, int):
        raise ShadowEvalInputError(f"{what}: '{k}' must be int|null, got {type(v).__name__}")
    if v < 0:
        raise ShadowEvalInputError(f"{what}: '{k}' must be >=0, got {v}")
    return v


def _se_number(d: dict, k: str, what: str) -> float:
    """numeric tier0_score: accept int|float (reject bool/str/None) → float."""
    v = _se_get(d, k, what)
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        raise ShadowEvalInputError(f"{what}: '{k}' must be number, got {type(v).__name__}")
    return float(v)


def _se_number_or_none(d: dict, k: str, what: str) -> Optional[float]:
    v = _se_get(d, k, what)
    if v is None:
        return None
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        raise ShadowEvalInputError(f"{what}: '{k}' must be number|null, got {type(v).__name__}")
    return float(v)


def _se_set_of_str(d: dict, k: str, what: str) -> set:
    v = _se_get(d, k, what)
    if not isinstance(v, list):
        raise ShadowEvalInputError(f"{what}: '{k}' must be list, got {type(v).__name__}")
    out: set[str] = set()
    for i, el in enumerate(v):
        if not isinstance(el, str):
            raise ShadowEvalInputError(f"{what}: '{k}'[{i}] must be str, got {type(el).__name__}")
        out.add(el)
    return out


def _se_list_of_str(d: dict, k: str, what: str) -> tuple:
    v = _se_get(d, k, what)
    if not isinstance(v, list):
        raise ShadowEvalInputError(f"{what}: '{k}' must be list, got {type(v).__name__}")
    out: list[str] = []
    for i, el in enumerate(v):
        if not isinstance(el, str):
            raise ShadowEvalInputError(f"{what}: '{k}'[{i}] must be str, got {type(el).__name__}")
        out.append(el)
    return tuple(out)


def _se_nonempty_str_or_none(d: dict, k: str, what: str) -> Optional[str]:
    v = _se_str_or_none(d, k, what)
    if v == "":
        raise ShadowEvalInputError(f"{what}: '{k}' must not be empty")
    return v


def _se_nonempty_str(d: dict, k: str, what: str) -> str:
    v = _se_str(d, k, what)
    if v == "":
        raise ShadowEvalInputError(f"{what}: '{k}' must not be empty")
    return v


def _parse_iso_day(value: str, what: str) -> date:
    if not isinstance(value, str):
        raise ShadowEvalInputError(f"{what} must be a string")
    if value == "":
        raise ShadowEvalInputError(f"{what} must not be empty")
    try:
        if len(value) == 10:
            return date.fromisoformat(value)
        return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
    except ValueError as exc:
        raise ShadowEvalInputError(f"{what} must be ISO date/timestamp, got {value!r}") from exc


# ===========================================================================
# Query 2 — owner-psql shadow-run extract (per eligible period; FIX-J run_id anchor)
# ===========================================================================
SHADOW_RUN_EXTRACT_SQL = """\
-- PR-B5 Query 2 — owner-psql shadow-run extract for ONE complete period ($1=period_key).
-- RAW FACTS only; classification/scoring in pure Python (shadow_eval). T2-I-6: owner connection,
-- never service_role. FIX-J: run_id anchored from the production-mirror candidate rows.
with mirror_run as materialized (
  select period_key, min(run_id) as run_id, count(distinct run_id) as run_id_count
  from public.tier0_candidates_150_shadow
  where arm = 'production-mirror' and period_key = $1
  group by period_key
),
cand as materialized (
  select c.period_key, c.arm, c.ticker, c.bucket, c.rank, c.tier0_score, c.status,
         c.counterfactual_cut, c.gate_eligible_size, c.universe_hash, c.universe_size,
         c.run_id, c.sector_view
  from public.tier0_candidates_150_shadow c
  join mirror_run mr on mr.period_key = c.period_key and c.run_id = mr.run_id
),
snap as materialized (
  select s.ticker, s.bucket, s.tier0_score, s.sector, s.sector_source, s.induty_code,
         s.universe_hash, s.universe_size, s.run_id, s.run_date
  from public.tier0_shadow_universe_snapshot s
  join mirror_run mr on mr.period_key = s.period_key and s.run_id = mr.run_id
),
hyp as materialized (
  select h.source, h.leading_sectors, h.as_of, h.selection_as_of, h.hypothesis_hash
  from public.tier0_shadow_sector_hypothesis h
  join public.tier0_candidates_150_shadow c on c.hypothesis_id = h.id
  join mirror_run mr on mr.period_key = c.period_key and mr.run_id = c.run_id
  group by h.source, h.leading_sectors, h.as_of, h.selection_as_of, h.hypothesis_hash
)
select json_build_object(
  'period_key',   $1,
  'run_id',       (select run_id from mirror_run),
  'run_id_count', (select run_id_count from mirror_run),
  'candidates',   coalesce((select json_agg(cand) from cand), '[]'::json),
  'snapshot',     coalesce((select json_agg(snap) from snap), '[]'::json),
  'hypothesis',   coalesce((select json_agg(hyp) from hyp), '[]'::json)
);
"""


def shadow_sql_inline() -> str:
    """Single-line (comment-stripped, no trailing ';') form for json_agg wrapping / smoke."""
    body = [ln for ln in SHADOW_RUN_EXTRACT_SQL.splitlines() if not ln.lstrip().startswith("--")]
    return " ".join(ln.strip() for ln in body if ln.strip()).rstrip(";")


# ===========================================================================
# parsed shapes
# ===========================================================================
@dataclass
class _ArmFacts:
    selected_all: set
    selected_by_horizon: dict          # bucket -> set[ticker]
    universe_size: int
    universe_hash: str
    counterfactual_cut: set            # hard-gate only
    sector_source_absent: bool
    sector_source: str


@dataclass
class ShadowExtract:
    period_key: str
    run_id: Optional[str]              # FIX-J anchor; None => mirror_arm_absent
    snapshot_score_by_horizon: dict    # bucket -> {ticker: tier0_score}
    snapshot_tickers: set
    universe_size: int
    universe_hash: str
    per_arm: dict                      # arm -> _ArmFacts
    selection_as_of: Optional[str]
    as_of: Optional[str]
    run_date: Optional[str]
    hypothesis_source: Optional[str]


def _parse_extract_one(obj: dict) -> ShadowExtract:
    _se_require_dict(obj, "extract period")
    period_key = _se_str(obj, "period_key", "extract")
    if not SR._is_monthly_period_key(period_key) and not SR._is_weekly_period_key(period_key):
        raise ShadowEvalInputError(f"extract: bad period_key {period_key!r}")
    run_id = _se_nonempty_str_or_none(obj, "run_id", "extract")          # None when mirror absent
    run_id_count = _se_int_or_none(obj, "run_id_count", "extract")
    if run_id is None:
        if run_id_count not in (None, 0):
            raise ShadowEvalInputError("malformed_row: mirror run_id absent but run_id_count is nonzero")
    elif run_id_count != 1:
        raise ShadowEvalInputError(f"malformed_row: mirror run_id_count must be 1, got {run_id_count}")
    cands = _se_require_list(_se_get(obj, "candidates", "extract"), "candidates")
    snaps = _se_require_list(_se_get(obj, "snapshot", "extract"), "snapshot")
    hyps = _se_require_list(_se_get(obj, "hypothesis", "extract"), "hypothesis")

    # snapshot → distinct tickers + per-(bucket) score map (the winner basis + co-gate IC input)
    snap_tickers: set = set()
    snap_score_by_h: dict = {h: {} for h in V.HARVEST_BUCKETS}
    snap_hashes: set = set()
    snap_usizes: set = set()
    snap_run_dates: set[str] = set()
    for s in snaps:
        _se_require_dict(s, "snapshot row")
        tk = _se_str(s, "ticker", "snapshot")
        bucket = _se_str(s, "bucket", "snapshot")
        if bucket not in V.HARVEST_BUCKETS:
            raise ShadowEvalInputError(f"snapshot: bad bucket {bucket!r}")
        snap_run_id = _se_str(s, "run_id", "snapshot")
        if snap_run_id != run_id:
            raise ShadowEvalInputError(f"malformed_row: snapshot run_id {snap_run_id!r} != extract run_id {run_id!r}")
        snap_tickers.add(tk)
        snap_hashes.add(_se_str(s, "universe_hash", "snapshot"))
        snap_usizes.add(_se_int(s, "universe_size", "snapshot"))
        run_date = _se_nonempty_str(s, "run_date", "snapshot")
        snap_run_dates.add(_parse_iso_day(run_date, "snapshot.run_date").isoformat())
        sc = _se_get(s, "tier0_score", "snapshot")
        if sc is not None and bucket in snap_score_by_h:
            if isinstance(sc, bool) or not isinstance(sc, (int, float)):
                raise ShadowEvalInputError(f"snapshot: tier0_score must be number|null, got {type(sc).__name__}")
            snap_score_by_h[bucket][tk] = float(sc)

    # candidates → per-arm selected sets + per-arm universe_hash/size (cross-arm guard)
    per_arm: dict = {}
    for c in cands:
        _se_require_dict(c, "candidate row")
        arm = _se_str(c, "arm", "candidate")
        if arm not in (_MIRROR, *_NON_MIRROR):
            raise ShadowEvalInputError(f"candidate: bad arm {arm!r}")
        status = _se_str(c, "status", "candidate")
        if status not in ("logged", "invalid_input", "incomplete_run"):
            raise ShadowEvalInputError(f"candidate: bad status {status!r}")
        tk = _se_str(c, "ticker", "candidate")
        bucket = _se_str(c, "bucket", "candidate")
        if bucket not in V.HARVEST_BUCKETS:
            raise ShadowEvalInputError(f"candidate: bad bucket {bucket!r}")
        cand_run_id = _se_str(c, "run_id", "candidate")
        if cand_run_id != run_id:
            raise ShadowEvalInputError(f"malformed_row: candidate run_id {cand_run_id!r} != extract run_id {run_id!r}")
        _se_int(c, "rank", "candidate")
        _se_number_or_none(c, "tier0_score", "candidate")
        gate_eligible_size = _se_int_or_none(c, "gate_eligible_size", "candidate")
        uhash = _se_str(c, "universe_hash", "candidate")
        usize = _se_int(c, "universe_size", "candidate")
        sv = _se_require_dict(_se_get(c, "sector_view", "candidate"), "sector_view")
        sv_source = _se_str(sv, "source", "sector_view")
        cut_all = _se_set_of_str(c, "counterfactual_cut", "candidate")
        cut = cut_all if arm == "sector-hard-gate" else set()
        if arm == "sector-hard-gate" and status == "logged" and (
            gate_eligible_size is None or gate_eligible_size < 150
        ):
            raise ShadowEvalInputError("malformed_row: logged hard-gate row has gate_eligible_size < 150")
        a = per_arm.get(arm)
        if a is None:
            a = _ArmFacts(set(), {h: set() for h in V.HARVEST_BUCKETS}, usize, uhash, set(),
                          sv_source == "absent", sv_source)
            per_arm[arm] = a
        else:
            if a.universe_size != usize or a.universe_hash != uhash:
                raise ShadowEvalInputError(f"universe_hash_mismatch_across_arms: inconsistent rows for {arm}")
            if a.sector_source != sv_source:
                raise ShadowEvalInputError("sector_view_source_mismatch_within_arm")
        if status == "logged":
            a.selected_all.add(tk)
            if bucket in a.selected_by_horizon:
                a.selected_by_horizon[bucket].add(tk)
        if arm == "sector-hard-gate":
            a.counterfactual_cut |= cut

    selection_as_of = None
    as_of = None
    hyp_source = None
    hyp_keys: set[tuple] = set()
    for h in hyps:
        hr = _se_require_dict(h, "hypothesis row")
        src = _se_nonempty_str(hr, "source", "hypothesis")
        sectors = _se_list_of_str(hr, "leading_sectors", "hypothesis")
        asof_raw = _se_nonempty_str(hr, "as_of", "hypothesis")
        sel_raw = _se_nonempty_str(hr, "selection_as_of", "hypothesis")
        hhash = _se_nonempty_str(hr, "hypothesis_hash", "hypothesis")
        key = (src, sectors,
               _parse_iso_day(asof_raw, "hypothesis.as_of").isoformat(),
               _parse_iso_day(sel_raw, "hypothesis.selection_as_of").isoformat(),
               hhash)
        hyp_keys.add(key)
    if len(hyp_keys) > 1:
        raise ShadowEvalInputError("hypothesis_mismatch")
    if hyp_keys:
        hyp_source, _sectors, as_of, selection_as_of, _hhash = next(iter(hyp_keys))

    # universe_size/hash = mirror's if present else snapshot's; cross-arm uniformity guard (§1.5)
    if _MIRROR in per_arm:
        usize = per_arm[_MIRROR].universe_size
        uhash = per_arm[_MIRROR].universe_hash
    elif snap_usizes:
        usize = max(snap_usizes)
        uhash = next(iter(snap_hashes), "")
    else:
        usize, uhash = 0, ""
    arm_hashes = {a.universe_hash for a in per_arm.values()} | snap_hashes
    if len(arm_hashes) > 1:
        raise ShadowEvalInputError(f"universe_hash_mismatch_across_arms: {sorted(arm_hashes)}")
    if len(snap_usizes) > 1:
        raise ShadowEvalInputError(f"universe_hash_mismatch_across_arms: inconsistent snapshot universe_size {sorted(snap_usizes)}")
    if len(snap_run_dates) > 1:
        raise ShadowEvalInputError("run_date_mismatch")
    run_date = next(iter(snap_run_dates)) if snap_run_dates else None

    return ShadowExtract(
        period_key=period_key, run_id=run_id,
        snapshot_score_by_horizon=snap_score_by_h, snapshot_tickers=snap_tickers,
        universe_size=usize, universe_hash=uhash, per_arm=per_arm,
        selection_as_of=selection_as_of, as_of=as_of, run_date=run_date, hypothesis_source=hyp_source)


def parse_shadow_extract(arr: Any) -> dict:
    """Top-level JSON = ARRAY of per-period Query-2 objects → {period_key: ShadowExtract}."""
    arr = _se_require_list(arr, "shadow-extract-json")
    out: dict = {}
    for obj in arr:
        ext = _parse_extract_one(obj)
        if ext.period_key in out:
            raise ShadowEvalInputError(f"duplicate period_key in extract: {ext.period_key!r}")
        out[ext.period_key] = ext
    return out


# ===========================================================================
# survivorship artifact (§5) — bracket assertion, fail-closed
# ===========================================================================
def _yyyymmdd(d: str) -> str:
    try:
        if len(d) == 8 and d.isdigit():
            date.fromisoformat(f"{d[:4]}-{d[4:6]}-{d[6:8]}")
            return d
        if len(d) == 10 and d[4] == "-" and d[7] == "-":
            return date.fromisoformat(d).strftime("%Y%m%d")
    except ValueError as exc:
        raise ShadowEvalInputError(f"survivorship date must be YYYYMMDD or YYYY-MM-DD, got {d!r}") from exc
    raise ShadowEvalInputError(f"survivorship date must be YYYYMMDD or YYYY-MM-DD, got {d!r}")


def read_survivorship_artifact(arr: Any, *, forward_window: tuple) -> dict:
    """Per-market list JSON from probe_pit_survivorship --emit-artifact. Returns
    {exit_status, label}. exit_status 0=PASS; 1/2=biased; 9=stale (dates do not bracket window)."""
    arr = _se_require_list(arr, "survivorship artifact")
    if not arr:
        raise ShadowEvalInputError("survivorship artifact must be a non-empty list")
    start_m, end_m = forward_window
    win_lo = start_m.strftime("%Y%m%d")
    win_hi = end_m.strftime("%Y%m%d")
    parsed_rows: list[dict] = []
    markets: set[str] = set()
    for o in arr:
        _se_require_dict(o, "survivorship row")
        market = _se_str(o, "market", "survivorship")
        if market not in ("KOSPI", "KOSDAQ"):
            raise ShadowEvalInputError(f"survivorship: bad market {market!r}")
        if market in markets:
            raise ShadowEvalInputError(f"survivorship: duplicate market {market!r}")
        markets.add(market)
        _se_int(o, "old_count", "survivorship")
        _se_int(o, "recent_count", "survivorship")
        _se_int_or_none(o, "gone_count", "survivorship")
        _se_int(o, "schema_version", "survivorship")
        old = _yyyymmdd(_se_str(o, "old_date", "survivorship"))
        recent = _yyyymmdd(_se_str(o, "recent_date", "survivorship"))
        st = _se_int(o, "exit_status", "survivorship")
        if st not in (0, 1, 2, 9):
            raise ShadowEvalInputError(f"survivorship: bad exit_status {st}")
        parsed_rows.append({"market": market, "old": old, "recent": recent, "exit_status": st})
    if markets != {"KOSPI", "KOSDAQ"}:
        raise ShadowEvalInputError(f"survivorship artifact must cover KOSPI and KOSDAQ, got {sorted(markets)}")
    worst = 0
    for row in parsed_rows:
        old = row["old"]
        recent = row["recent"]
        st = row["exit_status"]
        if not (old <= win_lo and recent >= win_hi):     # OLD/RECENT must bracket the forward window
            return {"exit_status": 9, "label": "survivorship-stale: recall=upper-bound"}
        if st == 9:
            return {"exit_status": 9, "label": "survivorship-stale: recall=upper-bound"}
        worst = max(worst, st)
    if worst != 0:
        return {"exit_status": worst, "label": "survivorship-biased: recall=upper-bound"}
    return {"exit_status": 0, "label": "clean (probe PASS, dates bracket forward window)"}


def shadow_forward_window(extract: dict, kill_rule: dict, panel, fallback: tuple[date, date]) -> tuple[date, date]:
    dates = V.panel_trading_days(panel)
    lo, hi = fallback
    for pk, ext in extract.items():
        if ext.run_id is None:
            continue
        h_star, _ = _track_config(kill_rule, _track_of(pk))
        if ext.selection_as_of is None and SR._is_weekly_period_key(pk):
            continue
        sel_date = ext.selection_as_of if ext.selection_as_of is not None else (pk + "-01")
        sel_idx = _sel_idx(dates, sel_date)
        if sel_idx < 0:
            continue
        target_idx = sel_idx + V.ENTRY_OFFSET_DAYS + V.HORIZON_DAYS[h_star] + V.ENTRY_GAP_DAYS
        lo = min(lo, date.fromisoformat(f"{dates[sel_idx][:4]}-{dates[sel_idx][4:6]}-{dates[sel_idx][6:8]}"))
        if target_idx < len(dates):
            hi_key = dates[target_idx]
            hi = max(hi, date.fromisoformat(f"{hi_key[:4]}-{hi_key[4:6]}-{hi_key[6:8]}"))
    return lo, hi


# ===========================================================================
# forward engine reuse (panel + winners + size tiers) — all REUSE V.*
# ===========================================================================
def shadow_panel_days(start_month: date, end_month: date) -> list:
    """DUPLICATE of validate_tier0_ic _build_real_providers panel-day logic (2296-2302) — NOT a
    refactor of the frozen provider builder. lookback(450d) + +210d forward tail (load-bearing for
    the long 126-bar horizon maturity, §2.5). weekday filter."""
    import screen_shortlist_tier0 as S          # for BPP_LOOKBACK_CALENDAR_DAYS (lazy, like the frozen path)
    from datetime import timedelta
    panel_start = date(start_month.year, start_month.month, 1) - timedelta(days=S.BPP_LOOKBACK_CALENDAR_DAYS)
    panel_end = min(date.today(), end_month + timedelta(days=210))
    span = (panel_end - panel_start).days + 1
    all_days = [panel_end - timedelta(days=o) for o in range(span)]
    return sorted(d.strftime("%Y%m%d") for d in all_days if d.weekday() < 5)


def _sel_idx(dates: Sequence[str], sel_date_str: str) -> int:
    import bisect
    return bisect.bisect_right(list(dates), _yyyymmdd(sel_date_str)) - 1


def _horizon_matured(dates: Sequence[str], sel_idx: int, h: str) -> bool:
    """§2.5: a (period,horizon) cell is evaluable only after entry(t+1)+HORIZON_DAYS[h]+ENTRY_GAP
    trading bars exist in the panel beyond the selection bar (trading-bar index, not calendar)."""
    need = sel_idx + V.ENTRY_OFFSET_DAYS + V.HORIZON_DAYS[h] + V.ENTRY_GAP_DAYS
    return need < len(dates)


def _winner_returns(panel, dates, tickers, sel_idx, h):
    """FIX-I winner basis via per-ticker compute_forward_return (status-aware — compute_month_forward
    collapses status to counts, §2.4). Keep ok/gap (alive); exclude delisted/absent/insufficient.
    Returns ({ticker: ret}, gap_count). 'gap' tickers resumed trading (alive_after); the precise
    last-bar trdval>0 thin-print refinement is reported via gap_count (verdict-run hardening)."""
    out: dict = {}
    gap = 0
    thin_gap = 0
    for tk in tickers:
        ret, st = V.compute_forward_return(panel, dates, tk, sel_idx, V.HORIZON_DAYS[h])
        if st == "gap":
            gap += 1
            if not _gap_return_has_trdval(panel, dates, tk, sel_idx, h):
                thin_gap += 1
                continue
        if st in ("ok", "gap") and not V._is_nan(ret):
            out[tk] = ret
    return out, gap, thin_gap


def _panel_row(panel, dates, ticker: str, idx: int):
    if idx < 0 or idx >= len(dates):
        return None
    return panel.get(dates[idx], {}).get(ticker)


def _gap_return_has_trdval(panel, dates, ticker: str, sel_idx: int, h: str) -> bool:
    entry_idx = sel_idx + V.ENTRY_OFFSET_DAYS
    p0, used_entry = V._first_price_from(panel, dates, ticker, entry_idx, entry_idx + V.ENTRY_GAP_DAYS)
    if V._is_nan(p0):
        return False
    target_idx = used_entry + V.HORIZON_DAYS[h]
    for j in range(min(target_idx, len(dates) - 1), used_entry, -1):
        row = _panel_row(panel, dates, ticker, j)
        if row is not None and row.close > 0:
            return row.trdval > 0
    for j in range(target_idx + 1, len(dates)):
        row = _panel_row(panel, dates, ticker, j)
        if row is not None and row.close > 0:
            return row.trdval > 0
    return False


def shadow_size_tiers(panel, dates, snap_tickers, sel_date_str):
    """Reconstruct StockRaw (market_cap + trdvals) from the PIT panel for the snapshot ticker set,
    then canonical_size_tiers over the WHOLE snapshot universe (§2.3). None if any ticker lacks
    panel mktcap → caller treats largemid as NOT_APPLICABLE_NO_SIZE_INPUT."""
    series = V.build_series_by_ticker(panel, dates)
    sliced = V.slice_series_at(series, _yyyymmdd(sel_date_str))
    stocks = []
    for tk in snap_tickers:
        s = sliced.get(tk)
        if not s or not s.get("closes"):
            return None
        mcap = s.get("mktcap_at")
        if mcap is None or V._is_nan(mcap):
            return None
        stocks.append(F.StockRaw(ticker=tk, sector="", market_cap=mcap,
                                 closes=s["closes"], trdvals=s["trdvals"], highs=s["highs"]))
    if not stocks:
        return None
    return V.canonical_size_tiers(stocks)


def _spearman_ic(score_by_ticker: dict, fwd: dict) -> float:
    """per-period rank-IC = spearman(snapshot tier0_score, forward return) over shared tickers."""
    common = [tk for tk in score_by_ticker if tk in fwd and not V._is_nan(fwd[tk])]
    if len(common) < 3:
        return _NAN
    return F.spearman_ic([score_by_ticker[tk] for tk in common], [fwd[tk] for tk in common])


def _tie_fraction(score_by_ticker: dict) -> float:
    """numeric(12,2) quantization → fraction of scores that collide at 2-decimal granularity (§4.4)."""
    vals = [round(v, 2) for v in score_by_ticker.values() if not V._is_nan(v)]
    if not vals:
        return _NAN
    from collections import Counter
    c = Counter(vals)
    tied = sum(n for n in c.values() if n > 1)
    return tied / len(vals)


def _ic_ir_ddof1(per_period_ics: Sequence[float]) -> float:
    """ddof=1 (small-sample) — NOT V.ic_information_ratio (ddof=0 biases IR high at small n, §4.4)."""
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
class _ArmCell:
    selected_all: set
    selected_by_horizon: dict
    recall: Any                        # V.RecallReport
    counterfactual_cut: set


@dataclass
class ShadowPeriodResult:
    period_key: str
    track: str
    regime: str
    eligible: bool
    universe_size: int = 0
    sel_idx: int = -1
    winners_all: set = field(default_factory=set)
    winners_by_horizon: dict = field(default_factory=dict)
    fwd_by_horizon: dict = field(default_factory=dict)     # full {ticker: ret} (ok/gap) per horizon — co-gate IC return side
    snapshot_score_by_horizon: dict = field(default_factory=dict)
    n_winners_by_horizon: dict = field(default_factory=dict)
    per_arm: dict = field(default_factory=dict)
    matured_horizons: set = field(default_factory=set)
    sector_source_absent: bool = False
    gap_winner_count: int = 0
    thin_gap_excluded_count: int = 0
    panel_status_counts: dict = field(default_factory=dict)
    delisted_fraction: float = _NAN
    absent_fraction: float = _NAN
    reason_code: Optional[str] = None


def _track_of(period_key: str) -> str:
    return "short" if SR._is_weekly_period_key(period_key) else "midlong"


def _require_regime(kill_rule: dict, period_key: str) -> str:
    _se_require_dict(kill_rule, "kill_rule")
    rbp = _se_get(kill_rule, "regime_by_period_key", "kill_rule")
    vocab = _se_get(kill_rule, "regime_vocab", "kill_rule")
    if not isinstance(rbp, dict) or not isinstance(vocab, list):
        raise ShadowEvalInputError("kill_rule.regime_by_period_key/regime_vocab missing or wrong-type")
    for i, v in enumerate(vocab):
        if not isinstance(v, str):
            raise ShadowEvalInputError(f"kill_rule.regime_vocab[{i}] must be str, got {type(v).__name__}")
    if period_key not in rbp:
        raise ShadowEvalInputError(f"regime_unregistered: {period_key!r}")
    reg = rbp[period_key]
    if not isinstance(reg, str):
        raise ShadowEvalInputError(f"kill_rule.regime_by_period_key[{period_key!r}] must be str")
    if reg not in vocab:
        raise ShadowEvalInputError(f"regime_unregistered: {reg!r} not in vocab")
    return reg


def _eligible_set(coverage: Any) -> set:
    """PR-B4 reconcile coverage → set of 'complete' period_keys (only those score; §1.2)."""
    cov = _se_require_dict(coverage, "coverage")
    periods = _se_require_list(_se_get(cov, "periods", "coverage"), "coverage.periods")
    out: set[str] = set()
    for i, p in enumerate(periods):
        row = _se_require_dict(p, f"coverage.periods[{i}]")
        pk = _se_str(row, "period_key", f"coverage.periods[{i}]")
        status = _se_str(row, "status", f"coverage.periods[{i}]")
        if status not in ("complete", "missing", "anomaly"):
            raise ShadowEvalInputError(f"coverage.periods[{i}]: bad status {status!r}")
        if status == "complete":
            out.add(pk)
    return out


def _track_config(kill_rule: dict, track: str) -> tuple[str, int]:
    kr = _se_require_dict(kill_rule, "kill_rule")
    tracks = _se_require_dict(_se_get(kr, "tracks", "kill_rule"), "kill_rule.tracks")
    if track not in tracks:
        raise ShadowEvalInputError(f"kill_rule.tracks missing track {track!r}")
    cfg = _se_require_dict(tracks[track], f"kill_rule.tracks[{track}]")
    h_star = _se_str(cfg, "primary_horizon", f"kill_rule.tracks[{track}]")
    if h_star not in V.HARVEST_BUCKETS:
        raise ShadowEvalInputError(f"kill_rule.tracks[{track}]: bad primary_horizon {h_star!r}")
    power_floor_n = _se_int(cfg, "power_floor_n", f"kill_rule.tracks[{track}]")
    if power_floor_n < _DATA_FLOOR:
        raise ShadowEvalInputError(f"kill_rule.tracks[{track}]: power_floor_n must be >= {_DATA_FLOOR}")
    return h_star, power_floor_n


def _run_date_stale_max_days(kill_rule: dict) -> int:
    return _se_int(_se_require_dict(kill_rule, "kill_rule"), "run_date_stale_max_days", "kill_rule")


def _period_stale_reason(ext: ShadowExtract, kill_rule: dict) -> Optional[str]:
    if ext.as_of is not None and ext.selection_as_of is not None:
        if date.fromisoformat(ext.as_of) >= date.fromisoformat(ext.selection_as_of):
            return "asof_stale"
    if ext.run_date is not None and ext.selection_as_of is not None:
        age_days = (date.fromisoformat(ext.selection_as_of) - date.fromisoformat(ext.run_date)).days
        if age_days > _run_date_stale_max_days(kill_rule):
            return "run_date_stale"
    return None


def _panel_forward_status_counts(panel, dates, tickers, sel_idx: int, h: str) -> dict:
    counts = {st: 0 for st in ("ok", "gap", "delisted", "insufficient", "absent")}
    for tk in tickers:
        _ret, st = V.compute_forward_return(panel, dates, tk, sel_idx, V.HORIZON_DAYS[h])
        if st not in counts:
            raise ShadowEvalInputError(f"unknown_forward_status: {st!r}")
        counts[st] += 1
    return counts


def harvest_shadow_periods(*, panel, extract: dict, coverage: Any, kill_rule: dict,
                           arms: Sequence[str]) -> list:
    """Per eligible period: build SHARED frozen winners on the snapshot ticker set, call
    gate_a_recall ONCE PER ARM with the SAME (identical-object) denominators. No DB write."""
    dates = V.panel_trading_days(panel)
    elig = _eligible_set(coverage)
    out: list = []
    for pk, ext in extract.items():
        if ext.run_id is None:                          # FIX-J anchor empty → mirror absent
            raise ShadowEvalInputError("mirror_arm_absent")
        track = _track_of(pk)
        regime = _require_regime(kill_rule, pk)
        if pk not in elig:                              # missing/anomaly → INCOMPLETE, never scored 0
            out.append(ShadowPeriodResult(pk, track, regime, eligible=False,
                                          reason_code="period_not_complete"))
            continue
        stale_reason = _period_stale_reason(ext, kill_rule)
        if stale_reason is not None:
            out.append(ShadowPeriodResult(pk, track, regime, eligible=False, reason_code=stale_reason))
            continue
        if ext.selection_as_of is None and SR._is_weekly_period_key(pk):
            out.append(ShadowPeriodResult(pk, track, regime, eligible=False,
                                          reason_code="forward_insufficient"))
            continue
        sel_date = ext.selection_as_of if ext.selection_as_of is not None else (pk + "-01")
        sel_idx = _sel_idx(dates, sel_date)
        if sel_idx < 0:
            out.append(ShadowPeriodResult(pk, track, regime, eligible=False, reason_code="forward_insufficient"))
            continue
        snap_tickers = ext.snapshot_tickers
        h_star, _ = _track_config(kill_rule, track)
        panel_counts = _panel_forward_status_counts(panel, dates, snap_tickers, sel_idx, h_star)
        delisted_fraction = (panel_counts["delisted"] / len(snap_tickers)) if snap_tickers else _NAN
        absent_fraction = (panel_counts["absent"] / len(snap_tickers)) if snap_tickers else _NAN
        if not V._is_nan(absent_fraction) and absent_fraction > PANEL_ABSENT_MAX:
            out.append(ShadowPeriodResult(
                pk, track, regime, eligible=False, universe_size=ext.universe_size, sel_idx=sel_idx,
                panel_status_counts=panel_counts, delisted_fraction=delisted_fraction,
                absent_fraction=absent_fraction,
                reason_code="panel_survivorship_unverified"))
            continue
        win_by_h: dict = {}
        fwd_by_h: dict = {}
        gap_total = 0
        thin_total = 0
        for h in V.HARVEST_BUCKETS:
            fwd_h, gap, thin_gap = _winner_returns(panel, dates, snap_tickers, sel_idx, h)
            gap_total += gap
            thin_total += thin_gap
            fwd_by_h[h] = fwd_h
            win_by_h[h] = V.top_decile_winners(fwd_h)
        winners_all = set().union(*win_by_h.values()) if win_by_h else set()
        tier_of = shadow_size_tiers(panel, dates, snap_tickers, sel_date)
        largemid_winners = ({tk for tk in winners_all if tier_of.get(tk) in ("large", "mid")}
                            if tier_of is not None else set())
        matured = {h for h in V.HARVEST_BUCKETS if _horizon_matured(dates, sel_idx, h)}
        per_arm: dict = {}
        for arm in arms:
            af = ext.per_arm.get(arm)
            if af is None:
                continue
            lm_sel = ({tk for tk in af.selected_all if tier_of.get(tk) in ("large", "mid")}
                      if tier_of is not None else set())
            rep = V.gate_a_recall(
                af.selected_all, af.selected_by_horizon, winners_all, win_by_h, ext.universe_size,
                largemid_selected=lm_sel, largemid_winners=largemid_winners,
                leader_basket=V.LEADER_BASKET_2026_06)
            per_arm[arm] = _ArmCell(af.selected_all, af.selected_by_horizon, rep, af.counterfactual_cut)
        sector_absent = all(ext.per_arm[a].sector_source_absent
                            for a in arms if a in ext.per_arm and a != _MIRROR) \
            if any(a != _MIRROR for a in arms if a in ext.per_arm) else False
        out.append(ShadowPeriodResult(
            pk, track, regime, eligible=True, universe_size=ext.universe_size, sel_idx=sel_idx,
            winners_all=winners_all, winners_by_horizon=win_by_h, fwd_by_horizon=fwd_by_h,
            snapshot_score_by_horizon=ext.snapshot_score_by_horizon,
            n_winners_by_horizon={h: len(win_by_h[h]) for h in V.HARVEST_BUCKETS},
            per_arm=per_arm, matured_horizons=matured, sector_source_absent=sector_absent,
            gap_winner_count=gap_total, thin_gap_excluded_count=thin_total,
            panel_status_counts=panel_counts, delisted_fraction=delisted_fraction,
            absent_fraction=absent_fraction))
    return out


# ===========================================================================
# aggregation → verdict (NEW; reuses _ci90 / gate_a_pass_selective_largemid PREDICATE / _mean)
# ===========================================================================
def _decimate_nonoverlap(rows: list, h: str) -> list:
    """§4.0: greedy non-overlapping forward windows — keep a period only if its sel_idx >= prior
    kept sel_idx + HORIZON_DAYS[h]. Counters use the post-decimation n (the verdict-floor n)."""
    kept: list = []
    last = None
    for r in sorted(rows, key=lambda r: r.sel_idx):
        if last is None or r.sel_idx >= last + V.HORIZON_DAYS[h]:
            kept.append(r)
            last = r.sel_idx
    return kept


def _regime_advisory(kept: list) -> list:
    """§4.0 ADVISORY (not a mechanical FAIL): flag single-regime + beta-orthogonalization-pending."""
    flags: list = []
    regimes = {r.regime for r in kept}
    if len(regimes) < 2:
        flags.append("single_regime_or_beta_confounded")
    # beta_orthogonalized_lift lands as null (§7.5b) → orthogonalization deferred to the verdict run.
    flags.append("beta_orthogonalization_pending")
    return flags


def _run_incomplete(reason: str, arms, kill_rule: dict, generated_at: str) -> dict:
    return {
        "run_verdict": reason if reason.startswith("INCOMPLETE_RUN") else "INCOMPLETE_RUN",
        "reason_code": reason, "user_review_required": False, "advisory_flags": [],
        "triple_gate_all_pass": False, "cells": [], "tracks": {},
        "generated_at": generated_at,
        "parameter_lock_commit_hash": kill_rule.get("parameter_lock_commit_hash"),
        "freeze_tag": kill_rule.get("freeze_tag"),
        "claim_discipline": "shadow generation-stage counterfactual observation (verification pending)",
        "no_apply": True,
    }


def _score_cell(elig: list, arm: str, track: str, kill_rule: dict, survivorship: Optional[dict]) -> dict:
    h_star, power_floor_n = _track_config(kill_rule, track)
    base = {"arm": arm, "track": track, "horizon": h_star,
            "gate_b": {"verdict": "NOT_APPLICABLE", "reason_code": "DIRECTIONAL_GATE_B_NA"},
            "gate_c": {"verdict": "NOT_APPLICABLE"}}
    # survivorship hard refusal first (§5)
    if not survivorship or survivorship.get("exit_status") != 0:
        return {**base, "verdict": "INCOMPLETE_RUN", "reason_code": "survivorship_failed",
                "gate_a": {"pass": False}}
    rows = [r for r in elig if r.track == track]
    kept = _decimate_nonoverlap(rows, h_star)
    series, ics, rec_shadow, rec_mirror, n_win = [], [], [], [], 0
    regime_lifts: dict[str, list[float]] = {}
    for r in kept:
        if h_star not in r.matured_horizons:            continue   # forward_insufficient
        if r.n_winners_by_horizon.get(h_star, 0) < _WINNERS_FLOOR:  continue   # winners_below_floor
        if arm not in r.per_arm or _MIRROR not in r.per_arm:        continue   # arm_missing
        rec_arm = r.per_arm[arm].recall.per_horizon.get(h_star, _NAN)
        rec_mir = r.per_arm[_MIRROR].recall.per_horizon.get(h_star, _NAN)
        if V._is_nan(rec_arm) or V._is_nan(rec_mir):    continue
        lift = rec_arm - rec_mir
        series.append(lift)                            # PRIMARY paired lift (NEW; NOT recall-random)
        rec_shadow.append(rec_arm)
        rec_mirror.append(rec_mir)
        regime_lifts.setdefault(r.regime, []).append(lift)
        ics.append(_spearman_ic(r.snapshot_score_by_horizon.get(h_star, {}),
                                r.fwd_by_horizon.get(h_star, {})))
        n_win += r.n_winners_by_horizon.get(h_star, 0)
    n = len(series)
    if n < _DATA_FLOOR:
        return {**base, "verdict": "INCOMPLETE_RUN", "reason_code": "n_below_data_floor",
                "n_periods": n, "n_nonoverlap": len(kept), "gate_a": {"pass": False}}
    lift_mean = V._mean(series)
    recall_shadow = V._mean(rec_shadow)
    recall_mirror = V._mean(rec_mirror)
    regime_stratified_lift = {reg: V._mean(vals) for reg, vals in sorted(regime_lifts.items())}
    ci = V._ci90(series)                                # LOCKED 5/95; FWER via power_floor_n, not CI-widening
    ic_ir = _ic_ir_ddof1(ics)
    if n < power_floor_n:                               # VERDICT floor → DIRECTIONAL, never PASS
        return {**base, "verdict": "DIRECTIONAL", "reason_code": "DIRECTIONAL_POWER_FLOOR",
                "n_periods": n, "n_nonoverlap": len(kept), "period_lift_mean": lift_mean,
                "recall_shadow": recall_shadow, "recall_mirror": recall_mirror,
                "regime_stratified_lift": regime_stratified_lift,
                "ci90": ci, "ic_ir": ic_ir, "gate_a": {"pass": False}}
    if V._is_nan(ci[0]):                                # +5pp NaN-fallback DISABLED on shadow path
        return {**base, "verdict": "INCOMPLETE_RUN", "reason_code": "n_below_data_floor",
                "n_periods": n, "gate_a": {"pass": False}}
    ga_pass, fails = V.gate_a_pass_selective_largemid(ci, lift_mean, ic_ir)   # PREDICATE only
    # Stage-1: full Gate B NOT_APPLICABLE → PASS structurally blocked → DIRECTIONAL_GATE_B_NA.
    advisory = _regime_advisory([r for r in kept if h_star in r.matured_horizons])
    return {**base, "verdict": "DIRECTIONAL", "reason_code": "DIRECTIONAL_GATE_B_NA",
            "n_periods": n, "n_nonoverlap": len(kept), "period_lift_mean": lift_mean,
            "recall_shadow": recall_shadow, "recall_mirror": recall_mirror,
            "regime_stratified_lift": regime_stratified_lift,
            "ci90": ci, "ic_ir": ic_ir, "ic_tie_fraction": _cell_tie_fraction(kept, h_star),
            "gate_a": {"pass": ga_pass, "fails": fails},
            "n_winners": n_win, "beta_orthogonalized_lift": None,
            "advisory_flags": advisory}


def _cell_tie_fraction(kept: list, h_star: str) -> float:
    fracs = [_tie_fraction(r.snapshot_score_by_horizon.get(h_star, {})) for r in kept]
    present = [f for f in fracs if not V._is_nan(f)]
    return (sum(present) / len(present)) if present else _NAN


def _rollup(cells: list, tracks_seen: list) -> dict:
    order = {"PASS": 3, "DIRECTIONAL": 2, "INCOMPLETE_RUN": 1, "INVALID_INPUT": 0}
    advisory_flags: list = []
    per_track: dict = {}
    for tr in tracks_seen:
        tcells = [c for c in cells if c["track"] == tr]
        worst = min((c["verdict"] for c in tcells), key=lambda v: order.get(v, 1)) if tcells else "INCOMPLETE_RUN"
        per_track[tr] = worst
    if any(c["verdict"] == "INVALID_INPUT" for c in cells):
        top = "INVALID_INPUT"
    else:
        top = min(per_track.values(), key=lambda v: order.get(v, 1)) if per_track else "INCOMPLETE_RUN"
    for c in cells:
        for fl in c.get("advisory_flags", []):
            if fl not in advisory_flags:
                advisory_flags.append(fl)
    tga = bool(cells) and all(c.get("gate_a", {}).get("pass") and c["gate_b"]["verdict"] == "PASS"
                              and c["gate_c"]["verdict"] == "PASS"
                              for c in cells)
    user_review = bool(advisory_flags) and top in ("PASS", "DIRECTIONAL")
    return {"verdict": top, "per_track": per_track, "advisory_flags": advisory_flags,
            "triple_gate_all_pass": tga, "user_review_required": user_review}


def _warning_summary(period_results: Sequence) -> list:
    gap_total = sum(r.gap_winner_count for r in period_results)
    thin_total = sum(r.thin_gap_excluded_count for r in period_results)
    delisted = [
        {"period_key": r.period_key, "track": r.track, "delisted_fraction": r.delisted_fraction,
         "absent_fraction": r.absent_fraction,
         "panel_status_counts": r.panel_status_counts}
        for r in period_results
        if r.panel_status_counts
    ]
    warnings: list = []
    if gap_total or thin_total or delisted:
        warnings.append({"code": "forward_panel_status_counts",
                         "gap_winner_count": gap_total,
                         "thin_gap_excluded_count": thin_total,
                         "delisted_fraction_by_period": delisted})
    return warnings


def _hard_gate_counterfactual(period_results: Sequence, kill_rule: dict) -> dict:
    periods: list = []
    total = 0
    for r in period_results:
        if not r.eligible or "sector-hard-gate" not in r.per_arm:
            continue
        h_star, _ = _track_config(kill_rule, r.track)
        if h_star not in r.matured_horizons:
            continue
        cut = r.per_arm["sector-hard-gate"].counterfactual_cut & r.winners_all
        leaders = []
        fwd = r.fwd_by_horizon.get(h_star, {})
        for tk in sorted(cut):
            if tk in fwd and not V._is_nan(fwd[tk]):
                leaders.append({"ticker": tk, "forward_return": fwd[tk]})
            else:
                leaders.append({"ticker": tk, "forward_return": None})
        total += len(leaders)
        if leaders:
            periods.append({"period_key": r.period_key, "track": r.track, "horizon": h_star,
                            "gate_cut_leader_count": len(leaders), "gate_cut_leaders": leaders})
    return {"claim_discipline": "counterfactual observation only; no production apply",
            "universe_size_basis": "full_pre_cut",
            "total_gate_cut_leader_count": total,
            "periods": periods}


def aggregate_shadow_harvest(period_results: Sequence, *, kill_rule: dict, arms: Sequence[str],
                             generated_at: str, survivorship: Optional[dict] = None) -> dict:
    tracks_cfg = _se_require_dict(_se_get(_se_require_dict(kill_rule, "kill_rule"), "tracks", "kill_rule"),
                                  "kill_rule.tracks")
    if not isinstance(survivorship, dict) or survivorship.get("exit_status") != 0:
        rep = _run_incomplete("survivorship_failed", arms, kill_rule, generated_at)
        rep["survivorship_label"] = (survivorship or {}).get("label", "survivorship-unknown: blocked")
        rep["warnings"] = _warning_summary(period_results)
        return rep
    elig = [r for r in period_results if r.eligible]
    if not elig:
        rep = _run_incomplete("no_eligible_periods", arms, kill_rule, generated_at)
        rep["warnings"] = _warning_summary(period_results)
        return rep
    if all(r.sector_source_absent for r in elig):
        rep = _run_incomplete("INCOMPLETE_RUN_PLUMBING_ONLY", arms, kill_rule, generated_at)
        rep["warnings"] = _warning_summary(period_results)
        return rep
    non_mirror = [a for a in arms if a != _MIRROR]
    tracks = list(tracks_cfg.keys())
    m_fwer = max(1, len(non_mirror) * len(tracks_cfg))
    alpha_corr_advisory = 0.10 / m_fwer
    cells: list = []
    for track in tracks:
        if track not in tracks_cfg:
            raise ShadowEvalInputError(f"kill_rule.tracks missing track {track!r}")
        for arm in non_mirror:
            cells.append(_score_cell(elig, arm, track, kill_rule, survivorship))
    roll = _rollup(cells, tracks)
    return {
        "run_verdict": roll["verdict"], "per_track_verdict": roll["per_track"],
        "user_review_required": roll["user_review_required"],
        "advisory_flags": roll["advisory_flags"],
        "triple_gate_all_pass": roll["triple_gate_all_pass"],
        "cells": cells, "n_arms": len(arms), "m_fwer": m_fwer,
        "alpha_corr_advisory": alpha_corr_advisory, "fwer_via_power_floor_n": True,
        "hard_gate_counterfactual": _hard_gate_counterfactual(period_results, kill_rule),
        "warnings": _warning_summary(period_results),
        "generated_at": generated_at,
        "parameter_lock_commit_hash": kill_rule.get("parameter_lock_commit_hash"),
        "freeze_tag": kill_rule.get("freeze_tag"),
        "survivorship_label": (survivorship or {}).get("label", "survivorship-unknown: blocked"),
        "claim_discipline": "shadow generation-stage counterfactual observation (verification pending)",
        "no_apply": True,
    }


def _json_safe(value: Any) -> Any:
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if isinstance(value, dict):
        return {k: _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(v) for v in value]
    return value


def emit_shadow_verdict(report: dict, out_path: Path) -> None:
    safe_report = _json_safe(report)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(safe_report, ensure_ascii=False, indent=2, allow_nan=False))
    out_path.with_suffix(".md").write_text(_markdown_verdict(safe_report), encoding="utf-8")


def _markdown_verdict(report: dict) -> str:
    lines = [
        "# PR-B5 Shadow Forward Recall Verdict",
        "",
        f"- run_verdict: {report.get('run_verdict')}",
        f"- per_track: {report.get('per_track_verdict', report.get('tracks', {}))}",
        f"- survivorship_label: {report.get('survivorship_label', '')}",
        f"- claim_discipline: {report.get('claim_discipline', '')}",
        f"- no_apply: {report.get('no_apply')}",
        "",
        "| arm | track | horizon | verdict | reason | n | lift | ci90 | gate_a | gate_b | gate_c |",
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    for cell in report.get("cells", []):
        ci = cell.get("ci90")
        lines.append(
            "| {arm} | {track} | {horizon} | {verdict} | {reason} | {n} | {lift} | {ci} | {ga} | {gb} | {gc} |".format(
                arm=cell.get("arm"),
                track=cell.get("track"),
                horizon=cell.get("horizon"),
                verdict=cell.get("verdict"),
                reason=cell.get("reason_code"),
                n=cell.get("n_periods"),
                lift=cell.get("period_lift_mean"),
                ci=ci,
                ga=cell.get("gate_a", {}).get("pass"),
                gb=cell.get("gate_b", {}).get("verdict"),
                gc=cell.get("gate_c", {}).get("verdict"),
            )
        )
    lines.append("")
    return "\n".join(lines)
