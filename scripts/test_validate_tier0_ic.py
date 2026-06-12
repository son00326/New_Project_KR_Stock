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


class TestCliFailClosed(unittest.TestCase):
    def test_validate_cli_is_not_a_gate_yet(self):
        proc = subprocess.run(
            [
                sys.executable,
                str(Path(V.__file__)),
                "--start-month",
                "2026-01-01",
                "--end-month",
                "2026-02-01",
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("NOT A GATE YET (step-2)", proc.stdout + proc.stderr)


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
        s = V.legacy_manual_weight_score(_stub_raw(closes), "short")
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
