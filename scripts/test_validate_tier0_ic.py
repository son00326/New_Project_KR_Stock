"""Unittest for scripts/validate_tier0_ic.py — Tier 0 B++ 삼중 게이트 하버스트 (§4).

SoT: docs/superpowers/specs/2026-06-12-tier0-scoring-bplus-validation.md §4
순수 메트릭/패널/포워드 로직을 hand-computed expected로 고정. 실 KRX run은 게이트 step 2.
"""
from __future__ import annotations

import math
import subprocess
import sys
import unittest
from datetime import date
from pathlib import Path

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


class TestSelectionPerformance(unittest.TestCase):
    def test_select_by_horizon_disjoint(self):
        import tier0_factors as F
        stocks = [F.StockRaw(ticker=f"T{i}", sector="제조", market_cap=1e12, closes=[100] * 5, trdvals=[5e9] * 5)
                  for i in range(120)]
        out = V._select_by_horizon(lambda ss, b: {s.ticker: float(int(s.ticker[1:])) for s in ss}, stocks, pool=10)
        allp = [t for v in out.values() for t in v]
        self.assertEqual(len(allp), 30)            # 3 buckets × 10
        self.assertEqual(len(set(allp)), 30)       # disjoint

    def test_selection_performance_aggregation(self):
        # omxy R6: gross+net, eqw vs sleeve excess, monthly-independent counts.
        perf = {"short": {"bpp": [0.10, 0.20], "legacy": [0.0], "eqw_mean": 0.05,
                          "bpp_sleeve_excess": [0.03, 0.03], "bpp_basket": 0.15},
                "mid": {"bpp": [], "legacy": [], "eqw_mean": math.nan,
                        "bpp_sleeve_excess": [], "bpp_basket": math.nan},
                "long": {"bpp": [], "legacy": [], "eqw_mean": math.nan,
                         "bpp_sleeve_excess": [], "bpp_basket": math.nan}}
        rep = V.aggregate_harvest([_mk_month_result(selection_perf=perf)], smoke=True,
                                  generated_at="t", coverage_meta={}, survivorship_label="clean")
        sp = rep["selection_performance"]["short"]
        self.assertAlmostEqual(sp["bpp_avg_return_gross"], 0.15)
        self.assertAlmostEqual(sp["bpp_net_return_after_cost"], 0.15 - V.ROUND_TRIP_COST)
        self.assertAlmostEqual(sp["bpp_hit_rate"], 1.0)
        self.assertAlmostEqual(sp["bpp_excess_vs_liquid_eqw"], 0.10)    # ((0.10-0.05)+(0.20-0.05))/2
        self.assertAlmostEqual(sp["bpp_excess_vs_own_sleeve"], 0.03)    # size-neutral skill
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


if __name__ == "__main__":
    unittest.main()
