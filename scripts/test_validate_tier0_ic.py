"""Unittest for scripts/validate_tier0_ic.py — Tier 0 B++ 삼중 게이트 하버스트 (§4).

SoT: docs/superpowers/specs/2026-06-12-tier0-scoring-bplus-validation.md §4
순수 메트릭/패널/포워드 로직을 hand-computed expected로 고정. 실 KRX run은 게이트 step 2.
"""
from __future__ import annotations

import math
import json
import subprocess
import sys
import tempfile
import unittest
from datetime import date
from itertools import combinations
from pathlib import Path
from unittest import mock

import validate_tier0_ic as V


def _row(close, high=None, trdval=5e9, mktcap=1e12, name="", market="KOSPI"):
    return V.PanelRow(close=close, high=high or close, trdval=trdval, mktcap=mktcap, name=name, market=market)


class TestBusinessDays(unittest.TestCase):
    def test_weekends_excluded_sorted(self):
        out = V.business_days_desc(date(2026, 1, 5), 4)  # Mon; back 4 cal days
        self.assertEqual(out, ["20260102", "20260105"])  # Fri + Mon


class TestPanelLoad(unittest.TestCase):
    def test_load_with_injected_fetch(self):
        def fake_fetch(market, bas_dd):
            return [
                {"ISU_CD": "A", "TDD_CLSPRC": "100", "TDD_HGPRC": "110",
                 "ACC_TRDVAL": "5000000000", "MKTCAP": "1000000000000", "ISU_NM": "에이"},
                {"ISU_CD": "BAD", "TDD_CLSPRC": "0"},  # close<=0 제외
            ]
        panel = V.load_pit_panel(["20260102"], markets=("KOSPI",), fetch=fake_fetch)
        self.assertIn("20260102", panel)
        self.assertIn("A", panel["20260102"])
        self.assertNotIn("BAD", panel["20260102"])
        self.assertEqual(panel["20260102"]["A"].close, 100.0)
        self.assertEqual(panel["20260102"]["A"].high, 110.0)


class TestForwardReturn(unittest.TestCase):
    """entry = t+1(기본 entry_offset=1, §4 same-bar 편향 차단) + gap(halt 생존) vs delisted(상폐) 구분."""

    def setUp(self):
        self.dates = ["d0", "d1", "d2", "d3", "d4", "d5"]
        self.panel = {
            "d0": {"OK": _row(100), "GAP": _row(100), "DEL": _row(100), "SOLO": _row(100)},
            "d1": {"OK": _row(100), "GAP": _row(100), "DEL": _row(100)},
            "d2": {"OK": _row(100), "GAP": _row(100), "DEL": _row(100)},
            "d3": {"OK": _row(100)},                       # GAP/DEL 부재
            "d4": {"OK": _row(110), "GAP": _row(120)},     # GAP 재거래(halt 해소), DEL 영구 부재
            "d5": {"OK": _row(110), "GAP": _row(120)},
        }

    def test_ok_t_plus_1_entry(self):
        # entry=d1(100), target=d1+3=d4(110) → 0.10
        ret, status = V.compute_forward_return(self.panel, self.dates, "OK", 0, 3)
        self.assertEqual(status, "ok")
        self.assertAlmostEqual(ret, 0.10)

    def test_gap_entry_anchors_horizon_to_actual_fill(self):
        # Given: intended t+1/t+2 entry is halted, actual fill is d3.
        dates = ["d0", "d1", "d2", "d3", "d4", "d5"]
        panel = {
            "d0": {"LATE": _row(80)},
            "d1": {},
            "d2": {},
            "d3": {"LATE": _row(100)},
            "d4": {"LATE": _row(110)},
            "d5": {"LATE": _row(130)},
        }
        # When: measuring a 2-day forward return.
        ret, status = V.compute_forward_return(panel, dates, "LATE", 0, 2)
        # Then: target is d5 = used_entry(d3)+2, not original entry_idx(d1)+2=d3.
        self.assertEqual(status, "ok")
        self.assertAlmostEqual(ret, 0.30)

    def test_entry_offset_param(self):
        # entry_offset=0 → entry=d0(100), target=d0+2=d2(100) → 0.0
        ret, status = V.compute_forward_return(self.panel, self.dates, "OK", 0, 2, entry_offset=0)
        self.assertEqual(status, "ok")
        self.assertAlmostEqual(ret, 0.0)

    def test_gap_alive_after_target(self):
        # entry=d1(100), target=d3(부재), GAP는 d4/d5 재거래 → 'gap', last_before d2=100 → 0.0
        ret, status = V.compute_forward_return(self.panel, self.dates, "GAP", 0, 2)
        self.assertEqual(status, "gap")
        self.assertAlmostEqual(ret, 0.0)

    def test_delisted_no_future_price(self):
        # entry=d1(100), target=d3(부재), DEL은 이후 전무 → 'delisted', last_before d2=100 → 0.0
        ret, status = V.compute_forward_return(self.panel, self.dates, "DEL", 0, 2)
        self.assertEqual(status, "delisted")
        self.assertAlmostEqual(ret, 0.0)

    def test_immediate_post_entry_delisting_gets_conservative_loss(self):
        # Given: ticker has an entry price but never trades after entry.
        dates = [f"d{i}" for i in range(9)]
        panel = {
            "d0": {"IMD": _row(100)},
            "d1": {"IMD": _row(90)},
            **{d: {} for d in dates[2:]},
        }
        # When: target horizon has no last-available post-entry price.
        ret, status = V.compute_forward_return(panel, dates, "IMD", 0, 2)
        # Then: it remains in the return distribution as a conservative delisting loss.
        self.assertEqual(status, "delisted")
        self.assertEqual(ret, V.DELISTING_RETURN_NO_PRICE)

    def test_right_edge_halt_without_lookahead_is_insufficient_not_delisted(self):
        # Given: target date is near the right edge, so absence after target is not yet delisting evidence.
        dates = ["d0", "d1", "d2", "d3"]
        panel = {
            "d0": {"EDGE": _row(100)},
            "d1": {"EDGE": _row(90)},
            "d2": {},
            "d3": {},
        }
        # When: no post-entry price exists, but the panel has no lookahead buffer after target.
        ret, status = V.compute_forward_return(panel, dates, "EDGE", 0, 2)
        # Then: the return is excluded as insufficient rather than forced to -100%.
        self.assertEqual(status, "insufficient")
        self.assertTrue(math.isnan(ret))

    def test_insufficient(self):
        ret, status = V.compute_forward_return(self.panel, self.dates, "OK", 2, 5)
        self.assertEqual(status, "insufficient")
        self.assertTrue(math.isnan(ret))

    def test_absent_entry(self):
        # SOLO만 d0 존재 → entry(d1~)에서 가격 없음 → 'absent'
        ret, status = V.compute_forward_return(self.panel, self.dates, "SOLO", 0, 1)
        self.assertEqual(status, "absent")
        self.assertTrue(math.isnan(ret))

    def test_panel_trading_days(self):
        self.assertEqual(V.panel_trading_days(self.panel), self.dates)


class TestWinnersRecall(unittest.TestCase):
    def test_top_decile_winners(self):
        returns = {f"T{i}": i / 100.0 for i in range(20)}  # 0.00..0.19
        winners = V.top_decile_winners(returns)
        self.assertEqual(winners, {"T18", "T19"})

    def test_top_decile_requires_positive(self):
        returns = {f"T{i}": -0.01 for i in range(20)}  # 전부 음수 → winner 0
        self.assertEqual(V.top_decile_winners(returns), set())

    def test_recall(self):
        self.assertAlmostEqual(V.recall({"A", "B"}, {"B", "C"}), 0.5)

    def test_recall_no_winners_nan(self):
        self.assertTrue(math.isnan(V.recall({"A"}, set())))


class TestGateA(unittest.TestCase):
    def test_gate_a_pass(self):
        rep = V.RecallReport(
            overall=0.30, random_ratio=3.0,
            per_horizon={"short": 0.15, "mid": 0.14, "long": 0.13},
            largemid_recall=0.40, largemid_vs_overall=0.85, baseline_recall=0.10,
        )
        ok, fails = V.gate_a_pass(rep)
        self.assertTrue(ok, fails)

    def test_gate_a_fail_overall(self):
        rep = V.RecallReport(
            overall=0.10, random_ratio=3.0,
            per_horizon={"short": 0.15}, largemid_recall=0.40,
            largemid_vs_overall=0.85, baseline_recall=0.05,
        )
        ok, fails = V.gate_a_pass(rep)
        self.assertFalse(ok)
        self.assertTrue(any("overall recall" in f for f in fails))

    def test_gate_a_fail_baseline_not_beaten(self):
        rep = V.RecallReport(
            overall=0.25, random_ratio=3.0,
            per_horizon={"short": 0.15}, largemid_recall=0.40,
            largemid_vs_overall=0.85, baseline_recall=0.30,  # baseline ≥ B++
        )
        ok, fails = V.gate_a_pass(rep)
        self.assertFalse(ok)
        self.assertTrue(any("baseline" in f for f in fails))

    def test_gate_a_fail_baseline_missing(self):
        # baseline 미제공(NaN) → anti-overfitting 비교 필수 → FAIL
        rep = V.RecallReport(
            overall=0.30, random_ratio=3.0,
            per_horizon={"short": 0.15}, largemid_recall=0.40,
            largemid_vs_overall=0.85,  # baseline_recall defaults NaN
        )
        ok, fails = V.gate_a_pass(rep)
        self.assertFalse(ok)
        self.assertTrue(any("baseline recall 미제공" in f for f in fails))

    def test_classify_missed_winners(self):
        visible, pred = V.classify_missed_winners(
            {"A", "B", "C"}, {"A": 80.0, "B": 30.0, "C": math.nan}
        )
        self.assertEqual((visible, pred), (1, 2))

    def test_gate_a_recall_aggregation(self):
        rep = V.gate_a_recall(
            selected_all={"A", "B"},
            selected_by_horizon={"short": {"A"}},
            winners_all={"A", "X"},
            winners_by_horizon={"short": {"A"}},
            universe_size=100,
            largemid_selected={"A"},
            largemid_winners={"A"},
            leader_basket={"A": "리더", "Q": "리더2"},
            baseline_selected={"X"},
        )
        self.assertAlmostEqual(rep.overall, 0.5)        # |{A}|/|{A,X}|
        self.assertAlmostEqual(rep.random_baseline, 0.02)  # 2/100
        self.assertAlmostEqual(rep.random_ratio, 25.0)
        self.assertEqual(rep.leader_hits, 1)
        self.assertEqual(rep.leader_total, 2)
        self.assertAlmostEqual(rep.baseline_recall, 0.5)

    def test_per_horizon_union_includes_uncovered_winner_horizon(self):
        # long horizon은 winner가 있으나 selected 키 없음 → union으로 포함 + recall 0
        rep = V.gate_a_recall(
            selected_all=set(), selected_by_horizon={"short": set()},
            winners_all={"W"}, winners_by_horizon={"short": set(), "long": {"W"}},
            universe_size=100, largemid_selected=set(), largemid_winners=set(),
            leader_basket={},
        )
        self.assertIn("long", rep.per_horizon)
        self.assertEqual(rep.per_horizon["long"], 0.0)


