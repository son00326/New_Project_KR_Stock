"""Unittest for scripts/tier0_cfg56.py — EXPLORATORY cfg5/cfg6/cfg7 후보 생성기 (2026-06-17).

검증: (1) cfg5 PIT-safety(forward-leak 없음, trailing 창만), (2) sleeve 쿼터 20/20/10 보존,
(3) cfg6 union+downselect cap=150·dedupe·no-retry, (4) cfg7 daily-surge proxy + high-volume baseline,
(5) frozen 파라미터 고정, (6) 진단 산출.
frozen 측정(validate_tier0_ic.py)은 import만, 변경 없음.
"""
from __future__ import annotations

import math
import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts import tier0_cfg56 as C
from scripts import tier0_factors as F


def _closes(n: int, drift: float, seed: int) -> list[float]:
    """n 거래일 종가 (drift = 일간 추세, seed로 noise 변주)."""
    out = []
    p = 100.0
    for t in range(n):
        p *= (1.0 + drift) * (1.0 + 0.005 * math.sin(t * 0.3 + seed))
        out.append(p)
    return out


def _universe(n: int = 320, sector_cycle=("방산", "조선", "바이오", "금융")) -> list[F.StockRaw]:
    """연속 시총 스펙트럼 universe (frozen size_breakpoints 20/40/40 → large/mid/small).

    n 종목의 시총을 단조 spread → top 20% large(64@320) / next 40% mid(128) / bottom 40% small(128),
    3 bucket cross-disjoint 쿼터(20/20/10×3=60/60/30) 충족(frozen select_size_sleeves backfill 불요).
    모두 유동성 플로어 충족·closes 300(long primary lookback 252+skip 21+1). 섹터 순환 배정.
    """
    stocks: list[F.StockRaw] = []
    for i in range(n):
        # 시총 단조 spread (큰 ticker idx일수록 작은 시총) → 결정론 size tier 분포.
        mktcap = 1e13 / (1.0 + 0.05 * i)
        drift = 0.002 + 0.0006 * (i % 8)
        stocks.append(F.StockRaw(
            ticker=f"{i:06d}", sector=sector_cycle[i % len(sector_cycle)],
            market_cap=mktcap, closes=_closes(300, drift, seed=i),
            trdvals=[5e9] * 300, foreign_net_60d=1e9 * (1 + (i % 7)),
        ))
    return stocks


class TestCfg5PITSafety(unittest.TestCase):
    def test_leading_sectors_uses_only_trailing_window_no_forward_leak(self):
        # 종목별 closes의 마지막 (lag) 구간을 forward로 간주 — 그 구간을 바꿔도 leading_sectors는 불변이어야 한다.
        base = _universe()
        lead_base = C.leading_sectors(base)
        leaked = []
        for s in base:
            cs = list(s.closes)
            # 마지막 CFG5_TREND_LAG 거래일(= as-of 이후로 취급되는 lag 구간)을 인위적으로 폭등시킴.
            for j in range(len(cs) - C.CFG5_TREND_LAG, len(cs)):
                cs[j] *= 5.0
            leaked.append(F.StockRaw(
                ticker=s.ticker, sector=s.sector, market_cap=s.market_cap,
                closes=cs, trdvals=s.trdvals, foreign_net_60d=s.foreign_net_60d))
        lead_leaked = C.leading_sectors(leaked)
        self.assertEqual(lead_base, lead_leaked,
                         "lag 구간(미래 프록시) 변경이 leading_sectors를 바꿈 = look-ahead leak")

    def test_leading_sectors_nonempty_and_subset(self):
        stocks = _universe()
        lead = C.leading_sectors(stocks)
        all_sectors = {s.sector for s in stocks}
        self.assertTrue(lead)
        self.assertTrue(lead <= all_sectors)
        # 상위 ~30% 만 (4 섹터 → ceil(4*0.3)=2)
        self.assertLessEqual(len(lead), math.ceil(len(all_sectors) * C.CFG5_LEADING_FRACTION))

    def test_leading_sectors_ignores_sector_specific_future_spike(self):
        base = _universe()
        lead_base = C.leading_sectors(base)
        shock_sector = next(iter({s.sector for s in base} - lead_base))
        shocked = []
        for s in base:
            cs = list(s.closes)
            if s.sector == shock_sector:
                for j in range(len(cs) - C.CFG5_TREND_LAG, len(cs)):
                    cs[j] *= 50.0
            shocked.append(F.StockRaw(
                ticker=s.ticker, sector=s.sector, market_cap=s.market_cap,
                closes=cs, trdvals=s.trdvals, foreign_net_60d=s.foreign_net_60d))
        self.assertEqual(C.leading_sectors(shocked), lead_base)
        self.assertNotIn(shock_sector, C.leading_sectors(shocked))


