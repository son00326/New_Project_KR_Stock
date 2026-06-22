#!/usr/bin/env python3
# noqa: SIZE_OK - PR-B5 unittest matrix is intentionally self-contained (no shared fixtures).
"""shadow_eval (PR-B5) test matrix — stdlib unittest (pytest 미설치).

Run:  cd scripts && ./.venv/bin/python -m unittest test_shadow_eval -v

Covers the pure evaluator: fail-closed symmetric extract parse, survivorship bracket gate,
_score_cell verdict logic (power_floor short-circuit / paired-lift@h* / Gate-B-NA / floors),
aggregate run-level guards + per-track rollup, helpers (ddof=1 IC, decimation, regime advisory,
tie-fraction), analytic-baseline-no-RNG, frozen-path byte-clean grep, Query-2 SQL invariants, and
the probe --emit-artifact. Verdict tests use hand-built ShadowPeriodResult (no panel); one harvest
test uses a tiny fake panel. NO DB, NO AI.
"""
from __future__ import annotations

import inspect
import io
import json
import math
import os
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from datetime import date
from unittest import mock

_THIS = os.path.dirname(os.path.abspath(__file__))
if _THIS not in sys.path:
    sys.path.insert(0, _THIS)

import shadow_eval as SE          # noqa: E402
import validate_tier0_ic as V     # noqa: E402

NAN = math.nan


# --------------------------------------------------------------------------- builders
def _arm_obj(arm, tickers, *, status="logged", bucket="short", uhash="uh", usize=200, source="manual_pre_registered"):
    return [{"period_key": "2026-06", "arm": arm, "ticker": tk, "bucket": bucket, "rank": i + 1,
             "tier0_score": 50.0 + i, "status": status, "counterfactual_cut": [],
             "gate_eligible_size": (200 if arm == "sector-hard-gate" else None),
             "universe_hash": uhash, "universe_size": usize, "run_id": "r1",
             "sector_view": {"source": source, "leadingSectors": []}}
            for i, tk in enumerate(tickers)]


def _extract_obj(**over):
    cand = []
    cand += _arm_obj("production-mirror", ["005930", "000660"])
    cand += _arm_obj("sector-soft-tilt", ["005930", "035720"])
    snap = [{"ticker": tk, "bucket": "short", "tier0_score": 50.0 + i, "sector": "반도체",
             "sector_source": "override", "induty_code": "0", "universe_hash": "uh",
             "universe_size": 200, "run_id": "r1", "run_date": "2026-06-01"}
            for i, tk in enumerate(["005930", "000660", "035720"])]
    hyp = [{"source": "manual_pre_registered", "leading_sectors": ["반도체"], "as_of": "2026-05-31T00:00:00Z",
            "selection_as_of": "2026-06-01T00:00:00Z", "hypothesis_hash": "h"}]
    obj = {"period_key": "2026-06", "run_id": "r1", "run_id_count": 1,
           "candidates": cand, "snapshot": snap, "hypothesis": hyp}
    obj.update(over)
    return obj


def _killrule(**over):
    kr = {"freeze_tag": "prb5-test", "parameter_lock_commit_hash": "abc1234",
          "arms": ["production-mirror", "sector-soft-tilt"],
          "run_date_stale_max_days": 45,
          "tracks": {"short": {"primary_horizon": "short", "power_floor_n": 10, "cadence": "weekly"},
                     "midlong": {"primary_horizon": "long", "power_floor_n": 10, "cadence": "monthly"}},
          "regime_by_period_key": {}, "regime_vocab": ["bull", "bear", "flat", "recovery"]}
    kr.update(over)
    return kr


def _recall(per_h):
    return V.RecallReport(per_horizon=dict(per_h))


def _period(pk, track, regime, *, arm_lift, h="short", n_win=20, matured=True, eligible=True,
            sector_absent=False, sel_idx=0, mirror_rec=0.03):
    """One ShadowPeriodResult with mirror recall=mirror_rec and arm recall=mirror_rec+arm_lift @h."""
    per_arm = {
        "production-mirror": SE._ArmCell({"x"}, {h: {"x"}}, _recall({h: mirror_rec}), set()),
        "sector-soft-tilt": SE._ArmCell({"y"}, {h: {"y"}}, _recall({h: mirror_rec + arm_lift}), set()),
    }
    return SE.ShadowPeriodResult(
        pk, track, regime, eligible=eligible, universe_size=200, sel_idx=sel_idx,
        winners_all={"w"}, winners_by_horizon={h: {"w"}}, fwd_by_horizon={h: {}},
        snapshot_score_by_horizon={h: {}}, n_winners_by_horizon={h: n_win},
        per_arm=per_arm, matured_horizons=({h} if matured else set()),
        sector_source_absent=sector_absent)


def _periods(n, *, lift=0.05, **kw):
    return [_period(f"2026-W{10+i:02d}", "short", "bull", arm_lift=lift, sel_idx=i * 40, **kw)
            for i in range(n)]


