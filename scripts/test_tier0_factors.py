"""Unittest for scripts/tier0_factors.py — Tier 0 B++ 순수 팩터/사이징/정규화 (D30, 77차).

SoT: docs/superpowers/specs/2026-06-12-tier0-scoring-bplus-validation.md
hand-computed expected values로 §3A~3D + §4 Gate B 핵심 수식을 고정한다.
"""
from __future__ import annotations

import math
import unittest

import tier0_factors as F


class TestQuantileWinsorize(unittest.TestCase):
    def test_quantile_linear_median(self):
        self.assertAlmostEqual(F.quantile([1, 2, 3, 4], 0.5), 2.5)

    def test_quantile_edges(self):
        self.assertEqual(F.quantile([5, 10, 15], 0.0), 5)
        self.assertEqual(F.quantile([5, 10, 15], 1.0), 15)

    def test_quantile_empty(self):
        self.assertTrue(math.isnan(F.quantile([], 0.5)))

    def test_winsorize_clamps_outlier(self):
        vals = [1, 2, 3, 4, 5, 6, 7, 8, 9, 1000]
        out = F.winsorize(vals, 0.01, 0.99)
        # hand: hi_v=quantile(present,0.99)=910.81, lo_v=quantile(0.01)=1.09
        self.assertAlmostEqual(max(out), 910.81, places=2)
        self.assertAlmostEqual(min(out), 1.09, places=2)

    def test_winsorize_passes_nan(self):
        out = F.winsorize([1.0, 2.0, math.nan, 4.0])
        self.assertTrue(math.isnan(out[2]))

    def test_winsorize_short_input_untouched(self):
        self.assertEqual(F.winsorize([5.0]), [5.0])


class TestPercentileRank(unittest.TestCase):
    def test_basic(self):
        out = F.percentile_rank([10, 20, 30, 40])
        self.assertEqual(out, [12.5, 37.5, 62.5, 87.5])

    def test_nan_excluded(self):
        out = F.percentile_rank([10, math.nan, 30])
        self.assertEqual(out[0], 25.0)
        self.assertTrue(math.isnan(out[1]))
        self.assertEqual(out[2], 75.0)

    def test_ties_average_rank(self):
        out = F.percentile_rank([5, 5, 10])
        self.assertAlmostEqual(out[0], 100.0 / 3.0, places=4)
        self.assertAlmostEqual(out[1], 100.0 / 3.0, places=4)
        self.assertAlmostEqual(out[2], 250.0 / 3.0, places=4)

    def test_single_value_neutral(self):
        self.assertEqual(F.percentile_rank([42.0]), [50.0])

    def test_all_nan(self):
        out = F.percentile_rank([math.nan, math.nan])
        self.assertTrue(all(math.isnan(v) for v in out))


class TestSignedLog(unittest.TestCase):
    def test_zero(self):
        self.assertEqual(F.signed_log(0.0), 0.0)

    def test_sign_preserved(self):
        self.assertAlmostEqual(F.signed_log(math.e - 1), 1.0, places=6)
        self.assertAlmostEqual(F.signed_log(-(math.e - 1)), -1.0, places=6)

    def test_nan_passthrough(self):
        self.assertTrue(math.isnan(F.signed_log(math.nan)))


class TestTrend(unittest.TestCase):
    def test_risk_adjusted_trend_exact(self):
        # closes=[100,101,100,102], lookback=3, skip=0 → cum=0.02, sigma≈0.012428 → ≈1.609
        val = F.risk_adjusted_trend([100, 101, 100, 102], lookback=3, skip=0)
        self.assertAlmostEqual(val, 1.609, places=2)

    def test_insufficient_data_nan(self):
        self.assertTrue(math.isnan(F.risk_adjusted_trend([100, 101], lookback=3, skip=0)))

    def test_flat_series_zero_sigma_nan(self):
        # 정확히 변동 없는 시계열 → 일간수익률 σ=0 → NaN (분모 보호)
        self.assertTrue(math.isnan(F.risk_adjusted_trend([100, 100, 100, 100], lookback=3, skip=0)))

    def test_skip_excludes_recent(self):
        # skip=1 이면 마지막 가격 제외 — 결과가 skip=0과 달라야 한다
        series = [100, 101, 100, 102, 130]
        v0 = F.risk_adjusted_trend(series, lookback=3, skip=0)
        v1 = F.risk_adjusted_trend(series, lookback=3, skip=1)
        self.assertFalse(math.isclose(v0, v1))

    def test_high_proximity(self):
        self.assertAlmostEqual(F.high_proximity([10, 20, 15]), 0.75)

    def test_high_proximity_at_high(self):
        self.assertAlmostEqual(F.high_proximity([10, 20, 20]), 1.0)

    def test_recent_return(self):
        self.assertAlmostEqual(F.recent_return([100, 110], window=1), 0.1)
        self.assertTrue(math.isnan(F.recent_return([100], window=1)))


