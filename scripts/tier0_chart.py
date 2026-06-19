#!/usr/bin/env python3
"""(D) CHART/TECHNICAL-INDICATOR COMPOSITE — pure PIT-safe indicators + equal-rank selector.

SoT: docs/superpowers/2026-06-18-tier0-chart-technical.md (pre-registered, frozen before run).

EXPLORATORY / diagnostic-only. OHLCV-only (close + high + trdval) from the PIT cache, cost 0.
This module is a STANDALONE read-only consumer of tier0_factors (F.*). It does NOT edit
tier0_factors.py — the chart indicators are NOT added as a with_chart param to score_bpp_universe.
score_chart_universe returns ScoredStock-shaped output so it drops into F.select_size_sleeves + the
(가) pooled-top-N truncation without touching the frozen scorer.

FROZEN params (SoT §2) — no mining, no grid, no per-indicator weights, equal-rank ensemble.
"""
from __future__ import annotations

import math
from typing import Optional, Sequence

import tier0_factors as F

# ============================================================================
# FROZEN parameters (SoT §2 — pre-registered, no mining)
# ============================================================================
MA_PERIODS: tuple[int, int, int] = (20, 60, 120)
GC_RECENCY_WINDOW = 20          # MA20×MA60 golden-cross recency window (trading days)
RSI_PERIOD = 14                 # Wilder RSI
MACD_FAST, MACD_SLOW, MACD_SIGNAL = 12, 26, 9
BB_PERIOD = 20
BB_K = 2.0
DONCHIAN_N = 20
VOL_AVG_WINDOW = 60
VOL_CONFIRM_MULT = 1.5
VOL_UNCONFIRMED_DAMP = 0.5      # breakout strength multiplier when volume is NOT confirmed
ATR_CONTRACTION_FAST = 20
ATR_CONTRACTION_SLOW = 60
CHART_WARMUP_NEUTRAL = F.MISSING_STRUCTURAL_SCORE  # 50.0 — warm-up → neutral-50 (NOT dropped)

# Sub-indicator order is fixed (deterministic composite + diagnostics labels).
SUB_INDICATORS: tuple[str, ...] = (
    "ma_align", "gc_recency", "rsi", "macd", "bollinger",
    "donchian", "vol_confirm", "atr_contraction",
)


# ============================================================================
# Pure helpers (close-only / high-only / trdval-only; ascending series ending at t)
# ============================================================================

def sma(closes: Sequence[float], period: int) -> float:
    """Simple moving average of the last `period` closes. < period bars → NaN."""
    if len(closes) < period or period <= 0:
        return math.nan
    tail = closes[-period:]
    if any(F._is_nan(c) for c in tail):
        return math.nan
    return sum(tail) / period


def sma_series(closes: Sequence[float], period: int) -> list[float]:
    """Trailing SMA at each bar i (i >= period-1), else NaN. Length == len(closes)."""
    n = len(closes)
    out = [math.nan] * n
    if period <= 0:
        return out
    for i in range(period - 1, n):
        win = closes[i - period + 1 : i + 1]
        if any(F._is_nan(c) for c in win):
            continue
        out[i] = sum(win) / period
    return out


def ema_series(values: Sequence[float], period: int) -> list[float]:
    """EMA series seeded with the SMA of the first `period` PRESENT values. < period present → all-NaN.

    Leading NaNs are skipped: the EMA is seeded from the first run of `period` consecutive present
    values (so an EMA of MACD-line — which has leading NaNs from its own slow EMA — still computes).
    A NaN gap AFTER the seed stops the series (conservative).
    """
    n = len(values)
    out = [math.nan] * n
    if period <= 0:
        return out
    # find the first index where a run of `period` consecutive present values begins.
    start = -1
    for i in range(n - period + 1):
        if all(not F._is_nan(values[j]) for j in range(i, i + period)):
            start = i
            break
    if start < 0:
        return out
    alpha = 2.0 / (period + 1.0)
    prev = sum(values[start : start + period]) / period
    out[start + period - 1] = prev
    for i in range(start + period, n):
        v = values[i]
        if F._is_nan(v):
            return out  # stop on first gap after the seed (conservative)
        prev = alpha * v + (1.0 - alpha) * prev
        out[i] = prev
    return out