# =========================================================================== fail-closed parse
class ParseFailClosed(unittest.TestCase):
    def _bad(self, mutate):
        obj = _extract_obj()
        mutate(obj)
        with self.assertRaises(SE.ShadowEvalInputError):
            SE.parse_shadow_extract([obj])

    def test_top_not_list(self):
        with self.assertRaises(SE.ShadowEvalInputError):
            SE.parse_shadow_extract({"period_key": "2026-06"})

    def test_top_none_fails_closed(self):
        with self.assertRaises(SE.ShadowEvalInputError):
            SE.parse_shadow_extract(None)

    def test_period_not_dict(self):
        with self.assertRaises(SE.ShadowEvalInputError):
            SE.parse_shadow_extract(["nope"])

    def test_period_key_missing(self):  self._bad(lambda o: o.pop("period_key"))
    def test_period_key_bad(self):      self._bad(lambda o: o.update(period_key="2026/06"))
    def test_top_run_id_non_str(self):  self._bad(lambda o: o.update(run_id=123))
    def test_candidates_missing(self):  self._bad(lambda o: o.pop("candidates"))
    def test_candidates_not_list(self): self._bad(lambda o: o.update(candidates={}))
    def test_snapshot_not_list(self):   self._bad(lambda o: o.update(snapshot={}))
    def test_hypothesis_not_list(self): self._bad(lambda o: o.update(hypothesis={}))
    def test_cand_not_dict(self):       self._bad(lambda o: o["candidates"].append("x"))
    def test_cand_arm_missing(self):    self._bad(lambda o: o["candidates"][0].pop("arm"))
    def test_cand_status_wrongtype(self): self._bad(lambda o: o["candidates"][0].update(status=1))
    def test_cand_status_bad_value(self): self._bad(lambda o: o["candidates"][0].update(status="pending"))
    def test_cand_ticker_non_str(self): self._bad(lambda o: o["candidates"][0].update(ticker=1))
    def test_cand_rank_non_int(self):   self._bad(lambda o: o["candidates"][0].update(rank="1"))
    def test_cand_rank_bool(self):      self._bad(lambda o: o["candidates"][0].update(rank=True))
    def test_cand_bucket_bad_value(self): self._bad(lambda o: o["candidates"][0].update(bucket="midlong"))
    def test_cand_uhash_non_str(self):  self._bad(lambda o: o["candidates"][0].update(universe_hash=1))
    def test_cand_usize_missing(self):  self._bad(lambda o: o["candidates"][0].pop("universe_size"))
    def test_cand_usize_bool(self):     self._bad(lambda o: o["candidates"][0].update(universe_size=True))
    def test_cand_usize_str(self):      self._bad(lambda o: o["candidates"][0].update(universe_size="200"))
    def test_cand_run_id_cross_run(self): self._bad(lambda o: o["candidates"][0].update(run_id="other"))
    def test_cand_sector_view_not_dict(self): self._bad(lambda o: o["candidates"][0].update(sector_view="absent"))
    def test_cand_sector_view_no_source(self): self._bad(lambda o: o["candidates"][0].update(sector_view={}))
    def test_cand_gate_eligible_size_non_int(self): self._bad(lambda o: o["candidates"][0].update(gate_eligible_size="150"))
    def test_cand_gate_eligible_size_bool(self): self._bad(lambda o: o["candidates"][0].update(gate_eligible_size=True))
    def test_cand_tier0_score_non_number(self): self._bad(lambda o: o["candidates"][0].update(tier0_score="50"))
    def test_cand_cut_non_list(self):   self._bad(lambda o: o["candidates"][0].update(counterfactual_cut={}))
    def test_hardgate_underfill_logged(self):
        obj = _extract_obj()
        obj["candidates"] += _arm_obj("sector-hard-gate", ["005930"])
        obj["candidates"][-1]["gate_eligible_size"] = 149
        with self.assertRaises(SE.ShadowEvalInputError):
            SE.parse_shadow_extract([obj])
    def test_snap_score_str(self):      self._bad(lambda o: o["snapshot"][0].update(tier0_score="50"))
    def test_snap_score_bool(self):     self._bad(lambda o: o["snapshot"][0].update(tier0_score=True))
    def test_snap_ticker_missing(self): self._bad(lambda o: o["snapshot"][0].pop("ticker"))
    def test_snap_bucket_bad_value(self): self._bad(lambda o: o["snapshot"][0].update(bucket="midlong"))
    def test_snap_usize_bool(self):     self._bad(lambda o: o["snapshot"][0].update(universe_size=True))
    def test_snap_uhash_non_str(self):  self._bad(lambda o: o["snapshot"][0].update(universe_hash=1))
    def test_snap_run_id_cross_run(self): self._bad(lambda o: o["snapshot"][0].update(run_id="other"))
    def test_run_id_count_ambiguous(self): self._bad(lambda o: o.update(run_id_count=2))
    def test_empty_selection_as_of_fails_closed(self): self._bad(lambda o: o["hypothesis"][0].update(selection_as_of=""))
    def test_hyp_source_non_str(self):  self._bad(lambda o: o["hypothesis"][0].update(source=1))
    def test_hypothesis_content_mismatch(self):
        obj = _extract_obj()
        other = dict(obj["hypothesis"][0])
        other["hypothesis_hash"] = "different"
        obj["hypothesis"].append(other)
        with self.assertRaisesRegex(SE.ShadowEvalInputError, "hypothesis_mismatch"):
            SE.parse_shadow_extract([obj])
    def test_sector_source_mismatch_within_arm(self):
        obj = _extract_obj()
        obj["candidates"][1]["sector_view"]["source"] = "absent"
        with self.assertRaisesRegex(SE.ShadowEvalInputError, "sector_view_source_mismatch_within_arm"):
            SE.parse_shadow_extract([obj])
    def test_hardgate_cut_element_wrongtype(self):
        obj = _extract_obj()
        obj["candidates"] += _arm_obj("sector-hard-gate", ["005930"])
        obj["candidates"][-1]["counterfactual_cut"] = [123]
        with self.assertRaises(SE.ShadowEvalInputError):
            SE.parse_shadow_extract([obj])
    def test_cross_arm_hash_mismatch(self):
        obj = _extract_obj()
        for c in obj["candidates"]:
            if c["arm"] == "sector-soft-tilt":
                c["universe_hash"] = "DIFFERENT"
        with self.assertRaises(SE.ShadowEvalInputError):
            SE.parse_shadow_extract([obj])
    def test_snapshot_candidate_hash_mismatch(self):
        obj = _extract_obj()
        obj["snapshot"][0]["universe_hash"] = "DIFFERENT"
        with self.assertRaisesRegex(SE.ShadowEvalInputError, "universe_hash_mismatch"):
            SE.parse_shadow_extract([obj])
    def test_duplicate_period(self):
        with self.assertRaises(SE.ShadowEvalInputError):
            SE.parse_shadow_extract([_extract_obj(), _extract_obj()])

    def test_happy(self):
        ex = SE.parse_shadow_extract([_extract_obj()])
        self.assertIn("2026-06", ex)
        e = ex["2026-06"]
        self.assertEqual(e.run_id, "r1")
        self.assertEqual(e.universe_size, 200)
        self.assertEqual(e.per_arm["production-mirror"].selected_all, {"005930", "000660"})
        self.assertEqual(e.snapshot_tickers, {"005930", "000660", "035720"})

    def test_parse_iso_day_non_str_fails_closed(self):
        for bad in (None, 123):
            with self.assertRaises(SE.ShadowEvalInputError):
                SE._parse_iso_day(bad, "selection_as_of")


