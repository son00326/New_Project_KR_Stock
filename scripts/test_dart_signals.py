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

    def test_is_accounts_prefer_cumulative_add_amount(self):
        # In a cumulative quarterly report (반기 11012 / 3분기 11014), thstrm_amount is the
        # 3-month figure while thstrm_add_amount is the 당기 누적 (cumulative) figure that
        # compute_standalone_quarter expects. IS/CIS accounts must read the cumulative one.
        from scripts.dart_signals import parse_dart_financial_response

        parsed, _ = parse_dart_financial_response({"status": "000", "list": [
            # IS account: 3-month (thstrm_amount) ≠ cumulative (thstrm_add_amount)
            {"account_nm": "매출액", "sj_div": "IS", "thstrm_amount": "150", "thstrm_add_amount": "440"},
            {"account_nm": "영업이익", "sj_div": "IS", "thstrm_amount": "20", "thstrm_add_amount": "55"},
            # BS account is point-in-time: keep thstrm_amount (add_amount, if any, must be ignored)
            {"account_nm": "자산총계", "sj_div": "BS", "thstrm_amount": "9000", "thstrm_add_amount": "1"},
        ]})
        self.assertEqual(parsed["revenue"], 440)  # cumulative, not 150
        self.assertEqual(parsed["op_income"], 55)  # cumulative, not 20
        self.assertEqual(parsed["total_assets"], 9000)  # BS unchanged

    def test_9m_cumulative_regression(self):
        # 3분기보고서 (9M): thstrm_amount(3mo)=140 must NOT be parsed; cumulative 360 must be.
        from scripts.dart_signals import parse_dart_financial_response

        parsed, _ = parse_dart_financial_response({"status": "000", "list": [
            {"account_nm": "매출액", "sj_div": "IS", "thstrm_amount": "140", "thstrm_add_amount": "360"},
        ]})
        self.assertEqual(parsed["revenue"], 360)

    def test_is_accounts_fall_back_when_add_amount_absent(self):
        # Annual report (11011) has no thstrm_add_amount; Q1 (11013) has add==amount.
        # In both cases the IS account must fall back to thstrm_amount.
        from scripts.dart_signals import parse_dart_financial_response

        annual, _ = parse_dart_financial_response({"status": "000", "list": [
            {"account_nm": "매출액", "sj_div": "IS", "thstrm_amount": "500"},  # no add_amount
        ]})
        self.assertEqual(annual["revenue"], 500)

        q1, _ = parse_dart_financial_response({"status": "000", "list": [
            {"account_nm": "매출액", "sj_div": "IS", "thstrm_amount": "100", "thstrm_add_amount": None},
        ]})
        self.assertEqual(q1["revenue"], 100)  # None add_amount → fall back to thstrm_amount


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