class TestLiquidity(unittest.TestCase):
    def test_adv60_median(self):
        self.assertEqual(F.adv60([1, 2, 3, 4, 5], window=5), 3)

    def test_adv60_empty_nan(self):
        self.assertTrue(math.isnan(F.adv60([])))

    def test_turnover60(self):
        self.assertAlmostEqual(F.turnover60([2, 2, 2], market_cap=10.0, window=3), 0.2)

    def test_turnover60_bad_mcap(self):
        self.assertTrue(math.isnan(F.turnover60([2, 2], market_cap=0)))

    def test_floor_pass(self):
        self.assertTrue(F.liquidity_floor_pass(3e9, 2e9))
        self.assertFalse(F.liquidity_floor_pass(1e9, 2e9))
        self.assertFalse(F.liquidity_floor_pass(math.nan))

    def test_anti_pump_penalty(self):
        # 고회전(turnover pct 99.5) + 단기 급등(5D +50%) → penalty > 0
        p = F.anti_pump_penalty(99.5, 0.50)
        self.assertGreater(p, 5.0)
        # 정상(회전 50, 급등 없음) → 0
        self.assertEqual(F.anti_pump_penalty(50.0, 0.02), 0.0)


class TestSizeSleeve(unittest.TestCase):
    def test_breakpoints(self):
        large_cut, mid_cut = F.size_breakpoints(list(range(1, 11)))
        self.assertAlmostEqual(large_cut, 8.2)
        self.assertAlmostEqual(mid_cut, 4.6)

    def test_size_tier(self):
        self.assertEqual(F.size_tier(10, 8.2, 4.6), "large")
        self.assertEqual(F.size_tier(5, 8.2, 4.6), "mid")
        self.assertEqual(F.size_tier(2, 8.2, 4.6), "small")

    def test_size_tier_missing_is_small(self):
        self.assertEqual(F.size_tier(math.nan, 8.2, 4.6), "small")

    def test_select_size_sleeves_basic(self):
        tickers = ["A", "B", "C", "D", "E", "F"]
        scores = [90, 80, 70, 60, 50, 40]
        sleeves = ["large", "large", "mid", "mid", "small", "small"]
        picked = F.select_size_sleeves(
            tickers, scores, sleeves, quota={"large": 1, "mid": 1, "small": 1}
        )
        self.assertEqual(picked, ["A", "C", "E"])

    def test_select_size_sleeves_backfill(self):
        # large 쿼터 2지만 large 1개뿐 → backfill로 다음 score 종목 충원
        tickers = ["A", "B", "C"]
        scores = [90, 80, 70]
        sleeves = ["large", "mid", "small"]
        picked = F.select_size_sleeves(
            tickers, scores, sleeves, quota={"large": 2, "mid": 0, "small": 0}, backfill=True
        )
        self.assertEqual(len(picked), 2)
        self.assertIn("A", picked)

    def test_select_size_sleeves_shortfall_raises(self):
        with self.assertRaises(F.SleeveShortfallError):
            F.select_size_sleeves(
                ["A"], [90], ["large"],
                quota={"large": 1, "mid": 1, "small": 0}, backfill=False,
            )

    def test_select_size_sleeves_exclude(self):
        tickers = ["A", "B"]
        scores = [90, 80]
        sleeves = ["large", "large"]
        picked = F.select_size_sleeves(
            tickers, scores, sleeves, quota={"large": 1, "mid": 0, "small": 0},
            exclude={"A"},
        )
        self.assertEqual(picked, ["B"])