class TestGateB(unittest.TestCase):
    def test_ic_ir(self):
        self.assertAlmostEqual(V.ic_information_ratio([0.1, 0.2, 0.3]), 2.449, places=2)

    def test_ic_ir_zero_variance_uses_signed_infinity(self):
        self.assertEqual(V.ic_information_ratio([0.1, 0.1, 0.1]), math.inf)
        self.assertEqual(V.ic_information_ratio([-0.1, -0.1, -0.1]), -math.inf)
        self.assertTrue(math.isnan(V.ic_information_ratio([0.0, 0.0, 0.0])))

    def test_ic_ir_too_few(self):
        self.assertTrue(math.isnan(V.ic_information_ratio([0.1])))

    def test_positive_ic_fraction(self):
        self.assertAlmostEqual(V.positive_ic_fraction([0.1, -0.2, 0.3, math.nan]), 2.0 / 3.0)

    def test_decile_spread(self):
        scores = {f"T{i}": float(i) for i in range(20)}
        fwd = {f"T{i}": i / 100.0 for i in range(20)}
        # bottom2 mean 0.005, top2 mean 0.185, − cost 0.004 → 0.176
        self.assertAlmostEqual(V.decile_spread(scores, fwd), 0.176, places=3)

    def test_gate_b_pass(self):
        verdict, fails, metrics = V.gate_b_pass(
            monthly_ics=[0.05, 0.06, 0.04, 0.05],
            sleeve_ics={"large": [0.04, 0.05], "mid": [0.03]},
            spreads=[0.02, 0.03],
            baseline_ic_ir=0.5,  # B++ IR(~7) > baseline → pass
            top_tercile_ics=[0.05, 0.04],
        )
        self.assertEqual(verdict, "PASS", fails)
        self.assertGreater(metrics["ic_ir"], 0.3)

    def test_gate_b_fail_baseline_missing(self):
        # 메트릭은 양호하나 baseline 미제공 → require_baseline FAIL
        verdict, fails, _ = V.gate_b_pass(
            monthly_ics=[0.05, 0.06, 0.04, 0.05],
            sleeve_ics={"large": [0.04, 0.05], "mid": [0.03]},
            spreads=[0.02, 0.03],
        )
        self.assertEqual(verdict, "FAIL")
        self.assertTrue(any("baseline IC IR 미제공" in f for f in fails))

    def test_gate_b_fail_negative_ic(self):
        verdict, fails, _ = V.gate_b_pass(
            monthly_ics=[-0.05, -0.06], sleeve_ics={"large": [-0.01], "mid": [-0.01]},
            spreads=[-0.02], baseline_ic_ir=-2.0, top_tercile_ics=[-0.04],
        )
        self.assertEqual(verdict, "FAIL")

    def test_gate_b_adjudicates_mixed_sleeve_ic(self):
        verdict, fails, _ = V.gate_b_pass(
            monthly_ics=[0.05, 0.06, 0.05, 0.06],
            sleeve_ics={"large": [-0.02, -0.01], "mid": [0.03]},  # large 음수
            spreads=[0.02, 0.03],
            baseline_ic_ir=0.5,
        )
        self.assertEqual(verdict, "ADJUDICATE")
        self.assertTrue(any("large sleeve" in f for f in fails))

    def test_gate_b_adjudicates_composite_fail_with_top_tercile_support(self):
        verdict, fails, metrics = V.gate_b_pass(
            monthly_ics=[0.01, -0.01, 0.0],
            sleeve_ics={"large": [0.02], "mid": [0.01]},
            spreads=[0.02],
            baseline_ic_ir=-1.0,
            top_tercile_ics=[0.05, 0.04],
        )
        self.assertEqual(verdict, "ADJUDICATE")
        self.assertGreater(metrics["top_tercile_ic_mean"], 0.0)
        self.assertTrue(any("composite IC" in f or "positive IC" in f for f in fails))

    def test_gate_b_fails_when_only_whole_universe_composite_is_positive(self):
        verdict, fails, _ = V.gate_b_pass(
            monthly_ics=[0.04, 0.06, 0.08, 0.05],
            sleeve_ics={"large": [-0.02], "mid": [-0.01]},
            spreads=[-0.02],
            baseline_ic_ir=0.5,
            top_tercile_ics=[-0.03],
        )
        self.assertEqual(verdict, "FAIL")
        self.assertTrue(any("decile spread" in f for f in fails))

    def test_gate_b_requires_finite_ic_ir_even_when_signed_inf_display_is_positive(self):
        verdict, fails, metrics = V.gate_b_pass(
            monthly_ics=[0.10, 0.10, 0.10],
            sleeve_ics={"large": [0.04], "mid": [0.03]},
            spreads=[0.02],
            baseline_ic_ir=0.5,
            top_tercile_ics=[0.05],
        )
        self.assertNotEqual(verdict, "PASS")
        self.assertEqual(metrics["ic_ir"], math.inf)
        self.assertTrue(any("IC IR" in f for f in fails))


class TestCliActivatedHelp(unittest.TestCase):
    """step-2 (77차): main() is no longer fail-closed. Smoke the CLI parser without network I/O."""

    def test_cli_help_runs_and_no_longer_fail_closed(self):
        proc = subprocess.run(
            [sys.executable, str(Path(V.__file__)), "--help"],
            capture_output=True, text=True, check=False,
        )
        self.assertEqual(proc.returncode, 0)
        self.assertIn("삼중 게이트", proc.stdout)
        self.assertNotIn("NOT A GATE YET", proc.stdout + proc.stderr)

    def test_cfg6_cli_requires_with_foreign_before_io(self):
        proc = subprocess.run(
            [
                sys.executable, str(Path(V.__file__)),
                "--start-month", "2025-01-01",
                "--end-month", "2025-02-01",
                "--cache-dir", "/tmp/tier0-no-io",
                "--out", "/tmp/tier0-no-io/out.json",
                "--smoke",
                "--generator", "cfg6",
            ],
            capture_output=True, text=True, check=False,
        )
        self.assertEqual(proc.returncode, 2)
        self.assertIn("--generator cfg6 requires --with-foreign", proc.stderr)

    def test_largemid_cli_rejects_deferred_generator_hybrid_before_io(self):
        # cfg8 UN-DEFER (2026-06-18): cfg7+largemid is now ALLOWED. cfg5/cfg6+largemid stay deferred.
        proc = subprocess.run(
            [
                sys.executable, str(Path(V.__file__)),
                "--start-month", "2025-01-01",
                "--end-month", "2025-02-01",
                "--cache-dir", "/tmp/tier0-no-io",
                "--out", "/tmp/tier0-no-io/out.json",
                "--smoke",
                "--generator", "cfg5",
                "--universe", "largemid",
            ],
            capture_output=True, text=True, check=False,
        )
        self.assertEqual(proc.returncode, 2)
        self.assertIn("cfg5/cfg6+largemid remain deferred", proc.stderr)

    def test_shadow_evaluator_families_are_mutually_exclusive_before_io(self):
        proc = subprocess.run(
            [
                sys.executable, str(Path(V.__file__)),
                "--start-month", "2026-06-01",
                "--end-month", "2026-06-01",
                "--cache-dir", "/tmp/tier0-no-io",
                "--out", "/tmp/tier0-no-io/out.json",
                "--shadow-eval",
                "--shadow-arm-eval",
            ],
            capture_output=True, text=True, check=False,
        )
        self.assertEqual(proc.returncode, 2)
        self.assertIn("PR-B5 shadow and PR-A5 shadow-arm modes are mutually exclusive", proc.stderr)


class TestHarvestDriverPure(unittest.TestCase):
    """Pure month-iteration helpers (no I/O)."""

    def test_iter_selection_months_inclusive(self):
        out = V.iter_selection_months(date(2024, 11, 1), date(2025, 2, 1))
        self.assertEqual([d.isoformat() for d in out],
                         ["2024-11-01", "2024-12-01", "2025-01-01", "2025-02-01"])

    def test_selection_index_is_last_trading_day_before_month(self):
        dates = ["20250130", "20250131", "20250203", "20250228", "20250303"]
        # 선정 2025-02-01 → 직전 마지막 거래일 = 20250131 (index 1)
        self.assertEqual(V.selection_index(dates, date(2025, 2, 1)), 1)
        # 선정 2025-03-01 → 20250228 (index 3)
        self.assertEqual(V.selection_index(dates, date(2025, 3, 1)), 3)
        # 모든 날짜가 이후 → -1
        self.assertEqual(V.selection_index(dates, date(2025, 1, 1)), -1)

    def test_build_series_and_slice_at(self):
        panel = {
            "20250101": {"A": _row(100, trdval=5e9, mktcap=1e12)},
            "20250102": {"A": _row(110), "B": _row(50)},
            "20250103": {"A": _row(120), "B": _row(55)},
        }
        series = V.build_series_by_ticker(panel, V.panel_trading_days(panel))
        self.assertEqual(series["A"]["closes"], [100.0, 110.0, 120.0])
        sliced = V.slice_series_at(series, "20250102")  # <= 0102
        self.assertEqual(sliced["A"]["closes"], [100.0, 110.0])
        self.assertEqual(sliced["A"]["mktcap_at"], 1e12)
        self.assertEqual(sliced["B"]["closes"], [50.0])

    def test_canonical_size_tiers_uses_liquid_breakpoints(self):
        import tier0_factors as F
        big = F.StockRaw(ticker="BIG", sector="제조", market_cap=1e13, closes=[100] * 70, trdvals=[5e9] * 70)
        mid = F.StockRaw(ticker="MID", sector="제조", market_cap=1e12, closes=[100] * 70, trdvals=[5e9] * 70)
        smol = F.StockRaw(ticker="SMOL", sector="제조", market_cap=1e11, closes=[100] * 70, trdvals=[5e9] * 70)
        illiquid = F.StockRaw(ticker="ILQ", sector="제조", market_cap=2e13, closes=[100] * 70, trdvals=[1e6] * 70)
        tiers = V.canonical_size_tiers([big, mid, smol, illiquid])
        self.assertEqual(tiers["ILQ"], "small")  # 유동성 미달 → small (보수적)
        self.assertIn(tiers["BIG"], ("large", "mid"))

    def test_baseline_select_disjoint_pool(self):
        import tier0_factors as F
        stocks = [F.StockRaw(ticker=f"T{i}", sector="제조", market_cap=1e12,
                             closes=[100 + i] * 65 + [100 + i + 5], trdvals=[5e9] * 66) for i in range(200)]
        sel = V._baseline_select(lambda ss, b: {s.ticker: float(int(s.ticker[1:])) for s in ss}, stocks, pool=10)
        self.assertEqual(len(sel), 30)  # 3 buckets × 10 disjoint

    def test_build_month_stockraws_threads_exact_panel_selection_date(self):
        # PIT-001: providers must receive the actual holiday-aware panel trading day used to
        # slice prices — NOT a weekday-only recompute that could land on a holiday after the slice.
        from dart_signals import DartSignalsResult
        series = {"A": {"dates": ["20250226", "20250227"], "closes": [100.0, 101.0],
                        "highs": [100.0, 101.0], "trdvals": [5e9, 5e9], "mktcap": [1e12, 1e12]}}
        seen = {}

        def dart_at(tk, d):
            seen["dart"] = d
            return DartSignalsResult()

        def foreign_at(tk, d):
            seen["foreign"] = d
            return (1e9, False)

        universe = [{"ticker": "A", "name": "에이", "sector": "제조", "market_cap_won": 1e12}]
        # 20250228(Fri) was a holiday; actual last panel trading day before 2025-03 = 20250227(Thu).
        stocks, _name, _meta = V.build_month_stockraws(
            date(2025, 2, 27), series, "20250227", universe, foreign_at=foreign_at, dart_at=dart_at)
        self.assertEqual(seen["dart"], date(2025, 2, 27))
        self.assertEqual(seen["foreign"], date(2025, 2, 27))
        self.assertEqual(len(stocks), 1)

    def test_ic_weighted_falls_back_to_equal_when_no_prior(self):
        import tier0_factors as F
        n = 100  # ≥ 82 (short 60-day lookback + 21 skip + 1) so primary trend is present
        stocks = [F.StockRaw(ticker=f"T{i}", sector="제조", market_cap=1e12,
                             closes=[100.0 * (1.001 ** t) * (1.0 + 0.01 * math.sin(t + i)) for t in range(n)],
                             trdvals=[5e9] * n, earnings_raw=0.05 + 0.001 * i) for i in range(40)]
        out = V.ic_weighted_rank_score(stocks, "short", prior_factor_ic={})  # no prior → equal weights
        self.assertTrue(any(not math.isnan(v) for v in out.values()))


