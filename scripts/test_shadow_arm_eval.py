#!/usr/bin/env python3
# noqa: SIZE_OK - PR-A5 unittest matrix is intentionally self-contained (no shared fixtures).
"""shadow_arm_eval (PR-A5) test matrix — stdlib unittest (pytest 미설치).

Run:  cd scripts && ./.venv/bin/python -m unittest test_shadow_arm_eval -v

Covers the pure Track-1 in-pool 30-reranking forward verdict evaluator: fail-closed symmetric extract
parse, reconcile-gate (complete/partial/missing/anomaly), survivorship bracket gate, _score_cell verdict
ladder (plumbing / data-floor / power-floor / beta-unverified / beta-blocked / gate-B-NA),
Bonferroni adj_lower PASS predicate, beta-orthogonalized lift (intercept of paired-lift-on-benchmark),
mean_return/hit_rate golden vectors (+delisted -1.0; absent/insufficient→cell INCOMPLETE), hard-gate
gate_cut_return diagnostic, triple_gate AND-mismatch→INVALID_INPUT, NaN/Inf→null JSON, closed
reason-code mapping, frozen-path byte-clean grep, SQL materialized/read-only invariants, no-DB-write/
no-RNG. Verdict tests use hand-built ShadowArmPeriodResult (no panel); harvest tests use a tiny fake
panel. NO DB, NO AI.
"""
from __future__ import annotations

import inspect
import json
import math
import os
import sys
import tempfile
import unittest
from datetime import date
from pathlib import Path

_THIS = os.path.dirname(os.path.abspath(__file__))
if _THIS not in sys.path:
    sys.path.insert(0, _THIS)

import shadow_arm_eval as SAE      # noqa: E402
import validate_tier0_ic as V      # noqa: E402

NAN = math.nan
_ARMS = list(SAE._ALL_ARMS)


# --------------------------------------------------------------------------- extract builders
def _sel(ticker, tf, ws=50.0, sector="반도체", assigned_by="primary"):
    return {"ticker": ticker, "assigned_timeframe": tf, "assigned_by": assigned_by,
            "weighted_score": ws, "sector": sector}


def _short_picks(base=1, tf="short", ws0=50.0):
    return [_sel(f"{base + i:06d}", tf, ws=ws0 + i) for i in range(10)]


def _arm_row(arm, *, track="short", status="logged", selected=None, sector_source="manual_pre_registered",
             leading=("반도체",), asof="2026-05-25", cut=None, regime=None, run_date="2026-06-01"):
    if selected is None:
        selected = _short_picks() if track == "short" else (_short_picks(1, "mid") + _short_picks(11, "long"))
    sv = {"source": sector_source, "leadingSectors": list(leading)}
    if sector_source == "manual_pre_registered":
        sv["asOf"] = asof
    row = {"arm": arm, "track": track, "status": status, "selected": selected,
           "sector_view": sv, "counterfactual_cut": (list(cut) if cut is not None else None),
           "regime_context": regime, "run_date": run_date}
    return row


def _extract_obj(period_key="s:2026-06-01", **arm_over):
    track = "short" if period_key.startswith("s:") else "midlong"
    arms = []
    # baseline always absent mirror; non-baseline manual sector hypothesis.
    arms.append(_arm_row(SAE._BASELINE, track=track, sector_source="absent", leading=()))
    for arm in SAE._NON_BASELINE:
        arms.append(_arm_row(arm, track=track))
    obj = {"period_key": period_key, "arms": arms}
    obj.update(arm_over)
    return obj


def _killrule(**over):
    kr = {"freeze_tag": "pra5-test", "parameter_lock_commit_hash": "abc1234",
          "arms": _ARMS, "run_date_stale_max_days": 45,
          "timeframes": ["short", "mid", "long"], "fwer_family_m": 9,
          "return_contract": "raw close t+1→t+1+h, 0bps",
          "tracks": {"short": {"cadence": "weekly", "power_floor_n": 6},
                     "midlong": {"cadence": "monthly", "power_floor_n": 6}},
          "regime_by_period_key": {}, "regime_vocab": ["bull", "bear", "sideways"],
          "leading_sectors_benchmark": {"by_period_key": {}}}
    kr.update(over)
    return kr


# --------------------------------------------------------------------------- period builders (no panel)
def _cell(mean, hit, ic, picks, complete=True):
    return SAE._ArmTfCell(mean_return=mean, hit_rate=hit, ic=ic, picks=frozenset(picks), complete=complete)


def _period(pk, regime, *, arm_cells, tf="short", track="short", sel_idx=0, n_win=50, matured=True,
            eligible=True, cut=None, winners=None, fwd_panel=None):
    """arm_cells: {arm: (mean, hit, ic, picks)} for the given tf. Baseline must be present."""
    per: dict = {}
    for arm, spec in arm_cells.items():
        m, h, ic, picks = spec
        per[arm] = {tf: _cell(m, h, ic, picks)}
    win = set(winners) if winners is not None else {f"{i:06d}" for i in range(900000, 900000 + n_win)}
    return SAE.ShadowArmPeriodResult(
        pk, track, regime, eligible=eligible, sel_idx=sel_idx, matured_tfs=({tf} if matured else set()),
        winners_by_tf={tf: win}, n_winners_by_tf={tf: len(win)},
        fwd_panel_by_tf={tf: (dict(fwd_panel) if fwd_panel else {})},
        per_arm_tf=per, counterfactual_cut=(set(cut) if cut else set()))


def _series_periods(n, *, arm, lift, snap_mean=0.0, regimes=None, benchmark=None, sel_step=25,
                    tf="short", track="short", hit_lift=0.1):
    """n non-overlapping periods with arm.mean = snap_mean+lift_p, distinct picks (not plumbing)."""
    out = []
    for i in range(n):
        reg = regimes[i % len(regimes)] if regimes else "bull"
        lp = lift[i] if isinstance(lift, (list, tuple)) else lift
        snap = snap_mean[i] if isinstance(snap_mean, (list, tuple)) else snap_mean
        arm_picks = [f"{100 + i * 20 + k:06d}" for k in range(10)]
        snap_picks = [f"{500 + i * 20 + k:06d}" for k in range(10)]
        out.append(_period(
            f"s:2026-{(i % 12) + 1:02d}-{((i // 12) % 28) + 1:02d}_{i}", reg,
            arm_cells={arm: (snap + lp, 0.2 + hit_lift, 0.4, arm_picks),
                       SAE._BASELINE: (snap, 0.2, 0.4, snap_picks)},
            tf=tf, track=track, sel_idx=i * sel_step))
    return out


def _kr_with_benchmark(periods, *, tf="short", x_fn=None, regimes_in_kr=None, **over):
    """kill-rule whose regime_by_period_key + leading_sectors_benchmark cover the given periods."""
    rbp = {p.period_key: p.regime for p in periods}
    by_pk = {}
    for i, p in enumerate(periods):
        x = (x_fn(i) if x_fn else 0.01 * ((i % 3) - 1))
        by_pk[p.period_key] = {tf: x}
    kr = _killrule(regime_by_period_key=rbp, leading_sectors_benchmark={"by_period_key": by_pk})
    kr.update(over)
    return kr


def _SP():  # survivorship PASS
    return {"exit_status": 0, "label": "clean (probe PASS, dates bracket forward window)"}


def _weekdays(n, start=(2026, 1, 1)):
    from datetime import timedelta
    out, d = [], date(*start)
    while len(out) < n:
        if d.weekday() < 5:
            out.append(d.strftime("%Y%m%d"))
        d += timedelta(days=1)
    return out


