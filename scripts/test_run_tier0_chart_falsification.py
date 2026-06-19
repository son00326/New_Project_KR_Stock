"""Driver tests for (D) chart-technical falsification.

SoT: docs/superpowers/2026-06-18-tier0-chart-technical.md
kill-switch fire/pass logic · foreign BLOCKED/OFF non-blocking · cfg7 N/A · verdict short-circuit ·
wording guard · cfg1-4 byte-identical (tier0_factors / validate_tier0_ic import-only, no edits).
"""
from __future__ import annotations

import math
import sys
import unittest
from io import StringIO
from unittest import mock
from pathlib import Path

_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(_DIR))
import tier0_factors as F  # noqa: E402
import tier0_chart as Ch  # noqa: E402
import run_tier0_chart_falsification as R  # noqa: E402


# ============================================================================
# aggregate_killswitch — FIRE rule (trend/full_bpp binding; size reported; foreign/cfg7 non-blocking)
# ============================================================================

def _km(scope_vals: dict) -> dict:
    """Build a per-month killswitch dict for the 'overall' scope (others empty)."""
    return {"overall": scope_vals, "large": {}, "mid": {}, "small": {}}


def _km_scope(scope: str, scope_vals: dict) -> dict:
    out = {"overall": {}, "large": {}, "mid": {}, "small": {}}
    out[scope] = scope_vals
    return out


class TestKillswitchFireRule(unittest.TestCase):
    def test_fires_on_high_trend_mean(self):
        per_month = [_km({"trend": 0.7, "full_bpp": 0.1, "size": 0.0}) for _ in range(4)]
        agg = R.aggregate_killswitch(per_month, with_foreign=False)
        self.assertTrue(agg["fired"])
        self.assertTrue(any("trend" in r for r in agg["fire_reasons"]))

    def test_fires_on_full_bpp_ci_upper_crossing(self):
        # means modest but variance pushes CI90 upper across 0.5.
        per_month = [_km({"trend": 0.1, "full_bpp": v, "size": 0.0}) for v in (0.1, 0.2, 0.4, 0.6)]
        agg = R.aggregate_killswitch(per_month, with_foreign=False)
        self.assertTrue(agg["fired"])

    def test_fires_on_negative_abs_corr(self):
        per_month = [_km({"trend": -0.7, "full_bpp": 0.1, "size": 0.0}) for _ in range(4)]
        agg = R.aggregate_killswitch(per_month, with_foreign=False)
        self.assertTrue(agg["fired"])
        self.assertTrue(any("|mean corr|" in r for r in agg["fire_reasons"]))

    def test_fires_on_by_sleeve_scope(self):
        per_month = [_km_scope("large", {"trend": 0.7, "full_bpp": 0.1, "size": 0.0}) for _ in range(4)]
        agg = R.aggregate_killswitch(per_month, with_foreign=False)
        self.assertTrue(agg["fired"])
        self.assertTrue(any("large/trend" in r for r in agg["fire_reasons"]))

    def test_fires_at_exact_threshold(self):
        per_month = [_km({"trend": 0.5, "full_bpp": 0.1, "size": 0.0}) for _ in range(4)]
        agg = R.aggregate_killswitch(per_month, with_foreign=False)
        self.assertTrue(agg["fired"])

    def test_does_not_fire_on_low_corr(self):
        per_month = [_km({"trend": 0.1, "full_bpp": 0.15, "size": 0.05}) for _ in range(5)]
        agg = R.aggregate_killswitch(per_month, with_foreign=False)
        self.assertFalse(agg["fired"])
        self.assertEqual(agg["fire_reasons"], [])

    def test_blocks_when_primary_scope_unmeasurable_and_not_fired(self):
        per_month = [_km({"trend": 0.1, "full_bpp": 0.15, "size": 0.05}) for _ in range(5)]
        agg = R.aggregate_killswitch(per_month, with_foreign=False)
        self.assertTrue(agg["blocked"])
        self.assertTrue(agg["block_reasons"])

    def test_size_high_does_not_fire(self):
        # size corr high but trend/full_bpp low → MUST NOT fire (size not a binding trigger).
        per_month = [_km({"trend": 0.1, "full_bpp": 0.1, "size": 0.9}) for _ in range(5)]
        agg = R.aggregate_killswitch(per_month, with_foreign=False)
        self.assertFalse(agg["fired"])

    def test_foreign_blocked_off_when_not_with_foreign(self):
        per_month = [_km({"trend": 0.1, "full_bpp": 0.1, "size": 0.0}) for _ in range(4)]
        agg = R.aggregate_killswitch(per_month, with_foreign=False)
        self.assertEqual(agg["by_scope"]["overall"]["foreign"]["status"], "BLOCKED/OFF")
        # BLOCKED foreign must not fire.
        self.assertFalse(agg["fired"])

    def test_cfg7_is_na_not_failure(self):
        per_month = [_km({"trend": 0.1, "full_bpp": 0.1, "size": 0.0}) for _ in range(4)]
        agg = R.aggregate_killswitch(per_month, with_foreign=False)
        self.assertEqual(agg["by_scope"]["overall"]["cfg7"]["status"], "N/A")
        self.assertFalse(agg["fired"])

    def test_foreign_high_corr_does_not_block_primary(self):
        # with_foreign=True, foreign corr high but trend/full_bpp low → still NOT fired (foreign not binding).
        per_month = [_km({"trend": 0.1, "full_bpp": 0.1, "size": 0.0, "foreign": 0.95}) for _ in range(4)]
        agg = R.aggregate_killswitch(per_month, with_foreign=True)
        self.assertFalse(agg["fired"])