def _mk_month_result(**kw):
    base = dict(
        month="2025-01-01", selection_date="20250102", n_universe=100, n_eligible=50, n_selected=2,
        selected_all={"A", "B"}, selected_by_horizon={"short": {"A"}, "mid": {"B"}, "long": set()},
        largemid_selected={"A"}, winners_by_horizon={"short": {"A"}, "mid": set(), "long": set()},
        winners_all={"A"}, largemid_winners={"A"}, baseline_current_selected={"A"},
        baseline_equal_selected={"A"}, leader_in_selected=[], composite_ic=0.05,
        sleeve_ic={"large": 0.05, "mid": 0.05}, spread=0.02, top_tercile_ic=0.05,
        baseline_equal_ic=0.0, baseline_ic_weighted_ic=0.0, factor_ics={},
        status_counts={h: {"ok": 1, "gap": 0, "delisted": 0, "insufficient": 0, "absent": 0} for h in V.HARVEST_BUCKETS},
        quality_meta={"foreign_failed": 0, "earnings_missing": 0, "quality_insufficient": 0},
        selected_sleeve={"A": "large", "B": "mid"}, selected_score={"A": 90.0, "B": 70.0},
        selected_mcap={"A": 1e13, "B": 1e12}, forward_insufficient_horizons=[], selection_perf={},
    )
    base.update(kw)
    return V.MonthResult(**base)


class TestFrozenDecisionRules(unittest.TestCase):
    """B+C anti-overfitting lock: gate thresholds + B++ params FROZEN before the 4-config × multi-regime run.

    SoT: docs/superpowers/tier0-4config-decision-rules.md. A mid-run threshold tweak (p-hacking across
    4 configs × 3 regimes × 3 gates) is caught here. Changing these requires editing BOTH this test AND
    the decision-rules doc — a deliberate, reviewable act, not a silent in-run shop.
    """

    def test_gate_thresholds_frozen(self):
        self.assertEqual(V.GATE_A_OVERALL_RECALL_MIN, 0.20)
        self.assertEqual(V.GATE_A_RANDOM_RATIO_MIN, 2.5)
        self.assertEqual(V.GATE_A_HORIZON_RECALL_MIN, 0.12)
        self.assertEqual(V.GATE_A_LARGEMID_RECALL_MIN, 0.35)
        self.assertEqual(V.GATE_A_LARGEMID_VS_OVERALL_MIN, 0.80)
        self.assertEqual(V.GATE_B_IC_IR_MIN, 0.30)
        self.assertEqual(V.GATE_B_POS_MONTHS_MIN, 0.60)
        self.assertEqual(V.GATE_C_SMALL_MAX_FRACTION, 0.25)

    def test_bpp_params_frozen(self):
        import tier0_factors as F
        self.assertEqual(F.MIN_ADV_WON, 2_000_000_000.0)
        self.assertEqual(F.SLEEVE_QUOTA, {"large": 20, "mid": 20, "small": 10})
        self.assertEqual(F.SKIP_DAYS, 21)
        self.assertEqual(F.TREND_LOOKBACKS, {"short": (20, 60), "mid": (63, 126), "long": (126, 252)})


class TestSelectionPerformance(unittest.TestCase):
    def test_select_by_horizon_disjoint(self):
        import tier0_factors as F
        stocks = [F.StockRaw(ticker=f"T{i}", sector="제조", market_cap=1e12, closes=[100] * 5, trdvals=[5e9] * 5)
                  for i in range(120)]
        out = V._select_by_horizon(lambda ss, b: {s.ticker: float(int(s.ticker[1:])) for s in ss}, stocks, pool=10)
        allp = [t for v in out.values() for t in v]
        self.assertEqual(len(allp), 30)            # 3 buckets × 10
        self.assertEqual(len(set(allp)), 30)       # disjoint

    def test_foreign_dict_from_df_schema_based(self):
        # omxy S1-R2 HIGH: pykrx swallows errors into a bare empty df → must classify by SCHEMA, not .empty.
        import pandas as pd
        df = pd.DataFrame({"순매수거래대금": [5.0, -3.0], "종목명": ["A사", "B사"]}, index=["000001", "000002"])
        self.assertEqual(V.foreign_dict_from_df(df), {"000001": 5.0, "000002": -3.0})
        self.assertIsNone(V.foreign_dict_from_df(pd.DataFrame()))   # bare empty (swallowed error) → None
        self.assertIsNone(V.foreign_dict_from_df(None))
        self.assertEqual(V.foreign_dict_from_df(pd.DataFrame({"순매수거래대금": []})), {})  # schema, 0 rows = 휴장

    def test_overlay_local_dart_cache(self):
        # B+C: genuine 'ok'(rcept_dt + 재무 ≥1) local backfill만 production preload 위에 overlay.
        # omxy BC-R3 #2 belt: no_data/schema_empty/no-content/rcept_dt-결여 → skip(clobber 금지).
        import json, tempfile, os
        mem = {
            ("C1", "annual", "2023"): {"corp_code": "C1", "period_type": "annual",
                                       "period_key": "2023", "status": "ok"},        # production, no rcept_dt
            ("C3", "annual", "2023"): {"corp_code": "C3", "period_type": "annual",
                                       "period_key": "2023", "status": "ok", "revenue": 999},  # 실 production 데이터
        }
        lines = [
            json.dumps({"corp_code": "C1", "period_type": "annual", "period_key": "2023",
                        "status": "ok", "rcept_dt": "20240312", "revenue": 100}),      # genuine → overlay
            json.dumps({"corp_code": "C2", "period_type": "quarterly", "period_key": "2024-Q1",
                        "status": "ok", "rcept_dt": "20240516", "net_income": 7}),     # genuine → add
            json.dumps({"corp_code": "C3", "period_type": "annual", "period_key": "2023",
                        "status": "no_data", "rcept_dt": None}),                       # no_data → skip(clobber 금지)
            json.dumps({"corp_code": "C4", "period_type": "annual", "period_key": "2022",
                        "status": "schema_empty", "rcept_dt": None}),                  # schema_empty → skip
            json.dumps({"corp_code": "C5", "period_type": "annual", "period_key": "2021",
                        "status": "ok", "rcept_dt": "20220312"}),                      # ok지만 재무 전무 → skip
            "",  # blank line tolerated
        ]
        fd, path = tempfile.mkstemp(suffix=".jsonl")
        try:
            with os.fdopen(fd, "w") as f:
                f.write("\n".join(lines))
            n = V._overlay_local_dart_cache(mem, Path(path))
        finally:
            os.unlink(path)
        self.assertEqual(n, 2)                                                   # C1 + C2만 overlay
        self.assertEqual(mem[("C1", "annual", "2023")]["rcept_dt"], "20240312")  # overlaid w/ rcept_dt
        self.assertIn(("C2", "quarterly", "2024-Q1"), mem)                       # new genuine row added
        self.assertEqual(mem[("C3", "annual", "2023")]["revenue"], 999)          # no_data가 production을 clobber 안 함
        self.assertNotIn(("C4", "annual", "2022"), mem)                          # schema_empty skip
        self.assertNotIn(("C5", "annual", "2021"), mem)                          # 재무 전무 ok skip

    def test_classify_foreign(self):
        # Stage-1 (omxy S1-R1 #2): fetch-fail(None)=penalty / present=genuine (missing ticker=0 no-flow, NOT fail).
        self.assertEqual(V.classify_foreign({"A": 5.0, "B": -3.0}, "A"), (5.0, False))
        self.assertEqual(V.classify_foreign({"A": 5.0}, "B"), (0.0, False))  # genuine no-flow, not penalty
        val, failed = V.classify_foreign(None, "A")                          # fetch failure → penalty
        self.assertTrue(math.isnan(val))
        self.assertTrue(failed)

    def test_selection_performance_aggregation(self):
        # omxy R6: gross+net, eqw vs sleeve excess, monthly-independent counts.
        perf = {"short": {"bpp": [0.10, 0.20], "legacy": [0.0], "eqw_mean": 0.05,
                          "bpp_sleeve_excess": [0.03, 0.03], "bpp_basket": 0.15,
                          "bpp_sleeve_excess_basket": 0.03},
                "mid": {"bpp": [], "legacy": [], "eqw_mean": math.nan, "bpp_sleeve_excess": [],
                        "bpp_basket": math.nan, "bpp_sleeve_excess_basket": math.nan},
                "long": {"bpp": [], "legacy": [], "eqw_mean": math.nan, "bpp_sleeve_excess": [],
                         "bpp_basket": math.nan, "bpp_sleeve_excess_basket": math.nan}}
        rep = V.aggregate_harvest([_mk_month_result(selection_perf=perf)], smoke=True,
                                  generated_at="t", coverage_meta={}, survivorship_label="clean")
        sp = rep["selection_performance"]["short"]
        self.assertAlmostEqual(sp["bpp_avg_return_gross"], 0.15)
        self.assertAlmostEqual(sp["bpp_net_return_after_cost"], 0.15 - V.ROUND_TRIP_COST)
        self.assertAlmostEqual(sp["bpp_hit_rate"], 1.0)
        self.assertAlmostEqual(sp["bpp_excess_vs_liquid_eqw"], 0.10)    # ((0.10-0.05)+(0.20-0.05))/2
        self.assertAlmostEqual(sp["bpp_excess_vs_own_sleeve"], 0.03)    # size-neutral skill
        self.assertIn("bpp_sleeve_excess_monthly_ci90", sp)             # skill significance CI present
        self.assertAlmostEqual(sp["legacy_momentum_proxy_avg_return"], 0.0)
        self.assertAlmostEqual(sp["liquid_eqw_return"], 0.05)
        self.assertEqual(sp["n_bpp_picks"], 2)
        self.assertEqual(sp["n_independent_months"], 1)   # NOT 2 (pick count ≠ independent obs)
        self.assertIn("DIAGNOSTIC", rep["selection_performance_note"])


def _make_fake_panel(n_days: int, n_tickers: int, *, start=date(2024, 1, 1)):
    """결정론 fake 패널 (n_days 거래일 × n_tickers). drift 차등으로 winner 존재, 3 size tier."""
    dates = []
    d = start
    while len(dates) < n_days:
        if d.weekday() < 5:
            dates.append(d.strftime("%Y%m%d"))
        d += __import__("datetime").timedelta(days=1)
    panel = {}
    for j, ds in enumerate(dates):
        day = {}
        for ti in range(n_tickers):
            drift = 0.0004 + 0.0006 * (ti % 10) / 9.0  # 0.0004..0.0010
            base = 1000.0 + 10 * ti
            close = base * ((1 + drift) ** j) * (1.0 + 0.012 * math.sin(j * 0.5 + ti * 0.13))
            close = max(1.0, close)
            if ti < n_tickers * 0.2:
                mktcap = 1e13 + ti * 1e11   # large
            elif ti < n_tickers * 0.6:
                mktcap = 1e12 + ti * 1e9    # mid
            else:
                mktcap = 1e11 + ti * 1e8    # small
            day[f"{ti:06d}"] = V.PanelRow(close=close, high=close * 1.005, trdval=5e9, mktcap=mktcap,
                                          name=f"종목{ti}", market="KOSPI")
        panel[ds] = day
    return panel, dates