# =========================================================================== survivorship
class Survivorship(unittest.TestCase):
    def _art(self, **o):
        base = {"market": "KOSPI", "old_date": "20240101", "recent_date": "20271231",
                "old_count": 900, "recent_count": 950, "gone_count": 5, "exit_status": 0, "schema_version": 1}
        base.update(o)
        other = dict(base)
        other["market"] = "KOSDAQ"
        return [base, other]

    def test_pass_brackets(self):
        r = SE.read_survivorship_artifact(self._art(), forward_window=(date(2026, 6, 1), date(2026, 12, 1)))
        self.assertEqual(r["exit_status"], 0)

    def test_biased(self):
        r = SE.read_survivorship_artifact(self._art(exit_status=1), forward_window=(date(2026, 6, 1), date(2026, 12, 1)))
        self.assertEqual(r["exit_status"], 1)
        self.assertIn("upper-bound", r["label"])

    def test_stale_not_bracketing(self):
        r = SE.read_survivorship_artifact(self._art(recent_date="20260615"),
                                          forward_window=(date(2026, 6, 1), date(2026, 12, 1)))
        self.assertEqual(r["exit_status"], 9)
    def test_stale_old_too_late(self):
        r = SE.read_survivorship_artifact(self._art(old_date="20260602"),
                                          forward_window=(date(2026, 6, 1), date(2026, 12, 1)))
        self.assertEqual(r["exit_status"], 9)
    def test_exact_boundary_pass(self):
        r = SE.read_survivorship_artifact(self._art(old_date="20260601", recent_date="20261201"),
                                          forward_window=(date(2026, 6, 1), date(2026, 12, 1)))
        self.assertEqual(r["exit_status"], 0)
    def test_two_market_worst_status(self):
        arr = self._art()
        arr[1]["exit_status"] = 1
        r = SE.read_survivorship_artifact(arr, forward_window=(date(2026, 6, 1), date(2026, 12, 1)))
        self.assertEqual(r["exit_status"], 1)
    def test_malformed_date_coercion_rejected(self):
        with self.assertRaises(SE.ShadowEvalInputError):
            SE._yyyymmdd("2020-0101-99")
    def test_single_market_nonbracketing_is_hard_error(self):
        with self.assertRaisesRegex(SE.ShadowEvalInputError, "KOSPI and KOSDAQ"):
            SE.read_survivorship_artifact([self._art(recent_date="20260615")[0]],
                                          forward_window=(date(2026, 6, 1), date(2026, 12, 1)))

    def test_artifact_stale_status(self):
        r = SE.read_survivorship_artifact(self._art(exit_status=9),
                                          forward_window=(date(2026, 6, 1), date(2026, 12, 1)))
        self.assertEqual(r["exit_status"], 9)
        self.assertIn("stale", r["label"])

    def test_bad_status_fails_closed(self):
        with self.assertRaises(SE.ShadowEvalInputError):
            SE.read_survivorship_artifact(self._art(exit_status=3),
                                          forward_window=(date(2026, 6, 1), date(2026, 12, 1)))

    def test_bad_date_fails_closed(self):
        with self.assertRaises(SE.ShadowEvalInputError):
            SE.read_survivorship_artifact(self._art(old_date="not-a-date"),
                                          forward_window=(date(2026, 6, 1), date(2026, 12, 1)))

    def test_one_market_fails_closed(self):
        with self.assertRaises(SE.ShadowEvalInputError):
            SE.read_survivorship_artifact([self._art()[0]],
                                          forward_window=(date(2026, 6, 1), date(2026, 12, 1)))

    def test_empty(self):
        with self.assertRaises(SE.ShadowEvalInputError):
            SE.read_survivorship_artifact([], forward_window=(date(2026, 6, 1), date(2026, 12, 1)))

    def test_not_list(self):
        with self.assertRaises(SE.ShadowEvalInputError):
            SE.read_survivorship_artifact({}, forward_window=(date(2026, 6, 1), date(2026, 12, 1)))


