"""Unittest for scripts/validate_tier0_ic.py — Tier 0 B++ 삼중 게이트 하버스트 (§4).

SoT: docs/superpowers/specs/2026-06-12-tier0-scoring-bplus-validation.md §4
순수 메트릭/패널/포워드 로직을 hand-computed expected로 고정. 실 KRX run은 게이트 step 2.
"""
from __future__ import annotations

import math
import unittest
from datetime import date

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
    def setUp(self):
        self.dates = ["20260101", "20260102", "20260103", "20260104"]
        self.panel = {
            "20260101": {"A": _row(100), "B": _row(50), "C": _row(200)},
            "20260102": {"A": _row(110), "B": _row(55), "C": _row(100)},
            "20260103": {"A": _row(121), "C": _row(50)},   # B 상폐
            "20260104": {"A": _row(133), "C": _row(25)},
        }

    def test_ok(self):
        ret, status = V.compute_forward_return(self.panel, self.dates, "A", 0, 2)
        self.assertEqual(status, "ok")
        self.assertAlmostEqual(ret, 0.21)

    def test_delisted_uses_last_available(self):
        ret, status = V.compute_forward_return(self.panel, self.dates, "B", 0, 2)
        self.assertEqual(status, "delisted")
        self.assertAlmostEqual(ret, 0.10)  # 55/50-1, last available at d1

    def test_insufficient(self):
        ret, status = V.compute_forward_return(self.panel, self.dates, "A", 2, 5)
        self.assertEqual(status, "insufficient")
        self.assertTrue(math.isnan(ret))

    def test_absent(self):
        ret, status = V.compute_forward_return(self.panel, self.dates, "Z", 0, 1)
        self.assertEqual(status, "absent")
        self.assertTrue(math.isnan(ret))


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


class TestGateB(unittest.TestCase):
    def test_ic_ir(self):
        self.assertAlmostEqual(V.ic_information_ratio([0.1, 0.2, 0.3]), 2.449, places=2)

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
        ok, fails, metrics = V.gate_b_pass(
            monthly_ics=[0.05, 0.06, 0.04, 0.05],
            sleeve_ics={"large": [0.04, 0.05], "mid": [0.03]},
            spreads=[0.02, 0.03],
        )
        self.assertTrue(ok, fails)
        self.assertGreater(metrics["ic_ir"], 0.3)

    def test_gate_b_fail_negative_ic(self):
        ok, fails, _ = V.gate_b_pass(
            monthly_ics=[-0.05, -0.06], sleeve_ics={"large": [-0.01], "mid": [-0.01]},
            spreads=[-0.02],
        )
        self.assertFalse(ok)

    def test_gate_b_fail_sleeve_ic(self):
        ok, fails, _ = V.gate_b_pass(
            monthly_ics=[0.05, 0.06, 0.05, 0.06],
            sleeve_ics={"large": [-0.02, -0.01], "mid": [0.03]},  # large 음수
            spreads=[0.02, 0.03],
        )
        self.assertFalse(ok)
        self.assertTrue(any("large sleeve" in f for f in fails))


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


class TestBaseline(unittest.TestCase):
    def test_legacy_score_short_weight(self):
        # close/MA60 모멘텀 × short weight 0.40
        closes = [100.0] * 60 + [110.0]  # last close 110, MA60(of last 60)=...
        s = V.legacy_manual_weight_score(
            V.StockRaw_stub(closes) if hasattr(V, "StockRaw_stub") else _stub_raw(closes), "short"
        )
        self.assertFalse(math.isnan(s))
        self.assertGreater(s, 0.0)


def _stub_raw(closes):
    import tier0_factors as F
    return F.StockRaw(ticker="X", sector="제조", market_cap=1e12, closes=closes, trdvals=[5e9] * len(closes))


if __name__ == "__main__":
    unittest.main()