class TestSmokeHarvestNoIO(unittest.TestCase):
    """smoke-1: harvest_pit_months end-to-end with injected fakes (no KRX/DART/pykrx I/O)."""

    def test_smoke_harvest_shape_and_no_real_io(self):
        import tier0_factors as F
        from dart_signals import DartSignalsResult
        panel, dates = _make_fake_panel(480, 240)
        sectors = ["제조", "바이오", "IT/SW", "금융"]

        def universe_at(t):
            return [{"ticker": f"{ti:06d}", "name": f"종목{ti}", "sector": sectors[ti % 4],
                     "market_cap_won": panel[dates[-1]][f"{ti:06d}"].mktcap} for ti in range(240)]

        def foreign_at(tk, t):
            return (1e9, False)  # genuine, not failed

        def dart_at(tk, t):
            return DartSignalsResult()  # neutral (structural-missing)

        report = V.harvest_pit_months(
            date(2025, 3, 1), date(2025, 4, 1), panel,
            universe_at=universe_at, foreign_at=foreign_at, dart_at=dart_at,
            smoke=True, generated_at="2026-06-12T00:00:00")

        # shape
        for k in ("version", "harvest", "gate_a", "gate_b", "gate_c", "data_quality",
                  "survivorship_label", "triple_gate_all_pass"):
            self.assertIn(k, report)
        self.assertGreaterEqual(report["harvest"]["months_analyzed"], 1)
        self.assertEqual(report["gate_a"]["verdict"], "SMOKE")  # 임계 미적용
        self.assertEqual(report["gate_b"]["verdict"], "SMOKE")
        self.assertIn(report["gate_c"]["verdict"], ("PASS", "FAIL"))  # 결정론은 smoke에도 산출
        self.assertIn("clean", report["survivorship_label"])
        # per-month + status counts present
        self.assertTrue(report["gate_a"]["per_month"])
        self.assertIn("return_status_counts", report["data_quality"])
        # winners exist (drift 차등) → recall 산출 가능
        self.assertGreater(report["gate_a"]["per_month"][0]["n_winners"], 0)
        # selection_performance wired end-to-end (omxy R6 MED: process_month → aggregate keys present)
        self.assertIn("selection_performance", report)
        self.assertIn("DIAGNOSTIC", report["selection_performance_note"])
        for h in ("short", "mid", "long"):
            sp = report["selection_performance"][h]
            for k in ("bpp_avg_return_gross", "bpp_net_return_after_cost", "bpp_excess_vs_liquid_eqw",
                      "bpp_excess_vs_own_sleeve", "liquid_eqw_return", "n_independent_months",
                      "legacy_momentum_proxy_avg_return"):
                self.assertIn(k, sp)
            # independent obs = months, never the pick count
            self.assertLessEqual(sp["n_independent_months"], report["harvest"]["months_analyzed"])

    def test_aggregate_harvest_leader_total_uses_injected_basket_size(self):
        r = V.MonthResult(
            month="2025-03-01", selection_date="20250228", n_universe=100, n_eligible=80, n_selected=1,
            selected_all={"A"}, selected_by_horizon={"short": {"A"}, "mid": set(), "long": set()},
            largemid_selected={"A"}, winners_by_horizon={"short": {"A"}, "mid": set(), "long": set()},
            winners_all={"A"}, largemid_winners={"A"}, baseline_current_selected=set(),
            baseline_equal_selected=set(), leader_in_selected=["A"], composite_ic=math.nan,
            sleeve_ic={"large": math.nan, "mid": math.nan}, spread=math.nan, top_tercile_ic=math.nan,
            baseline_equal_ic=math.nan, baseline_ic_weighted_ic=math.nan, factor_ics={},
            status_counts={h: {"ok": 1, "gap": 0, "delisted": 0, "insufficient": 0, "absent": 0}
                           for h in V.HARVEST_BUCKETS},
            quality_meta={"foreign_failed": 0, "earnings_missing": 0},
            selected_sleeve={"A": "large"}, selected_score={"A": 90.0}, selected_mcap={"A": 1e13},
            forward_insufficient_horizons=[],
        )
        report = V.aggregate_harvest(
            [r], smoke=True, generated_at="2026-06-12T00:00:00", coverage_meta={},
            survivorship_label="clean", leader_basket_size=2)
        self.assertEqual(report["gate_a"]["leader_hits_total"], 1)
        self.assertEqual(report["gate_a"]["leader_total"], 2)

    def test_aggregate_harvest_gate_c_fails_if_any_month_fails_size_dist(self):
        def month_result(month, selected_sleeve):
            selected = set(selected_sleeve)
            return V.MonthResult(
                month=month, selection_date="20250228", n_universe=300, n_eligible=250,
                n_selected=len(selected), selected_all=selected,
                selected_by_horizon={"short": selected, "mid": set(), "long": set()},
                largemid_selected=selected, winners_by_horizon={"short": set(), "mid": set(), "long": set()},
                winners_all=set(), largemid_winners=set(), baseline_current_selected=set(),
                baseline_equal_selected=set(), leader_in_selected=[], composite_ic=math.nan,
                sleeve_ic={"large": math.nan, "mid": math.nan}, spread=math.nan, top_tercile_ic=math.nan,
                baseline_equal_ic=math.nan, baseline_ic_weighted_ic=math.nan, factor_ics={},
                status_counts={h: {"ok": 0, "gap": 0, "delisted": 0, "insufficient": 0, "absent": 0}
                               for h in V.HARVEST_BUCKETS},
                quality_meta={"foreign_failed": 0, "earnings_missing": 0},
                selected_sleeve=selected_sleeve,
                selected_score={t: 90.0 for t in selected},
                selected_mcap={t: 1e13 for t in selected},
                forward_insufficient_horizons=[],
            )

        passing = {
            **{f"L{i}": "large" for i in range(60)},
            **{f"M{i}": "mid" for i in range(60)},
            **{f"S{i}": "small" for i in range(30)},
        }
        failing = {f"X{i}": "large" for i in range(150)}
        report = V.aggregate_harvest(
            [month_result("2025-03-01", passing), month_result("2025-04-01", failing)],
            smoke=True, generated_at="2026-06-12T00:00:00", coverage_meta={},
            survivorship_label="clean")
        self.assertEqual(report["gate_c"]["verdict"], "FAIL")
        self.assertTrue(any("2025-04-01" in f for f in report["gate_c"]["fails"]))

    def test_harvest_raises_on_empty_universe(self):
        panel, _ = _make_fake_panel(300, 60)
        with self.assertRaises(RuntimeError):
            V.harvest_pit_months(
                date(2025, 3, 1), date(2025, 4, 1), panel,
                universe_at=lambda t: [], foreign_at=lambda tk, t: (0.0, False),
                dart_at=lambda tk, t: __import__("dart_signals").DartSignalsResult(), smoke=True)


class TestGateC(unittest.TestCase):
    def test_gate_c_pass(self):
        sleeve = {}
        score = {}
        mcap = {}
        for i in range(2):
            sleeve[f"L{i}"] = "large"; score[f"L{i}"] = 90.0; mcap[f"L{i}"] = 1e13
        for i in range(2):
            sleeve[f"M{i}"] = "mid"; score[f"M{i}"] = 70.0; mcap[f"M{i}"] = 1e12
        sleeve["S0"] = "small"; score["S0"] = 60.0; mcap["S0"] = 1e11
        ok, fails, metrics = V.gate_c_size_composition(
            sleeve, score, mcap, expected={"large": 2, "mid": 2, "small": 1}
        )
        self.assertTrue(ok, fails)
        self.assertAlmostEqual(metrics["small_fraction"], 1.0 / 5.0)

    def test_gate_c_fail_dist_and_small_fraction(self):
        sleeve = {"L0": "large"}
        score = {"L0": 90.0}
        mcap = {"L0": 1e13}
        for i in range(2):
            sleeve[f"S{i}"] = "small"; score[f"S{i}"] = 50.0; mcap[f"S{i}"] = 1e11
        ok, fails, metrics = V.gate_c_size_composition(
            sleeve, score, mcap, expected={"large": 2, "mid": 2, "small": 1}
        )
        self.assertFalse(ok)
        self.assertGreater(metrics["small_fraction"], 0.25)


def _stub_raw(closes, **kw):
    import tier0_factors as F
    return F.StockRaw(ticker=kw.pop("ticker", "X"), sector=kw.pop("sector", "제조"),
                      market_cap=1e12, closes=closes, trdvals=[5e9] * len(closes), **kw)


class TestBaseline(unittest.TestCase):
    def test_legacy_score_short_weight(self):
        closes = [100.0] * 60 + [110.0]  # close/MA60 모멘텀 × short weight 0.40 > 0
        s = V.legacy_momentum_proxy_score(_stub_raw(closes), "short")
        self.assertFalse(math.isnan(s))
        self.assertGreater(s, 0.0)

    def test_equal_rank_baseline_runs_and_floors(self):
        import tier0_factors as F
        n = 300

        def series(drift, phase):
            return [100.0 * ((1 + drift) ** t) * (1.0 + 0.01 * math.sin(t * 0.7 + phase)) for t in range(n)]
        stocks = [
            F.StockRaw(ticker=f"T{k}", sector="제조", market_cap=1e12,
                       closes=series(0.001 + 0.0003 * k, k * 0.1),
                       trdvals=[5e9] * n, earnings_raw=0.05 + 0.01 * k)
            for k in range(6)
        ]
        # 유동성 미달 1종목 추가 → baseline에서 제외돼야 함
        stocks.append(F.StockRaw(ticker="LOWADV", sector="제조", market_cap=1e12,
                                 closes=series(0.002, 0.0), trdvals=[1e8] * n, earnings_raw=0.1))
        scores = V.baseline_equal_rank_score(stocks, "mid")
        self.assertNotIn("LOWADV", scores)  # 유동성 플로어 적용
        self.assertEqual(len(scores), 6)
        for v in scores.values():
            self.assertFalse(math.isnan(v))