def wilder_rsi(closes: Sequence[float], period: int = RSI_PERIOD) -> float:
    """Wilder RSI on closes. < period+1 bars → NaN. All-gains → 100, all-losses → 0."""
    if len(closes) < period + 1:
        return math.nan
    deltas = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
    if any(F._is_nan(d) for d in deltas):
        return math.nan
    seed = deltas[:period]
    avg_gain = sum(d for d in seed if d > 0) / period
    avg_loss = sum(-d for d in seed if d < 0) / period
    for d in deltas[period:]:
        gain = d if d > 0 else 0.0
        loss = -d if d < 0 else 0.0
        avg_gain = (avg_gain * (period - 1) + gain) / period
        avg_loss = (avg_loss * (period - 1) + loss) / period
    if avg_loss == 0.0:
        return 100.0 if avg_gain > 0 else 50.0
    rs = avg_gain / avg_loss
    return 100.0 - (100.0 / (1.0 + rs))


def macd_histogram(closes: Sequence[float]) -> float:
    """MACD histogram (macd_line - signal_line) at t + bounded signal-cross-up recency add.

    Encoded higher = more bullish: histogram sign+magnitude, plus a small bounded bonus if the
    macd line crossed above the signal line within the last MACD_SIGNAL bars. < slow+signal → NaN.
    """
    need = MACD_SLOW + MACD_SIGNAL
    if len(closes) < need:
        return math.nan
    fast = ema_series(closes, MACD_FAST)
    slow = ema_series(closes, MACD_SLOW)
    macd_line = [
        (fast[i] - slow[i]) if (not F._is_nan(fast[i]) and not F._is_nan(slow[i])) else math.nan
        for i in range(len(closes))
    ]
    signal = ema_series([m for m in macd_line], MACD_SIGNAL)
    hist = [
        (macd_line[i] - signal[i]) if (not F._is_nan(macd_line[i]) and not F._is_nan(signal[i])) else math.nan
        for i in range(len(closes))
    ]
    if F._is_nan(hist[-1]):
        return math.nan
    # cross-up recency (bounded): macd_line crossed above signal within last MACD_SIGNAL bars.
    base = hist[-1]
    cross_bonus = 0.0
    win = range(max(1, len(closes) - MACD_SIGNAL), len(closes))
    for i in win:
        a0, a1 = macd_line[i - 1], macd_line[i]
        s0, s1 = signal[i - 1], signal[i]
        if any(F._is_nan(x) for x in (a0, a1, s0, s1)):
            continue
        if a0 <= s0 and a1 > s1:  # cross up
            age = (len(closes) - 1) - i
            cross_bonus = max(cross_bonus, (MACD_SIGNAL - age) / MACD_SIGNAL)
    # bounded add: cross_bonus ∈ [0,1] folded into the histogram-sign signal (small, bounded).
    return base + cross_bonus


def bollinger_composite(closes: Sequence[float]) -> float:
    """Bollinger(20,2) %b + squeeze→expand composite. higher = bullish. < BB_PERIOD → NaN.

    %b = (close - lower)/(upper - lower); squeeze->expand = current bandwidth vs trailing-min
    bandwidth (expansion after a squeeze = bullish). Composite = mean of the two present parts.
    """
    if len(closes) < BB_PERIOD:
        return math.nan
    mas = sma_series(closes, BB_PERIOD)
    bw: list[float] = [math.nan] * len(closes)
    pctb: list[float] = [math.nan] * len(closes)
    for i in range(BB_PERIOD - 1, len(closes)):
        win = closes[i - BB_PERIOD + 1 : i + 1]
        if any(F._is_nan(c) for c in win) or F._is_nan(mas[i]):
            continue
        sd = F.stdev_pop(win)
        if F._is_nan(sd):
            continue
        upper = mas[i] + BB_K * sd
        lower = mas[i] - BB_K * sd
        rng = upper - lower
        bw[i] = (rng / mas[i]) if mas[i] != 0 else math.nan
        pctb[i] = ((closes[i] - lower) / rng) if rng > 0 else 0.5
    if F._is_nan(pctb[-1]):
        return math.nan
    parts = [pctb[-1]]
    present_bw = [b for b in bw if not F._is_nan(b)]
    if present_bw and not F._is_nan(bw[-1]):
        bw_min = min(present_bw)
        # expansion after squeeze: current / trailing-min, bounded bullish scalar in [0,1].
        # floored at 0 (a contracting band does NOT penalize an otherwise-bullish %b), capped at +1.
        expand = (bw[-1] / bw_min) if bw_min > 0 else 1.0
        parts.append(max(0.0, min(expand - 1.0, 1.0)))
    return sum(parts) / len(parts)