class TestSectorRelativeAndMissing(unittest.TestCase):
    def test_within_group_rank(self):
        out = F.within_group_percentile_rank([10, 20, 30, 40], ["a", "a", "b", "b"])
        self.assertEqual(out, [25.0, 75.0, 25.0, 75.0])

    def test_within_group_size_one_neutral(self):
        out = F.within_group_percentile_rank([99.0], ["solo"])
        self.assertEqual(out, [50.0])

    def test_fill_missing_structural_vs_failure(self):
        out = F.fill_missing_rank([50.0, math.nan, math.nan], failure_mask=[False, False, True])
        self.assertEqual(out, [50.0, F.MISSING_STRUCTURAL_SCORE, F.MISSING_FAILURE_SCORE])

    def test_fill_missing_no_mask_is_structural(self):
        out = F.fill_missing_rank([math.nan])
        self.assertEqual(out, [F.MISSING_STRUCTURAL_SCORE])


class TestForeignAndEnsemble(unittest.TestCase):
    def test_foreign_adv_normalized(self):
        self.assertAlmostEqual(F.foreign_adv_normalized(1e9, 5e8), 2.0)

    def test_foreign_adv_bad(self):
        self.assertTrue(math.isnan(F.foreign_adv_normalized(1e9, 0)))

    def test_rank_ensemble(self):
        self.assertAlmostEqual(
            F.rank_ensemble_score({"a": 60, "b": 40}, volume_bonus=5, penalty=2), 53.0
        )

    def test_rank_ensemble_bonus_capped(self):
        # bonus 99 → cap 10
        self.assertAlmostEqual(
            F.rank_ensemble_score({"a": 50}, volume_bonus=99, penalty=0), 60.0
        )

    def test_rank_ensemble_all_missing(self):
        self.assertTrue(math.isnan(F.rank_ensemble_score({"a": math.nan})))

    def test_capped_volume_bonus_confirms_trend(self):
        self.assertAlmostEqual(F.capped_volume_bonus(80, 70), 6.0)

    def test_capped_volume_bonus_no_trend(self):
        self.assertEqual(F.capped_volume_bonus(80, 40), 0.0)

    def test_capped_volume_bonus_negative_clamped(self):
        # 추세 확인(70≥50)이나 거래 미동반(vol 30<50) → 음수 대신 0 (source clamp)
        self.assertEqual(F.capped_volume_bonus(30, 70), 0.0)

    def test_capped_volume_bonus_long_zero(self):
        self.assertEqual(F.capped_volume_bonus(80, 70, long_bucket=True), 0.0)


class TestCorrelationAndIC(unittest.TestCase):
    def test_pairwise_correlation_perfect(self):
        corr = F.pairwise_correlation({"x": [1, 2, 3, 4], "y": [2, 4, 6, 8]})
        self.assertAlmostEqual(corr[("x", "y")], 1.0)

    def test_spearman_ic_perfect_positive(self):
        self.assertAlmostEqual(F.spearman_ic([1, 2, 3, 4], [10, 20, 30, 40]), 1.0)

    def test_spearman_ic_perfect_negative(self):
        self.assertAlmostEqual(F.spearman_ic([1, 2, 3, 4], [40, 30, 20, 10]), -1.0)

    def test_spearman_ic_too_few(self):
        self.assertTrue(math.isnan(F.spearman_ic([1, 2], [3, 4])))

    def test_spearman_ic_monotonic_nonlinear(self):
        # 비선형이지만 단조증가 → Spearman 1.0 (rank 기반)
        self.assertAlmostEqual(F.spearman_ic([1, 2, 3, 4], [1, 4, 9, 16]), 1.0)


def _series(n, drift, wiggle=0.01, phase=0.0, start=100.0):
    """결정론 합성 종가: 곱셈 drift + 공통 wiggle(비-0 σ 보장). 오름차순."""
    return [start * ((1 + drift) ** t) * (1.0 + wiggle * math.sin(t * 0.7 + phase)) for t in range(n)]