# =========================================================================== score cell + aggregate
class ScoreCellVerdict(unittest.TestCase):
    def _agg(self, periods, **krover):
        return SE.aggregate_shadow_harvest(periods, kill_rule=_killrule(**krover),
                                           arms=["production-mirror", "sector-soft-tilt"],
                                           generated_at="t", survivorship={"exit_status": 0, "label": "clean"})

    def test_n_below_data_floor(self):
        rep = self._agg(_periods(4))                       # 4 < 6
        c = rep["cells"][0]
        self.assertEqual(c["verdict"], "INCOMPLETE_RUN")
        self.assertEqual(c["reason_code"], "n_below_data_floor")

    def test_power_floor_short_circuit_directional(self):
        spy = mock.Mock(return_value=(True, []))
        with mock.patch.object(V, "gate_a_pass_selective_largemid", spy):
            rep = self._agg(_periods(7), tracks={"short": {"primary_horizon": "short", "power_floor_n": 10}})
        c = rep["cells"][0]
        self.assertEqual(c["verdict"], "DIRECTIONAL")
        self.assertEqual(c["reason_code"], "DIRECTIONAL_POWER_FLOOR")  # 6<=7<10 → DIRECTIONAL never PASS
        spy.assert_not_called()

    def test_above_power_floor_gate_b_na(self):
        rep = self._agg(_periods(12), tracks={"short": {"primary_horizon": "short", "power_floor_n": 10}})
        c = rep["cells"][0]
        self.assertEqual(c["verdict"], "DIRECTIONAL")
        self.assertEqual(c["reason_code"], "DIRECTIONAL_GATE_B_NA")    # Gate B NA blocks PASS
        self.assertEqual(c["gate_b"]["verdict"], "NOT_APPLICABLE")

    def test_paired_lift_is_per_horizon_not_overall(self):
        # arm recall 0.08 @short, mirror 0.03 @short → lift 0.05; .overall must NOT be used.
        rep = self._agg(_periods(12, lift=0.05), tracks={"short": {"primary_horizon": "short", "power_floor_n": 10}})
        c = rep["cells"][0]
        self.assertAlmostEqual(c["period_lift_mean"], 0.05, places=6)
        self.assertAlmostEqual(c["recall_shadow"], 0.08, places=6)
        self.assertAlmostEqual(c["recall_mirror"], 0.03, places=6)
        self.assertAlmostEqual(c["regime_stratified_lift"]["bull"], 0.05, places=6)

    def test_nan_ci_shadow_fallback_disabled(self):
        gate_spy = mock.Mock(return_value=(True, []))
        with mock.patch.object(V, "_ci90", return_value=[math.nan, math.nan]), \
             mock.patch.object(V, "gate_a_pass_selective_largemid", gate_spy):
            rep = self._agg(_periods(12), tracks={"short": {"primary_horizon": "short", "power_floor_n": 10}})
        c = rep["cells"][0]
        self.assertEqual(c["verdict"], "INCOMPLETE_RUN")
        self.assertEqual(c["reason_code"], "n_below_data_floor")
        gate_spy.assert_not_called()

    def test_ic_ir_reported_uses_ddof1(self):
        values = [1.0, 0.8, 0.6, 0.4, -1.0, 0.8]
        periods = []
        for i, ic in enumerate(values):
            p = _period(f"2026-W{10+i:02d}", "short", "bull", arm_lift=0.05, sel_idx=i * 40)
            p.snapshot_score_by_horizon = {"short": {"a": 1.0, "b": 2.0, "c": 3.0}}
            p.fwd_by_horizon = {"short": {"a": 1.0, "b": 2.0 + ic, "c": 3.0 - ic}}
            periods.append(p)
        with mock.patch.object(SE, "_spearman_ic", side_effect=values):
            rep = self._agg(periods, tracks={"short": {"primary_horizon": "short", "power_floor_n": 6}})
        self.assertAlmostEqual(rep["cells"][0]["ic_ir"], SE._ic_ir_ddof1(values), places=6)
        self.assertNotAlmostEqual(SE._ic_ir_ddof1(values), V.ic_information_ratio(values), places=6)

    def test_survivorship_blocks(self):
        rep = SE.aggregate_shadow_harvest(_periods(12), kill_rule=_killrule(),
                                          arms=["production-mirror", "sector-soft-tilt"],
                                          generated_at="t", survivorship={"exit_status": 1, "label": "biased"})
        self.assertEqual(rep["reason_code"], "survivorship_failed")

    def test_survivorship_first_before_no_eligible(self):
        ps = [_period("2026-W10", "short", "bull", arm_lift=0.05, eligible=False)]
        rep = SE.aggregate_shadow_harvest(ps, kill_rule=_killrule(), arms=["production-mirror", "sector-soft-tilt"],
                                          generated_at="t", survivorship={"exit_status": 1, "label": "biased"})
        self.assertEqual(rep["reason_code"], "survivorship_failed")

    def test_winners_floor_excludes(self):
        rep = self._agg(_periods(12, n_win=5), tracks={"short": {"primary_horizon": "short", "power_floor_n": 10}})
        # all cells thin (<10 winners) → no series → n_below_data_floor
        self.assertEqual(rep["cells"][0]["reason_code"], "n_below_data_floor")

    def test_immature_excluded(self):
        rep = self._agg(_periods(12, matured=False))
        self.assertEqual(rep["cells"][0]["reason_code"], "n_below_data_floor")

    def test_mixed_period_subset_drop(self):
        periods = _periods(12)
        for p in periods[:2]:
            p.n_winners_by_horizon["short"] = 5
        for p in periods[2:4]:
            p.matured_horizons = set()
        rep = self._agg(periods, tracks={"short": {"primary_horizon": "short", "power_floor_n": 6}})
        c = rep["cells"][0]
        self.assertEqual(c["n_periods"], 8)
        self.assertAlmostEqual(c["period_lift_mean"], 0.05, places=6)

    def test_coverage_malformed_fails_closed(self):
        with self.assertRaises(SE.ShadowEvalInputError):
            SE.harvest_shadow_periods(panel={}, extract={}, coverage={"periods": [{"status": "complete"}]},
                                      kill_rule=_killrule(), arms=["production-mirror"])

    def test_power_floor_bool_fails_closed(self):
        bad_tracks = {"short": {"primary_horizon": "short", "power_floor_n": True}}
        with self.assertRaises(SE.ShadowEvalInputError):
            self._agg(_periods(12), tracks=bad_tracks)