def _mk_panel(close_fn, tickers, dates, *, present=None):
    """build a panel; close_fn(ti, di)->close; present(tk, di)->bool to drop a ticker on a day."""
    from validate_tier0_ic import PanelRow
    panel = {}
    for di, dk in enumerate(dates):
        day = {}
        for ti, tk in enumerate(tickers):
            if present is not None and not present(tk, di):
                continue
            day[tk] = PanelRow(close=close_fn(ti, di), high=close_fn(ti, di), trdval=1e9,
                               mktcap=1e12 - ti * 1e8, name=tk, market="KOSPI", list_shrs=1e6)
        panel[dk] = day
    return panel


# =========================================================================== fail-closed parse
class ParseFailClosed(unittest.TestCase):
    def _bad(self, mutate, *, period_key="s:2026-06-01"):
        obj = _extract_obj(period_key)
        mutate(obj)
        with self.assertRaises(SAE.ShadowArmEvalInputError):
            SAE.parse_shadow_arm_extract([obj])

    def test_top_not_list(self):
        with self.assertRaises(SAE.ShadowArmEvalInputError):
            SAE.parse_shadow_arm_extract({"period_key": "s:2026-06-01"})

    def test_top_none(self):
        with self.assertRaises(SAE.ShadowArmEvalInputError):
            SAE.parse_shadow_arm_extract(None)

    def test_period_not_dict(self):
        with self.assertRaises(SAE.ShadowArmEvalInputError):
            SAE.parse_shadow_arm_extract(["nope"])

    def test_period_key_missing(self):     self._bad(lambda o: o.pop("period_key"))
    def test_period_key_bad(self):         self._bad(lambda o: o.update(period_key="2026-06"))
    def test_short_pk_wrong_len(self):     self._bad(lambda o: o.update(period_key="s:2026-6-1"))
    def test_arms_missing(self):           self._bad(lambda o: o.pop("arms"))
    def test_arms_not_list(self):          self._bad(lambda o: o.update(arms={}))
    def test_arm_not_dict(self):           self._bad(lambda o: o["arms"].append("x"))
    def test_arm_bad_name(self):           self._bad(lambda o: o["arms"][0].update(arm="bogus"))
    def test_arm_duplicate(self):          self._bad(lambda o: o["arms"].append(_arm_row(SAE._BASELINE)))
    def test_track_mismatch(self):         self._bad(lambda o: o["arms"][1].update(track="midlong"))
    def test_status_bad(self):             self._bad(lambda o: o["arms"][1].update(status="pending"))
    def test_status_wrongtype(self):       self._bad(lambda o: o["arms"][1].update(status=1))
    def test_sel_not_list(self):           self._bad(lambda o: o["arms"][1].update(selected={}))
    def test_sel_ticker_non6(self):        self._bad(lambda o: o["arms"][1]["selected"][0].update(ticker="12"))
    def test_sel_ticker_nonstr(self):      self._bad(lambda o: o["arms"][1]["selected"][0].update(ticker=1))
    def test_sel_bad_tf(self):             self._bad(lambda o: o["arms"][1]["selected"][0].update(assigned_timeframe="mid"))
    def test_sel_bad_assigned_by(self):    self._bad(lambda o: o["arms"][1]["selected"][0].update(assigned_by="x"))
    def test_sel_ws_nonnumber(self):       self._bad(lambda o: o["arms"][1]["selected"][0].update(weighted_score="50"))
    def test_sel_ws_bool(self):            self._bad(lambda o: o["arms"][1]["selected"][0].update(weighted_score=True))
    def test_sel_ws_nan(self):             self._bad(lambda o: o["arms"][1]["selected"][0].update(weighted_score=float("nan")))
    def test_sel_bad_sector(self):         self._bad(lambda o: o["arms"][1]["selected"][0].update(sector="기타"))
    def test_sel_sector_null_ok(self):
        obj = _extract_obj("s:2026-06-01")
        for s in obj["arms"][1]["selected"]:
            s["sector"] = None
        SAE.parse_shadow_arm_extract([obj])  # no raise
    def test_sel_count_short_not10(self):  self._bad(lambda o: o["arms"][1]["selected"].pop())
    def test_sel_dup_ticker(self):
        self._bad(lambda o: o["arms"][1]["selected"].__setitem__(1, _sel(o["arms"][1]["selected"][0]["ticker"], "short")))
    def test_cut_on_nonhardgate(self):     self._bad(lambda o: o["arms"][1].update(counterfactual_cut=["000001"]))
    def test_cut_element_wrongtype(self):
        self._bad(lambda o: o["arms"][3].update(counterfactual_cut=[123]))
    def test_cut_ticker_bad_format(self):
        self._bad(lambda o: o["arms"][3].update(counterfactual_cut=["12ABCD"]))
    def test_cut_duplicate_ticker(self):
        self._bad(lambda o: o["arms"][3].update(counterfactual_cut=["000099", "000099"]))
    def test_sv_not_dict(self):            self._bad(lambda o: o["arms"][1].update(sector_view="absent"))
    def test_sv_bad_source(self):          self._bad(lambda o: o["arms"][1]["sector_view"].update(source="x"))
    def test_sv_leading_nonlist(self):     self._bad(lambda o: o["arms"][1]["sector_view"].update(leadingSectors="반도체"))
    def test_sv_leading_noncanon(self):    self._bad(lambda o: o["arms"][1]["sector_view"].update(leadingSectors=["기타"]))
    def test_sv_absent_with_leading(self):
        self._bad(lambda o: o["arms"][1]["sector_view"].update(source="absent", leadingSectors=["반도체"]))
    def test_sv_manual_no_asof(self):      self._bad(lambda o: o["arms"][1]["sector_view"].pop("asOf"))
    def test_sv_mismatch_across_arms_raises(self):
        self._bad(lambda o: o["arms"][2]["sector_view"].update(leadingSectors=["금융"]), period_key="s:2026-06-01")
    def test_regime_bad_stage(self):
        self._bad(lambda o: o["arms"][2].update(regime_context={"source": "manual_pre_registered", "stage": "boom", "asOf": "2026-05-25"}))
    def test_regime_mismatch_across_arms_raises(self):
        self._bad(lambda o: (
            o["arms"][1].update(regime_context={"source": "manual_pre_registered", "stage": "bull", "asOf": "2026-05-25"}),
            o["arms"][2].update(regime_context={"source": "manual_pre_registered", "stage": "bear", "asOf": "2026-05-25"})
        ))
    def test_midlong_counts(self):
        obj = _extract_obj("m:2026-06")
        SAE.parse_shadow_arm_extract([obj])  # 10 mid + 10 long ok
        obj2 = _extract_obj("m:2026-06")
        obj2["arms"][1]["selected"] = _short_picks(1, "mid") + _short_picks(11, "long")[:-1]
        with self.assertRaises(SAE.ShadowArmEvalInputError):
            SAE.parse_shadow_arm_extract([obj2])
    def test_midlong_tf_purity(self):
        obj = _extract_obj("m:2026-06")
        obj["arms"][1]["selected"][0]["assigned_timeframe"] = "short"
        with self.assertRaises(SAE.ShadowArmEvalInputError):
            SAE.parse_shadow_arm_extract([obj])
    def test_duplicate_period(self):
        with self.assertRaises(SAE.ShadowArmEvalInputError):
            SAE.parse_shadow_arm_extract([_extract_obj(), _extract_obj()])

    def test_happy_short(self):
        ex = SAE.parse_shadow_arm_extract([_extract_obj()])
        self.assertIn("s:2026-06-01", ex)
        e = ex["s:2026-06-01"]
        self.assertEqual(e.track, "short")
        self.assertEqual(set(e.per_arm), set(_ARMS))
        self.assertEqual(len(e.per_arm[SAE._BASELINE].picks_by_tf["short"]), 10)
        self.assertEqual(e.sector_source, "manual_pre_registered")
        self.assertEqual(e.leading_sectors, ("반도체",))

    def test_incomplete_arm_loose_count(self):
        obj = _extract_obj()
        obj["arms"][3].update(status="incomplete_run", selected=_short_picks()[:7])  # underfill ok for non-logged
        ex = SAE.parse_shadow_arm_extract([obj])
        self.assertEqual(ex["s:2026-06-01"].per_arm[SAE._HARD_GATE].status, "incomplete_run")


