"""Unittest for scripts/dart_signals.py — DART Signal 4/5 pure functions and cache wiring."""
from __future__ import annotations

import math
import unittest
from datetime import date
from unittest.mock import MagicMock, patch


SAMPLE_DART_OK = {
    "status": "000",
    "message": "정상",
    "list": [
        {"account_nm": "매출액", "sj_div": "IS", "thstrm_amount": "300,870,000,000,000"},
        {"account_nm": "영업이익", "sj_div": "IS", "thstrm_amount": "32,730,000,000,000"},
        {"account_nm": "당기순이익", "sj_div": "IS", "thstrm_amount": "34,450,000,000,000"},
        {"account_nm": "자산총계", "sj_div": "BS", "thstrm_amount": "514,530,000,000,000"},
        {"account_nm": "자본총계", "sj_div": "BS", "thstrm_amount": "402,190,000,000,000"},
        {"account_nm": "부채총계", "sj_div": "BS", "thstrm_amount": "112,340,000,000,000"},
        {"account_nm": "이자비용", "sj_div": "IS", "thstrm_amount": "1,200,000,000,000"},
    ],
}


def _financial_row(**overrides):
    row = {
        "revenue": 300_870_000_000_000,
        "op_income": 32_730_000_000_000,
        "net_income": 34_450_000_000_000,
        "total_assets": 514_530_000_000_000,
        "total_equity": 402_190_000_000_000,
        "total_debt": 112_340_000_000_000,
        "interest_expense": 1_200_000_000_000,
    }
    row.update(overrides)
    return row


class TestParseDartFinancialResponse(unittest.TestCase):
    def test_normal_parse(self):
        from scripts.dart_signals import parse_dart_financial_response

        parsed, aliases = parse_dart_financial_response(SAMPLE_DART_OK)
        self.assertEqual(parsed["revenue"], 300_870_000_000_000)
        self.assertEqual(parsed["op_income"], 32_730_000_000_000)
        self.assertEqual(parsed["interest_expense"], 1_200_000_000_000)
        self.assertEqual(aliases, [])

    def test_missing_account_returns_none(self):
        from scripts.dart_signals import parse_dart_financial_response

        parsed, aliases = parse_dart_financial_response({"status": "000", "list": [
            {"account_nm": "매출액", "sj_div": "IS", "thstrm_amount": "1,000"},
        ]})
        self.assertEqual(parsed["revenue"], 1000)
        self.assertIsNone(parsed["op_income"])
        self.assertEqual(aliases, [])

    def test_status_not_000_raises(self):
        from scripts.dart_signals import DartNoDataError, parse_dart_financial_response

        with self.assertRaises(DartNoDataError):
            parse_dart_financial_response({"status": "013", "message": "조회된 데이터가 없습니다."})

    def test_account_alias_match_logs_metadata(self):
        from scripts.dart_signals import parse_dart_financial_response

        parsed, aliases = parse_dart_financial_response({"status": "000", "list": [
            {"account_nm": "영업수익", "sj_div": "IS", "thstrm_amount": "5,000"},
            {"account_nm": "영업이익", "sj_div": "IS", "thstrm_amount": "500"},
        ]})
        self.assertEqual(parsed["revenue"], 5000)
        self.assertIn("account_alias_used:revenue=영업수익", aliases)