def ma_alignment_score(closes: Sequence[float]) -> float:
    """Count of satisfied price>MA20>MA60>MA120 inequalities ∈ {0,1,2,3}. < max+1 → NaN."""
    need = max(MA_PERIODS) + 1
    if len(closes) < need:
        return math.nan
    price = closes[-1]
    if F._is_nan(price):
        return math.nan
    m20 = sma(closes, MA_PERIODS[0])
    m60 = sma(closes, MA_PERIODS[1])
    m120 = sma(closes, MA_PERIODS[2])
    if any(F._is_nan(x) for x in (m20, m60, m120)):
        return math.nan
    score = 0
    score += int(price > m20)
    score += int(m20 > m60)
    score += int(m60 > m120)
    return float(score)


def gc_recency_score(closes: Sequence[float], window: int = GC_RECENCY_WINDOW) -> float:
    """Days since the most recent MA20-crosses-above-MA60 within `window`, encoded (W-age)/W ∈ [0,1].

    0 if no recent cross within `window`. < 61 closes (need MA60 over the window) → NaN.
    """
    need = MA_PERIODS[1] + 1
    if len(closes) < need:
        return math.nan
    m20 = sma_series(closes, MA_PERIODS[0])
    m60 = sma_series(closes, MA_PERIODS[1])
    last = len(closes) - 1
    best = 0.0
    found = False
    lo = max(1, last - window + 1)
    for i in range(lo, last + 1):
        a0, a1 = m20[i - 1], m20[i]
        b0, b1 = m60[i - 1], m60[i]
        if any(F._is_nan(x) for x in (a0, a1, b0, b1)):
            continue
        found = True  # we have at least one evaluable bar in-window
        if a0 <= b0 and a1 > b1:  # MA20 crosses above MA60
            age = last - i
            best = max(best, (window - age) / window)
    if not found:
        return math.nan
    return best


def donchian_breakout(closes: Sequence[float], highs: Sequence[float], n: int = DONCHIAN_N) -> float:
    """1.0 if close[-1] > max(highs[t-N..t-1]) else proximity close[-1]/that_high ∈ (0,1].

    PIT: t EXCLUDED from the trailing high (no look-ahead). < N+1 high bars → NaN.
    """
    if len(highs) < n + 1 or len(closes) < 1:
        return math.nan
    trailing = highs[-(n + 1):-1]  # t-N .. t-1 (t excluded)
    trailing = [h for h in trailing if not F._is_nan(h)]
    if len(trailing) < n:
        return math.nan
    hi = max(trailing)
    c = closes[-1]
    if F._is_nan(c) or hi <= 0:
        return math.nan
    if c > hi:
        return 1.0
    return c / hi  # proximity in (0,1]


def vol_confirmed_breakout(
    closes: Sequence[float], highs: Sequence[float], trdvals: Sequence[float], n: int = DONCHIAN_N
) -> float:
    """Donchian breakout strength gated by trdval[t] > MULT * mean(trdval[t-VOL_AVG..t-1]).

    Volume-confirmed → full breakout strength; else damped ×VOL_UNCONFIRMED_DAMP. trdval is the
    volume proxy (consistent with F._volume_surge). PIT: trailing avg excludes t. Warm-up → NaN.
    """
    bo = donchian_breakout(closes, highs, n)
    if F._is_nan(bo):
        return math.nan
    if len(trdvals) < VOL_AVG_WINDOW + 1:
        return math.nan
    trailing = trdvals[-(VOL_AVG_WINDOW + 1):-1]  # t excluded
    trailing = [v for v in trailing if not F._is_nan(v) and v >= 0]
    if len(trailing) < VOL_AVG_WINDOW:
        return math.nan
    avg = sum(trailing) / len(trailing)
    vt = trdvals[-1]
    if F._is_nan(vt) or avg <= 0:
        return math.nan
    confirmed = vt > VOL_CONFIRM_MULT * avg
    return bo if confirmed else bo * VOL_UNCONFIRMED_DAMP


def atr_contraction_proxy(
    closes: Sequence[float], fast: int = ATR_CONTRACTION_FAST, slow: int = ATR_CONTRACTION_SLOW
) -> float:
    """Close-to-close realized-vol contraction = 1 - stdev(ret_fast)/stdev(ret_slow). higher=more coil.

    True-range ATR needs `low` (not on the panel) → OHLCV-only proxy (SoT §1). < slow+1 closes → NaN.
    """
    if len(closes) < slow + 1:
        return math.nan
    rets = F.daily_returns(closes)
    if len(rets) < slow:
        return math.nan
    fast_rets = rets[-fast:]
    slow_rets = rets[-slow:]
    sf = F.stdev_pop(fast_rets)
    ss = F.stdev_pop(slow_rets)
    if F._is_nan(sf) or F._is_nan(ss) or ss <= 0:
        return math.nan
    return 1.0 - (sf / ss)  # <1 ratio (contraction) → positive; >1 (expansion) → negative