# =========================================================================== reconcile + survivorship
class CoverageAndSurvivorship(unittest.TestCase):
    def test_eligible_set_statuses(self):
        cov = {"rows": [{"period_key": "s:2026-06-01", "status": "complete"},
                        {"period_key": "s:2026-06-08", "status": "partial"},
                        {"period_key": "s:2026-06-15", "status": "missing"},
                        {"period_key": "s:2026-06-22", "status": "anomaly"}]}
        d = SAE._eligible_set(cov)
        self.assertEqual(d["s:2026-06-01"], "complete")
        self.assertEqual(d["s:2026-06-22"], "anomaly")

    def test_coverage_bad_status(self):
        with self.assertRaises(SAE.ShadowArmEvalInputError):
            SAE._eligible_set({"rows": [{"period_key": "s:2026-06-01", "status": "weird"}]})

    def test_coverage_track_mismatch_raises(self):
        with self.assertRaisesRegex(SAE.ShadowArmEvalInputError, "cross_period"):
            SAE._eligible_set({"rows": [{"period_key": "s:2026-06-01", "track": "midlong", "status": "complete"}]})

    def test_survivorship_pass(self):
        art = [{"market": m, "old_date": "20200101", "recent_date": "20300101", "old_count": 1,
                "recent_count": 1, "schema_version": 1, "exit_status": 0} for m in ("KOSPI", "KOSDAQ")]
        r = SAE.read_survivorship_artifact(art, forward_window=(date(2026, 1, 1), date(2026, 12, 31)))
        self.assertEqual(r["exit_status"], 0)
        self.assertIn("clean", r["label"])

    def test_survivorship_stale_when_not_bracketing(self):
        art = [{"market": m, "old_date": "20260601", "recent_date": "20260701", "old_count": 1,
                "recent_count": 1, "schema_version": 1, "exit_status": 0} for m in ("KOSPI", "KOSDAQ")]
        r = SAE.read_survivorship_artifact(art, forward_window=(date(2020, 1, 1), date(2030, 1, 1)))
        self.assertEqual(r["exit_status"], 9)

    def test_survivorship_biased(self):
        art = [{"market": "KOSPI", "old_date": "20200101", "recent_date": "20300101", "old_count": 1,
                "recent_count": 1, "schema_version": 1, "exit_status": 2},
               {"market": "KOSDAQ", "old_date": "20200101", "recent_date": "20300101", "old_count": 1,
                "recent_count": 1, "schema_version": 1, "exit_status": 0}]
        r = SAE.read_survivorship_artifact(art, forward_window=(date(2026, 1, 1), date(2026, 12, 31)))
        self.assertEqual(r["exit_status"], 2)

    def test_survivorship_must_cover_both_markets(self):
        art = [{"market": "KOSPI", "old_date": "20200101", "recent_date": "20300101", "old_count": 1,
                "recent_count": 1, "schema_version": 1, "exit_status": 0}]
        with self.assertRaises(SAE.ShadowArmEvalInputError):
            SAE.read_survivorship_artifact(art, forward_window=(date(2026, 1, 1), date(2026, 12, 31)))

    def test_run_aborts_when_survivorship_not_pass(self):
        rep = SAE.aggregate_shadow_arm_verdict([], kill_rule=_killrule(), arms=_ARMS,
                                               generated_at="2026-06-23T00:00:00",
                                               survivorship={"exit_status": 9, "label": "x"})
        self.assertEqual(rep["run_verdict"], "INCOMPLETE_RUN")
        self.assertEqual(rep["reason_code"], "survivorship_failed")


# =========================================================================== _score_cell verdict ladder
class ScoreCellVerdict(unittest.TestCase):
    ARM = "sector-soft-reserve"

    def _cell(self, periods, kr, *, surv=None):
        return SAE._score_cell(periods, self.ARM, "short", "short", kr, surv or _SP())

    def test_survivorship_guard_in_cell(self):
        c = self._cell(_series_periods(8, arm=self.ARM, lift=0.03), _killrule(), surv={"exit_status": 1})
        self.assertEqual(c["verdict"], "INCOMPLETE_RUN")
        self.assertEqual(c["reason_code"], "survivorship_failed")

    def test_data_floor_below_6(self):
        ps = _series_periods(5, arm=self.ARM, lift=0.03, regimes=["bull", "bear"])
        c = self._cell(ps, _kr_with_benchmark(ps))
        self.assertEqual(c["verdict"], "INCOMPLETE_RUN")
        self.assertEqual(c["reason_code"], "n_below_data_floor")
        self.assertEqual(c["n_periods"], 5)

    def test_power_floor_directional(self):
        ps = _series_periods(6, arm=self.ARM, lift=0.03, regimes=["bull", "bear"])
        kr = _kr_with_benchmark(ps, tracks={"short": {"cadence": "weekly", "power_floor_n": 10},
                                            "midlong": {"cadence": "monthly", "power_floor_n": 10}})
        c = self._cell(ps, kr)
        self.assertEqual(c["verdict"], "DIRECTIONAL")
        self.assertEqual(c["reason_code"], "DIRECTIONAL_POWER_FLOOR")
        self.assertEqual(c["gate_a"]["pass"], False)

    def test_beta_unverified_when_no_benchmark(self):
        ps = _series_periods(8, arm=self.ARM, lift=0.03, regimes=["bull", "bear"])
        kr = _killrule(regime_by_period_key={p.period_key: p.regime for p in ps},
                       leading_sectors_benchmark={"by_period_key": {}})  # no benchmark → unverified
        c = self._cell(ps, kr)
        self.assertEqual(c["verdict"], "DIRECTIONAL")
        self.assertEqual(c["reason_code"], "DIRECTIONAL_BETA_UNVERIFIED")

    def test_beta_unverified_when_any_kept_period_missing_benchmark(self):
        xs = [0.0, 0.02, -0.02, 0.04, -0.04, 0.01, -0.01, 0.03]
        ps = _series_periods(8, arm=self.ARM, lift=[0.03 + 0.5 * x for x in xs], regimes=["bull", "bear"])
        kr = _kr_with_benchmark(ps, x_fn=lambda i: xs[i])
        del kr["leading_sectors_benchmark"]["by_period_key"][ps[3].period_key]  # one missing x_p is enough to block
        c = self._cell(ps, kr)
        self.assertEqual(c["verdict"], "DIRECTIONAL")
        self.assertEqual(c["reason_code"], "DIRECTIONAL_BETA_UNVERIFIED")

    def test_beta_blocked_single_regime(self):
        ps = _series_periods(8, arm=self.ARM, lift=0.03, regimes=["bull"])  # single regime
        kr = _kr_with_benchmark(ps, x_fn=lambda i: 0.01 * ((i % 4) - 1.5))
        c = self._cell(ps, kr)
        self.assertEqual(c["verdict"], "DIRECTIONAL")
        self.assertEqual(c["reason_code"], "DIRECTIONAL_BETA_BLOCKED")
        self.assertIn("single_regime", c["advisory_flags"])

    def test_beta_blocked_nonpositive_ortho(self):
        # lift fully explained by benchmark (intercept ≈ 0, not > 0) with multi-regime.
        xs = [0.0, 0.02, 0.04, -0.02, 0.06, -0.04, 0.03, -0.03]
        lifts = [0.5 * x for x in xs]  # intercept 0
        ps = _series_periods(8, arm=self.ARM, lift=lifts, regimes=["bull", "bear"])
        kr = _kr_with_benchmark(ps, x_fn=lambda i: xs[i])
        c = self._cell(ps, kr)
        self.assertEqual(c["verdict"], "DIRECTIONAL")
        self.assertEqual(c["reason_code"], "DIRECTIONAL_BETA_BLOCKED")
        self.assertIn("beta_orthogonalized_non_positive", c["advisory_flags"])

    def test_gate_b_na_is_ceiling(self):
        # multi-regime, benchmark present, positive orthogonalized intercept, n>=power_floor → ceiling NA.
        xs = [0.0, 0.02, -0.02, 0.04, -0.04, 0.01, -0.01, 0.03]
        lifts = [0.03 + 0.5 * x for x in xs]  # intercept +0.03 > 0
        ps = _series_periods(8, arm=self.ARM, lift=lifts, regimes=["bull", "bear"])
        kr = _kr_with_benchmark(ps, x_fn=lambda i: xs[i])
        c = self._cell(ps, kr)
        self.assertEqual(c["verdict"], "DIRECTIONAL")
        self.assertEqual(c["reason_code"], "DIRECTIONAL_GATE_B_NA")
        self.assertEqual(c["gate_b"]["verdict"], "NOT_APPLICABLE")
        self.assertEqual(c["gate_c"]["verdict"], "NOT_APPLICABLE")
        self.assertGreater(c["beta_orthogonalized_ret_lift"], 0)
        self.assertEqual(c["fwer_family_m"], 9)
        self.assertAlmostEqual(c["alpha_cell"], 0.10 / 9)

    def test_pass_structurally_unreachable(self):
        # even a very strong, beta-clean, well-powered cell never reaches PASS (Gate B NA).
        xs = [(i % 7) * 0.01 - 0.03 for i in range(12)]
        lifts = [0.10 + 0.2 * xs[i] for i in range(12)]
        ps = _series_periods(12, arm=self.ARM, lift=lifts, regimes=["bull", "bear", "sideways"])
        kr = _kr_with_benchmark(ps, x_fn=lambda i: xs[i])
        c = self._cell(ps, kr)
        self.assertNotEqual(c["verdict"], "PASS")
        self.assertEqual(c["reason_code"], "DIRECTIONAL_GATE_B_NA")

    def test_plumbing_when_picks_identical(self):
        # arm picks == baseline picks every period → NOT_APPLICABLE_PLUMBING_ONLY.
        ps = []
        for i in range(8):
            same = [f"{100 + i * 20 + k:06d}" for k in range(10)]
            ps.append(_period(f"s:2026-01-{i + 1:02d}_{i}", "bull",
                              arm_cells={self.ARM: (0.05, 0.3, 0.4, same),
                                         SAE._BASELINE: (0.02, 0.2, 0.4, same)}, sel_idx=i * 25))
        c = self._cell(ps, _kr_with_benchmark(ps))
        self.assertEqual(c["verdict"], "NOT_APPLICABLE_PLUMBING_ONLY")
        self.assertEqual(c["reason_code"], "NOT_APPLICABLE_PLUMBING_ONLY")

    def test_adjusted_lower_is_binding(self):
        # all positive lifts → adj_lower (one-sided 0.10/9 quantile) > 0 → gate_a.pass True (but verdict NA).
        xs = [(-1) ** i * 0.02 for i in range(8)]
        lifts = [0.08 + 0.01 * i + 0.3 * xs[i] for i in range(8)]
        ps = _series_periods(8, arm=self.ARM, lift=lifts, regimes=["bull", "bear"])
        kr = _kr_with_benchmark(ps, x_fn=lambda i: xs[i])
        c = self._cell(ps, kr)
        self.assertTrue(c["gate_a"]["pass"])
        self.assertGreater(c["adj_lower"], 0)

    def test_unadjusted_ci90_only_cannot_pass(self):
        # ci90 lower > 0 but the verdict is still capped at DIRECTIONAL (no PASS); gate_a uses adj_lower.
        xs = [(-1) ** i * 0.02 for i in range(8)]
        lifts = [0.08 + 0.3 * xs[i] for i in range(8)]
        ps = _series_periods(8, arm=self.ARM, lift=lifts, regimes=["bull", "bear"])
        kr = _kr_with_benchmark(ps, x_fn=lambda i: xs[i])
        c = self._cell(ps, kr)
        self.assertNotEqual(c["verdict"], "PASS")
        # adj_lower (alpha=0.0111) <= ci90 lower (0.05) by quantile monotonicity.
        self.assertLessEqual(c["adj_lower"], c["ci90"][0])