class TestGeneratorInjection(unittest.TestCase):
    """cfg5/cfg6 생성기 주입 (2026-06-17). default 경로 byte-identical + EXPLORATORY 라벨."""

    def _fakes(self, n_tickers=360):
        from dart_signals import DartSignalsResult
        panel, dates = _make_fake_panel(480, n_tickers)
        sectors = ["제조", "바이오", "IT/SW", "금융"]

        def universe_at(t):
            return [{"ticker": f"{ti:06d}", "name": f"종목{ti}", "sector": sectors[ti % 4],
                     "market_cap_won": panel[dates[-1]][f"{ti:06d}"].mktcap} for ti in range(n_tickers)]

        def foreign_at(tk, t):
            return (1e9, False)

        def dart_at(tk, t):
            return DartSignalsResult()

        return panel, universe_at, foreign_at, dart_at

    def _run(self, generator=None, generator_label="bpp", n_tickers=360):
        panel, universe_at, foreign_at, dart_at = self._fakes(n_tickers)
        return V.harvest_pit_months(
            date(2025, 3, 1), date(2025, 4, 1), panel,
            universe_at=universe_at, foreign_at=foreign_at, dart_at=dart_at,
            smoke=True, generated_at="2026-06-12T00:00:00",
            generator=generator, generator_label=generator_label)

    def test_default_path_is_byte_identical_to_explicit_bpp(self):
        # generator=None (default → select_bpp_for_harvest) == explicit select_bpp_for_harvest.
        default = self._run(generator=None, generator_label="bpp")
        explicit = self._run(generator=V.select_bpp_for_harvest, generator_label="bpp")
        self.assertEqual(default, explicit)
        self.assertNotIn("generator", default)
        self.assertNotIn("exploratory", default)
        self.assertNotIn("exploratory_verdict", default["gate_a"])
        self.assertNotIn("exploratory_verdict", default["gate_b"])

    def test_cfg5_generator_injection_labels_exploratory(self):
        import tier0_cfg56 as C
        rep = self._run(generator=C.select_cfg5_for_harvest, generator_label="cfg5")
        self.assertEqual(rep["generator"], "cfg5")
        self.assertTrue(rep["exploratory"])
        self.assertIn("generation_diagnostics", rep)
        self.assertTrue(rep["generation_diagnostics"]["per_month"])
        diag = rep["generation_diagnostics"]["per_month"][0]
        for key in ("jaccard_vs_bpp", "unique_leader_hits_vs_bpp", "size_dist",
                    "sector_dist", "random_baseline_ratio"):
            self.assertIn(key, diag)
        # smoke verdict는 SMOKE — _expl는 PASS/FAIL만 접두, SMOKE는 그대로.
        self.assertEqual(rep["gate_a"]["verdict"], "SMOKE")
        self.assertEqual(rep["gate_a"]["exploratory_verdict"], "SMOKE")
        # gate_c는 결정론 PASS/FAIL → EXPLORATORY 접두 확인.
        gc_v = rep["gate_c"]["verdict"]
        self.assertIn(gc_v, ("PASS", "FAIL"))
        self.assertEqual(rep["gate_c"]["exploratory_verdict"], f"EXPLORATORY {gc_v}")

    def test_cfg6_generator_injection_labels_exploratory(self):
        import tier0_cfg56 as C
        rep = self._run(generator=C.select_cfg6_for_harvest, generator_label="cfg6", n_tickers=1000)
        self.assertEqual(rep["generator"], "cfg6")
        self.assertTrue(rep["exploratory"])
        diag = rep["generation_diagnostics"]["per_month"][0]
        self.assertIn("pre_cap_union_count", diag)
        self.assertIn("leaders_dropped_post_cap", diag)
        self.assertIsNotNone(diag["pre_cap_union_count"])
        gc_v = rep["gate_c"]["verdict"]
        self.assertEqual(rep["gate_c"]["exploratory_verdict"], f"EXPLORATORY {gc_v}")

    def test_generator_label_mismatch_fails_closed(self):
        import tier0_cfg56 as C
        with self.assertRaises(ValueError):
            self._run(generator=C.select_cfg5_for_harvest, generator_label="bpp")
        with self.assertRaises(ValueError):
            self._run(generator=None, generator_label="cfg5")

    def test_exploratory_generator_shortfall_is_recorded_not_silent(self):
        # 방어적 per-month skip(EXPLORATORY): 첫 월에서 생성기가 SleeveShortfallError를 내면 그 월만
        # skip하고 generator_shortfall_months에 기록(무음 금지). 나머지 월은 정상 측정.
        import tier0_cfg56 as C
        calls = {"n": 0}

        def flaky_cfg6(stocks):
            calls["n"] += 1
            if calls["n"] == 1:
                raise V.F.SleeveShortfallError("synthetic month-1 shortfall (test)")
            return C.select_cfg6_for_harvest(stocks)

        rep = self._run(generator=flaky_cfg6, generator_label="cfg6", n_tickers=1000)
        gd = rep["generation_diagnostics"]
        self.assertEqual(gd["generator_shortfall_count"], 1)
        self.assertEqual(len(gd["generator_shortfall_months"]), 1)
        self.assertIn("synthetic month-1 shortfall", gd["generator_shortfall_months"][0]["reason"])
        # skip 월은 months_analyzed에서 제외(나머지 1개월만 측정).
        self.assertEqual(rep["harvest"]["months_analyzed"], 1)

    def test_process_month_bpp_shortfall_propagates_cfg6_skips(self):
        # process_month 직접 호출: 동일 raising 생성기를 label="bpp"면 propagate(byte-identical),
        # label="cfg6"면 _GeneratorShortfall sentinel 반환(방어적 skip). frozen 경로 무음삼킴 금지 증명.
        panel, universe_at, foreign_at, dart_at = self._fakes(n_tickers=360)
        dates = V.panel_trading_days(panel)
        series = V.build_series_by_ticker(panel, dates)
        t = date(2025, 3, 1)
        sel_idx = V.selection_index(dates, t)
        sel_date_obj = V.datetime.strptime(dates[sel_idx], "%Y%m%d").date()
        universe_rows = universe_at(sel_date_obj)

        def raises(stocks):
            raise V.F.SleeveShortfallError("synthetic shortfall (test)")

        # bpp 경로: 그대로 전파.
        with self.assertRaises(V.F.SleeveShortfallError):
            V.process_month(t, panel, dates, series, universe_rows,
                            foreign_at=foreign_at, dart_at=dart_at,
                            prior_factor_ic={}, leader_basket=V.LEADER_BASKET_2026_06,
                            generator=raises, generator_label="bpp")
        # cfg6 경로: sentinel 반환(skip).
        r = V.process_month(t, panel, dates, series, universe_rows,
                            foreign_at=foreign_at, dart_at=dart_at,
                            prior_factor_ic={}, leader_basket=V.LEADER_BASKET_2026_06,
                            generator=raises, generator_label="cfg6")
        self.assertIsInstance(r, V._GeneratorShortfall)
        self.assertIn("synthetic shortfall", r.reason)

    def test_exploratory_pass_label_when_gate_passes(self):
        # non-smoke aggregate: 게이트가 PASS면 exploratory_verdict = "EXPLORATORY PASS".
        rep = V.aggregate_harvest(
            [_mk_month_result()], smoke=False, generated_at="t", coverage_meta={},
            survivorship_label="clean", generator_label="cfg5")
        self.assertTrue(rep["exploratory"])
        for g in ("gate_a", "gate_b"):
            v = rep[g]["verdict"]
            if v in ("PASS", "FAIL"):
                self.assertEqual(rep[g]["exploratory_verdict"], f"EXPLORATORY {v}")


def _largemid_fakes(n_tickers=360):
    """fake panel + providers for TASK A largemid (cap spread = 3 size tiers)."""
    from dart_signals import DartSignalsResult
    panel, dates = _make_fake_panel(480, n_tickers)
    sectors = ["제조", "바이오", "IT/SW", "금융"]

    def universe_at(t):
        return [{"ticker": f"{ti:06d}", "name": f"종목{ti}", "sector": sectors[ti % 4],
                 "market_cap_won": panel[dates[-1]][f"{ti:06d}"].mktcap} for ti in range(n_tickers)]

    def foreign_at(tk, t):
        return (1e9, False)

    def dart_at(tk, t):
        return DartSignalsResult()

    return panel, dates, universe_at, foreign_at, dart_at


class TestUniverseLargemid(unittest.TestCase):
    """TASK A — universe='largemid' FROZEN PROTOCOL. default ('all') byte-identical."""

    def _run(self, universe, n_tickers=360, smoke=False):
        panel, _dates, universe_at, foreign_at, dart_at = _largemid_fakes(n_tickers)
        return V.harvest_pit_months(
            date(2025, 3, 1), date(2025, 4, 1), panel,
            universe_at=universe_at, foreign_at=foreign_at, dart_at=dart_at,
            smoke=smoke, generated_at="2026-06-12T00:00:00", universe=universe)

    def _run_explicit_all(self, n_tickers=360):
        panel, _dates, universe_at, foreign_at, dart_at = _largemid_fakes(n_tickers)
        return V.harvest_pit_months(
            date(2025, 3, 1), date(2025, 4, 1), panel,
            universe_at=universe_at, foreign_at=foreign_at, dart_at=dart_at,
            smoke=True, generated_at="2026-06-12T00:00:00")  # universe defaults to 'all'

    def test_default_universe_all_is_byte_identical(self):
        # universe defaults to 'all' → identical report to explicit 'all', and NO largemid/protocol fields.
        default = self._run_explicit_all()       # no universe kwarg (default)
        explicit = self._run(universe="all", smoke=True)
        # 'all' output must NOT carry the largemid-only additive fields (byte-identical to cfg1-4 path).
        self.assertNotIn("protocol", default)
        self.assertNotIn("universe", default)
        self.assertNotIn("generator", default)
        self.assertNotIn("exploratory", default)
        self.assertNotIn("baseline_random_largemid_recall", default["gate_a"])
        self.assertEqual(default, explicit)

    def test_largemid_filters_candidates_and_winners_to_pit_large_mid(self):
        # In largemid mode, EVERY selected ticker AND every winner must be PIT large/mid at the selection
        # date (whole-market breakpoints). We verify by reconstructing the month and checking tiers.
        panel, dates, universe_at, foreign_at, dart_at = _largemid_fakes(360)
        series = V.build_series_by_ticker(panel, dates)
        t = date(2025, 3, 1)
        sel_idx = V.selection_index(dates, t)
        sel_date_obj = V.datetime.strptime(dates[sel_idx], "%Y%m%d").date()
        universe_rows = universe_at(sel_date_obj)
        r = V.process_month(t, panel, dates, series, universe_rows,
                            foreign_at=foreign_at, dart_at=dart_at, prior_factor_ic={},
                            leader_basket=V.LEADER_BASKET_2026_06, universe="largemid")
        self.assertIsNotNone(r)
        # full-market tiers (whole universe) to validate restriction used whole-market breakpoints.
        stocks_full, _nb, _qm = V.build_month_stockraws(
            sel_date_obj, series, dates[sel_idx], universe_rows,
            foreign_at=foreign_at, dart_at=dart_at)
        full_tier = V.canonical_size_tiers(stocks_full)
        # candidates restricted to large/mid
        for tk in r.selected_all:
            self.assertIn(full_tier.get(tk), ("large", "mid"), f"selected {tk} not large/mid")
        for tk, gate_c_tier in r.selected_sleeve.items():
            self.assertEqual(gate_c_tier, full_tier.get(tk), f"Gate C tier for {tk} must use whole-market tier")
            self.assertIn(gate_c_tier, ("large", "mid"), f"Gate C leaked whole-market small for {tk}")
        # winners restricted to large/mid (winners come from largemid forward dict by construction)
        for tk in r.winners_all:
            self.assertIn(full_tier.get(tk), ("large", "mid"), f"winner {tk} not large/mid")
        # largemid_* == overall on this path
        self.assertEqual(r.largemid_selected, r.selected_all)
        self.assertEqual(r.largemid_winners, r.winners_all)
        # there ARE small-tier tickers in the full universe that got excluded (proves the filter bit).
        self.assertTrue(any(v == "small" for v in full_tier.values()))

    def test_largemid_gate_c_ignores_generator_relative_small_sleeve(self):
        panel, dates, universe_at, foreign_at, dart_at = _largemid_fakes(360)
        series = V.build_series_by_ticker(panel, dates)
        t = date(2025, 3, 1)
        sel_idx = V.selection_index(dates, t)
        sel_date_obj = V.datetime.strptime(dates[sel_idx], "%Y%m%d").date()
        universe_rows = universe_at(sel_date_obj)

        def relative_small_generator(stocks):
            sel = V.select_bpp_for_harvest(stocks)
            first = sel[V.HARVEST_BUCKETS[0]][1][0]
            first.sleeve = "small"
            return sel

        r = V.process_month(t, panel, dates, series, universe_rows,
                            foreign_at=foreign_at, dart_at=dart_at, prior_factor_ic={},
                            leader_basket=V.LEADER_BASKET_2026_06, universe="largemid",
                            generator=relative_small_generator)
        self.assertIsNotNone(r)
        self.assertNotIn("small", set(r.selected_sleeve.values()))

    def test_largemid_report_has_gate_c_replacement_and_baselines(self):
        rep = self._run(universe="largemid", smoke=False)
        self.assertEqual(rep["universe"], "largemid")
        self.assertEqual(rep["protocol"], "largemid-freeze")
        self.assertTrue(rep["diagnostic_only"])
        self.assertFalse(rep["decision_grade"])
        self.assertIn("exploratory_verdict", rep["gate_a"])
        self.assertIn("exploratory_verdict", rep["gate_c"])
        self.assertIn("FAILED", rep["protocol_note"])  # framing: all-universe still FAILED
        ga = rep["gate_a"]
        # pre-registered baselines present
        for k in ("baseline_random_largemid_recall", "baseline_equal_rank_largemid_recall",
                  "leader_prevalence_in_largemid_winners"):
            self.assertIn(k, ga)
        self.assertEqual(
            ga["binding_baseline_recall"],
            max(ga["baseline_legacy_momentum_proxy_recall"], ga["baseline_equal_rank_largemid_recall"]),
        )
        # Gate C replacement metrics present (balance band + ADV floor + sector N/A), NOT 60/60/30.
        gc = rep["gate_c"]
        entry = gc["per_month"][0]
        self.assertEqual(entry["protocol"], "largemid-freeze")
        for k in ("large_fraction", "mid_fraction", "min_selected_adv",
                  "median_selected_adv", "sector_cap"):
            self.assertIn(k, entry)
        self.assertEqual(entry["small_fraction"], 0.0)
        self.assertEqual(entry["dist"].get("small"), 0)
        self.assertEqual(entry["sector_cap"], "N/A (no PIT-safe offline sector source, addendum §5)")

    def test_largemid_gate_a_uses_020_bar_not_035(self):
        # gate_a_pass_largemid binds on GATE_A_OVERALL_RECALL_MIN (0.20), and drops the redundant 0.35
        # largemid sub-check. Construct a RecallReport with overall just above 0.20 but below 0.35.
        rep = V.RecallReport(
            overall=0.25, random_baseline=0.05, random_ratio=5.0,
            per_horizon={"short": 0.2, "mid": 0.2, "long": 0.2},
            largemid_recall=0.25, largemid_vs_overall=1.0,
            baseline_recall=0.10)
        ok, fails = V.gate_a_pass_largemid(rep)
        self.assertTrue(ok, f"largemid 0.25 recall should pass 0.20 bar; fails={fails}")
        # but the all-universe gate_a_pass would FAIL on the same report (0.35 largemid bar).
        ok_all, fails_all = V.gate_a_pass(rep)
        self.assertFalse(ok_all)
        self.assertTrue(any("0.35" in f for f in fails_all))

    def test_largemid_gate_a_still_must_beat_baseline(self):
        # 'must beat baseline, not merely clear 0.20' is enforced verbatim.
        rep = V.RecallReport(
            overall=0.25, random_baseline=0.05, random_ratio=5.0,
            per_horizon={"short": 0.2, "mid": 0.2, "long": 0.2},
            largemid_recall=0.25, largemid_vs_overall=1.0,
            baseline_recall=0.30)  # baseline >= overall → must FAIL
        ok, fails = V.gate_a_pass_largemid(rep)
        self.assertFalse(ok)
        self.assertTrue(any("baseline" in f for f in fails))

    def test_largemid_gate_a_still_enforces_random_ratio_and_per_horizon(self):
        low_ratio = V.RecallReport(
            overall=0.25, random_baseline=0.11, random_ratio=2.49,
            per_horizon={"short": 0.2, "mid": 0.2, "long": 0.2},
            largemid_recall=0.25, largemid_vs_overall=1.0,
            baseline_recall=0.10)
        ok, fails = V.gate_a_pass_largemid(low_ratio)
        self.assertFalse(ok)
        self.assertTrue(any("random" in f for f in fails))
        low_horizon = V.RecallReport(
            overall=0.25, random_baseline=0.05, random_ratio=5.0,
            per_horizon={"short": 0.119, "mid": 0.2, "long": 0.2},
            largemid_recall=0.25, largemid_vs_overall=1.0,
            baseline_recall=0.10)
        ok, fails = V.gate_a_pass_largemid(low_horizon)
        self.assertFalse(ok)
        self.assertTrue(any("short recall" in f for f in fails))