class TestComputeQualityScore(unittest.TestCase):
    def test_normal_5_metrics(self):
        from scripts.dart_signals import compute_quality_score

        cur = _financial_row()
        prev = _financial_row(revenue=258_900_000_000_000)
        raw, insufficient = compute_quality_score(cur, prev)
        self.assertFalse(insufficient)
        self.assertAlmostEqual(raw["roe"], 34_450 / 402_190, places=4)
        self.assertAlmostEqual(raw["debt_ratio_inv"], -(112_340 / 402_190), places=4)
        self.assertAlmostEqual(raw["op_margin"], 32_730 / 300_870, places=4)
        self.assertAlmostEqual(raw["revenue_growth"], (300_870 - 258_900) / 258_900, places=4)
        self.assertAlmostEqual(raw["interest_coverage"], 32_730 / 1_200, places=2)

    def test_capital_impairment_skips_roe_debt(self):
        from scripts.dart_signals import compute_quality_score

        raw, insufficient = compute_quality_score(_financial_row(total_equity=-1), _financial_row(revenue=1))
        self.assertTrue(math.isnan(raw["roe"]))
        self.assertTrue(math.isnan(raw["debt_ratio_inv"]))
        self.assertFalse(insufficient)

    def test_three_missing_returns_insufficient(self):
        from scripts.dart_signals import compute_quality_score

        raw, insufficient = compute_quality_score(
            _financial_row(total_equity=None, interest_expense=None, op_income=None),
            _financial_row(),
        )
        self.assertTrue(insufficient)
        self.assertTrue(math.isnan(raw["op_margin"]))

    def test_quality_composite_ignores_nan_and_zeroes_insufficient(self):
        from scripts.dart_signals import compute_quality_composite_for_universe

        scores = compute_quality_composite_for_universe([
            {"roe": 0.2, "debt_ratio_inv": -0.2, "op_margin": 0.2, "revenue_growth": 0.2, "interest_coverage": 10},
            {"roe": math.nan, "debt_ratio_inv": math.nan, "op_margin": 0.1, "revenue_growth": math.nan, "interest_coverage": math.nan},
        ])
        self.assertGreater(scores[0], 0)
        self.assertEqual(scores[1], 0.0)


class TestEarningsMomentum(unittest.TestCase):
    def test_standalone_quarters(self):
        from scripts.dart_signals import compute_standalone_quarter

        self.assertEqual(compute_standalone_quarter("Q1", q1_cumulative={"revenue": 100})["revenue"], 100)
        self.assertEqual(compute_standalone_quarter("Q2", h1_cumulative={"revenue": 220}, q1_cumulative={"revenue": 100})["revenue"], 120)
        self.assertEqual(compute_standalone_quarter("Q3", nine_m_cumulative={"revenue": 360}, h1_cumulative={"revenue": 220})["revenue"], 140)
        self.assertEqual(compute_standalone_quarter("Q4", annual_cumulative={"revenue": 500}, nine_m_cumulative={"revenue": 360})["revenue"], 140)
        self.assertIsNone(compute_standalone_quarter("Q3", nine_m_cumulative={"revenue": 1}, h1_cumulative=None))

    def test_yoy_momentum(self):
        from scripts.dart_signals import compute_yoy_earnings_momentum

        self.assertAlmostEqual(compute_yoy_earnings_momentum({"revenue": 120, "op_income": 15}, {"revenue": 100, "op_income": 10}), 0.35)
        self.assertAlmostEqual(compute_yoy_earnings_momentum({"revenue": 110, "op_income": 30}, {"revenue": 100, "op_income": -10}), 2.05)
        self.assertTrue(math.isnan(compute_yoy_earnings_momentum(None, {"revenue": 100, "op_income": 10})))

    def test_determine_target_quarter(self):
        from scripts.dart_signals import determine_target_quarter

        self.assertEqual(determine_target_quarter(date(2026, 2, 15)), (2025, "Q3"))
        self.assertEqual(determine_target_quarter(date(2026, 5, 12)), (2025, "Q4"))
        self.assertEqual(determine_target_quarter(date(2026, 6, 20)), (2026, "Q1"))
        self.assertEqual(determine_target_quarter(date(2026, 10, 1)), (2026, "Q2"))
        self.assertEqual(determine_target_quarter(date(2026, 12, 20)), (2026, "Q3"))