class TestPitAsOfAndCacheOnly(unittest.TestCase):
    """C1 (77차 B++ step-2): PIT as-of date threading + cache-only harvest mode.

    Removes the date.today() look-ahead so historical harvests evaluate disclosure
    status as-of the harvest month, and the harvest reads cache only (no DART HTTP).
    """

    def test_disclosure_window_anchors_to_as_of_not_today(self):
        from scripts.dart_signals import _is_within_disclosure_window

        # Q1 2024 statutory deadline 2024-05-15 + 30D grace = 2024-06-14.
        # As-of 2024-01-15 (before deadline) → still within window (not yet disclosed PIT).
        self.assertTrue(_is_within_disclosure_window(2024, "Q1", as_of_date=date(2024, 1, 15)))
        # As-of 2024-07-01 (after deadline+grace) → disclosed (not within window).
        self.assertFalse(_is_within_disclosure_window(2024, "Q1", as_of_date=date(2024, 7, 1)))
        # No as_of → falls back to _today(); patch to confirm it is the fallback path.
        with patch("scripts.dart_signals._today", return_value=date(2024, 1, 15)):
            self.assertTrue(_is_within_disclosure_window(2024, "Q1"))

    def test_not_yet_disclosed_freshness_anchors_to_as_of(self):
        from scripts.dart_signals import _not_yet_disclosed_is_fresh

        row = {"fetched_at": "2026-05-01"}
        # Historical harvest (as_of 2024): a 2026-cached row must NOT be judged 'stale'
        # relative to a 2024 anchor (no spurious refetch / silent mutation).
        self.assertTrue(_not_yet_disclosed_is_fresh(row, as_of_date=date(2024, 6, 15)))
        # Live (as_of=today 2026-06-12): >7d after fetched_at → stale.
        with patch("scripts.dart_signals._today", return_value=date(2026, 6, 12)):
            self.assertFalse(_not_yet_disclosed_is_fresh(row))

    def _client_empty_cache(self):
        return self._client_with_cache([])

    def _client_with_cache(self, rows):
        client = MagicMock()
        table = MagicMock()
        client.table.return_value = table
        select = MagicMock(); eq1 = MagicMock(); eq2 = MagicMock(); eq3 = MagicMock(); limit = MagicMock()
        table.select.return_value = select
        select.eq.return_value = eq1
        eq1.eq.return_value = eq2
        eq2.eq.return_value = eq3
        eq3.limit.return_value = limit
        limit.execute.return_value = MagicMock(data=rows)
        table.upsert.return_value = table
        table.execute.return_value = MagicMock(data=[{}])
        return client, table

    def test_cache_only_annual_miss_no_http_no_upsert(self):
        from scripts.dart_signals import cache_get_or_fetch_annual

        client, table = self._client_empty_cache()
        with patch("scripts.dart_signals.fetch_financial_with_fallback") as mock_fetch:
            row = cache_get_or_fetch_annual(client, "00126380", 2024, "KEY", cache_only=True)
        mock_fetch.assert_not_called()
        table.upsert.assert_not_called()
        self.assertEqual(row["status"], "no_data")
        self.assertEqual(row["error_code"], "cache_only_miss")

    def test_cache_only_quarterly_miss_no_http_status_pit(self):
        from scripts.dart_signals import cache_get_or_fetch_quarterly

        client, table = self._client_empty_cache()
        with patch("scripts.dart_signals.fetch_financial_with_fallback") as mock_fetch:
            # As-of 2024-01-15: Q1 2024 not yet past deadline+grace → not_yet_disclosed.
            r_pending = cache_get_or_fetch_quarterly(
                client, "X", 2024, "Q1", "KEY", as_of_date=date(2024, 1, 15), cache_only=True)
            # As-of 2024-12-31: Q1 2024 long disclosed but uncached → no_data.
            r_nodata = cache_get_or_fetch_quarterly(
                client, "X", 2024, "Q1", "KEY", as_of_date=date(2024, 12, 31), cache_only=True)
        mock_fetch.assert_not_called()
        table.upsert.assert_not_called()
        self.assertEqual(r_pending["status"], "not_yet_disclosed")
        self.assertEqual(r_nodata["status"], "no_data")

    def test_cache_only_ok_row_after_as_of_is_hidden(self):
        from scripts.dart_signals import cache_get_or_fetch_quarterly

        cached = {
            **_financial_row(),
            "corp_code": "X",
            "period_type": "quarterly",
            "period_key": "2024-Q1",
            "statement_scope": "CFS",
            "status": "ok",
            "calculation_basis": "standalone",
            "rcept_dt": "20240620",
        }
        client, table = self._client_with_cache([cached])
        with patch("scripts.dart_signals.fetch_financial_with_fallback") as mock_fetch:
            hidden = cache_get_or_fetch_quarterly(
                client, "X", 2024, "Q1", "KEY", as_of_date=date(2024, 6, 15), cache_only=True)
        mock_fetch.assert_not_called()
        table.upsert.assert_not_called()
        self.assertEqual(hidden["status"], "no_data")
        self.assertEqual(hidden["error_code"], "cache_only_miss")

    def test_cache_only_ok_row_before_as_of_is_used(self):
        from scripts.dart_signals import cache_get_or_fetch_quarterly

        cached = {
            **_financial_row(),
            "corp_code": "X",
            "period_type": "quarterly",
            "period_key": "2024-Q1",
            "statement_scope": "CFS",
            "status": "ok",
            "calculation_basis": "standalone",
            "rcept_dt": "20240610",
        }
        client, _table = self._client_with_cache([cached])
        with patch("scripts.dart_signals.fetch_financial_with_fallback") as mock_fetch:
            row = cache_get_or_fetch_quarterly(
                client, "X", 2024, "Q1", "KEY", as_of_date=date(2024, 6, 15), cache_only=True)
        mock_fetch.assert_not_called()
        self.assertEqual(row["revenue"], cached["revenue"])

    def test_cache_only_ok_row_without_availability_is_hidden(self):
        from scripts.dart_signals import cache_get_or_fetch_annual

        cached = {
            **_financial_row(),
            "corp_code": "X",
            "period_type": "annual",
            "period_key": "2023",
            "statement_scope": "CFS",
            "status": "ok",
            "calculation_basis": "annual",
        }
        client, table = self._client_with_cache([cached])
        with patch("scripts.dart_signals.fetch_financial_with_fallback") as mock_fetch:
            hidden = cache_get_or_fetch_annual(
                client, "X", 2023, "KEY", as_of_date=date(2024, 6, 15), cache_only=True)
        mock_fetch.assert_not_called()
        table.upsert.assert_not_called()
        self.assertEqual(hidden["status"], "no_data")
        self.assertEqual(hidden["error_code"], "cache_only_miss")

    def test_live_screen_quarterly_ok_hit_without_rcept_is_not_refetched(self):
        # Claude adversarial R1 (Finding 1): the cache-only availability gate must NOT leak into the
        # live screen (cache_only=False). A cached 'ok' quarterly without rcept_dt must stay a cache
        # HIT — otherwise the monthly screen re-fetches + re-upserts every quarterly.
        from scripts.dart_signals import cache_get_or_fetch_quarterly

        cached = {**_financial_row(), "corp_code": "X", "period_type": "quarterly",
                  "period_key": "2024-Q1", "statement_scope": "CFS", "status": "ok",
                  "calculation_basis": "standalone"}  # no rcept_dt
        client, table = self._client_empty_cache()
        client.table.return_value.select.return_value.eq.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(data=[cached])
        with patch("scripts.dart_signals.fetch_financial_with_fallback") as mock_fetch:
            row = cache_get_or_fetch_quarterly(
                client, "X", 2024, "Q1", "KEY", as_of_date=date(2025, 6, 15), cache_only=False)
        mock_fetch.assert_not_called()  # live screen: cache hit, no re-fetch
        table.upsert.assert_not_called()
        self.assertEqual(row["revenue"], cached["revenue"])

    def test_fetch_dart_signals_cache_only_never_calls_http(self):
        from scripts.dart_signals import fetch_dart_signals

        client, table = self._client_empty_cache()
        with patch("scripts.dart_signals._lookup_corp_code", return_value="00126380"), \
             patch("scripts.dart_signals.fetch_financial_with_fallback") as mock_fetch:
            result = fetch_dart_signals(
                client, "005930", date(2024, 6, 15), "KEY", as_of_date=date(2024, 6, 15), cache_only=True)
        mock_fetch.assert_not_called()
        table.upsert.assert_not_called()
        # All caches miss → structural-missing: earnings unresolved (0.0/NaN), quality insufficient.
        self.assertTrue(result.quality_insufficient)


if __name__ == "__main__":
    unittest.main()