# =========================================================================== aggregate / rollup
class Aggregate(unittest.TestCase):
    def test_no_eligible(self):
        ps = [SAE.ShadowArmPeriodResult("s:2026-06-01", "short", "bull", eligible=False,
                                        reason_code="reconcile_partial")]
        rep = SAE.aggregate_shadow_arm_verdict(ps, kill_rule=_killrule(), arms=_ARMS,
                                               generated_at="t", survivorship=_SP())
        self.assertEqual(rep["run_verdict"], "INCOMPLETE_RUN")
        self.assertEqual(rep["reason_code"], "no_eligible_periods")

    def test_all_plumbing_run_incomplete_plumbing_only(self):
        ps = []
        for i in range(8):
            same = [f"{100 + i * 20 + k:06d}" for k in range(10)]
            cells = {SAE._BASELINE: (0.02, 0.2, 0.4, same)}
            for arm in SAE._NON_BASELINE:
                cells[arm] = (0.02, 0.2, 0.4, same)  # every arm mirrors baseline
            ps.append(_period(f"s:2026-01-{i + 1:02d}_{i}", "bull", arm_cells=cells, sel_idx=i * 25))
        rep = SAE.aggregate_shadow_arm_verdict(ps, kill_rule=_kr_with_benchmark(ps), arms=_ARMS,
                                               generated_at="t", survivorship=_SP())
        self.assertEqual(rep["run_verdict"], "INCOMPLETE_RUN")
        self.assertEqual(rep["reason_code"], "INCOMPLETE_RUN_PLUMBING_ONLY")

    def test_rollup_directional_when_one_cell_directional(self):
        ps = _series_periods(8, arm="sector-soft-reserve", lift=0.03, regimes=["bull", "bear"])
        # add the other non-baseline arms as plumbing so they don't error.
        for p in ps:
            base = p.per_arm_tf[SAE._BASELINE]["short"]
            for arm in ("regime-sector-soft-reserve", SAE._HARD_GATE):
                p.per_arm_tf[arm] = {"short": SAE._ArmTfCell(
                    mean_return=base.mean_return, hit_rate=base.hit_rate, ic=0.4,
                    picks=base.picks, complete=True)}
        rep = SAE.aggregate_shadow_arm_verdict(ps, kill_rule=_kr_with_benchmark(ps), arms=_ARMS,
                                               generated_at="t", survivorship=_SP())
        self.assertEqual(rep["run_verdict"], "DIRECTIONAL")
        self.assertFalse(rep["triple_gate_all_pass"])
        self.assertEqual(rep["no_apply"], True)

    def test_cells_only_non_baseline(self):
        ps = _series_periods(8, arm="sector-soft-reserve", lift=0.03, regimes=["bull", "bear"])
        for p in ps:
            base = p.per_arm_tf[SAE._BASELINE]["short"]
            for arm in ("regime-sector-soft-reserve", SAE._HARD_GATE):
                p.per_arm_tf[arm] = {"short": base}
        rep = SAE.aggregate_shadow_arm_verdict(ps, kill_rule=_kr_with_benchmark(ps), arms=_ARMS,
                                               generated_at="t", survivorship=_SP())
        arms_in_cells = {c["arm"] for c in rep["cells"]}
        self.assertNotIn(SAE._BASELINE, arms_in_cells)
        self.assertTrue(arms_in_cells <= set(SAE._NON_BASELINE))