class AggregateRunLevel(unittest.TestCase):
    def test_no_eligible(self):
        ps = [_period("2026-W10", "short", "bull", arm_lift=0.05, eligible=False)]
        rep = SE.aggregate_shadow_harvest(ps, kill_rule=_killrule(), arms=["production-mirror", "sector-soft-tilt"],
                                          generated_at="t", survivorship={"exit_status": 0})
        self.assertEqual(rep["run_verdict"], "INCOMPLETE_RUN")
        self.assertEqual(rep["reason_code"], "no_eligible_periods")

    def test_plumbing_only(self):
        ps = _periods(8, sector_absent=True)
        rep = SE.aggregate_shadow_harvest(ps, kill_rule=_killrule(), arms=["production-mirror", "sector-soft-tilt"],
                                          generated_at="t", survivorship={"exit_status": 0})
        self.assertEqual(rep["run_verdict"], "INCOMPLETE_RUN_PLUMBING_ONLY")

    def test_per_track_not_masked(self):
        short = _periods(12, lift=0.05)
        mid = [_period(f"2026-{m:02d}", "midlong", "bull", arm_lift=0.05, h="long", sel_idx=i * 200)
               for i, m in enumerate((1, 2, 3))]
        kr = _killrule(tracks={"short": {"primary_horizon": "short", "power_floor_n": 10},
                               "midlong": {"primary_horizon": "long", "power_floor_n": 10}})
        rep = SE.aggregate_shadow_harvest(short + mid, kill_rule=kr,
                                          arms=["production-mirror", "sector-soft-tilt"],
                                          generated_at="t", survivorship={"exit_status": 0})
        self.assertEqual(rep["per_track_verdict"]["short"], "DIRECTIONAL")
        self.assertEqual(rep["per_track_verdict"]["midlong"], "INCOMPLETE_RUN")
        self.assertEqual(rep["run_verdict"], "INCOMPLETE_RUN")

    def test_missing_registered_track_emits_incomplete_cells(self):
        rep = SE.aggregate_shadow_harvest(_periods(12), kill_rule=_killrule(),
                                          arms=["production-mirror", "sector-soft-tilt"],
                                          generated_at="t", survivorship={"exit_status": 0})
        self.assertEqual(rep["per_track_verdict"]["midlong"], "INCOMPLETE_RUN")
        self.assertEqual(rep["run_verdict"], "INCOMPLETE_RUN")

    def test_triple_gate_not_vacuous_on_incomplete(self):
        rep = SE.aggregate_shadow_harvest(_periods(12, n_win=5), kill_rule=_killrule(),
                                          arms=["production-mirror", "sector-soft-tilt"],
                                          generated_at="t", survivorship={"exit_status": 0})
        self.assertFalse(rep["triple_gate_all_pass"])

    def test_fwer_m(self):
        rep = SE.aggregate_shadow_harvest(_periods(12), kill_rule=_killrule(),
                                          arms=["production-mirror", "sector-soft-tilt", "sector-hard-gate"],
                                          generated_at="t", survivorship={"exit_status": 0})
        self.assertEqual(rep["m_fwer"], 4)
        self.assertAlmostEqual(rep["alpha_corr_advisory"], 0.025, places=6)
        self.assertTrue(rep["fwer_via_power_floor_n"])

    def test_intra_track_worst_of_two_arms(self):
        cells = [
            {"track": "short", "verdict": "DIRECTIONAL", "gate_a": {"pass": False},
             "gate_b": {"verdict": "NOT_APPLICABLE"}, "gate_c": {"verdict": "NOT_APPLICABLE"}},
            {"track": "short", "verdict": "INCOMPLETE_RUN", "gate_a": {"pass": False},
             "gate_b": {"verdict": "NOT_APPLICABLE"}, "gate_c": {"verdict": "NOT_APPLICABLE"}},
        ]
        roll = SE._rollup(cells, ["short"])
        self.assertEqual(roll["per_track"]["short"], "INCOMPLETE_RUN")

    def test_hard_gate_counterfactual_report(self):
        p = _period("2026-W10", "short", "bull", arm_lift=0.05)
        p.winners_all = {"cut1", "keep1"}
        p.fwd_by_horizon = {"short": {"cut1": 0.42, "keep1": 0.30}}
        p.per_arm["sector-hard-gate"] = SE._ArmCell(
            {"keep1"}, {"short": {"keep1"}}, _recall({"short": 0.01}), {"cut1", "noise"})
        rep = SE.aggregate_shadow_harvest([p], kill_rule=_killrule(tracks={"short": {"primary_horizon": "short", "power_floor_n": 6}}),
                                          arms=["production-mirror", "sector-hard-gate"],
                                          generated_at="t", survivorship={"exit_status": 0})
        block = rep["hard_gate_counterfactual"]
        self.assertEqual(block["total_gate_cut_leader_count"], 1)
        self.assertEqual(block["periods"][0]["gate_cut_leaders"], [{"ticker": "cut1", "forward_return": 0.42}])

    def test_hard_gate_counterfactual_skips_immature_horizon(self):
        p = _period("2026-W10", "short", "bull", arm_lift=0.05, matured=False)
        p.winners_all = {"cut1"}
        p.fwd_by_horizon = {"short": {"cut1": 0.42}}
        p.per_arm["sector-hard-gate"] = SE._ArmCell(
            set(), {"short": set()}, _recall({"short": 0.0}), {"cut1"})
        rep = SE.aggregate_shadow_harvest([p], kill_rule=_killrule(tracks={"short": {"primary_horizon": "short", "power_floor_n": 6}}),
                                          arms=["production-mirror", "sector-hard-gate"],
                                          generated_at="t", survivorship={"exit_status": 0})
        self.assertEqual(rep["hard_gate_counterfactual"]["total_gate_cut_leader_count"], 0)
        self.assertEqual(rep["hard_gate_counterfactual"]["periods"], [])

    def test_warnings_emit_gap_and_thin_counts(self):
        p = _period("2026-W10", "short", "bull", arm_lift=0.05)
        p.gap_winner_count = 3
        p.thin_gap_excluded_count = 1
        rep = SE.aggregate_shadow_harvest([p], kill_rule=_killrule(tracks={"short": {"primary_horizon": "short", "power_floor_n": 6}}),
                                          arms=["production-mirror", "sector-soft-tilt"],
                                          generated_at="t", survivorship={"exit_status": 0})
        self.assertEqual(rep["warnings"][0]["gap_winner_count"], 3)
        self.assertEqual(rep["warnings"][0]["thin_gap_excluded_count"], 1)

    def test_no_apply_and_claim_discipline(self):
        rep = SE.aggregate_shadow_harvest(_periods(12), kill_rule=_killrule(),
                                          arms=["production-mirror", "sector-soft-tilt"],
                                          generated_at="t", survivorship={"exit_status": 0})
        self.assertTrue(rep["no_apply"])
        self.assertNotIn("PASS", rep["run_verdict"])
        self.assertIn("verification pending", rep["claim_discipline"])

    def test_period_level_availability_drops_do_not_block_run(self):
        ps = _periods(8)
        for reason in ("asof_stale", "run_date_stale", "panel_survivorship_unverified"):
            bad = _period(f"bad-{reason}", "short", "bull", arm_lift=0.05, eligible=False)
            bad.reason_code = reason
            ps.append(bad)
        rep = SE.aggregate_shadow_harvest(ps, kill_rule=_killrule(tracks={"short": {"primary_horizon": "short", "power_floor_n": 6}}),
                                          arms=["production-mirror", "sector-soft-tilt"],
                                          generated_at="t", survivorship={"exit_status": 0})
        self.assertEqual(rep["run_verdict"], "DIRECTIONAL")
        self.assertEqual(rep["cells"][0]["n_periods"], 8)
        self.assertNotIn("reason_code", rep)