class TestGateCLargemid(unittest.TestCase):
    def _mk(self, large_n, mid_n, small_n=0, adv=5e9):
        sleeve, score, mcap, advd = {}, {}, {}, {}
        i = 0
        for sl, n in (("large", large_n), ("mid", mid_n), ("small", small_n)):
            for _ in range(n):
                t = f"{i:06d}"
                sleeve[t], score[t], mcap[t], advd[t] = sl, 50.0, 1e12, adv
                i += 1
        return sleeve, score, mcap, advd

    def test_balanced_passes(self):
        sleeve, score, mcap, adv = self._mk(75, 75)
        ok, fails, met = V.gate_c_largemid(sleeve, score, mcap, adv)
        self.assertTrue(ok, fails)
        self.assertEqual(met["sector_cap"], "N/A (no PIT-safe offline sector source, addendum §5)")

    def test_sleeve_collapse_fails_band(self):
        sleeve, score, mcap, adv = self._mk(140, 10)  # large 0.93 outside [0.30,0.70]
        ok, fails, _ = V.gate_c_largemid(sleeve, score, mcap, adv)
        self.assertFalse(ok)
        self.assertTrue(any("balance" in f for f in fails))

    def test_below_adv_floor_fails(self):
        sleeve, score, mcap, adv = self._mk(75, 75, adv=1e8)  # below ₩2B floor
        ok, fails, _ = V.gate_c_largemid(sleeve, score, mcap, adv)
        self.assertFalse(ok)
        self.assertTrue(any("ADV floor" in f for f in fails))

    def test_small_leak_fails(self):
        sleeve, score, mcap, adv = self._mk(70, 70, small_n=10)
        ok, fails, _ = V.gate_c_largemid(sleeve, score, mcap, adv)
        self.assertFalse(ok)
        self.assertTrue(any("small" in f for f in fails))

    def test_sector_cap_emitted_when_sectors_given(self):
        sleeve, score, mcap, adv = self._mk(75, 75)
        sectors = {t: ("제조" if i % 2 else "바이오") for i, t in enumerate(score)}
        ok, fails, met = V.gate_c_largemid(sleeve, score, mcap, adv, sector_by_ticker=sectors)
        self.assertIsInstance(met["sector_cap"], dict)
        self.assertIn("top_sector_fraction", met["sector_cap"])


class TestCfg7Diagnostics(unittest.TestCase):
    """TASK B — cfg7 daily surge proxy secondary metrics end-to-end (offline, no I/O)."""

    def _run_cfg7(self, n_tickers=360):
        import tier0_cfg56 as C
        panel, _dates, universe_at, foreign_at, dart_at = _largemid_fakes(n_tickers)
        return V.harvest_pit_months(
            date(2025, 3, 1), date(2025, 4, 1), panel,
            universe_at=universe_at, foreign_at=foreign_at, dart_at=dart_at,
            smoke=False, generated_at="2026-06-12T00:00:00",
            generator=C.select_cfg7_for_harvest, generator_label="cfg7")

    def test_cfg7_labels_exploratory_and_has_secondary_metrics(self):
        rep = self._run_cfg7()
        self.assertEqual(rep["generator"], "cfg7")
        self.assertTrue(rep["exploratory"])
        gd = rep["generation_diagnostics"]
        self.assertIn("NOT prism", gd["note"])
        sm = gd["cfg7_secondary_metrics"]
        # all four mandatory secondary metric families present
        self.assertIn("lead_time_to_winner_move", sm)
        self.assertIn("fwd_return_of_picks", sm)
        self.assertIn("churn_repeat_rate_month_over_month", sm)
        self.assertIn("recall_lift_vs_random", sm)
        self.assertIn("recall_lift_vs_high_volume", sm)

    def test_cfg7_winner_move_definition_preregistered_in_output(self):
        rep = self._run_cfg7()
        sm = rep["generation_diagnostics"]["cfg7_secondary_metrics"]
        defn = sm["lead_time_winner_move_definition"]
        self.assertIn("top-decile", defn)
        self.assertIn("PRE-REGISTERED", defn)
        self.assertIn("censored", defn)
        # per-horizon lead-time reports reached + censored counts (censored never imputed to 0/horizon).
        for h in V.HARVEST_BUCKETS:
            cell = sm["lead_time_to_winner_move"][h]
            for k in ("mean_lead_time_days", "median_lead_time_days",
                      "n_winner_picks_reached", "n_winner_picks_censored"):
                self.assertIn(k, cell)

    def test_cfg7_fwd_returns_1d_5d_20d(self):
        rep = self._run_cfg7()
        fwd = rep["generation_diagnostics"]["cfg7_secondary_metrics"]["fwd_return_of_picks"]
        for label in ("1d", "5d", "20d"):
            self.assertIn(label, fwd)
            for k in ("mean_return", "hit_rate", "n"):
                self.assertIn(k, fwd[label])

    def test_first_day_reaching_threshold_pit_and_censoring(self):
        # ticker rising 1%/day from entry; threshold 0.05 reached on day 5 (cum>=0.05). high threshold censored.
        dates = [f"2025010{i}" if i < 10 else f"202501{i}" for i in range(1, 30)]
        panel = {}
        for j, ds in enumerate(dates):
            panel[ds] = {"AAA": V.PanelRow(close=100.0 * (1.01 ** j), high=100.0 * (1.01 ** j),
                                           trdval=5e9, mktcap=1e12)}
        d = V.panel_trading_days(panel)
        # entry = t+1; from entry price, cum>=0.05 first at ~5 trading days.
        lt = V.first_day_reaching_threshold(panel, d, "AAA", 0, 0.05, 20)
        self.assertIsNotNone(lt)
        self.assertGreaterEqual(lt, 4)
        self.assertLessEqual(lt, 7)
        # unreachable threshold within horizon → censored (None), never 0.
        self.assertIsNone(V.first_day_reaching_threshold(panel, d, "AAA", 0, 5.0, 20))

    def test_cfg7_recall_lift_vs_high_volume_present_and_numeric(self):
        rep = self._run_cfg7()
        sm = rep["generation_diagnostics"]["cfg7_secondary_metrics"]
        self.assertIn("baseline_high_volume_recall", sm)
        self.assertIn("lift_interpretation", sm)
        self.assertIn("liquidity", sm["lift_interpretation"])

    def test_cfg7_lift_vs_high_volume_uses_same_winner_denominator(self):
        r = _mk_month_result(
            generator_diagnostics={
                "lead_time_by_horizon": {h: [] for h in V.HARVEST_BUCKETS},
                "lead_time_censored_by_horizon": {h: 0 for h in V.HARVEST_BUCKETS},
                "fwd_returns": {label: [] for label in V.CFG7_FWD_HORIZONS},
                "recall_num": 2,
                "recall_den": 10,
                "random_num": 1,
                "random_den": 100,
                "high_volume_num": 3,
                "high_volume_selected_count": 150,
                "high_volume_baseline_status": "OK",
            }
        )
        sm = V._cfg7_aggregate([r])
        self.assertEqual(sm["recall"], 0.2)
        self.assertEqual(sm["baseline_high_volume_recall"], 0.3)
        self.assertEqual(sm["recall_lift_vs_high_volume"], -0.1)
        self.assertEqual(sm["recall_winner_denominator"], 10)
        self.assertEqual(sm["baseline_high_volume_hit_count"], 3)

    def test_cfg7_high_volume_shortfall_is_recorded_not_raised(self):
        r = _mk_month_result(
            generator_diagnostics={
                "lead_time_by_horizon": {h: [] for h in V.HARVEST_BUCKETS},
                "lead_time_censored_by_horizon": {h: 0 for h in V.HARVEST_BUCKETS},
                "fwd_returns": {label: [] for label in V.CFG7_FWD_HORIZONS},
                "recall_num": 2,
                "recall_den": 10,
                "random_num": 1,
                "random_den": 100,
                "high_volume_num": None,
                "high_volume_selected_count": 0,
                "high_volume_baseline_status": "SHORTFALL",
                "high_volume_baseline_shortfall_reason": "synthetic shortfall",
            }
        )
        sm = V._cfg7_aggregate([r])
        self.assertEqual(sm["high_volume_baseline_status"], "SHORTFALL")
        self.assertIsNone(sm["baseline_high_volume_recall"])
        self.assertIsNone(sm["recall_lift_vs_high_volume"])
        self.assertIn("synthetic shortfall", sm["high_volume_baseline_shortfall_reasons"])
        json.dumps(sm, allow_nan=False)

    def test_first_day_reaching_threshold_uses_actual_gap_entry(self):
        dates = [f"202501{i:02d}" for i in range(1, 12)]
        panel = {}
        for j, ds in enumerate(dates):
            if j in (1, 2):
                panel[ds] = {}
            else:
                price = 100.0 if j <= 3 else 100.0 * (1.03 ** (j - 3))
                panel[ds] = {"AAA": V.PanelRow(close=price, high=price, trdval=5e9, mktcap=1e12)}
        lt = V.first_day_reaching_threshold(panel, dates, "AAA", 0, 0.05, 7)
        self.assertEqual(lt, 2)

    def test_cfg7_secondary_metrics_are_strict_json_serializable(self):
        rep = self._run_cfg7()
        sm = rep["generation_diagnostics"]["cfg7_secondary_metrics"]
        json.dumps(sm, allow_nan=False)

    def test_cfg7_selection_ignores_post_selection_price_volume_high_spikes(self):
        import tier0_cfg56 as C
        panel, dates, universe_at, foreign_at, dart_at = _largemid_fakes(360)
        t = date(2025, 3, 1)
        sel_idx = V.selection_index(dates, t)
        mutated = {}
        for i, ds in enumerate(dates):
            mutated[ds] = {}
            for tk, row in panel[ds].items():
                factor = 10.0 if i > sel_idx and int(tk) % 17 == 0 else 1.0
                mutated[ds][tk] = V.PanelRow(
                    close=row.close * factor,
                    high=row.high * factor,
                    trdval=row.trdval * factor,
                    mktcap=row.mktcap,
                    name=row.name,
                    market=row.market,
                )
        sel_date_obj = V.datetime.strptime(dates[sel_idx], "%Y%m%d").date()
        universe_rows = universe_at(sel_date_obj)
        base = V.process_month(
            t, panel, dates, V.build_series_by_ticker(panel, dates), universe_rows,
            foreign_at=foreign_at, dart_at=dart_at, prior_factor_ic={},
            leader_basket=V.LEADER_BASKET_2026_06,
            generator=C.select_cfg7_for_harvest, generator_label="cfg7")
        changed = V.process_month(
            t, mutated, dates, V.build_series_by_ticker(mutated, dates), universe_rows,
            foreign_at=foreign_at, dart_at=dart_at, prior_factor_ic={},
            leader_basket=V.LEADER_BASKET_2026_06,
            generator=C.select_cfg7_for_harvest, generator_label="cfg7")
        self.assertEqual(base.selected_by_horizon, changed.selected_by_horizon)