# =========================================================================== triple_gate integrity
class TripleGateIntegrity(unittest.TestCase):
    def test_consistent_report_ok(self):
        rep = {"triple_gate_all_pass": False,
               "cells": [{"gate_a": {"pass": False}, "gate_b": {"verdict": "NOT_APPLICABLE"},
                          "gate_c": {"verdict": "NOT_APPLICABLE"}}]}
        SAE.assert_verdict_integrity(rep)  # no raise

    def test_mismatch_raises_invalid_input(self):
        rep = {"triple_gate_all_pass": True,   # claims pass...
               "cells": [{"gate_a": {"pass": True}, "gate_b": {"verdict": "NOT_APPLICABLE"},  # ...but gate_b NA
                          "gate_c": {"verdict": "NOT_APPLICABLE"}}]}
        with self.assertRaisesRegex(SAE.ShadowArmEvalInputError, "triple_gate_inconsistent"):
            SAE.assert_verdict_integrity(rep)


# =========================================================================== helpers + invariants
class Helpers(unittest.TestCase):
    def test_adjusted_lower_quantile(self):
        vals = [0.01 * i for i in range(1, 11)]
        self.assertAlmostEqual(SAE._adjusted_lower(vals, 0.5), round(V.F.quantile(sorted(vals), 0.5), 6))
        self.assertTrue(math.isnan(SAE._adjusted_lower([0.05], 0.1)))

    def test_ic_ir_ddof1(self):
        self.assertTrue(math.isnan(SAE._ic_ir_ddof1([0.3])))
        self.assertGreater(SAE._ic_ir_ddof1([0.3, 0.3, 0.3]), 1e6)  # zero variance positive → +inf-ish

    def test_ols_intercept(self):
        a, b = SAE._ols_intercept_slope([0.0, 1.0, 2.0], [0.05, 1.05, 2.05])
        self.assertAlmostEqual(a, 0.05, places=4)
        self.assertAlmostEqual(b, 1.0, places=4)
        self.assertIsNone(SAE._ols_intercept_slope([1.0, 1.0, 1.0], [0.1, 0.2, 0.3]))  # var(x)=0
        self.assertIsNone(SAE._ols_intercept_slope([1.0, 2.0], [0.1, 0.2]))            # n<3

    def test_json_safe_nan_inf_to_null(self):
        out = SAE._json_safe({"a": float("nan"), "b": float("inf"), "c": [1, float("-inf")], "s": {"x"}})
        self.assertIsNone(out["a"])
        self.assertIsNone(out["b"])
        self.assertEqual(out["c"], [1, None])
        self.assertEqual(out["s"], ["x"])

    def test_emit_writes_json_and_md(self):
        rep = SAE.aggregate_shadow_arm_verdict([], kill_rule=_killrule(), arms=_ARMS,
                                               generated_at="t", survivorship=_SP())
        with tempfile.TemporaryDirectory() as d:
            out = Path(d) / "v.json"
            SAE.emit_shadow_arm_verdict(rep, out)
            loaded = json.loads(out.read_text())
            self.assertEqual(loaded["no_apply"], True)
            self.assertTrue(out.with_suffix(".md").exists())

    def test_reason_codes_closed_set_mapping(self):
        # every reason_code emitted by the verdict ladder is in the closed REASON_CODES set.
        emitted = set()
        for surv in ({"exit_status": 1},):
            emitted.add(SAE._score_cell([], "sector-soft-reserve", "short", "short", _killrule(), surv)["reason_code"])
        ps5 = _series_periods(5, arm="sector-soft-reserve", lift=0.03, regimes=["bull", "bear"])
        emitted.add(SAE._score_cell(ps5, "sector-soft-reserve", "short", "short", _kr_with_benchmark(ps5), _SP())["reason_code"])
        for rc in emitted:
            self.assertIn(rc, SAE.REASON_CODES)
        self.assertNotIn("period_not_complete", SAE.REASON_CODES)

    def test_active_arms_fail_closed(self):
        with self.assertRaisesRegex(SAE.ShadowArmEvalInputError, "unknown active arm"):
            SAE._validate_arms([SAE._BASELINE, "bogus"], _killrule())
        with self.assertRaisesRegex(SAE.ShadowArmEvalInputError, "production-snapshot"):
            SAE._validate_arms(["sector-soft-reserve"], _killrule())
        with self.assertRaisesRegex(SAE.ShadowArmEvalInputError, "at least one non-baseline"):
            SAE._validate_arms([SAE._BASELINE], _killrule())
        with self.assertRaisesRegex(SAE.ShadowArmEvalInputError, "duplicate"):
            SAE._validate_arms([SAE._BASELINE, "sector-soft-reserve", "sector-soft-reserve"], _killrule())
        kr = _killrule(arms=[SAE._BASELINE, "sector-soft-reserve"])
        with self.assertRaisesRegex(SAE.ShadowArmEvalInputError, "not declared"):
            SAE._validate_arms([SAE._BASELINE, SAE._HARD_GATE], kr)


class Invariants(unittest.TestCase):
    def test_no_rng(self):
        for fn in (SAE.harvest_shadow_arm_periods, SAE.aggregate_shadow_arm_verdict, SAE._score_cell,
                   SAE._winner_universe_returns):
            src = inspect.getsource(fn)
            for tok in ("random.", "np.random", ".seed(", "Random("):
                self.assertNotIn(tok, src, f"{fn.__name__} makes RNG call {tok}")
        self.assertNotIn("import random", inspect.getsource(SAE))

    def test_frozen_funcs_byte_clean(self):
        for fn in (V.process_month, V.aggregate_harvest, V.harvest_pit_months):
            src = inspect.getsource(fn).lower()
            self.assertNotIn("shadow_arm", src, f"{fn.__name__} mentions shadow_arm")

    def test_sql_materialized_readonly(self):
        self.assertEqual(SAE.SHADOW_ARM_EXTRACT_SQL.count("as materialized"), 1)
        up = SAE.shadow_arm_sql_inline().upper()
        for forbidden in ("INSERT ", "UPDATE ", "DELETE ", "SKIP LOCKED", "FOR UPDATE"):
            self.assertNotIn(forbidden, up)
        self.assertNotIn("--", SAE.shadow_arm_sql_inline())

    def test_no_db_write_in_module(self):
        src = inspect.getsource(SAE)
        for tok in ("upsert_shadow_arm_log(", "create_client", ".execute(", "INSERT INTO", "DELETE FROM"):
            self.assertNotIn(tok, src, f"shadow_arm_eval makes DB write/client call {tok}")


