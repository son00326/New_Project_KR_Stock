"""Unit tests for (D) tier0_chart — pure indicators (PIT no-leak, warm-up→neutral-50, composite).

SoT: docs/superpowers/2026-06-18-tier0-chart-technical.md
"""
from __future__ import annotations

import math
import sys
import unittest
from pathlib import Path

_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(_DIR))
import tier0_factors as F  # noqa: E402
import tier0_chart as C  # noqa: E402


def _mk(tk, cap, closes, highs=None, trdvals=None, sector="제조"):
    n = len(closes)
    return F.StockRaw(
        ticker=tk, sector=sector, market_cap=cap, closes=list(closes),
        trdvals=list(trdvals) if trdvals is not None else [5e9] * n,
        highs=list(highs) if highs is not None else None,
    )


def _eligible_universe(n_days=300, n=14):
    """Rising-price, fat-ADV, distinct-mcap universe eligible on the liquidity floor."""
    base = [100.0 * (1.0015 ** i) for i in range(n_days)]
    out = []
    for j in range(n):
        cl = [c * (1 + 0.02 * j) for c in base]
        out.append(_mk(f"T{j:02d}", 1e12 * (j + 1), cl))
    return out


# ============================================================================
# sma / ema
# ============================================================================

class TestMovingAverages(unittest.TestCase):
    def test_sma_basic(self):
        self.assertAlmostEqual(C.sma([1, 2, 3, 4, 5], 5), 3.0)

    def test_sma_warmup_nan(self):
        self.assertTrue(math.isnan(C.sma([1, 2, 3], 5)))

    def test_ema_seeded_with_sma(self):
        vals = list(range(1, 11))
        e = C.ema_series(vals, 5)
        self.assertTrue(math.isnan(e[3]))
        self.assertAlmostEqual(e[4], 3.0)  # SMA(1..5)
        self.assertGreater(e[9], e[4])     # rising series → EMA rises

    def test_ema_warmup_all_nan(self):
        self.assertTrue(all(math.isnan(v) for v in C.ema_series([1, 2], 5)))


# ============================================================================
# Wilder RSI
# ============================================================================

class TestRSI(unittest.TestCase):
    def test_all_gains_is_100(self):
        closes = [100.0 + i for i in range(30)]
        self.assertAlmostEqual(C.wilder_rsi(closes), 100.0)

    def test_all_losses_is_0(self):
        closes = [100.0 - i for i in range(30)]
        self.assertAlmostEqual(C.wilder_rsi(closes), 0.0)

    def test_warmup_nan(self):
        self.assertTrue(math.isnan(C.wilder_rsi([100.0] * 10)))

    def test_mid_range(self):
        # alternating ±1 → roughly balanced → RSI near 50.
        closes = [100.0 + (1 if i % 2 == 0 else -1) for i in range(40)]
        r = C.wilder_rsi(closes)
        self.assertTrue(0 < r < 100)


# ============================================================================
# MACD
# ============================================================================

class TestMACD(unittest.TestCase):
    def test_warmup_nan(self):
        self.assertTrue(math.isnan(C.macd_histogram([100.0] * 30)))

    def test_uptrend_positive_histogram(self):
        closes = [100.0 * (1.01 ** i) for i in range(80)]
        self.assertGreater(C.macd_histogram(closes), 0.0)

    def test_downtrend_negative_histogram(self):
        closes = [200.0 * (0.99 ** i) for i in range(80)]
        # downtrend → histogram should be <= cross_bonus; with no cross-up it is negative.
        self.assertLess(C.macd_histogram(closes), 1.0)


# ============================================================================
# MA alignment + golden-cross recency
# ============================================================================

class TestMAAlignment(unittest.TestCase):
    def test_perfect_uptrend_is_3(self):
        closes = [100.0 * (1.002 ** i) for i in range(200)]
        self.assertEqual(C.ma_alignment_score(closes), 3.0)

    def test_perfect_downtrend_is_0(self):
        closes = [300.0 * (0.998 ** i) for i in range(200)]
        self.assertEqual(C.ma_alignment_score(closes), 0.0)

    def test_warmup_nan(self):
        self.assertTrue(math.isnan(C.ma_alignment_score([100.0] * 100)))


class TestGoldenCrossRecency(unittest.TestCase):
    def test_warmup_nan(self):
        self.assertTrue(math.isnan(C.gc_recency_score([100.0] * 40)))

    def test_no_recent_cross_is_zero(self):
        # steady uptrend the whole way: MA20 already above MA60 → no fresh cross inside window.
        closes = [100.0 * (1.002 ** i) for i in range(200)]
        self.assertEqual(C.gc_recency_score(closes), 0.0)

    def test_fresh_cross_positive(self):
        # downtrend then sharp uptrend → MA20 crosses above MA60 recently.
        down = [200.0 * (0.99 ** i) for i in range(120)]
        up = [down[-1] * (1.03 ** i) for i in range(1, 30)]
        closes = down + up
        self.assertGreater(C.gc_recency_score(closes), 0.0)