# =========================================================================== helpers
class Helpers(unittest.TestCase):
    def test_ic_ir_ddof1(self):
        # ddof=1 SD (n-1). [0.1,0.3,0.2] mean=0.2 var=(0.01+0.01+0)/2=0.01 sd=0.1 → IR=2.0
        self.assertAlmostEqual(SE._ic_ir_ddof1([0.1, 0.3, 0.2]), 2.0, places=6)

    def test_ic_ir_lt2_nan(self):
        self.assertTrue(math.isnan(SE._ic_ir_ddof1([0.1])))

    def test_decimate_nonoverlap(self):
        rows = [_period(f"p{i}", "short", "bull", arm_lift=0.0, sel_idx=s) for i, s in enumerate((0, 5, 25, 30, 60))]
        kept = SE._decimate_nonoverlap(rows, "short")   # HORIZON_DAYS['short']=21
        self.assertEqual([r.sel_idx for r in kept], [0, 25, 60])   # greedy gap>=21

    def test_regime_advisory_single(self):
        flags = SE._regime_advisory([_period("a", "short", "bull", arm_lift=0.0)])
        self.assertIn("single_regime_or_beta_confounded", flags)
        self.assertIn("beta_orthogonalization_pending", flags)

    def test_regime_advisory_multi(self):
        flags = SE._regime_advisory([_period("a", "short", "bull", arm_lift=0.0),
                                     _period("b", "short", "bear", arm_lift=0.0)])
        self.assertNotIn("single_regime_or_beta_confounded", flags)

    def test_tie_fraction(self):
        self.assertAlmostEqual(SE._tie_fraction({"a": 1.00, "b": 1.00, "c": 2.00}), 2 / 3, places=6)

    def test_require_regime_unregistered(self):
        with self.assertRaises(SE.ShadowEvalInputError):
            SE._require_regime(_killrule(regime_by_period_key={}), "2026-06")

    def test_shadow_json_loader_wraps_malformed_json(self):
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "bad.json")
            with open(path, "w") as fh:
                fh.write("{")
            with self.assertRaisesRegex(SE.ShadowEvalInputError, "kill_rule JSON invalid"):
                V._load_shadow_json_file(SE.Path(path), "kill_rule", SE.ShadowEvalInputError)

    def test_emit_shadow_verdict_writes_markdown_sibling(self):
        with tempfile.TemporaryDirectory() as d:
            out = os.path.join(d, "verdict.json")
            SE.emit_shadow_verdict({"run_verdict": "DIRECTIONAL", "per_track_verdict": {"short": "DIRECTIONAL"},
                                    "cells": [{"period_lift_mean": math.nan,
                                               "ci90": [math.nan, math.inf], "ic_ir": -math.inf}],
                                    "survivorship_label": "clean", "claim_discipline": "x",
                                    "no_apply": True}, SE.Path(out))
            self.assertTrue(os.path.exists(out))
            with open(out) as fh:
                raw = fh.read()
            self.assertNotIn("NaN", raw)
            self.assertNotIn("Infinity", raw)
            loaded = json.loads(raw, parse_constant=lambda c: self.fail(f"non-finite JSON literal {c}"))
            self.assertIsNone(loaded["cells"][0]["period_lift_mean"])
            self.assertEqual(loaded["cells"][0]["ci90"], [None, None])
            self.assertIsNone(loaded["cells"][0]["ic_ir"])
            md = os.path.join(d, "verdict.md")
            self.assertTrue(os.path.exists(md))
            with open(md) as fh:
                body = fh.read()
            self.assertIn("run_verdict", body)
            self.assertIn("no_apply", body)


# =========================================================================== invariants
class Invariants(unittest.TestCase):
    def test_no_rng_in_evaluator(self):
        # actual RNG CALLS (not the comment "NOT recall-random"): no random module / seed / np.random.
        for fn in (SE.harvest_shadow_periods, SE.aggregate_shadow_harvest, SE._score_cell, SE._winner_returns):
            src = inspect.getsource(fn)
            for tok in ("random.", "np.random", ".seed(", "Random("):
                self.assertNotIn(tok, src, f"{fn.__name__} makes RNG call {tok}")
        self.assertNotIn("import random", inspect.getsource(SE))

    def test_frozen_funcs_byte_clean(self):
        for fn in (V.process_month, V.aggregate_harvest, V.harvest_pit_months):
            src = inspect.getsource(fn).lower()
            for tok in ("shadow", "shadow_eval"):
                self.assertNotIn(tok, src, f"{fn.__name__} contains '{tok}'")

    def test_sql_materialized_readonly(self):
        self.assertEqual(SE.SHADOW_RUN_EXTRACT_SQL.count("as materialized"), 4)
        up = SE.shadow_sql_inline().upper()
        for forbidden in ("INSERT ", "UPDATE ", "DELETE ", "SKIP LOCKED", "FOR UPDATE"):
            self.assertNotIn(forbidden, up)
        self.assertNotIn("--", SE.shadow_sql_inline())

    def test_no_db_write_in_module(self):
        # actual WRITE calls / clients (the SQL is a read-only SELECT; "service_role" only appears in
        # the no-service_role docstring, "INSERT" never — Query 2 is a SELECT).
        src = inspect.getsource(SE)
        for tok in ("upsert_tier0_shadow_run(", "create_client", ".execute(", "INSERT INTO", "DELETE FROM"):
            self.assertNotIn(tok, src, f"shadow_eval makes DB write/client call {tok}")