class TestGateASelectiveLargemid(unittest.TestCase):
    """TASK 가 — gate_a_pass_selective_largemid unit logic (recall-lift CI + co-gate, no 0.20)."""

    def test_pass_when_ci_lower_positive_and_ic_ir_ok(self):
        ok, fails = V.gate_a_pass_selective_largemid([0.02, 0.08], 0.05, 0.35)
        self.assertTrue(ok, fails)

    def test_fail_when_ci_lower_not_positive(self):
        ok, fails = V.gate_a_pass_selective_largemid([-0.01, 0.08], 0.04, 0.35)
        self.assertFalse(ok)
        self.assertTrue(any("CI90 lower" in f for f in fails))

    def test_fail_co_gate_ic_ir_below_030(self):
        ok, fails = V.gate_a_pass_selective_largemid([0.02, 0.08], 0.05, 0.29)
        self.assertFalse(ok)
        self.assertTrue(any("co-gate" in f for f in fails))

    def test_fallback_5pp_when_ci_unavailable_pass(self):
        # CI NaN (<2 months) → fallback margin lift >= +5pp.
        ok, fails = V.gate_a_pass_selective_largemid([math.nan, math.nan], 0.06, 0.35)
        self.assertTrue(ok, fails)

    def test_fallback_5pp_when_ci_unavailable_fail(self):
        ok, fails = V.gate_a_pass_selective_largemid([math.nan, math.nan], 0.04, 0.35)
        self.assertFalse(ok)
        self.assertTrue(any("fallback" in f for f in fails))

    def test_does_not_use_absolute_020_bar(self):
        # A selective report whose absolute recall is far below 0.20 still PASSES if lift CI>0 + IC ok.
        # (proven structurally: the function never references overall recall / 0.20.)
        ok, _ = V.gate_a_pass_selective_largemid([0.001, 0.002], 0.0015, 0.40)
        self.assertTrue(ok)

    def test_analytic_random_baseline_equals_uniform_random_expectation(self):
        universe = ("A", "B", "C", "D", "E")
        winners = {"A", "C"}
        n = 2
        draws = [set(draw) for draw in combinations(universe, n)]
        mean_recall = sum(len(draw & winners) / len(winners) for draw in draws) / len(draws)
        self.assertAlmostEqual(mean_recall, n / len(universe))


class TestSelectiveLargemidHarvest(unittest.TestCase):
    """TASK 가 — --select-count end-to-end on largemid (count=50 mapping, lift block, no-0.20-rescue)."""

    def _run(self, select_count=None, universe="largemid", smoke=False, n_tickers=360):
        panel, _dates, universe_at, foreign_at, dart_at = _largemid_fakes(n_tickers)
        return V.harvest_pit_months(
            date(2025, 3, 1), date(2025, 4, 1), panel,
            universe_at=universe_at, foreign_at=foreign_at, dart_at=dart_at,
            smoke=smoke, generated_at="2026-06-12T00:00:00",
            universe=universe, select_count=select_count)

    def test_default_none_is_byte_identical_to_plain_largemid(self):
        base = self._run(select_count=None, smoke=True)
        self.assertEqual(base["protocol"], "largemid-freeze")
        self.assertNotIn("select_count", base["gate_a"])
        self.assertNotIn("recall_lift_ci90", base["gate_a"])

    def test_select_count_caps_selected_all_to_n(self):
        # process_month directly: every month's selected_all must be <= N after truncation.
        panel, dates, universe_at, foreign_at, dart_at = _largemid_fakes(360)
        series = V.build_series_by_ticker(panel, dates)
        t = date(2025, 3, 1)
        sel_idx = V.selection_index(dates, t)
        sel_date_obj = V.datetime.strptime(dates[sel_idx], "%Y%m%d").date()
        universe_rows = universe_at(sel_date_obj)
        full = V.process_month(t, panel, dates, series, universe_rows,
                               foreign_at=foreign_at, dart_at=dart_at, prior_factor_ic={},
                               leader_basket=V.LEADER_BASKET_2026_06, universe="largemid")
        capped = V.process_month(t, panel, dates, series, universe_rows,
                                 foreign_at=foreign_at, dart_at=dart_at, prior_factor_ic={},
                                 leader_basket=V.LEADER_BASKET_2026_06, universe="largemid",
                                 select_count=50)
        self.assertEqual(len(capped.selected_all), 50)
        self.assertLess(len(capped.selected_all), len(full.selected_all))
        # kept set is a SUBSET of the full pick set (truncation, not re-score).
        self.assertTrue(capped.selected_all.issubset(full.selected_all))
        # Gate C size composition measured over the kept top-N only.
        self.assertEqual(set(capped.selected_sleeve), capped.selected_all)

    def test_select_count_keeps_top_n_by_score(self):
        # The kept set must be exactly the top-N by score over the disjoint union of full picks.
        panel, dates, universe_at, foreign_at, dart_at = _largemid_fakes(360)
        series = V.build_series_by_ticker(panel, dates)
        t = date(2025, 3, 1)
        sel_idx = V.selection_index(dates, t)
        sel_date_obj = V.datetime.strptime(dates[sel_idx], "%Y%m%d").date()
        universe_rows = universe_at(sel_date_obj)
        full = V.process_month(t, panel, dates, series, universe_rows,
                               foreign_at=foreign_at, dart_at=dart_at, prior_factor_ic={},
                               leader_basket=V.LEADER_BASKET_2026_06, universe="largemid")
        # reconstruct expected pooled top-30 by (score desc, ticker asc).
        pooled = sorted(((sc, tk) for tk, sc in full.selected_score.items()), key=lambda x: (-x[0], x[1]))
        expected = {tk for _s, tk in pooled[:30]}
        capped = V.process_month(t, panel, dates, series, universe_rows,
                                 foreign_at=foreign_at, dart_at=dart_at, prior_factor_ic={},
                                 leader_basket=V.LEADER_BASKET_2026_06, universe="largemid",
                                 select_count=30)
        self.assertEqual(capped.selected_all, expected)

    def test_scored_universe_for_ic_is_not_truncated(self):
        # Gate B IC scope must stay over the full scored largemid universe. The composite IC of the
        # capped run must equal the uncapped run (IC computed on sel[b][0], untouched by select_count).
        capped = self._run(select_count=50, smoke=True)
        full = self._run(select_count=None, smoke=True)
        self.assertEqual(capped["gate_b"]["ic_ir"], full["gate_b"]["ic_ir"])

    def test_selective_emits_recall_lift_block_and_protocol(self):
        rep = self._run(select_count=50, smoke=False)
        self.assertEqual(rep["protocol"], "selective-largemid")
        self.assertEqual(rep["select_count"], 50)
        self.assertTrue(rep["diagnostic_only"])
        self.assertFalse(rep["decision_grade"])
        ga = rep["gate_a"]
        self.assertEqual(ga["select_count"], 50)
        self.assertIn("recall_lift_mean", ga)
        self.assertIn("recall_lift_ci90", ga)
        self.assertIn("recall_lift_random_baseline_per_month", ga)
        self.assertIn("recall_lift_co_gate_ic_ir", ga)
        self.assertIn("NEGATIVE-HYPOTHESIS", rep["protocol_note"])
        self.assertIn("0.20", ga["recall_lift_note"])  # states 0.20 NOT used

    def test_selective_random_baseline_uses_actual_same_count_n_over_month_universe(self):
        rep = self._run(select_count=50, smoke=False)
        per_month = rep["gate_a"]["per_month"]
        baselines = rep["gate_a"]["recall_lift_random_baseline_per_month"]
        self.assertEqual(len(per_month), len(baselines))
        for row, baseline in zip(per_month, baselines):
            self.assertAlmostEqual(baseline, 50 / row["n_universe"])

    def test_selective_verdict_does_not_use_absolute_020(self):
        # Even if absolute recall < 0.20, the selective gate decides on lift+IC. We assert the gate_a
        # fails list NEVER contains the 0.20 absolute-recall message used by gate_a_pass(_largemid).
        rep = self._run(select_count=50, smoke=False)
        for f in rep["gate_a"]["fails"]:
            self.assertNotIn(f"< {V.GATE_A_OVERALL_RECALL_MIN}", f)

    def test_select_count_rejected_on_all_universe(self):
        with self.assertRaises(ValueError):
            self._run(select_count=50, universe="all")

    def test_sensitivity_counts_never_emit_pass_fail(self):
        for n in (30, 75):
            rep = self._run(select_count=n, smoke=False)
            self.assertEqual(rep["select_count"], n)
            self.assertEqual(rep["gate_a"]["verdict"], "SENSITIVITY")
            self.assertTrue(rep["sensitivity_only"])
            self.assertFalse(rep["selective_adjudicated"])
            self.assertFalse(rep["triple_gate_all_pass"])
        rep50 = self._run(select_count=50, smoke=False)
        self.assertIn(rep50["gate_a"]["verdict"], ("PASS", "FAIL"))
        self.assertTrue(rep50["selective_adjudicated"])

    def test_select_count_rejects_non_preregistered_values(self):
        with self.assertRaises(ValueError):
            self._run(select_count=40, smoke=False)

    def test_selection_performance_uses_kept_top_n_not_full_harvest(self):
        rep = self._run(select_count=50, smoke=False)
        total_bpp_picks = sum(rep["selection_performance"][h]["n_bpp_picks"] for h in V.HARVEST_BUCKETS)
        self.assertEqual(total_bpp_picks, 50 * rep["harvest"]["months_analyzed"])
        for row in rep["gate_a"]["per_month"]:
            self.assertEqual(row["selected_target_count"], 50)
            self.assertEqual(row["selected_actual_count"], 50)