# ============================================================================
# Bollinger
# ============================================================================

class TestBollinger(unittest.TestCase):
    def test_warmup_nan(self):
        self.assertTrue(math.isnan(C.bollinger_composite([100.0] * 10)))

    def test_uptrend_above_downtrend(self):
        up = [100.0 * (1.01 ** i) for i in range(60)]
        down = [200.0 * (0.99 ** i) for i in range(60)]
        vu = C.bollinger_composite(up)
        vd = C.bollinger_composite(down)
        self.assertFalse(math.isnan(vu))
        self.assertFalse(math.isnan(vd))
        # uptrend rides the upper band (high %b) → strictly more bullish than the downtrend.
        self.assertGreater(vu, vd)


# ============================================================================
# Donchian breakout — PIT no-look-ahead (t excluded from trailing high)
# ============================================================================

class TestDonchianPIT(unittest.TestCase):
    def test_breakout_excludes_t_from_trailing_high(self):
        # t-N..t-1 all 100; t = 105 breaks out. Trailing high (excl t) = 100 → 1.0.
        highs = [100.0] * 21
        closes = [99.0] * 20 + [105.0]
        self.assertEqual(C.donchian_breakout(closes, highs, n=20), 1.0)

    def test_t_high_does_not_count_as_its_own_breakout(self):
        # If t's OWN high were (wrongly) included, close 99 < high 200 at t would never be 1.0,
        # but also the trailing max must be 100 (not 200). close 150 > trailing-100 → breakout 1.0.
        highs = [100.0] * 20 + [200.0]  # t's high is a huge spike
        closes = [99.0] * 20 + [150.0]
        # trailing high EXCLUDING t = max(highs[-21:-1]) = 100 → 150 > 100 → 1.0 (t's 200 ignored)
        self.assertEqual(C.donchian_breakout(closes, highs, n=20), 1.0)

    def test_proximity_when_below(self):
        highs = [100.0] * 21
        closes = [99.0] * 20 + [80.0]
        self.assertAlmostEqual(C.donchian_breakout(closes, highs, n=20), 0.8)

    def test_warmup_nan(self):
        self.assertTrue(math.isnan(C.donchian_breakout([100.0] * 5, [100.0] * 5, n=20)))


# ============================================================================
# Volume-confirmed breakout — gating + PIT (trailing avg excludes t)
# ============================================================================

class TestVolConfirm(unittest.TestCase):
    def test_confirmed_keeps_full_strength(self):
        highs = [100.0] * 61
        closes = [99.0] * 60 + [110.0]
        trdvals = [1e9] * 60 + [5e9]  # t volume 5x trailing → confirmed
        self.assertEqual(C.vol_confirmed_breakout(closes, highs, trdvals, n=20), 1.0)

    def test_trailing_volume_average_excludes_t(self):
        highs = [100.0] * 61
        closes = [99.0] * 60 + [110.0]
        trdvals = [1e9] * 60 + [1.505e9]
        self.assertEqual(C.vol_confirmed_breakout(closes, highs, trdvals, n=20), 1.0)

    def test_unconfirmed_damped(self):
        highs = [100.0] * 61
        closes = [99.0] * 60 + [110.0]
        trdvals = [1e9] * 61  # t volume == trailing avg → NOT confirmed
        self.assertAlmostEqual(C.vol_confirmed_breakout(closes, highs, trdvals, n=20),
                               1.0 * C.VOL_UNCONFIRMED_DAMP)

    def test_warmup_nan(self):
        self.assertTrue(math.isnan(C.vol_confirmed_breakout([99.0] * 21, [100.0] * 21, [1e9] * 21, n=20)))


# ============================================================================
# ATR contraction proxy
# ============================================================================

class TestATRContraction(unittest.TestCase):
    def test_warmup_nan(self):
        self.assertTrue(math.isnan(C.atr_contraction_proxy([100.0] * 40)))

    def test_contracting_vol_positive(self):
        # high vol early, low vol recently → fast stdev < slow stdev → contraction > 0.
        import random
        random.seed(7)
        early = [100.0 * (1 + random.uniform(-0.05, 0.05)) for _ in range(60)]
        recent = [early[-1] * (1 + random.uniform(-0.002, 0.002)) for _ in range(40)]
        closes = early + recent
        self.assertGreater(C.atr_contraction_proxy(closes), 0.0)