# =========================================================================== harvest (tiny fake panel)
class HarvestFakePanel(unittest.TestCase):
    def _panel(self):
        # 40 trading days; 12 tickers with rising closes (deterministic forward returns).
        from validate_tier0_ic import PanelRow
        dates = [f"202601{d:02d}" for d in range(1, 29)] + [f"202602{d:02d}" for d in range(1, 13)]
        tickers = [f"{i:06d}" for i in range(1, 13)]
        panel = {}
        for di, d in enumerate(dates):
            day = {}
            for ti, tk in enumerate(tickers):
                close = 100.0 + di * (ti + 1)        # ticker ti rises faster → top-decile winners deterministic
                day[tk] = PanelRow(close=close, high=close, trdval=1e9, mktcap=1e12 - ti * 1e10,
                                   name=tk, market="KOSPI", list_shrs=1e6)
            panel[d] = day
        return panel, dates, tickers

    def test_harvest_shared_denominators_and_paired(self):
        panel, dates, tickers = self._panel()
        # extract: mirror + soft-tilt selecting different subsets; snapshot = all tickers
        cand = (_arm_obj("production-mirror", tickers[:4], bucket="short")
                + _arm_obj("sector-soft-tilt", tickers[:6], bucket="short"))
        snap = [{"ticker": tk, "bucket": "short", "tier0_score": 50.0 + i, "sector": "반도체",
                 "sector_source": "override", "induty_code": "0", "universe_hash": "uh",
                 "universe_size": 200, "run_id": "r1", "run_date": "2026-01-05"}
                for i, tk in enumerate(tickers)]
        hyp = [{"source": "manual_pre_registered", "leading_sectors": ["반도체"],
                "as_of": "2026-01-01T00:00:00Z", "selection_as_of": "2026-01-05T00:00:00Z", "hypothesis_hash": "h"}]
        ext = SE.parse_shadow_extract([{"period_key": "2026-W02", "run_id": "r1", "run_id_count": 1,
                                        "candidates": cand, "snapshot": snap, "hypothesis": hyp}])
        cov = {"periods": [{"period_key": "2026-W02", "status": "complete"}]}
        spy = []
        real = V.gate_a_recall

        def _spy(selected_all, selected_by_horizon, winners_all, winners_by_horizon, universe_size, **kw):
            spy.append((winners_all, winners_by_horizon, universe_size, kw["largemid_winners"], kw["leader_basket"]))
            return real(selected_all, selected_by_horizon, winners_all, winners_by_horizon, universe_size, **kw)

        with mock.patch.object(V, "gate_a_recall", _spy):
            res = SE.harvest_shadow_periods(panel=panel, extract=ext, coverage=cov,
                                            kill_rule=_killrule(regime_by_period_key={"2026-W02": "bull"}),
                                            arms=["production-mirror", "sector-soft-tilt"])
        self.assertEqual(len(res), 1)
        self.assertTrue(res[0].eligible)
        # SHARED frozen denominators: identical OBJECT across both arm calls (§4.1 / §10.2)
        self.assertEqual(len(spy), 2)
        self.assertIs(spy[0][0], spy[1][0])    # winners_all
        self.assertIs(spy[0][1], spy[1][1])    # winners_by_horizon
        self.assertEqual(spy[0][2], spy[1][2])  # universe_size
        self.assertIs(spy[0][4], spy[1][4])    # leader_basket (LEADER_BASKET_2026_06)

    def test_gap_zero_trdval_excluded_from_winner_returns(self):
        from validate_tier0_ic import PanelRow
        dates = [f"202601{d:02d}" for d in range(1, 29)]
        panel = {}
        for i, d in enumerate(dates):
            if i == 22:
                panel[d] = {}
                continue
            trdval = 0.0 if i == 21 else 1.0
            panel[d] = {"000001": PanelRow(close=100.0 + i, high=100.0 + i, trdval=trdval,
                                           mktcap=1e12, name="a", market="KOSPI", list_shrs=1e6)}
        got, gap_count, thin_count = SE._winner_returns(panel, dates, ["000001"], 0, "short")
        self.assertEqual(got, {})
        self.assertEqual(gap_count, 1)
        self.assertEqual(thin_count, 1)

    def test_gap_trdval_mixed_tickers(self):
        from validate_tier0_ic import PanelRow
        dates = [f"202601{d:02d}" for d in range(1, 29)]
        panel = {}
        for i, d in enumerate(dates):
            day = {}
            for tk, thin in (("000001", False), ("000002", False), ("000003", True)):
                if tk in ("000002", "000003") and i == 22:
                    continue
                trdval = 0.0 if thin and i == 21 else 1.0
                day[tk] = PanelRow(close=100.0 + i, high=100.0 + i, trdval=trdval,
                                   mktcap=1e12, name=tk, market="KOSPI", list_shrs=1e6)
            panel[d] = day
        got, gap_count, thin_count = SE._winner_returns(panel, dates, ["000001", "000002", "000003"], 0, "short")
        self.assertEqual(set(got), {"000001", "000002"})
        self.assertEqual(gap_count, 2)
        self.assertEqual(thin_count, 1)

    def test_selection_before_panel_is_forward_insufficient(self):
        panel, dates, tickers = self._panel()
        obj = _extract_obj(period_key="2026-W02")
        obj["hypothesis"][0]["selection_as_of"] = "2025-01-01T00:00:00Z"
        obj["hypothesis"][0]["as_of"] = "2024-12-31T00:00:00Z"
        for c in obj["candidates"]:
            c["period_key"] = "2026-W02"
        obj["snapshot"] = [{"ticker": tk, "bucket": "short", "tier0_score": 1.0, "sector": "반도체",
                            "sector_source": "override", "induty_code": "0", "universe_hash": "uh",
                            "universe_size": 200, "run_id": "r1", "run_date": "2025-01-01"}
                           for tk in tickers]
        ext = SE.parse_shadow_extract([obj])
        res = SE.harvest_shadow_periods(panel=panel, extract=ext, coverage={"periods": [{"period_key": "2026-W02", "status": "complete"}]},
                                        kill_rule=_killrule(regime_by_period_key={"2026-W02": "bull"}),
                                        arms=["production-mirror", "sector-soft-tilt"])
        self.assertFalse(res[0].eligible)
        self.assertEqual(res[0].reason_code, "forward_insufficient")

    def test_weekly_missing_selection_as_of_is_forward_insufficient(self):
        panel, dates, tickers = self._panel()
        obj = _extract_obj(period_key="2026-W02")
        obj["hypothesis"] = []
        for c in obj["candidates"]:
            c["period_key"] = "2026-W02"
        obj["snapshot"] = [{"ticker": tk, "bucket": "short", "tier0_score": 1.0, "sector": "반도체",
                            "sector_source": "override", "induty_code": "0", "universe_hash": "uh",
                            "universe_size": 200, "run_id": "r1", "run_date": "2026-01-05"}
                           for tk in tickers]
        ext = SE.parse_shadow_extract([obj])
        kr = _killrule(regime_by_period_key={"2026-W02": "bull"})
        self.assertEqual(SE.shadow_forward_window(ext, kr, panel,
                                                  fallback=(date(2026, 1, 1), date(2026, 1, 31))),
                         (date(2026, 1, 1), date(2026, 1, 31)))
        res = SE.harvest_shadow_periods(panel=panel, extract=ext,
                                        coverage={"periods": [{"period_key": "2026-W02", "status": "complete"}]},
                                        kill_rule=kr, arms=["production-mirror", "sector-soft-tilt"])
        self.assertFalse(res[0].eligible)
        self.assertEqual(res[0].reason_code, "forward_insufficient")

    def test_asof_stale_and_run_date_stale_are_period_incomplete(self):
        panel, dates, tickers = self._panel()
        obj = _extract_obj(period_key="2026-W02")
        for c in obj["candidates"]:
            c["period_key"] = "2026-W02"
        obj["hypothesis"][0]["as_of"] = "2026-01-05T00:00:00Z"
        obj["hypothesis"][0]["selection_as_of"] = "2026-01-05T00:00:00Z"
        obj["snapshot"] = [{"ticker": tk, "bucket": "short", "tier0_score": 1.0, "sector": "반도체",
                            "sector_source": "override", "induty_code": "0", "universe_hash": "uh",
                            "universe_size": 200, "run_id": "r1", "run_date": "2025-10-01"}
                           for tk in tickers]
        ext = SE.parse_shadow_extract([obj])
        res = SE.harvest_shadow_periods(panel=panel, extract=ext, coverage={"periods": [{"period_key": "2026-W02", "status": "complete"}]},
                                        kill_rule=_killrule(regime_by_period_key={"2026-W02": "bull"}),
                                        arms=["production-mirror", "sector-soft-tilt"])
        self.assertEqual(res[0].reason_code, "asof_stale")
        obj["hypothesis"][0]["as_of"] = "2026-01-01T00:00:00Z"
        ext = SE.parse_shadow_extract([obj])
        res = SE.harvest_shadow_periods(panel=panel, extract=ext, coverage={"periods": [{"period_key": "2026-W02", "status": "complete"}]},
                                        kill_rule=_killrule(regime_by_period_key={"2026-W02": "bull"}),
                                        arms=["production-mirror", "sector-soft-tilt"])
        self.assertEqual(res[0].reason_code, "run_date_stale")

    def test_panel_absent_below_threshold_is_report_only(self):
        panel, dates, tickers = self._panel()
        tk_absent = tickers[-1]
        for d in dates:
            panel[d].pop(tk_absent, None)
        cand = _arm_obj("production-mirror", tickers[:4], bucket="short") + _arm_obj("sector-soft-tilt", tickers[:6], bucket="short")
        snap = [{"ticker": tk, "bucket": "short", "tier0_score": 50.0 + i, "sector": "반도체",
                 "sector_source": "override", "induty_code": "0", "universe_hash": "uh",
                 "universe_size": 200, "run_id": "r1", "run_date": "2026-01-05"}
                for i, tk in enumerate(tickers)]
        hyp = [{"source": "manual_pre_registered", "leading_sectors": ["반도체"],
                "as_of": "2026-01-01T00:00:00Z", "selection_as_of": "2026-01-05T00:00:00Z", "hypothesis_hash": "h"}]
        ext = SE.parse_shadow_extract([{"period_key": "2026-W02", "run_id": "r1", "run_id_count": 1,
                                        "candidates": cand, "snapshot": snap, "hypothesis": hyp}])
        res = SE.harvest_shadow_periods(panel=panel, extract=ext, coverage={"periods": [{"period_key": "2026-W02", "status": "complete"}]},
                                        kill_rule=_killrule(regime_by_period_key={"2026-W02": "bull"}),
                                        arms=["production-mirror", "sector-soft-tilt"])
        self.assertTrue(res[0].eligible)
        self.assertAlmostEqual(res[0].absent_fraction, 1 / len(tickers), places=6)

    def test_panel_absent_above_threshold_blocks_period(self):
        panel, dates, tickers = self._panel()
        for tk_absent in tickers[-2:]:
            for d in dates:
                panel[d].pop(tk_absent, None)
        cand = _arm_obj("production-mirror", tickers[:4], bucket="short") + _arm_obj("sector-soft-tilt", tickers[:6], bucket="short")
        snap = [{"ticker": tk, "bucket": "short", "tier0_score": 50.0 + i, "sector": "반도체",
                 "sector_source": "override", "induty_code": "0", "universe_hash": "uh",
                 "universe_size": 200, "run_id": "r1", "run_date": "2026-01-05"}
                for i, tk in enumerate(tickers)]
        hyp = [{"source": "manual_pre_registered", "leading_sectors": ["반도체"],
                "as_of": "2026-01-01T00:00:00Z", "selection_as_of": "2026-01-05T00:00:00Z", "hypothesis_hash": "h"}]
        ext = SE.parse_shadow_extract([{"period_key": "2026-W02", "run_id": "r1", "run_id_count": 1,
                                        "candidates": cand, "snapshot": snap, "hypothesis": hyp}])
        res = SE.harvest_shadow_periods(panel=panel, extract=ext, coverage={"periods": [{"period_key": "2026-W02", "status": "complete"}]},
                                        kill_rule=_killrule(regime_by_period_key={"2026-W02": "bull"}),
                                        arms=["production-mirror", "sector-soft-tilt"])
        self.assertFalse(res[0].eligible)
        self.assertEqual(res[0].reason_code, "panel_survivorship_unverified")
        self.assertAlmostEqual(res[0].absent_fraction, 2 / len(tickers), places=6)

    def test_mirror_absent_raises(self):
        panel, dates, tickers = self._panel()
        ext = SE.parse_shadow_extract([{"period_key": "2026-W02", "run_id": None, "run_id_count": 0,
                                        "candidates": [], "snapshot": [], "hypothesis": []}])
        with self.assertRaisesRegex(SE.ShadowEvalInputError, "mirror_arm_absent"):
            SE.harvest_shadow_periods(panel=panel, extract=ext, coverage={"periods": []},
                                      kill_rule=_killrule(regime_by_period_key={"2026-W02": "bull"}),
                                      arms=["production-mirror"])