class TestCfg5Sleeve(unittest.TestCase):
    def test_cfg5_preserves_sleeve_quota_20_20_10(self):
        sel = C.select_cfg5_for_harvest(_universe())
        # cross-bucket disjoint 합 = 150, sleeve 분포 = 60/60/30.
        all_sel = C._selected_set(sel)
        self.assertEqual(len(all_sel), 150)
        dist = {"large": 0, "mid": 0, "small": 0}
        for b in C.HARVEST_BUCKETS:
            for sc in sel[b][1]:
                dist[sc.sleeve] += 1
        self.assertEqual(dist, {"large": 60, "mid": 60, "small": 30})

    def test_cfg5_ranked_exposes_frozen_score_not_tilted(self):
        # ranked의 score는 frozen ensemble score(틸트 가산 전)여야 측정이 frozen 그대로.
        sel = C.select_cfg5_for_harvest(_universe())
        for b in C.HARVEST_BUCKETS:
            scored_by_t = {sc.ticker: sc for sc in sel[b][0]}
            for sc in sel[b][1]:
                self.assertEqual(sc.score, scored_by_t[sc.ticker].score)


class TestCfg6Union(unittest.TestCase):
    def test_tier0_factors_module_identity_is_singleton(self):
        self.assertIs(C.F.SleeveShortfallError, F.SleeveShortfallError)

    def test_cfg6_cap_150_never_exceeded(self):
        # omxy 정정: union>150이면 cap이 강제 downselect. cap을 넘지 않는 것이 frozen 불변식.
        # (union 멤버만 sleeve 경쟁 → top-N-per-screen 제약상 sleeve dist는 backfill로 달라질 수 있다 —
        # 60/60/30 정확 일치를 보장하지 않는다. 보장은 'total ≤ cap' + dedupe + no-retry.)
        sel = C.select_cfg6_for_harvest(_universe())
        all_sel = C._selected_set(sel)
        self.assertLessEqual(len(all_sel), C.CFG6_FINAL_CAP)
        self.assertEqual(len(all_sel), 150)  # 충분한 universe → cap 채움(backfill 포함)

    def test_cfg6_selection_is_deduped(self):
        sel = C.select_cfg6_for_harvest(_universe())
        flat = [sc.ticker for b in C.HARVEST_BUCKETS for sc in sel[b][1]]
        self.assertEqual(len(flat), len(set(flat)), "cfg6 선정에 중복 ticker")

    def test_cfg6_frozen_screen_params(self):
        self.assertEqual(C.CFG6_SCREENS, ("composite", "trend", "foreign"))
        self.assertEqual(C.CFG6_TOP_N_PER_SLEEVE, 30)
        self.assertEqual(C.CFG6_FINAL_CAP, 150)

    def test_cfg6_downselects_when_pre_cap_union_exceeds_cap(self):
        stocks = _universe()
        union = C.cfg6_union_for_diagnostics(stocks)
        sel = C.select_cfg6_for_harvest(stocks)
        self.assertGreater(len(union), C.CFG6_FINAL_CAP)
        self.assertEqual(len(C._selected_set(sel)), C.CFG6_FINAL_CAP)

    def test_cfg6_screen_tie_break_uses_composite_before_ticker(self):
        scored = [
            F.ScoredStock("000001", "제조", 1e12, "large", 10.0, 5e9, {"trend": 80.0}),
            F.ScoredStock("000002", "제조", 1e12, "large", 90.0, 5e9, {"trend": 80.0}),
        ]
        self.assertEqual(C._screen_top_n_per_sleeve(scored, "trend", 1), {"000002"})

    def test_cfg6_no_retry_raises_on_shortfall(self):
        # universe가 너무 작아 sleeve 쿼터를 못 채우면 SleeveShortfallError surface(무음 truncation 금지).
        tiny = _universe(n=12)  # 12 종목 → 쿼터 20/20/10 불충족
        with self.assertRaises(F.SleeveShortfallError):
            C.select_cfg6_for_harvest(tiny)