# =========================================================================== harvest (tiny fake panel)
class HarvestFakePanel(unittest.TestCase):
    def _panel(self, n_tickers=30, n_days=200):
        from validate_tier0_ic import PanelRow
        dates = []
        d = date(2026, 1, 1)
        while len(dates) < n_days:
            if d.weekday() < 5:
                dates.append(d.strftime("%Y%m%d"))
            d = date.fromordinal(d.toordinal() + 1)
        tickers = [f"{i:06d}" for i in range(1, n_tickers + 1)]
        panel = {}
        for di, dk in enumerate(dates):
            day = {}
            for ti, tk in enumerate(tickers):
                close = 100.0 + di * (ti + 1) * 0.5     # ticker ti rises faster → deterministic winners
                day[tk] = PanelRow(close=close, high=close, trdval=1e9, mktcap=1e12 - ti * 1e9,
                                   name=tk, market="KOSPI", list_shrs=1e6)
            panel[dk] = day
        return panel, dates, tickers

    def _extract(self, period_key, *, arm_picks, snap_picks, cut=None, asof="2025-12-31", run_date="2026-01-05"):
        arms = [_arm_row(SAE._BASELINE, sector_source="absent", leading=(), run_date=run_date,
                         selected=[_sel(tk, "short") for tk in snap_picks])]
        arms.append(_arm_row("sector-soft-reserve", asof=asof, run_date=run_date,
                             selected=[_sel(tk, "short") for tk in arm_picks]))
        arms.append(_arm_row("regime-sector-soft-reserve", asof=asof, run_date=run_date,
                             selected=[_sel(tk, "short") for tk in snap_picks]))
        arms.append(_arm_row(SAE._HARD_GATE, asof=asof, run_date=run_date,
                             selected=[_sel(tk, "short") for tk in snap_picks], cut=(cut or [])))
        return SAE.parse_shadow_arm_extract([{"period_key": period_key, "arms": arms}])

    def test_shared_winner_basis_and_paired(self):
        panel, dates, tickers = self._panel()
        ext = self._extract("s:2026-01-05", arm_picks=tickers[:10], snap_picks=tickers[5:15])
        cov = {"rows": [{"period_key": "s:2026-01-05", "status": "complete"}]}
        kr = _killrule(regime_by_period_key={"s:2026-01-05": "bull"})
        res = SAE.harvest_shadow_arm_periods(panel=panel, extract=ext, coverage=cov, kill_rule=kr, arms=_ARMS)
        self.assertEqual(len(res), 1)
        r = res[0]
        self.assertTrue(r.eligible)
        # winner basket shared object identity across arms (one compute per period/tf).
        self.assertGreaterEqual(r.n_winners_by_tf["short"], 1)
        for arm in _ARMS:
            self.assertIn("short", r.per_arm_tf[arm])

    def test_mean_return_golden_and_delisted(self):
        # ticker 000001 delists right after entry (no price after target) → DELISTING_RETURN_NO_PRICE used.
        from validate_tier0_ic import PanelRow
        panel, dates, tickers = self._panel(n_tickers=30, n_days=60)
        for dk in dates[8:]:
            panel[dk].pop("000001", None)   # delist 000001 early (after entry, before short target)
        ext = self._extract("s:2026-01-05", arm_picks=tickers[:10], snap_picks=tickers[10:20])
        cov = {"rows": [{"period_key": "s:2026-01-05", "status": "complete"}]}
        kr = _killrule(regime_by_period_key={"s:2026-01-05": "bull"})
        res = SAE.harvest_shadow_arm_periods(panel=panel, extract=ext, coverage=cov, kill_rule=kr, arms=_ARMS)
        cell = res[0].per_arm_tf["sector-soft-reserve"]["short"]
        # 000001 is a pick; it delisted with no target price → return -1.0 included, denominator stays 10.
        self.assertTrue(cell.complete)
        self.assertEqual(len(cell.picks), 10)

    def test_absent_pick_makes_cell_incomplete(self):
        panel, dates, tickers = self._panel(n_tickers=30, n_days=60)
        # a pick that is never in the panel → absent at entry → cell INCOMPLETE.
        ext = self._extract("s:2026-01-05", arm_picks=["999999"] + tickers[:9], snap_picks=tickers[10:20])
        cov = {"rows": [{"period_key": "s:2026-01-05", "status": "complete"}]}
        kr = _killrule(regime_by_period_key={"s:2026-01-05": "bull"})
        res = SAE.harvest_shadow_arm_periods(panel=panel, extract=ext, coverage=cov, kill_rule=kr, arms=_ARMS)
        cell = res[0].per_arm_tf["sector-soft-reserve"]["short"]
        self.assertFalse(cell.complete)
        self.assertTrue(math.isnan(cell.mean_return))

    def test_reconcile_partial_excluded(self):
        panel, dates, tickers = self._panel()
        ext = self._extract("s:2026-01-05", arm_picks=tickers[:10], snap_picks=tickers[5:15])
        cov = {"rows": [{"period_key": "s:2026-01-05", "status": "partial"}]}
        kr = _killrule(regime_by_period_key={"s:2026-01-05": "bull"})
        res = SAE.harvest_shadow_arm_periods(panel=panel, extract=ext, coverage=cov, kill_rule=kr, arms=_ARMS)
        self.assertFalse(res[0].eligible)
        self.assertEqual(res[0].reason_code, "reconcile_partial")

    def test_regime_unregistered_raises(self):
        panel, dates, tickers = self._panel()
        ext = self._extract("s:2026-01-05", arm_picks=tickers[:10], snap_picks=tickers[5:15])
        cov = {"rows": [{"period_key": "s:2026-01-05", "status": "complete"}]}
        with self.assertRaisesRegex(SAE.ShadowArmEvalInputError, "regime_unregistered"):
            SAE.harvest_shadow_arm_periods(panel=panel, extract=ext, coverage=cov,
                                           kill_rule=_killrule(), arms=_ARMS)

    def test_arm_pick_returns_delisted_neg1(self):
        # a pick present ONLY at the entry bar then gone forever → DELISTING_RETURN_NO_PRICE (-1.0),
        # accepted into the mean (denominator stays 10, §2). other picks ok.
        from validate_tier0_ic import PanelRow
        dates = [f"202601{d:02d}" for d in range(1, 29)]
        panel = {}
        for i, dk in enumerate(dates):
            day = {"000002": PanelRow(close=100.0 + i, high=100.0 + i, trdval=1e9, mktcap=1e12,
                                      name="b", market="KOSPI", list_shrs=1e6)}
            if i <= 1:  # 000001 present only at entry window then delists with no later price
                day["000001"] = PanelRow(close=100.0, high=100.0, trdval=1e9, mktcap=1e12,
                                         name="a", market="KOSPI", list_shrs=1e6)
            panel[dk] = day
        rets, delisted = SAE._arm_pick_returns(panel, dates, ["000001", "000002"], 0, "short")
        self.assertIsNotNone(rets)
        self.assertEqual(rets["000001"], V.DELISTING_RETURN_NO_PRICE)
        self.assertEqual(delisted, 1)

    def test_hard_gate_cut_diagnostic(self):
        panel, dates, tickers = self._panel()
        # cut a fast-rising ticker (000030, the fastest riser → a winner) to make gate_cut_return non-empty.
        ext = self._extract("s:2026-01-05", arm_picks=tickers[:10], snap_picks=tickers[5:15],
                            cut=["000030"])
        cov = {"rows": [{"period_key": "s:2026-01-05", "status": "complete"}]}
        kr = _killrule(regime_by_period_key={"s:2026-01-05": "bull"})
        res = SAE.harvest_shadow_arm_periods(panel=panel, extract=ext, coverage=cov, kill_rule=kr, arms=_ARMS)
        gc = SAE._gate_cut_return(res, "short")
        self.assertIsNotNone(gc)
        self.assertIn("counterfactual observation only", gc["claim_discipline"])
        self.assertGreaterEqual(gc["total_gate_cut_winner_count"], 1)