# ============================================================================
# build_verdict — short-circuit: fired → selector appendix only
# ============================================================================

class TestBuildVerdict(unittest.TestCase):
    def test_fired_makes_selector_appendix(self):
        killswitch = {"fired": True, "fire_reasons": ["overall/trend |mean corr| 0.700 >= 0.5"]}
        selector = {"by_n": {"50": {"gate": {"pass": True}}}}  # even if gate "passed", appendix only
        v = R.build_verdict(killswitch, selector)
        self.assertEqual(v["raw_decision"], "KILLSWITCH_FIRED")
        self.assertTrue(v["selector_gate_appendix_only"])
        self.assertIsNone(v["selector_gate_pass"])
        self.assertIn("already-tested OHLCV momentum", v["verdict"])

    def test_blocked_makes_selector_appendix(self):
        killswitch = {"fired": False, "blocked": True, "block_reasons": ["large/trend missing"]}
        selector = {"by_n": {"50": {"gate": {"pass": True}}}}
        v = R.build_verdict(killswitch, selector)
        self.assertEqual(v["raw_decision"], "KILLSWITCH_BLOCKED")
        self.assertTrue(v["selector_gate_appendix_only"])
        self.assertIsNone(v["selector_gate_pass"])

    def test_passed_gate_pass(self):
        killswitch = {"fired": False, "fire_reasons": []}
        selector = {"by_n": {"50": {"gate": {"pass": True}}}}
        v = R.build_verdict(killswitch, selector)
        self.assertEqual(v["raw_decision"], "SELECTOR_GATE_PASS")
        self.assertTrue(v["selector_gate_pass"])

    def test_passed_gate_fail(self):
        killswitch = {"fired": False, "fire_reasons": []}
        selector = {"by_n": {"50": {"gate": {"pass": False, "fails": ["x"]}}}}
        v = R.build_verdict(killswitch, selector)
        self.assertEqual(v["raw_decision"], "SELECTOR_GATE_FAIL")
        self.assertFalse(v["selector_gate_pass"])


# ============================================================================
# wording guard — fail-closed on forbidden tokens
# ============================================================================

class TestWordingGuard(unittest.TestCase):
    def test_clean_verdict_passes(self):
        report = {"verdict": {"verdict": "FIRED — already-tested OHLCV momentum"}}
        R._assert_verdict_wording(report)  # no raise

    def test_forbidden_word_raises(self):
        for bad in ("rescue", "apply", "상승 예측"):
            with self.assertRaises(AssertionError):
                R._assert_verdict_wording({"verdict": {"verdict": f"this would {bad} the funnel"}})


# ============================================================================
# pooled-top-N selector reuse — deterministic, equals (가) truncation
# ============================================================================

def _eligible_universe(n_days=300, n=200):
    """Universe large enough to fill L20/M20/S10 sleeves (cross-bucket-disjoint) without shortfall.

    Wide mcap spread (exp) so size_breakpoints yields ~top20% large / next40% mid / rest small.
    """
    base = [100.0 * (1.0015 ** i) for i in range(n_days)]
    out = []
    for j in range(n):
        cl = [c * (1 + 0.005 * j) for c in base]
        out.append(F.StockRaw(ticker=f"T{j:03d}", sector="제조", market_cap=1e11 * (1.05 ** j),
                               closes=cl, trdvals=[5e9] * n_days, highs=None))
    return out


class TestPooledTopN(unittest.TestCase):
    def test_topn_returns_exact_registered_counts(self):
        stocks = _eligible_universe()
        chart_by_b = {b: Ch.score_chart_universe(stocks, b) for b in R.HARVEST_BUCKETS}
        for n in (30, 50, 75):
            sel = R._pooled_topn_select(chart_by_b, n)
            self.assertEqual(len(sel), n)

    def test_topn_deterministic(self):
        stocks = _eligible_universe()
        chart_by_b = {b: Ch.score_chart_universe(stocks, b) for b in R.HARVEST_BUCKETS}
        a = R._pooled_topn_select(chart_by_b, 50)
        b = R._pooled_topn_select(chart_by_b, 50)
        self.assertEqual(a, b)


# ============================================================================
# leave-one-out diagnostic — returns a ratio for each sub-indicator, no removal applied
# ============================================================================