class TestTradableWinnerDenominator(unittest.TestCase):
    """재검증 (a) — --winner-universe tradable: liquidity-matched Gate A denominator (additive).

    The winner set is restricted to ADV≥₩2B names in process_month; aggregate_harvest binds on
    gate_a_pass_selective_largemid (lift-CI lower>0 + IC IR≥0.30) REUSED VERBATIM. Default path
    (winner_universe='all') must stay byte-identical (no tradable fields, gate_a_pass path).
    """

    def _months(self, composite_ic=0.45):
        return [
            _mk_month_result(month="2024-06-01", composite_ic=composite_ic + 0.0),
            _mk_month_result(month="2024-07-01", composite_ic=composite_ic + 0.05),
            _mk_month_result(month="2024-08-01", composite_ic=composite_ic + 0.02),
        ]

    def test_tradable_emits_protocol_and_lift_block(self):
        rep = V.aggregate_harvest(self._months(), smoke=False, generated_at="t", coverage_meta={},
                                  survivorship_label="t", winner_universe="tradable")
        self.assertEqual(rep.get("protocol"), "tradable-winner-denominator")
        self.assertEqual(rep.get("winner_universe"), "tradable")
        self.assertIs(rep.get("decision_grade"), False)
        self.assertIs(rep.get("diagnostic_only"), True)
        ga = rep["gate_a"]
        self.assertIn("tradable_recall_lift_ci90", ga)
        self.assertIn("tradable_recall_lift_co_gate_ic_ir", ga)
        self.assertEqual(ga.get("protocol"), "tradable-winner-denominator")
        # per-month tradable lift fields present; baseline uses n_eligible (tradable size), not n_universe.
        row = ga["per_month"][0]
        self.assertIn("tradable_recall_lift", row)
        self.assertAlmostEqual(row["tradable_random_baseline"], 2 / 50)  # N=2 selected / M=50 eligible

    def test_default_all_has_no_tradable_fields_and_uses_gate_a_pass(self):
        rep = V.aggregate_harvest(self._months(), smoke=False, generated_at="t", coverage_meta={},
                                  survivorship_label="t")  # winner_universe defaults to 'all'
        self.assertIsNone(rep.get("protocol"))
        self.assertNotIn("tradable_recall_lift_ci90", rep["gate_a"])
        # default all path is the frozen gate_a_pass — synthetic recall fails the 0.20/baseline bar.
        self.assertEqual(rep["gate_a"]["verdict"], "FAIL")

    def test_binding_is_lift_not_absolute_020(self):
        # tradable verdict is driven by lift CI + IC IR (reused selective gate), NOT the absolute 0.20 bar.
        rep = V.aggregate_harvest(self._months(composite_ic=0.5), smoke=False, generated_at="t",
                                  coverage_meta={}, survivorship_label="t", winner_universe="tradable")
        ga = rep["gate_a"]
        # synthetic: funnel catches the winner every month (recall 1.0) vs random 0.04 → big positive lift,
        # IC IR positive → selective gate PASS. The absolute recall is reported as SECONDARY (non-binding).
        self.assertEqual(ga["verdict"], "PASS")
        self.assertIn("secondary_absolute_recall_vs_frozen_0_20", ga)

    def test_harvest_rejects_tradable_with_largemid(self):
        # validation fires before the panel is read; reuse the proven largemid panel fake.
        panel = _largemid_fakes(360)[0]
        with self.assertRaises(ValueError):
            V.harvest_pit_months(
                date(2024, 6, 1), date(2024, 6, 1), panel,
                universe_at=lambda d: [], foreign_at=lambda tk, d: (0.0, False),
                dart_at=lambda tk, d: None, universe="largemid", winner_universe="tradable")

    def test_harvest_rejects_tradable_with_select_count(self):
        panel = _largemid_fakes(360)[0]
        with self.assertRaises(ValueError):
            V.harvest_pit_months(
                date(2024, 6, 1), date(2024, 6, 1), panel,
                universe_at=lambda d: [], foreign_at=lambda tk, d: (0.0, False),
                dart_at=lambda tk, d: None, universe="all", select_count=50, winner_universe="tradable")


class TestCfg8SurgeLargemid(unittest.TestCase):
    """cfg8 — cfg7 surge generator restricted to --universe largemid (un-deferred 2026-06-18)."""

    def _run_cfg8(self, n_tickers=360):
        import tier0_cfg56 as C
        panel, _dates, universe_at, foreign_at, dart_at = _largemid_fakes(n_tickers)
        return V.harvest_pit_months(
            date(2025, 3, 1), date(2025, 4, 1), panel,
            universe_at=universe_at, foreign_at=foreign_at, dart_at=dart_at,
            smoke=False, generated_at="2026-06-12T00:00:00",
            generator=C.select_cfg7_for_harvest, generator_label="cfg7", universe="largemid")

    def test_cfg7_plus_largemid_is_allowed(self):
        rep = self._run_cfg8()
        self.assertEqual(rep["generator"], "cfg7")
        self.assertTrue(rep["exploratory"])
        self.assertEqual(rep["universe"], "largemid")

    def test_cfg5_cfg6_plus_largemid_still_blocked(self):
        import tier0_cfg56 as C
        panel, _dates, universe_at, foreign_at, dart_at = _largemid_fakes(360)
        for label, gen in (("cfg5", C.select_cfg5_for_harvest), ("cfg6", C.select_cfg6_for_harvest)):
            with self.assertRaises(ValueError, msg=f"{label}+largemid must be blocked"):
                V.harvest_pit_months(
                    date(2025, 3, 1), date(2025, 4, 1), panel,
                    universe_at=universe_at, foreign_at=foreign_at, dart_at=dart_at,
                    smoke=False, generated_at="t",
                    generator=gen, generator_label=label, universe="largemid")

    def test_cfg8_emits_cfg7_secondary_metrics_on_largemid(self):
        rep = self._run_cfg8()
        gd = rep["generation_diagnostics"]
        self.assertIn("NOT prism", gd["note"])
        sm = gd["cfg7_secondary_metrics"]
        for k in ("lead_time_to_winner_move", "fwd_return_of_picks",
                  "churn_repeat_rate_month_over_month", "recall_lift_vs_random",
                  "recall_lift_vs_high_volume"):
            self.assertIn(k, sm)

    def test_cfg8_uses_largemid_gate_and_largemid_framing(self):
        rep = self._run_cfg8()
        # cfg8 fires the largemid additive block + the cfg7 funnel gate (gate_a_pass_largemid).
        self.assertEqual(rep["universe"], "largemid")
        self.assertEqual(rep["protocol"], "largemid-freeze")
        self.assertTrue(rep["diagnostic_only"])
        self.assertFalse(rep["decision_grade"])
        self.assertIn("baseline_random_largemid_recall", rep["gate_a"])

    def test_cfg8_runs_offline_no_supabase_flag(self):
        # main() forces allow_supabase=False for any non-(bpp,all) combo. We assert the CLI guard wiring
        # by confirming cfg7+largemid passes the orchestrator guard (no ValueError) — already covered by
        # _run_cfg8; here we double-check the orchestrator rejects an undefined combo deterministically.
        import tier0_cfg56 as C
        panel, _dates, universe_at, foreign_at, dart_at = _largemid_fakes(360)
        # select_count must be rejected for cfg7 generator (TASK 가 is bpp-only).
        with self.assertRaises(ValueError):
            V.harvest_pit_months(
                date(2025, 3, 1), date(2025, 4, 1), panel,
                universe_at=universe_at, foreign_at=foreign_at, dart_at=dart_at,
                smoke=False, generated_at="t",
                generator=C.select_cfg7_for_harvest, generator_label="cfg7",
                universe="largemid", select_count=50)


class TestCfg8CliGuard(unittest.TestCase):
    """cfg8 CLI guard relax — cfg7+largemid allowed before I/O; cfg5/cfg6+largemid + select-count misuse rejected."""

    def _cli(self, *args):
        return subprocess.run(
            [sys.executable, str(Path(__file__).with_name("validate_tier0_ic.py")),
             "--start-month", "2025-03-01", "--end-month", "2025-04-01", *args],
            capture_output=True, text=True, cwd=str(Path(__file__).parent))

    def test_cfg5_largemid_rejected_before_io(self):
        proc = self._cli("--generator", "cfg5", "--universe", "largemid")
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("cfg5/cfg6+largemid remain deferred", proc.stderr)

    def test_select_count_on_all_universe_rejected_before_io(self):
        proc = self._cli("--select-count", "50", "--universe", "all")
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("--select-count only applies to --universe largemid", proc.stderr)

    def test_select_count_with_cfg7_rejected(self):
        proc = self._cli("--select-count", "50", "--universe", "largemid", "--generator", "cfg7")
        self.assertNotEqual(proc.returncode, 0)
        # cfg7+largemid passes the universe guard, but select-count requires bpp.
        self.assertIn("--select-count only applies to --universe largemid + --generator bpp", proc.stderr)

    def test_select_count_non_preregistered_value_rejected_before_io(self):
        proc = self._cli("--select-count", "40", "--universe", "largemid")
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("--select-count must be one of", proc.stderr)

    def test_cfg7_rejects_foreign_and_earnings_flags_before_io(self):
        proc = self._cli("--generator", "cfg7", "--with-foreign")
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("daily-surge-only", proc.stderr)
        proc = self._cli("--generator", "cfg7", "--earnings")
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("daily-surge-only", proc.stderr)

    def test_largemid_rejects_foreign_and_earnings_flags_before_io(self):
        proc = self._cli("--universe", "largemid", "--with-foreign")
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("foreign/earnings OFF", proc.stderr)
        proc = self._cli("--universe", "largemid", "--earnings")
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("foreign/earnings OFF", proc.stderr)


if __name__ == "__main__":
    unittest.main()