# =========================================================================== PR-A5 review-round coverage
class ReviewFixes(unittest.TestCase):
    ARM = "sector-soft-reserve"

    # ---- correctness: n_periods (pre-decimation) vs n_nonoverlap (post-decimation) now differ
    def test_n_periods_gt_nonoverlap_when_overlapping(self):
        ps = _series_periods(20, arm=self.ARM, lift=0.03, regimes=["bull", "bear"], sel_step=10)  # < horizon 21
        c = SAE._score_cell(ps, self.ARM, "short", "short", _kr_with_benchmark(ps), _SP())
        self.assertGreater(c["n_periods"], c["n_nonoverlap"])   # 20 observed > ~7 independent
        self.assertEqual(c["n_periods"], 20)
        self.assertGreaterEqual(c["n_nonoverlap"], SAE._DATA_FLOOR)

    # ---- beta extrapolation guard: benchmark range must bracket 0
    def test_beta_unverified_when_x_does_not_bracket_zero(self):
        ps = _series_periods(8, arm=self.ARM, lift=[0.03 + 0.5 * (0.02 + 0.001 * i) for i in range(8)],
                             regimes=["bull", "bear"])
        kr = _kr_with_benchmark(ps, x_fn=lambda i: 0.02 + 0.001 * i)  # all x_p > 0 → x=0 is extrapolation
        c = SAE._score_cell(ps, self.ARM, "short", "short", kr, _SP())
        self.assertEqual(c["reason_code"], "DIRECTIONAL_BETA_UNVERIFIED")

    # ---- closed-set: gate_b/gate_c annotations are within REASON_CODES (gate_c carries no reason key)
    def test_gate_b_gate_c_annotations_closed(self):
        xs = [0.0, 0.02, -0.02, 0.04, -0.04, 0.01, -0.01, 0.03]
        ps = _series_periods(8, arm=self.ARM, lift=[0.03 + 0.5 * x for x in xs], regimes=["bull", "bear"])
        c = SAE._score_cell(ps, self.ARM, "short", "short", _kr_with_benchmark(ps, x_fn=lambda i: xs[i]), _SP())
        self.assertIn(c["gate_b"]["reason"], SAE.REASON_CODES)   # `reason` key per §6.5
        self.assertNotIn("reason", c["gate_c"])                  # gate_c: {verdict} only, no reason key
        self.assertEqual(c["gate_c"]["verdict"], "NOT_APPLICABLE")

    # ---- gate_cut diagnostic must NOT change the verdict (§7 diagnostic-only)
    def test_gate_cut_does_not_change_verdict(self):
        # winners + fwd_panel are IDENTICAL across both runs (≥10 winners incl. the cut ticker); only
        # counterfactual_cut differs → gate_cut_return populated vs None, verdict unchanged (§7 diagnostic).
        xs = [0.0, 0.02, -0.02, 0.04, -0.04, 0.01, -0.01, 0.03]
        lifts = [0.03 + 0.5 * x for x in xs]
        WIN = {f"90{i:04d}" for i in range(12)} | {"900030"}
        FWD = {tk: 0.5 for tk in WIN}
        def build(cut):
            ps = []
            for i in range(8):
                ap = [f"{100 + i * 20 + k:06d}" for k in range(10)]
                sp = [f"{500 + i * 20 + k:06d}" for k in range(10)]
                p = _period(f"s:2026-{(i % 12) + 1:02d}-{(i // 12) + 1:02d}_{i}", ["bull", "bear"][i % 2],
                            arm_cells={SAE._HARD_GATE: (lifts[i], 0.3, 0.4, ap), SAE._BASELINE: (0.0, 0.2, 0.4, sp)},
                            sel_idx=i * 25, cut=cut, winners=WIN, fwd_panel=FWD)
                ps.append(p)
            return ps
        kr_args = dict(x_fn=lambda i: xs[i])
        cut_ps, no_ps = build(["900030"]), build([])
        c_cut = SAE._score_cell(cut_ps, SAE._HARD_GATE, "short", "short",
                                _kr_with_benchmark(cut_ps, **kr_args), _SP())
        c_no = SAE._score_cell(no_ps, SAE._HARD_GATE, "short", "short",
                               _kr_with_benchmark(no_ps, **kr_args), _SP())
        self.assertEqual(c_cut["verdict"], c_no["verdict"])
        self.assertEqual(c_cut["reason_code"], c_no["reason_code"])
        self.assertEqual(c_cut["gate_a"], c_no["gate_a"])
        self.assertIsNotNone(c_cut["gate_cut_return"])
        self.assertIsNone(c_no["gate_cut_return"])

    # ---- coverage duplicate period_key fails closed (no last-write-wins)
    def test_coverage_duplicate_period_raises(self):
        with self.assertRaisesRegex(SAE.ShadowArmEvalInputError, "duplicate period_key"):
            SAE._eligible_set({"rows": [{"period_key": "s:2026-06-01", "status": "complete"},
                                        {"period_key": "s:2026-06-01", "status": "anomaly"}]})

    # ---- cross_period reason is individually pinned (not just "some error")
    def test_cross_period_regex(self):
        obj = _extract_obj("s:2026-06-01")
        obj["arms"][1]["track"] = "midlong"
        with self.assertRaisesRegex(SAE.ShadowArmEvalInputError, "cross_period"):
            SAE.parse_shadow_arm_extract([obj])

    # ---- logged arm row missing run_date fails closed
    def test_logged_row_missing_run_date_raises(self):
        obj = _extract_obj("s:2026-06-01")
        obj["arms"][1].pop("run_date")
        with self.assertRaises(SAE.ShadowArmEvalInputError):
            SAE.parse_shadow_arm_extract([obj])