class TestDiagnostics(unittest.TestCase):
    def test_diagnostics_fields_present(self):
        stocks = _universe()
        bpp = _bpp_select(stocks)
        sel5 = C.select_cfg5_for_harvest(stocks)
        diag = C.compute_diagnostics(stocks, sel5, bpp, _LEADERS)
        self.assertEqual(diag.selected_count, 150)
        self.assertTrue(0.0 <= diag.jaccard_vs_bpp <= 1.0)
        self.assertEqual(sum(diag.size_dist.values()), 150)
        self.assertTrue(diag.sector_dist)
        self.assertFalse(math.isnan(diag.random_baseline_ratio))
        self.assertAlmostEqual(diag.random_baseline_ratio, 150 / len(stocks))

    def test_cfg6_diagnostics_report_pre_cap_and_dropped_leaders(self):
        stocks = _universe()
        bpp = _bpp_select(stocks)
        sel6 = C.select_cfg6_for_harvest(stocks)
        union = C.cfg6_union_for_diagnostics(stocks)
        diag = C.compute_diagnostics(stocks, sel6, bpp, _LEADERS, pre_cap_union=union)
        pre_cap_count = diag.pre_cap_union_count
        self.assertIsNotNone(pre_cap_count)
        assert pre_cap_count is not None
        self.assertGreaterEqual(pre_cap_count, diag.selected_count - 1)
        self.assertGreaterEqual(diag.leaders_dropped_post_cap, 0)

    def test_cfg6_diagnostics_counts_actual_post_cap_dropped_leader(self):
        stocks = _universe()
        bpp = _bpp_select(stocks)
        sel6 = C.select_cfg6_for_harvest(stocks)
        union = C.cfg6_union_for_diagnostics(stocks)
        dropped = sorted(union - C._selected_set(sel6))
        self.assertTrue(dropped)
        diag = C.compute_diagnostics(
            stocks, sel6, bpp, {dropped[0]: "dropped"}, pre_cap_union=union)
        self.assertEqual(diag.leaders_dropped_post_cap, 1)
        self.assertEqual(diag.unique_leader_hits_vs_bpp, 0)