class TestDartFetchFinancial(unittest.TestCase):
    def test_cfs_success_and_ofs_fallback(self):
        from scripts.dart_signals import fetch_financial_with_fallback

        ok = {"status": "000", "list": [{"account_nm": "매출액", "sj_div": "IS", "thstrm_amount": "100"}]}
        with patch("scripts.dart_signals._dart_get", return_value=ok) as m:
            parsed, scope, alias = fetch_financial_with_fallback("00126380", "2024", "11011", "KEY")
            self.assertEqual(scope, "CFS")
            self.assertEqual(parsed["revenue"], 100)
            self.assertEqual(alias, [])
            self.assertEqual(m.call_args.kwargs["fs_div"], "CFS")

        no_data = {"status": "013", "message": "조회된 데이터가 없습니다."}
        with patch("scripts.dart_signals._dart_get", side_effect=[no_data, ok]) as m:
            parsed, scope, _ = fetch_financial_with_fallback("00126380", "2024", "11011", "KEY")
            self.assertEqual(scope, "OFS")
            self.assertEqual(parsed["revenue"], 100)
            self.assertEqual(m.call_args_list[1].kwargs["fs_div"], "OFS")


class TestCacheLayer(unittest.TestCase):
    def _make_client(self, select_data=None):
        client = MagicMock()
        table = MagicMock()
        client.table.return_value = table
        select = MagicMock(); eq1 = MagicMock(); eq2 = MagicMock(); eq3 = MagicMock(); limit = MagicMock()
        table.select.return_value = select
        select.eq.return_value = eq1
        eq1.eq.return_value = eq2
        eq2.eq.return_value = eq3
        eq3.limit.return_value = limit
        limit.execute.return_value = MagicMock(data=select_data or [])
        table.upsert.return_value = table
        table.execute.return_value = MagicMock(data=[{}])
        return client, table

    def test_cache_hit_does_not_call_dart(self):
        from scripts.dart_signals import cache_get_or_fetch_annual

        cached = {**_financial_row(), "corp_code": "00126380", "period_type": "annual", "period_key": "2024", "statement_scope": "CFS", "status": "ok", "calculation_basis": "annual"}
        client, _ = self._make_client([cached])
        with patch("scripts.dart_signals.fetch_financial_with_fallback") as mock_fetch:
            row = cache_get_or_fetch_annual(client, "00126380", 2024, "KEY")
            self.assertEqual(row["revenue"], cached["revenue"])
            mock_fetch.assert_not_called()

    def test_cache_miss_calls_dart_and_inserts(self):
        from scripts.dart_signals import FINANCIAL_KEYS, cache_get_or_fetch_annual

        client, table = self._make_client([])
        parsed = {k: 1.0 for k in FINANCIAL_KEYS}
        with patch("scripts.dart_signals.fetch_financial_with_fallback", return_value=(parsed, "CFS", [])):
            row = cache_get_or_fetch_annual(client, "00126380", 2024, "KEY")
            self.assertEqual(row["status"], "ok")
            self.assertEqual(row["calculation_basis"], "annual")
            table.upsert.assert_called_once()

    def test_quarterly_not_yet_disclosed_and_ttl_refresh(self):
        from scripts.dart_signals import FINANCIAL_KEYS, cache_get_or_fetch_quarterly

        client, _ = self._make_client([])
        with patch("scripts.dart_signals.fetch_financial_with_fallback", return_value=(None, "NONE", [])), \
             patch("scripts.dart_signals._today", return_value=date(2026, 5, 12)):
            row = cache_get_or_fetch_quarterly(client, "X", 2026, "Q1", "KEY")
            self.assertEqual(row["status"], "not_yet_disclosed")

        stale = {"corp_code": "X", "period_type": "quarterly", "period_key": "2026-Q1", "status": "not_yet_disclosed", "statement_scope": "NONE", "fetched_at": "2026-05-01"}
        client, _ = self._make_client([stale])
        parsed = {k: 1.0 for k in FINANCIAL_KEYS}
        with patch("scripts.dart_signals.fetch_financial_with_fallback", return_value=(parsed, "CFS", [])) as mock_fetch, \
             patch("scripts.dart_signals._today", return_value=date(2026, 5, 12)):
            row = cache_get_or_fetch_quarterly(client, "X", 2026, "Q1", "KEY")
            mock_fetch.assert_called_once()
            self.assertEqual(row["status"], "ok")


if __name__ == "__main__":
    unittest.main()