# ============================================================================
# Composite scorer — eligibility, warm-up→neutral-50, determinism
# ============================================================================

class TestComposite(unittest.TestCase):
    def test_eligible_universe_scores_present(self):
        stocks = _eligible_universe()
        scored = C.score_chart_universe(stocks, "short")
        elig = [s for s in scored if s.eligible]
        self.assertTrue(len(elig) >= 10)
        for s in elig:
            self.assertFalse(math.isnan(s.score))
            self.assertEqual(set(s.factor_ranks), set(C.SUB_INDICATORS))

    def test_warmup_ticker_retained_at_neutral(self):
        # One ticker with only 130 bars: macd/bollinger/donchian present but some indicators
        # (none here actually warm-up since 130>121) — use a 125-bar ticker mixed with full ones.
        stocks = _eligible_universe(n_days=300, n=12)
        # add a short-history ticker (only 130 bars) — ma_align needs 121, gc needs 61, atr needs 61
        short_closes = [100.0 * (1.002 ** i) for i in range(130)]
        stocks.append(_mk("SHORT1", 5e12, short_closes))
        scored = C.score_chart_universe(stocks, "short")
        by_t = {s.ticker: s for s in scored}
        self.assertIn("SHORT1", by_t)
        # row retained & eligible (130 bars > all warm-ups) — composite present, NOT dropped.
        self.assertTrue(by_t["SHORT1"].eligible)
        self.assertFalse(math.isnan(by_t["SHORT1"].score))

    def test_warmup_neutral_50_for_missing_subindicator(self):
        # ticker with only 70 bars: ma_align (needs 121) warm-up → that sub-rank neutral-50,
        # row still retained (NOT dropped), composite present.
        stocks = _eligible_universe(n_days=300, n=12)
        seventy = [100.0 * (1.002 ** i) for i in range(70)]
        stocks.append(_mk("WARM1", 5e12, seventy))
        scored = C.score_chart_universe(stocks, "short")
        by_t = {s.ticker: s for s in scored}
        w = by_t["WARM1"]
        self.assertTrue(w.eligible)
        self.assertFalse(math.isnan(w.score))
        # ma_align warm-up (70 < 121) → neutral-50.
        self.assertAlmostEqual(w.factor_ranks["ma_align"], C.CHART_WARMUP_NEUTRAL)

    def test_missing_high_dependent_indicators_are_neutral(self):
        stocks = _eligible_universe(n_days=300, n=12)
        no_high = _mk("NOHIGH", 5e12, [100.0 * (1.002 ** i) for i in range(300)], highs=None)
        stocks.append(no_high)
        scored = C.score_chart_universe(stocks, "short")
        by_t = {s.ticker: s for s in scored}
        self.assertTrue(by_t["NOHIGH"].eligible)
        self.assertAlmostEqual(by_t["NOHIGH"].factor_ranks["donchian"], C.CHART_WARMUP_NEUTRAL)
        self.assertAlmostEqual(by_t["NOHIGH"].factor_ranks["vol_confirm"], C.CHART_WARMUP_NEUTRAL)

    def test_frozen_indicator_params(self):
        self.assertEqual(C.SUB_INDICATORS, (
            "ma_align", "gc_recency", "rsi", "macd", "bollinger",
            "donchian", "vol_confirm", "atr_contraction",
        ))
        self.assertEqual(C.MA_PERIODS, (20, 60, 120))
        self.assertEqual((C.RSI_PERIOD, C.MACD_FAST, C.MACD_SLOW, C.MACD_SIGNAL), (14, 12, 26, 9))
        self.assertEqual((C.BB_PERIOD, C.BB_K, C.DONCHIAN_N), (20, 2.0, 20))
        self.assertEqual((C.VOL_AVG_WINDOW, C.VOL_CONFIRM_MULT), (60, 1.5))

    def test_determinism_two_runs_identical(self):
        stocks = _eligible_universe()
        a = C.score_chart_universe(stocks, "mid")
        b = C.score_chart_universe(stocks, "mid")
        self.assertEqual([(s.ticker, s.score, s.sleeve) for s in a],
                         [(s.ticker, s.score, s.sleeve) for s in b])

    def test_illiquid_excluded(self):
        stocks = _eligible_universe(n=10)
        illiquid = _mk("ILQ1", 1e12, [100.0 * (1.002 ** i) for i in range(300)], trdvals=[1.0] * 300)
        stocks.append(illiquid)
        scored = C.score_chart_universe(stocks, "short")
        by_t = {s.ticker: s for s in scored}
        self.assertFalse(by_t["ILQ1"].eligible)
        self.assertTrue(math.isnan(by_t["ILQ1"].score))


if __name__ == "__main__":
    unittest.main()