# ============================================================================
# Per-ticker raw sub-indicator vector
# ============================================================================

def chart_subindicators_raw(stock: F.StockRaw) -> dict[str, float]:
    """All 8 sub-indicator raw scalars for one ticker (higher = bullish). NaN on warm-up."""
    closes = stock.closes
    highs = stock.highs
    trdvals = stock.trdvals
    has_highs = highs is not None and len(highs) == len(closes)
    high_series = highs if has_highs else None
    return {
        "ma_align": ma_alignment_score(closes),
        "gc_recency": gc_recency_score(closes),
        "rsi": wilder_rsi(closes),
        "macd": macd_histogram(closes),
        "bollinger": bollinger_composite(closes),
        "donchian": donchian_breakout(closes, high_series) if high_series is not None else math.nan,
        "vol_confirm": vol_confirmed_breakout(closes, high_series, trdvals) if high_series is not None else math.nan,
        "atr_contraction": atr_contraction_proxy(closes),
    }


# ============================================================================
# Equal-rank composite scorer (ScoredStock-shaped, drops into F.select_size_sleeves)
# ============================================================================

def score_chart_universe(stocks: Sequence[F.StockRaw], bucket: str) -> list[F.ScoredStock]:
    """B++-shaped chart composite scoring for one horizon(bucket).

    Eligibility = SAME F.liquidity_floor_pass(F.adv60) floor as B++ → identical universe.
    Each sub-indicator raw vector → F._rank_of (over eligible mask) → F.fill_missing_rank(
    failure_mask=None) so warm-up NaN → neutral-50 → F._combine_ranks equal-weight mean over present.
    Returns ScoredStock(score=chart_composite, factor_ranks={sub-indicator ranks}) preserving input order.

    `bucket` is accepted for shape parity with F.score_bpp_universe (and sleeve/forward per horizon);
    the chart composite itself is horizon-agnostic (objective indicators are not bucket-tuned — no
    per-horizon parameter mining).
    """
    n = len(stocks)
    advs = [F.adv60(s.trdvals) for s in stocks]
    eligible = [F.liquidity_floor_pass(a) for a in advs]

    def elig_mask(values: list[float]) -> list[float]:
        return [values[i] if eligible[i] else math.nan for i in range(n)]

    # size sleeve from eligible mcaps (same breakpoint convention as B++).
    elig_caps = [stocks[i].market_cap for i in range(n) if eligible[i]]
    large_cut, mid_cut = F.size_breakpoints(elig_caps)
    sleeves = [
        F.size_tier(stocks[i].market_cap, large_cut, mid_cut) if eligible[i] else "small"
        for i in range(n)
    ]

    # raw sub-indicator vectors (warm-up = NaN).
    raw_by_sub: dict[str, list[float]] = {sub: [math.nan] * n for sub in SUB_INDICATORS}
    for i, s in enumerate(stocks):
        if not eligible[i]:
            continue
        sr = chart_subindicators_raw(s)
        for sub in SUB_INDICATORS:
            raw_by_sub[sub][i] = sr[sub]

    # rank each sub-indicator over the eligible cross-section, then warm-up NaN → neutral-50.
    rank_by_sub: dict[str, list[float]] = {}
    for sub in SUB_INDICATORS:
        ranked = F._rank_of(elig_mask(raw_by_sub[sub]))
        # only fill neutral-50 for eligible rows (non-eligible stay NaN → excluded below).
        filled = [
            (F.fill_missing_rank([ranked[i]])[0] if eligible[i] else math.nan)
            for i in range(n)
        ]
        rank_by_sub[sub] = filled

    composite = F._combine_ranks([rank_by_sub[sub] for sub in SUB_INDICATORS])

    out: list[F.ScoredStock] = []
    for i, s in enumerate(stocks):
        if not eligible[i] or F._is_nan(composite[i]):
            out.append(F.ScoredStock(s.ticker, s.sector, s.market_cap, "small", math.nan,
                                     advs[i], eligible=False))
            continue
        ranks = {sub: rank_by_sub[sub][i] for sub in SUB_INDICATORS}
        out.append(F.ScoredStock(
            ticker=s.ticker, sector=s.sector, market_cap=s.market_cap,
            sleeve=sleeves[i], score=composite[i], adv60=advs[i],
            factor_ranks=ranks, eligible=True,
        ))
    return out