class TestScoreBppUniverse(unittest.TestCase):
    N = 300  # long lookback(252)+skip(21)+1 충족

    def _raw(self, ticker, mcap, drift, adv=5e9, sector="제조", **kw):
        closes = _series(self.N, drift, phase=kw.pop("phase", 0.0))
        return F.StockRaw(
            ticker=ticker, sector=sector, market_cap=mcap,
            closes=closes, trdvals=[adv] * self.N, highs=closes,
            foreign_net_60d=kw.pop("foreign", 1e9),
            earnings_raw=kw.pop("earnings", 0.1),
            quality_composite_raw=kw.pop("quality", 0.1),
            **kw,
        )

    def test_liquidity_floor_excludes_low_adv(self):
        stocks = [
            self._raw("HIGH", 5e12, 0.002, adv=5e9),
            self._raw("LOWADV", 5e12, 0.002, adv=1e8),  # ADV 1e8 < 2e9 floor
        ]
        scored = {s.ticker: s for s in F.score_bpp_universe(stocks, "short")}
        self.assertTrue(scored["HIGH"].eligible)
        self.assertFalse(scored["LOWADV"].eligible)
        self.assertTrue(math.isnan(scored["LOWADV"].score))

    def test_adv60_requires_half_window_coverage(self):
        self.assertTrue(math.isnan(F.adv60([5e9] * 29)))
        self.assertEqual(F.adv60([5e9] * 30), 5e9)

    def test_missing_primary_trend_makes_stock_ineligible(self):
        stocks = [
            self._raw("FULL1", 5e12, 0.002),
            self._raw("FULL2", 4e12, 0.0015),
            F.StockRaw(
                ticker="SHORT",
                sector="제조",
                market_cap=3e12,
                closes=_series(30, 0.003),
                trdvals=[5e9] * 60,
                highs=_series(30, 0.003),
                foreign_net_60d=1e9,
                earnings_raw=0.5,
                quality_composite_raw=0.5,
            ),
        ]
        scored = {s.ticker: s for s in F.score_bpp_universe(stocks, "short")}
        self.assertFalse(scored["SHORT"].eligible)
        self.assertTrue(math.isnan(scored["SHORT"].score))

    def test_size_sleeve_distribution(self):
        stocks = [self._raw(f"T{k}", float(k) * 1e12, 0.001) for k in range(1, 11)]
        scored = {s.ticker: s for s in F.score_bpp_universe(stocks, "mid")}
        large = [t for t, s in scored.items() if s.sleeve == "large"]
        mid = [t for t, s in scored.items() if s.sleeve == "mid"]
        small = [t for t, s in scored.items() if s.sleeve == "small"]
        self.assertEqual((len(large), len(mid), len(small)), (2, 4, 4))
        self.assertIn("T10", large)
        self.assertIn("T1", small)

    def test_trend_monotonic_in_score(self):
        # 동일 mcap(같은 sleeve)·동일 펀더멘털, drift만 다름 → 높은 추세가 높은 trend rank
        stocks = [
            self._raw("STRONG", 1e12, 0.004),
            self._raw("WEAK", 1e12, 0.0005),
            self._raw("MID1", 1e12, 0.002),
        ]
        scored = {s.ticker: s for s in F.score_bpp_universe(stocks, "long")}
        self.assertGreater(scored["STRONG"].factor_ranks["trend"], scored["WEAK"].factor_ranks["trend"])

    def test_long_bucket_no_volume_bonus(self):
        stocks = [self._raw(f"T{k}", 1e12, 0.002) for k in range(5)]
        scored = F.score_bpp_universe(stocks, "long")
        self.assertTrue(all(s.volume_bonus == 0.0 for s in scored))

    def test_missing_earnings_structural_neutral(self):
        stocks = [
            self._raw("A", 1e12, 0.002, earnings=0.1),
            self._raw("B", 1e12, 0.002, earnings=0.2),
            self._raw("MISS", 1e12, 0.002, earnings=math.nan),  # 구조적 결측
        ]
        scored = {s.ticker: s for s in F.score_bpp_universe(stocks, "mid")}
        self.assertEqual(scored["MISS"].factor_ranks["earnings"], F.MISSING_STRUCTURAL_SCORE)

    def test_missing_earnings_fetch_failure_penalty(self):
        stocks = [
            self._raw("A", 1e12, 0.002, earnings=0.1),
            self._raw("B", 1e12, 0.002, earnings=0.2),
            self._raw("FAIL", 1e12, 0.002, earnings=math.nan, earnings_fetch_failed=True),
        ]
        scored = {s.ticker: s for s in F.score_bpp_universe(stocks, "mid")}
        self.assertEqual(scored["FAIL"].factor_ranks["earnings"], F.MISSING_FAILURE_SCORE)

    def test_eligible_scores_finite(self):
        stocks = [self._raw(f"T{k}", float(k) * 1e12, 0.001 + 0.0003 * k) for k in range(1, 8)]
        scored = F.score_bpp_universe(stocks, "short")
        for s in scored:
            if s.eligible:
                self.assertFalse(math.isnan(s.score), f"{s.ticker} eligible but NaN score")


if __name__ == "__main__":
    unittest.main()