class TestCfg7DailySurgeProxy(unittest.TestCase):
    def test_cfg7_preserves_sleeve_quota_60_60_30(self):
        sel = C.select_cfg7_for_harvest(_universe())
        all_sel = C._selected_set(sel)
        self.assertEqual(len(all_sel), 150)
        dist = {"large": 0, "mid": 0, "small": 0}
        for b in C.HARVEST_BUCKETS:
            for sc in sel[b][1]:
                dist[sc.sleeve] += 1
        self.assertEqual(dist, {"large": 60, "mid": 60, "small": 30})

    def test_cfg7_ranked_exposes_frozen_score_not_surge(self):
        # 측정 score는 frozen ensemble score(surge 아님)여야 IC/recall이 frozen 그대로.
        sel = C.select_cfg7_for_harvest(_universe())
        for b in C.HARVEST_BUCKETS:
            scored_by_t = {sc.ticker: sc for sc in sel[b][0]}
            for sc in sel[b][1]:
                self.assertEqual(sc.score, scored_by_t[sc.ticker].score)

    def test_cfg7_pit_no_leak_future_prices_do_not_change_selection(self):
        # 선정일 t에서 끝나는 trailing 창만 본다 — t 이후(존재하지 않는) 가격을 시계열에 못 본다는 것은
        # 구조적으로 보장되지만, 'closes의 마지막 SKIP_DAYS lag 구간'을 폭등시켜도 recent_trend(lag)는
        # 불변임을 확인한다(same-day leak 차단). vol_surge/recent_return/high_proximity는 lag 미적용이라
        # 마지막 구간 변경 시 바뀔 수 있으므로, trend 단독 시그널로 PIT lag만 검증한다.
        base = _universe()
        leaked = []
        for s in base:
            cs = list(s.closes)
            for j in range(len(cs) - F.SKIP_DAYS, len(cs)):
                cs[j] *= 4.0
            leaked.append(F.StockRaw(
                ticker=s.ticker, sector=s.sector, market_cap=s.market_cap,
                closes=cs, trdvals=list(s.trdvals), highs=None,
                foreign_net_60d=s.foreign_net_60d))
        rt_base = [F.risk_adjusted_trend(s.closes, C.CFG7_TREND_LB, skip=F.SKIP_DAYS) for s in base]
        rt_leak = [F.risk_adjusted_trend(s.closes, C.CFG7_TREND_LB, skip=F.SKIP_DAYS) for s in leaked]
        for a, b in zip(rt_base, rt_leak):
            if not (math.isnan(a) and math.isnan(b)):
                self.assertAlmostEqual(a, b, places=9,
                                       msg="recent-trend lag 구간(미래 프록시) 변경이 trend를 바꿈 = leak")

    def test_cfg7_frozen_params(self):
        self.assertEqual(C.CFG7_SURGE_WINDOW, 5)
        self.assertEqual(C.CFG7_HIGH_WINDOW, 252)
        self.assertEqual(C.CFG7_TREND_LB, 60)

    def test_cfg7_high_volume_baseline_shape(self):
        hv = C.cfg7_high_volume_baseline(_universe())
        all_sel = C._selected_set(hv)
        self.assertEqual(len(all_sel), 150)
        for b in C.HARVEST_BUCKETS:
            scored_by_t = {sc.ticker: sc for sc in hv[b][0]}
            for sc in hv[b][1]:
                self.assertEqual(sc.score, scored_by_t[sc.ticker].score)

    def test_cfg7_high_volume_baseline_selects_top_adv_per_sleeve(self):
        stocks = [
            F.StockRaw(
                ticker=s.ticker, sector=s.sector, market_cap=s.market_cap,
                closes=s.closes, highs=s.highs,
                trdvals=[2e9 + i * 1e8] * len(s.trdvals),
                foreign_net_60d=s.foreign_net_60d,
            )
            for i, s in enumerate(_universe())
        ]
        hv = C.cfg7_high_volume_baseline(stocks)
        expected, used = set(), set()
        composite, composite_used = set(), set()
        for b in C.HARVEST_BUCKETS:
            scored = F.score_bpp_universe(stocks, b)
            picked = F.select_size_sleeves(
                [sc.ticker for sc in scored],
                [sc.adv60 if sc.eligible and not math.isnan(sc.adv60) else math.nan for sc in scored],
                [sc.sleeve for sc in scored],
                quota=dict(F.SLEEVE_QUOTA),
                exclude=used,
            )
            expected |= set(picked)
            used |= set(picked)
            composite_picked = F.select_size_sleeves(
                [sc.ticker for sc in scored],
                [sc.score for sc in scored],
                [sc.sleeve for sc in scored],
                quota=dict(F.SLEEVE_QUOTA),
                exclude=composite_used,
            )
            composite |= set(composite_picked)
            composite_used |= set(composite_picked)
        actual = C._selected_set(hv)
        self.assertEqual(actual, expected)
        self.assertNotEqual(actual, composite)

    def test_cfg7_no_retry_raises_on_shortfall(self):
        tiny = _universe(n=12)
        with self.assertRaises(F.SleeveShortfallError):
            C.select_cfg7_for_harvest(tiny)


# leader basket: 본 fixture에 존재하는 ticker 몇 개를 leader로 둔다(진단 leader_hits 검증용).
_LEADERS = {"000000": "리더A", "000010": "리더B", "000100": "리더C"}


def _bpp_select(stocks):
    """frozen select_bpp_for_harvest 재사용 (진단 기준선). import는 validate 모듈에서."""
    from scripts import validate_tier0_ic as V
    return V.select_bpp_for_harvest(stocks)


if __name__ == "__main__":
    unittest.main()