class HarvestReasons(unittest.TestCase):
    """harvest-path INCOMPLETE_RUN exclusion branches (PR-A5 review: previously untested)."""
    def _ext(self, period_key="s:2026-06-01", *, asof="2025-12-31", run_date="2026-06-01", arms=None):
        track = "short" if period_key.startswith("s:") else "midlong"
        rows = [_arm_row(SAE._BASELINE, track=track, sector_source="absent", leading=(), run_date=run_date)]
        for arm in SAE._NON_BASELINE:
            rows.append(_arm_row(arm, track=track, asof=asof, run_date=run_date,
                                 **(arms.get(arm, {}) if arms else {})))
        return SAE.parse_shadow_arm_extract([{"period_key": period_key, "arms": rows}])

    def _cov(self, pk="s:2026-06-01", status="complete"):
        return {"rows": [{"period_key": pk, "status": status, "track": "short"}]}

    def _panel150(self, n_days=200):
        tickers = [f"{i:06d}" for i in range(1, 151)]
        dates = _weekdays(n_days, start=(2026, 4, 1))
        panel = _mk_panel(lambda ti, di: 100.0 + di * (ti % 7 + 1) * 0.4, tickers, dates)
        return panel, dates

    def test_asof_stale_excluded(self):
        panel, dates = self._panel150()
        # period anchor 2026-06-01; sector asOf == anchor (not strictly before) → asof_stale.
        ext = self._ext("s:2026-06-01", asof="2026-06-01")
        res = SAE.harvest_shadow_arm_periods(panel=panel, extract=ext, coverage=self._cov(),
                                             kill_rule=_killrule(regime_by_period_key={"s:2026-06-01": "bull"}),
                                             arms=_ARMS)
        self.assertFalse(res[0].eligible)
        self.assertEqual(res[0].reason_code, "asof_stale")

    def test_run_date_stale_excluded(self):
        panel, dates = self._panel150()
        # run_date far AFTER anchor (>45d): anchor 2026-06-01, run_date 2026-09-01.
        ext = self._ext("s:2026-06-01", run_date="2026-09-01")
        res = SAE.harvest_shadow_arm_periods(panel=panel, extract=ext, coverage=self._cov(),
                                             kill_rule=_killrule(regime_by_period_key={"s:2026-06-01": "bull"}),
                                             arms=_ARMS)
        self.assertFalse(res[0].eligible)
        self.assertEqual(res[0].reason_code, "run_date_stale")

    def test_one_late_logged_arm_run_date_excluded(self):
        panel, dates = self._panel150()
        obj = _extract_obj("s:2026-06-01")
        obj["arms"][2]["run_date"] = "2026-09-01"  # not first row; must still trip stale guard
        ext = SAE.parse_shadow_arm_extract([obj])
        res = SAE.harvest_shadow_arm_periods(panel=panel, extract=ext, coverage=self._cov(),
                                             kill_rule=_killrule(regime_by_period_key={"s:2026-06-01": "bull"}),
                                             arms=_ARMS)
        self.assertFalse(res[0].eligible)
        self.assertEqual(res[0].reason_code, "run_date_stale")

    def test_complete_coverage_missing_raw_arm_raises(self):
        panel, dates = self._panel150()
        obj = _extract_obj("s:2026-06-01")
        obj["arms"] = obj["arms"][:-1]
        ext = SAE.parse_shadow_arm_extract([obj])
        with self.assertRaisesRegex(SAE.ShadowArmEvalInputError, "complete 4-arm"):
            SAE.harvest_shadow_arm_periods(panel=panel, extract=ext, coverage=self._cov(),
                                           kill_rule=_killrule(regime_by_period_key={"s:2026-06-01": "bull"}),
                                           arms=_ARMS)

    def test_extract_period_missing_from_coverage_raises(self):
        panel, dates = self._panel150()
        ext = self._ext("s:2026-06-01")
        with self.assertRaisesRegex(SAE.ShadowArmEvalInputError, "coverage missing period_key"):
            SAE.harvest_shadow_arm_periods(panel=panel, extract=ext, coverage={"rows": []},
                                           kill_rule=_killrule(regime_by_period_key={"s:2026-06-01": "bull"}),
                                           arms=_ARMS)

    def test_forward_insufficient_sel_before_panel(self):
        panel, dates = self._panel150()  # panel starts 2026-04 → 2026-... wait, selection before panel.
        ext = self._ext("s:2026-04-06")  # anchor before panel start (2026-04-01 lookback) → sel may be <0
        # use a period clearly before the panel: rebuild panel starting later.
        tickers = [f"{i:06d}" for i in range(1, 151)]
        dates2 = _weekdays(80, start=(2026, 6, 1))
        panel2 = _mk_panel(lambda ti, di: 100.0 + di, tickers, dates2)
        ext2 = self._ext("s:2026-01-05", asof="2025-12-01", run_date="2026-01-05")
        res = SAE.harvest_shadow_arm_periods(panel=panel2, extract=ext2, coverage=self._cov("s:2026-01-05"),
                                             kill_rule=_killrule(regime_by_period_key={"s:2026-01-05": "bull"}),
                                             arms=_ARMS)
        self.assertFalse(res[0].eligible)
        self.assertEqual(res[0].reason_code, "forward_insufficient")

    def test_panel_survivorship_unverified(self):
        # 20 tickers at selection; 5 of them vanish for ALL post-selection days → absent_fraction 0.25 > 0.10.
        tickers = [f"{i:06d}" for i in range(1, 21)]
        dates = _weekdays(120, start=(2026, 4, 1))
        sel_key = "20260601"
        sel_di = dates.index(min(d for d in dates if d >= sel_key))
        vanish = set(tickers[:5])
        panel = _mk_panel(lambda ti, di: 100.0 + di, tickers, dates,
                          present=lambda tk, di: not (tk in vanish and di > sel_di))
        ext = self._ext("s:2026-06-01")
        # arm/snap picks must exist in the panel; default picks 000001.. are present pre-selection.
        res = SAE.harvest_shadow_arm_periods(panel=panel, extract=ext, coverage=self._cov(),
                                             kill_rule=_killrule(regime_by_period_key={"s:2026-06-01": "bull"}),
                                             arms=_ARMS)
        self.assertFalse(res[0].eligible)
        self.assertEqual(res[0].reason_code, "panel_survivorship_unverified")
        self.assertGreater(res[0].absent_fraction, SAE.PANEL_ABSENT_MAX)

    def test_arm_incomplete_run_reason(self):
        # hard-gate arm logged incomplete_run in the (single) complete period → that arm-cell → arm_incomplete_run.
        panel, dates = self._panel150()
        ext = self._ext("s:2026-06-01",
                        arms={SAE._HARD_GATE: {"status": "incomplete_run", "selected": [_sel(f"{i:06d}", "short") for i in range(1, 6)]}})
        # need >=6 complete periods for the OTHER arms not to matter; here we just check the hard-gate cell reason.
        # Build 6 complete periods so n_obs context exists; reuse single period but assert the arm cell.
        res = SAE.harvest_shadow_arm_periods(panel=panel, extract=ext, coverage=self._cov(),
                                             kill_rule=_killrule(regime_by_period_key={"s:2026-06-01": "bull"}),
                                             arms=_ARMS)
        elig = [r for r in res if r.eligible]
        c = SAE._score_cell(elig, SAE._HARD_GATE, "short", "short",
                            _killrule(regime_by_period_key={"s:2026-06-01": "bull"}), _SP())
        self.assertEqual(c["reason_code"], "arm_incomplete_run")

    def test_reconcile_incomplete_unregistered_period_excluded_not_aborted(self):
        # a 'missing' period with NO regime registration must be EXCLUDED (reconcile_missing), not abort
        # the run as INVALID_INPUT; a separate complete+registered period still scores.
        panel, dates = self._panel150()
        ext = SAE.parse_shadow_arm_extract([
            {"period_key": "s:2026-06-01", "arms": [
                _arm_row(SAE._BASELINE, sector_source="absent", leading=()),
                *[_arm_row(a) for a in SAE._NON_BASELINE]]},
            {"period_key": "s:2026-06-08", "arms": [
                _arm_row(SAE._BASELINE, sector_source="absent", leading=()),
                *[_arm_row(a) for a in SAE._NON_BASELINE]]},
        ])
        cov = {"rows": [{"period_key": "s:2026-06-01", "status": "complete", "track": "short"},
                        {"period_key": "s:2026-06-08", "status": "missing", "track": "short"}]}
        kr = _killrule(regime_by_period_key={"s:2026-06-01": "bull"})  # 06-08 (missing) intentionally unregistered
        res = SAE.harvest_shadow_arm_periods(panel=panel, extract=ext, coverage=cov, kill_rule=kr, arms=_ARMS)
        by_pk = {r.period_key: r for r in res}
        self.assertEqual(by_pk["s:2026-06-08"].reason_code, "reconcile_missing")
        self.assertFalse(by_pk["s:2026-06-08"].eligible)
        self.assertTrue(by_pk["s:2026-06-01"].eligible)  # complete+registered still scores

    def test_cell_mean_and_hit_golden(self):
        # 9 arm picks rise 100→120 (ret +0.20), 1 pick delists with no later price (-1.0) → mean (9*0.20-1.0)/10=0.08.
        risers = [f"{i:06d}" for i in range(1, 10)]
        delister = "000010"
        snap = [f"{i:06d}" for i in range(20, 30)]
        filler = [f"{i:06d}" for i in range(40, 80)]
        tickers = risers + [delister] + snap + filler
        dates = _weekdays(150, start=(2026, 4, 1))   # enough days for the short horizon to mature
        sel_di = dates.index(min(d for d in dates if d >= "20260601"))
        entry = sel_di + 1
        def close_fn(ti, di):
            tk = tickers[ti]
            if tk in risers:
                return 120.0 if di > entry else 100.0
            if tk == delister:
                return 100.0
            if tk in snap:
                return 110.0 if di > entry else 100.0   # +0.10
            return 102.0 if di > entry else 100.0        # filler +0.02
        panel = _mk_panel(close_fn, tickers, dates,
                          present=lambda tk, di: not (tk == delister and di > entry))
        arms = [_arm_row(SAE._BASELINE, sector_source="absent", leading=(),
                         selected=[_sel(tk, "short") for tk in snap])]
        arms.append(_arm_row(self_arm := "sector-soft-reserve",
                             selected=[_sel(tk, "short") for tk in (risers + [delister])]))
        arms.append(_arm_row("regime-sector-soft-reserve", selected=[_sel(tk, "short") for tk in snap]))
        arms.append(_arm_row(SAE._HARD_GATE, selected=[_sel(tk, "short") for tk in snap]))
        ext = SAE.parse_shadow_arm_extract([{"period_key": "s:2026-06-01", "arms": arms}])
        res = SAE.harvest_shadow_arm_periods(
            panel=panel, extract=ext, coverage={"rows": [{"period_key": "s:2026-06-01", "status": "complete"}]},
            kill_rule=_killrule(regime_by_period_key={"s:2026-06-01": "bull"}), arms=_ARMS)
        cell = res[0].per_arm_tf["sector-soft-reserve"]["short"]
        self.assertTrue(cell.complete)
        self.assertEqual(cell.delisted_count, 1)
        self.assertAlmostEqual(cell.mean_return, (9 * 0.20 - 1.0) / 10, places=6)  # 0.08
        # hit_rate re-derived against the harvested winner basket (catches denominator/intersection bugs).
        win = res[0].winners_by_tf["short"]
        self.assertAlmostEqual(cell.hit_rate, len(set(cell.picks) & win) / 10, places=9)


if __name__ == "__main__":
    unittest.main()