class TestLeaveOneOut(unittest.TestCase):
    def test_loo_returns_all_subindicators(self):
        stocks = _eligible_universe()
        # fabricate winners + tier_of from the universe
        fwd = {b: {s.ticker: 0.3 for s in stocks[:10]} for b in R.HARVEST_BUCKETS}
        winners = {s.ticker for s in stocks[:10]}
        tier_of = {s.ticker: "large" for s in stocks}
        loo = R._leave_one_out_recall(stocks, fwd, winners, tier_of, 50)
        for sub in Ch.SUB_INDICATORS:
            self.assertIn(sub, loo)
            self.assertIn("num", loo[sub])

    def test_diagnostics_are_non_binding(self):
        diag = R._diagnostics_report([{"a|b": 0.1}], {s: 1 for s in Ch.SUB_INDICATORS}, 10)
        self.assertFalse(diag["decision_grade"])
        self.assertTrue(diag["diagnostic_only"])
        self.assertNotIn("gate", diag)
        self.assertNotIn("pass", diag)


def _leg(months):
    leg = R._LegAcc()
    leg.months = months
    return leg


class TestSelectorReport(unittest.TestCase):
    def test_only_n50_is_adjudicated(self):
        month = {
            "month": "2023-01-01", "recall": 0.2, "random_baseline": 0.1,
            "composite_ic": 0.05, "num": 2, "den": 10, "lm_num": 2, "lm_den": 10,
            "leader_hits": 0,
        }
        legs = {
            n: {"chart": _leg([dict(month)]), "bpp": _leg([dict(month)])}
            for n in (R.ADJUDICATED_N, *R.SENSITIVITY_N)
        }
        rep = R._selector_report(legs, {b: [0.5] for b in R.HARVEST_BUCKETS}, fired=False)
        self.assertTrue(rep["by_n"]["50"]["adjudicated"])
        self.assertIn("gate", rep["by_n"]["50"])
        for n in ("30", "75"):
            self.assertFalse(rep["by_n"][n]["adjudicated"])
            self.assertNotIn("gate", rep["by_n"][n])
            self.assertIn("NON-ADJUDICATED", rep["by_n"][n]["note"])

    def test_ic_gate_uses_monthly_composite_ic_not_bucket_diagnostic(self):
        months = [
            {"month": "2023-01-01", "recall": 0.2, "random_baseline": 0.1, "composite_ic": 0.10,
             "num": 2, "den": 10, "lm_num": 2, "lm_den": 10, "leader_hits": 0},
            {"month": "2023-02-01", "recall": 0.25, "random_baseline": 0.1, "composite_ic": 0.20,
             "num": 3, "den": 12, "lm_num": 3, "lm_den": 12, "leader_hits": 0},
        ]
        legs = {
            n: {"chart": _leg([dict(m) for m in months]), "bpp": _leg([dict(m) for m in months])}
            for n in (R.ADJUDICATED_N, *R.SENSITIVITY_N)
        }
        rep = R._selector_report(legs, {b: [0.99, 0.99] for b in R.HARVEST_BUCKETS}, fired=False)
        expected = R.V._json_number(R.V.ic_information_ratio([0.10, 0.20]), 4)
        self.assertEqual(rep["by_n"]["50"]["rank_ic_ir"], expected)
        self.assertNotEqual(rep["by_n"]["50"]["rank_ic_ir"], rep["bucket_ic_ir_diagnostic"])


# ============================================================================
# frozen byte-identical attest — tier0_factors & validate_tier0_ic NOT edited by (D)
# ============================================================================

class TestFrozenBoundary(unittest.TestCase):
    def test_chart_module_does_not_define_with_chart_on_scorer(self):
        # tier0_factors.score_bpp_universe must NOT have a with_chart param (chart lives standalone).
        import inspect
        sig = inspect.signature(F.score_bpp_universe)
        self.assertNotIn("with_chart", sig.parameters)

    def test_score_bpp_universe_byte_identical_with_without_chart_import(self):
        # importing tier0_chart must not mutate F.score_bpp_universe output.
        stocks = _eligible_universe(n=30)
        before = [(sc.ticker, sc.score) for sc in F.score_bpp_universe(stocks, "short")]
        import tier0_chart  # noqa: F401  (re-import, must be side-effect free)
        after = [(sc.ticker, sc.score) for sc in F.score_bpp_universe(stocks, "short")]
        self.assertEqual(before, after)

    def test_tier0_factors_has_no_chart_refs(self):
        text = (_DIR / "tier0_factors.py").read_text()
        for token in ("tier0_chart", "with_chart", "chart_technical"):
            self.assertNotIn(token, text)


class TestCliGuards(unittest.TestCase):
    def test_universe_limit_is_smoke_only(self):
        argv = [
            "run_tier0_chart_falsification.py",
            "--start-month", "2023-01-01",
            "--end-month", "2023-03-01",
            "--universe-limit", "400",
        ]
        with mock.patch.object(sys, "argv", argv), mock.patch("sys.stderr", StringIO()):
            with self.assertRaises(SystemExit):
                R.main()

    def test_with_foreign_is_blocked_for_ohlcv_only_protocol(self):
        argv = [
            "run_tier0_chart_falsification.py",
            "--start-month", "2023-01-01",
            "--end-month", "2023-03-01",
            "--with-foreign",
        ]
        with mock.patch.object(sys, "argv", argv), mock.patch("sys.stderr", StringIO()):
            with self.assertRaises(SystemExit):
                R.main()


if __name__ == "__main__":
    unittest.main()