# =========================================================================== probe --emit-artifact
class ProbeEmitArtifact(unittest.TestCase):
    def _run(self, argv, fake_fetch):
        import probe_pit_survivorship as P
        out = io.StringIO()
        with mock.patch.object(sys, "argv", ["probe"] + argv), \
             mock.patch.dict(sys.modules), redirect_stdout(out):
            import krx_openapi
            with mock.patch.object(krx_openapi, "fetch_bydd_trd", fake_fetch):
                rc = P.main()
        return rc

    def test_default_no_file_pass(self):
        f = lambda mkt, d: ([{"ISU_CD": "A", "ISU_NM": "a"}] if d == "20240101"
                            else [{"ISU_CD": "B", "ISU_NM": "b"}])  # gone={A} → PASS exit 0
        rc = self._run(["--old", "20240101", "--recent", "20271231", "--market", "KOSPI"], f)
        self.assertEqual(rc, 0)

    def test_emit_pass_artifact(self):
        f = lambda mkt, d: ([{"ISU_CD": "A"}, {"ISU_CD": "B"}] if d == "20240101"
                            else [{"ISU_CD": "B"}])   # gone={A} → PASS
        with tempfile.NamedTemporaryFile("r", suffix=".json", delete=False) as fh:
            path = fh.name
        self.addCleanup(os.unlink, path)
        rc = self._run(["--old", "20240101", "--recent", "20271231", "--market", "KOSPI",
                        "--emit-artifact", path], f)
        self.assertEqual(rc, 0)
        with open(path) as _fh:
            arr = json.load(_fh)
        self.assertIsInstance(arr, list)
        self.assertEqual(arr[0]["exit_status"], 0)
        self.assertEqual(arr[0]["gone_count"], 1)
        self.assertEqual(arr[0]["market"], "KOSPI")

    def test_emit_unknown_gone_none(self):
        f = lambda mkt, d: ([] if d == "20240101" else [{"ISU_CD": "B"}])   # old empty → UNKNOWN exit 2
        with tempfile.NamedTemporaryFile("r", suffix=".json", delete=False) as fh:
            path = fh.name
        self.addCleanup(os.unlink, path)
        rc = self._run(["--old", "20240101", "--recent", "20271231", "--market", "KOSPI",
                        "--emit-artifact", path], f)
        self.assertEqual(rc, 2)
        with open(path) as _fh:
            arr = json.load(_fh)
        self.assertIsNone(arr[0]["gone_count"])   # no NameError; None on UNKNOWN path
        self.assertEqual(arr[0]["exit_status"], 2)


if __name__ == "__main__":
    unittest.main(verbosity=2)
