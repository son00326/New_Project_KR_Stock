#!/usr/bin/env python3
# noqa: SIZE_OK - PR-B1 unittest matrix is intentionally self-contained (no shared fixtures).
"""shadow_gen_core (PR-B1) 테스트 매트릭스 — stdlib unittest (pytest 미설치).

실행:
    cd /Users/yong/New_Project_KR_Stock/scripts
    ./.venv/bin/python -m unittest test_shadow_gen_core -v

self-contained: 공유 conftest/fixture 모듈이 없으므로 builder를 본 파일에 복사한다.
fixture는 BppIntegrationTest._universe(350) recipe 차용(검증된 clean 20/40/40 breakpoint).
sector만 canonical-14로 교체(shadow path가 leading sector를 canonical-14로 검증하므로 — 유일한
의도적 deviation). 결정론(랜덤 없음).
"""
from __future__ import annotations

import math
import os
import re
import sys
import unittest
from dataclasses import asdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import TypeAlias

_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
if _THIS_DIR not in sys.path:
    sys.path.insert(0, _THIS_DIR)

import tier0_factors as TF                              # noqa: E402
import screen_shortlist_tier0 as SS                     # noqa: E402
from canonical_sector_mapper import CANONICAL_SECTORS   # noqa: E402

import shadow_gen_core as SG                            # noqa: E402


ShadowHypothesis: TypeAlias = dict[str, object]
TickerScoreSleeveSnapshot: TypeAlias = dict[str, list[tuple[str, float, str]]]


# ============================================================================
# Fixtures (BppIntegrationTest._universe recipe 차용, sector만 canonical-14)
# ============================================================================

_N = 280                                       # close 시계열 길이 ≥ 274 (long lookback 252+21+1)
_SECTORS = ("반도체", "바이오", "IT/SW", "금융")   # 전부 canonical-14 (parity-safe)


def _bpp_series(n: int, drift: float, wiggle: float = 0.01, phase: float = 0.0) -> list[float]:
    out, v = [], 100.0
    for i in range(n):
        v *= (1.0 + drift + wiggle * math.sin(phase + i * 0.3))
        out.append(v)
    return out


def _universe(count: int = 350) -> list[TF.StockRaw]:
    """≥150-distinct eligible B++ universe.

    monotone mktcap 5e10..(count*5e10) → clean 20/40/40 large/mid/small breakpoint;
    trdvals ~5e9 >> 2e9 floor; distinct positive drift + wiggle → non-zero return sigma
    (risk_adjusted_trend not NaN). 전부 eligible.
    """
    stocks = []
    for k in range(count):
        closes = _bpp_series(_N, 0.0005 + 0.00002 * k, phase=k * 0.1)
        stocks.append(TF.StockRaw(
            ticker=f"{100000 + k:06d}",
            sector=_SECTORS[k % 4],
            market_cap=(k + 1) * 5e10,
            closes=closes,
            trdvals=[5e9 + k * 1e7] * _N,
            highs=list(closes),
            foreign_net_60d=1e9 + k * 1e6,
            earnings_raw=0.05 + 0.001 * k,
            quality_composite_raw=40.0 + (k % 30),
        ))
    return stocks


def _tickers(stocks: list[TF.StockRaw]) -> list[str]:
    return [s.ticker for s in stocks]

def _universe_rows(stocks: list[TF.StockRaw]) -> list[dict]:
    return [{"ticker": s.ticker, "sector": s.sector} for s in stocks]


def _softtilt_boundary_fixture() -> dict[str, list[TF.ScoredStock]]:
    fixture: dict[str, list[TF.ScoredStock]] = {}
    for bucket in SS.BUCKETS:
        prefix = bucket[0].upper()
        rows: list[TF.ScoredStock] = []
        for i, score in enumerate(range(100, 79, -1)):
            rows.append(TF.ScoredStock(
                ticker=f"{prefix}L{i:03d}",
                sector="반도체" if score == 80 else "금융",
                market_cap=1e11,
                sleeve="large",
                score=float(score),
                adv60=5e9,
            ))
        for i in range(20):
            rows.append(TF.ScoredStock(
                ticker=f"{prefix}M{i:03d}", sector="금융", market_cap=5e10,
                sleeve="mid", score=200.0 + i, adv60=5e9,
            ))
        for i in range(10):
            rows.append(TF.ScoredStock(
                ticker=f"{prefix}S{i:03d}", sector="금융", market_cap=1e10,
                sleeve="small", score=300.0 + i, adv60=5e9,
            ))
        fixture[bucket] = rows
    return fixture


def _stocks_from_scored_fixture(fixture: dict[str, list[TF.ScoredStock]]) -> list[TF.StockRaw]:
    return [
        TF.StockRaw(
            ticker=sc.ticker, sector=sc.sector, market_cap=sc.market_cap,
            closes=[100.0], trdvals=[5e9], highs=[100.0],
        )
        for rows in fixture.values()
        for sc in rows
    ]


def _hyp_absent() -> ShadowHypothesis:
    return {
        "period_key": "2026-06",
        "source": "absent",
        "leading_sectors": [],
        "as_of": None,
        "selection_as_of": "2026-06-01",
        "params": {},
        "hypothesis_hash": "h_absent",
    }


def _hyp_manual(leading_sectors, *, tilt_version="soft_tilt_v1") -> ShadowHypothesis:
    return {
        "period_key": "2026-06",
        "source": "manual_pre_registered",
        "leading_sectors": list(leading_sectors),
        "as_of": "2026-05-01",
        "selection_as_of": "2026-06-01",
        "params": {"tilt_version": tilt_version},
        "hypothesis_hash": "h_manual",
    }


def _flatten(selections: dict) -> list[TF.ScoredStock]:
    return [sc for b in SS.BUCKETS for sc in selections[b]]


def _ticker_score_sleeve(selections: dict) -> TickerScoreSleeveSnapshot:
    """bucket → [(ticker, score, sleeve)] 비교용 스냅샷."""
    return {
        b: [(sc.ticker, sc.score, sc.sleeve) for sc in selections[b]]
        for b in SS.BUCKETS
    }


# ============================================================================
# T1/T2 — tri-source canonical parity
# ============================================================================

_TS_PATH = Path(_THIS_DIR) / ".." / "tudal" / "src" / "lib" / "screening" / "canonical-sectors.ts"
_SPEC_PATH = Path(_THIS_DIR) / ".." / "docs" / "superpowers" / "specs" / "2026-06-20-pathA-track2-generator-shadow.md"


def _ts_canonical_14() -> list[str]:
    ts = _TS_PATH.resolve().read_text(encoding="utf-8")
    m = re.search(
        r"export\s+const\s+CANONICAL_SECTORS\b[^\[]*\[(.*?)\]\s*as\s+const",
        ts,
        re.S,
    )
    assert m is not None, "TS CANONICAL_SECTORS const 블록을 찾지 못함"
    return re.findall(r'"([^"]+)"', m.group(1))


def _spec_sql_sector_15() -> list[str]:
    spec = _SPEC_PATH.resolve().read_text(encoding="utf-8")
    m = re.search(r"sector\s+in\s*\(([^)]*'unresolved'[^)]*)\)", spec, re.S)
    assert m is not None, "spec SQL sector CHECK 블록을 찾지 못함"
    return re.findall(r"'([^']+)'", m.group(1))


class TestTriSourceParity(unittest.TestCase):
    def test_tri_source_canonical_parity(self):  # T1
        ts14 = _ts_canonical_14()
        sql15 = _spec_sql_sector_15()
        # Python == TS (순서 + 집합)
        self.assertEqual(list(CANONICAL_SECTORS), ts14)
        # spec-SQL enum minus 'unresolved' == canonical-14
        self.assertEqual(set(sql15) - {"unresolved"}, set(CANONICAL_SECTORS))
        self.assertIn("unresolved", sql15)
        self.assertEqual(len(sql15), 15)
        # 'unresolved'는 14-set 어디에도 없음
        self.assertNotIn("unresolved", CANONICAL_SECTORS)
        self.assertNotIn("unresolved", ts14)
        self.assertEqual(len(CANONICAL_SECTORS), 14)

    def test_ts_parse_isolates_const_block(self):  # T2
        # regex가 위쪽 `export type CanonicalSector = | "..."` union을 무시하고 const [...]만 추출.
        ts14 = _ts_canonical_14()
        self.assertEqual(len(ts14), 14)  # union(14) double-count 시 28이 됨
        self.assertEqual(list(CANONICAL_SECTORS), ts14)


# ============================================================================
# T3/T4 — production-mirror & identity-transform no-drift
# ============================================================================

class TestNoDrift(unittest.TestCase):
    def setUp(self):
        self.stocks = _universe(350)
        self.universe = _tickers(self.stocks)

    def test_accepts_spec_universe_rows(self):  # T3b
        baseline = SS.select_bpp_candidates(self.stocks, pool_size=50)
        out = SG.compute_shadow_selections(
            _universe_rows(self.stocks), self.stocks, _hyp_absent(), "production-mirror"
        )
        self.assertEqual(_ticker_score_sleeve(out["selections"]),
                         _ticker_score_sleeve(baseline))
        self.assertEqual(out["universe_size"], len(set(self.universe)))

    def test_production_mirror_equals_select_bpp_candidates(self):  # T3
        baseline = SS.select_bpp_candidates(self.stocks, pool_size=50)
        out = SG.compute_shadow_selections(
            self.universe, self.stocks, _hyp_absent(), "production-mirror"
        )
        self.assertEqual(_ticker_score_sleeve(out["selections"]),
                         _ticker_score_sleeve(baseline))
        # 150 disjoint
        all_t = [sc.ticker for sc in _flatten(out["selections"])]
        self.assertEqual(len(all_t), 150)
        self.assertEqual(len(set(all_t)), 150)
        for b in SS.BUCKETS:
            self.assertEqual(len(out["selections"][b]), 50)

    def test_identity_transform_no_drift(self):  # T4
        baseline = SS.select_bpp_candidates(self.stocks, pool_size=50)
        out = SG._select_with_score_transform(
            self.stocks, transform=lambda sc: sc.score, pool_size=50
        )
        self.assertEqual(_ticker_score_sleeve(out), _ticker_score_sleeve(baseline))
        all_t = [sc.ticker for b in SS.BUCKETS for sc in out[b]]
        self.assertEqual(len(set(all_t)), 150)


# ============================================================================
# T5–T11 — validation (ShadowInvalidInputError)
# ============================================================================

class TestValidation(unittest.TestCase):
    def setUp(self):
        self.stocks = _universe(350)
        self.universe = _tickers(self.stocks)

    def test_invalid_unknown_arm(self):  # T5
        with self.assertRaises(SG.ShadowInvalidInputError):
            SG.compute_shadow_selections(
                self.universe, self.stocks, _hyp_absent(), "no-such-arm"
            )

    def test_invalid_unknown_source(self):  # T6
        hyp = _hyp_absent()
        hyp["source"] = "bogus"
        with self.assertRaises(SG.ShadowInvalidInputError):
            SG.compute_shadow_selections(
                self.universe, self.stocks, hyp, "production-mirror"
            )

    def test_invalid_noncanonical_leading_sector(self):  # T7
        for bad in ("unresolved", "코스피", "NotASector"):
            hyp = _hyp_manual(["반도체", bad])
            with self.assertRaises(SG.ShadowInvalidInputError):
                SG.compute_shadow_selections(
                    self.universe, self.stocks, hyp, "production-mirror"
                )

    def test_invalid_manual_missing_or_bad_dates(self):  # T8
        # (a) 빈 leading_sectors
        h = _hyp_manual([])
        h["leading_sectors"] = []
        with self.assertRaises(SG.ShadowInvalidInputError):
            SG.compute_shadow_selections(self.universe, self.stocks, h, "production-mirror")
        # (b) as_of 누락
        h = _hyp_manual(["반도체"])
        h["as_of"] = None
        with self.assertRaises(SG.ShadowInvalidInputError):
            SG.compute_shadow_selections(self.universe, self.stocks, h, "production-mirror")
        # (c) selection_as_of 누락
        h = _hyp_manual(["반도체"])
        h["selection_as_of"] = None
        with self.assertRaises(SG.ShadowInvalidInputError):
            SG.compute_shadow_selections(self.universe, self.stocks, h, "production-mirror")
        # (d) as_of >= selection_as_of
        h = _hyp_manual(["반도체"])
        h["as_of"] = "2026-06-01"
        h["selection_as_of"] = "2026-06-01"
        with self.assertRaises(SG.ShadowInvalidInputError):
            SG.compute_shadow_selections(self.universe, self.stocks, h, "production-mirror")

    def test_invalid_absent_with_nonempty_sectors(self):  # T9
        h = _hyp_absent()
        h["leading_sectors"] = ["반도체"]
        with self.assertRaises(SG.ShadowInvalidInputError):
            SG.compute_shadow_selections(self.universe, self.stocks, h, "production-mirror")

    def test_invalid_softtilt_missing_tilt_version(self):  # T10
        h = _hyp_manual(["반도체"])
        h["params"] = {}  # tilt_version 없음
        with self.assertRaises(SG.ShadowInvalidInputError):
            SG.compute_shadow_selections(self.universe, self.stocks, h, "sector-soft-tilt")

    def test_invalid_softtilt_unknown_tilt_version(self):  # T10b
        h = _hyp_manual(["반도체"], tilt_version="future_multiplier")
        with self.assertRaises(SG.ShadowInvalidInputError):
            SG.compute_shadow_selections(self.universe, self.stocks, h, "sector-soft-tilt")

    def test_invalid_softtilt_wrong_addend_param(self):  # T10c
        h = _hyp_manual(["반도체"])
        h["params"] = {"tilt_version": "soft_tilt_v1", "tilt_addend": 11.0}
        with self.assertRaises(SG.ShadowInvalidInputError):
            SG.compute_shadow_selections(self.universe, self.stocks, h, "sector-soft-tilt")

    def test_invalid_softtilt_rejects_non_object_params(self):
        for bad_params in ("bad", 123, [("tilt_version", "soft_tilt_v1")]):
            h = _hyp_manual(["반도체"])
            h["params"] = bad_params
            with self.assertRaises(SG.ShadowInvalidInputError):
                SG.compute_shadow_selections(
                    self.universe, self.stocks, h, "sector-soft-tilt"
                )

    def test_invalid_rejects_falsy_non_object_params(self):
        for bad_params in ([], "", 0, False, None):
            h = _hyp_absent()
            h["params"] = bad_params
            with self.assertRaises(SG.ShadowInvalidInputError):
                SG.compute_shadow_selections(
                    self.universe, self.stocks, h, "production-mirror"
                )

    def test_invalid_manual_rejects_non_iso_dates(self):  # T8b
        h = _hyp_manual(["반도체"])
        h["as_of"] = "2026-05-99"
        with self.assertRaises(SG.ShadowInvalidInputError):
            SG.compute_shadow_selections(self.universe, self.stocks, h, "production-mirror")

    def test_manual_accepts_iso_timestamps(self):  # T8c
        h = _hyp_manual(["반도체"])
        h["as_of"] = "2026-05-01T00:00:00+09:00"
        h["selection_as_of"] = "2026-06-01T00:00:00+09:00"
        out = SG.compute_shadow_selections(self.universe, self.stocks, h, "production-mirror")
        self.assertEqual(out["universe_size"], len(set(self.universe)))

    def test_invalid_universe_stocks_mismatch(self):  # T11
        bad_universe = self.universe[:-1] + ["999999"]  # ticker-set 불일치
        with self.assertRaises(SG.ShadowInvalidInputError):
            SG.compute_shadow_selections(
                bad_universe, self.stocks, _hyp_absent(), "production-mirror"
            )

    def test_invalid_duplicate_universe_or_stock_tickers(self):  # T11b
        duplicated_universe = self.universe + [self.universe[0]]
        with self.assertRaises(SG.ShadowInvalidInputError):
            SG.compute_shadow_selections(
                duplicated_universe, self.stocks, _hyp_absent(), "production-mirror"
            )

        duplicated_stocks = list(self.stocks) + [self.stocks[0]]
        with self.assertRaises(SG.ShadowInvalidInputError):
            SG.compute_shadow_selections(
                _tickers(duplicated_stocks), duplicated_stocks, _hyp_absent(),
                "production-mirror",
            )


# ============================================================================
# T12–T14 — soft-tilt 동작 + additive(not multiplier) + 음수 score
# ============================================================================

class TestSoftTiltBoundary(unittest.TestCase):
    def test_softtilt_promotes_leader_at_sleeve_boundary(self):  # T12
        # large sleeve: 21개 score 100..80; score-80=주도(반도체), score-81=비주도(금융).
        # mid: 20개 ~200(여유), small: 10개 ~300(여유) → sleeve short 없음, backfill 미발동.
        tickers, scores, sleeves, sectors = [], [], [], []
        large_scores = list(range(100, 79, -1))  # 100..80, 21개
        for i, s in enumerate(large_scores):
            tickers.append(f"L{i:03d}")
            scores.append(float(s))
            sleeves.append("large")
            # score 80(마지막)만 주도-섹터, score 81(끝에서 두번째)은 비주도.
            sectors.append("반도체" if s == 80 else "금융")
        for i in range(20):
            tickers.append(f"M{i:03d}"); scores.append(200.0 + i); sleeves.append("mid"); sectors.append("금융")
        for i in range(10):
            tickers.append(f"S{i:03d}"); scores.append(300.0 + i); sleeves.append("small"); sectors.append("금융")

        leader = next(t for t, sec, sc in zip(tickers, sectors, scores) if sc == 80.0)
        displaced = next(t for t, sc in zip(tickers, scores) if sc == 81.0)

        # untilted: large quota 20 → score 100..81 채택, 80(leader) 탈락, 81(displaced) 채택.
        untilted = set(TF.select_size_sleeves(tickers, scores, sleeves, quota=TF.SLEEVE_QUOTA))
        self.assertNotIn(leader, untilted)
        self.assertIn(displaced, untilted)

        # tilted: leader(80)에 +10 → 90 → 81을 넘어 채택; displaced(81) 탈락.
        leading = frozenset(["반도체"])
        tscores = [
            (sc + SG.SOFT_TILT_V1_ADDEND) if sec in leading else sc
            for sc, sec in zip(scores, sectors)
        ]
        tilted = set(TF.select_size_sleeves(tickers, tscores, sleeves, quota=TF.SLEEVE_QUOTA))
        self.assertIn(leader, tilted)
        self.assertNotIn(displaced, tilted)

        # 차이는 정확히 {leader, displaced}만.
        self.assertEqual(untilted ^ tilted, {leader, displaced})

    def test_compute_softtilt_changes_selection_and_logs_tilted_score(self):  # T12b
        fixture = _softtilt_boundary_fixture()
        stocks = _stocks_from_scored_fixture(fixture)
        universe = _tickers(stocks)
        original_score_bpp_universe = TF.score_bpp_universe

        def fake_score_bpp_universe(_stocks, bucket, **_kwargs):
            return fixture[bucket]

        TF.score_bpp_universe = fake_score_bpp_universe
        try:
            mirror = SG.compute_shadow_selections(
                universe, stocks, _hyp_absent(), "production-mirror"
            )
            tilted = SG.compute_shadow_selections(
                universe, stocks, _hyp_manual(["반도체"]), "sector-soft-tilt"
            )
        finally:
            TF.score_bpp_universe = original_score_bpp_universe

        for bucket in SS.BUCKETS:
            leader = next(sc.ticker for sc in fixture[bucket] if sc.score == 80.0)
            displaced = next(sc.ticker for sc in fixture[bucket] if sc.score == 81.0)
            mirror_tickers = {sc.ticker for sc in mirror["selections"][bucket]}
            tilted_tickers = {sc.ticker for sc in tilted["selections"][bucket]}

            self.assertNotIn(leader, mirror_tickers)
            self.assertIn(displaced, mirror_tickers)
            self.assertIn(leader, tilted_tickers)
            self.assertNotIn(displaced, tilted_tickers)

            tilted_leader = next(
                sc for sc in tilted["selections"][bucket] if sc.ticker == leader
            )
            self.assertAlmostEqual(tilted_leader.score, 90.0)

            # dual-application 보장: 최종 정렬도 tilted score 기준 → bucket 내 non-increasing.
            # (final sort가 untilted score로 회귀하면 selection은 같아도 순서가 깨져 여기서 잡힘.)
            tilted_scores = [sc.score for sc in tilted["selections"][bucket]]
            self.assertTrue(
                all(a >= b for a, b in zip(tilted_scores, tilted_scores[1:])),
                f"{bucket} soft-tilt selection not sorted desc by tilted score: {tilted_scores}",
            )

    def test_softtilt_additive_not_multiplier_signsafe(self):  # T13
        # 음수 score 주도-종목이 +10으로 UP. multiplier(×1.10)였다면 더 내려갔을 것.
        t = SG._make_soft_tilt_transform(frozenset(["반도체"]))
        sc_neg = TF.ScoredStock(
            ticker="NEG", sector="반도체", market_cap=1e11, sleeve="large",
            score=-5.0, adv60=5e9,
        )
        self.assertAlmostEqual(t(sc_neg), 5.0)               # additive: -5 + 10 = +5
        self.assertGreater(t(sc_neg), -5.0)                  # UP (multiplier면 -5.5로 down)
        self.assertNotAlmostEqual(t(sc_neg), -5.0 * 1.10)    # multiplier 아님
        # 비주도-섹터 음수는 그대로.
        sc_other = TF.ScoredStock(
            ticker="NEG2", sector="금융", market_cap=1e11, sleeve="large",
            score=-5.0, adv60=5e9,
        )
        t2 = SG._make_soft_tilt_transform(frozenset(["반도체"]))
        self.assertAlmostEqual(t2(sc_other), -5.0)

    def test_score_can_be_negative(self):  # T14 — 실제 production 함수로 음수 score 입증 (D7 freeze 근거)
        # B++ score = mean(rank∈[0,100]) + capped_volume_bonus[0,10] − anti_pump_penalty[0,25].
        # 낮은 ensemble + 최대 penalty면 음수 — 이것이 D7가 multiplier 대신 additive를 고른 이유.
        # (자기충족 산술이 아니라 REAL TF.rank_ensemble_score를 호출해 입증.)
        neg = TF.rank_ensemble_score(
            {"trend": 0.0, "foreign": 0.0}, volume_bonus=0.0, penalty=25.0
        )
        self.assertLess(neg, 0.0)                       # 0 − 25 = −25 < 0 (실제 production 함수)
        # multiplier(×1.10)였다면 음수 leader를 더 demote: −27.5 < −25.
        self.assertLess(neg * 1.10, neg)
        # additive(+10)는 음수 leader도 위로 promote: −15 > −25 (order-preserving sign-safe).
        self.assertGreater(neg + SG.SOFT_TILT_V1_ADDEND, neg)


# ============================================================================
# T15–T16 — hard-gate cut / gate_eligible_size / incomplete-run
# ============================================================================

class TestHardGate(unittest.TestCase):
    def test_hardgate_counterfactual_cut_and_gate_eligible_size(self):  # T15
        stocks = _universe(350)
        universe = _tickers(stocks)
        # 반도체+바이오만 leading → 350 중 ~175 gated. 각 sleeve 채우기 충분.
        leading = ["반도체", "바이오"]
        hyp = _hyp_manual(leading)
        out = SG.compute_shadow_selections(universe, stocks, hyp, "sector-hard-gate")

        gated = [s for s in stocks if s.sector in set(leading)]
        gated_tickers = {s.ticker for s in gated}
        expected_cut = sorted(t for t in {s.ticker for s in stocks} if t not in gated_tickers)
        self.assertEqual(out["counterfactual_cut"], expected_cut)
        self.assertEqual(out["gate_eligible_size"], len(gated))

        # 선정은 gated 섹터에서만.
        for sc in _flatten(out["selections"]):
            self.assertIn(sc.sector, set(leading))
        # 150 valid
        all_t = [sc.ticker for sc in _flatten(out["selections"])]
        self.assertEqual(len(set(all_t)), 150)

    def test_hardgate_underfill_raises_incomplete_run(self):  # T16
        # leading 섹터에 너무 적은 종목 → sleeve quota(20/20/10) 미충족.
        # 350 universe에서 sector를 모두 금융으로 두고, 주도 섹터를 반도체로 → gated 0.
        stocks = _universe(350)
        for s in stocks:
            s.sector = "금융"
        universe = _tickers(stocks)
        hyp = _hyp_manual(["반도체"])  # gated 0 → underfill
        with self.assertRaises(SG.ShadowIncompleteRunError):
            SG.compute_shadow_selections(universe, stocks, hyp, "sector-hard-gate")
        # ShadowIncompleteRunError는 SleeveShortfallError의 instance가 아님.
        try:
            SG.compute_shadow_selections(universe, stocks, hyp, "sector-hard-gate")
        except SG.ShadowIncompleteRunError as e:
            self.assertNotIsInstance(e, TF.SleeveShortfallError)
            self.assertIsInstance(e.__cause__, TF.SleeveShortfallError)


# ============================================================================
# T17 — universe_hash 결정론 + full-for-hardgate
# ============================================================================

class TestUniverseHash(unittest.TestCase):
    def test_universe_hash_determinism_and_full_for_hardgate(self):  # T17
        stocks = _universe(350)
        universe = _tickers(stocks)

        h_mirror = SG.compute_shadow_selections(
            universe, stocks, _hyp_absent(), "production-mirror"
        )["universe_hash"]

        # 입력 reorder해도 동일 (sorted distinct over full).
        reordered = list(reversed(stocks))
        reordered_universe = _tickers(reordered)
        h_reordered = SG.compute_shadow_selections(
            reordered_universe, reordered, _hyp_absent(), "production-mirror"
        )["universe_hash"]
        self.assertEqual(h_mirror, h_reordered)

        # hard-gate hash도 FULL pre-cut universe 위 → mirror와 동일.
        hyp = _hyp_manual(["반도체", "바이오"])
        h_hardgate = SG.compute_shadow_selections(
            universe, stocks, hyp, "sector-hard-gate"
        )["universe_hash"]
        self.assertEqual(h_mirror, h_hardgate)

        # soft-tilt도 동일.
        h_soft = SG.compute_shadow_selections(
            universe, stocks, hyp, "sector-soft-tilt"
        )["universe_hash"]
        self.assertEqual(h_mirror, h_soft)


# ============================================================================
# T18 — no mutation of inputs
# ============================================================================

class TestNoMutation(unittest.TestCase):
    def test_no_mutation_of_inputs(self):  # T18
        for arm, hyp in (
            ("production-mirror", _hyp_absent()),
            ("sector-soft-tilt", _hyp_manual(["반도체", "바이오"])),
            ("sector-hard-gate", _hyp_manual(["반도체", "바이오"])),
        ):
            stocks = _universe(350)
            universe = _tickers(stocks)
            before_stocks = [asdict(s) for s in stocks]
            before_universe = list(universe)
            before_hyp = dict(hyp)
            before_hyp_params = dict(hyp.get("params") or {})

            SG.compute_shadow_selections(universe, stocks, hyp, arm)

            after_stocks = [asdict(s) for s in stocks]
            self.assertEqual(before_stocks, after_stocks, f"stocks mutated by {arm}")
            self.assertEqual(before_universe, universe, f"universe mutated by {arm}")
            self.assertEqual(before_hyp, hyp, f"hypothesis mutated by {arm}")
            self.assertEqual(before_hyp_params, hyp.get("params") or {},
                             f"hypothesis.params mutated by {arm}")


# ============================================================================
# T19 — absent source: 모든 arm == mirror
# ============================================================================

class TestAbsentSource(unittest.TestCase):
    def test_absent_source_all_arms_equal_mirror(self):  # T19
        stocks = _universe(350)
        universe = _tickers(stocks)
        baseline = SS.select_bpp_candidates(stocks, pool_size=50)
        baseline_snap = _ticker_score_sleeve(baseline)

        for arm in SG._VALID_ARMS:
            out = SG.compute_shadow_selections(universe, stocks, _hyp_absent(), arm)
            self.assertEqual(_ticker_score_sleeve(out["selections"]), baseline_snap,
                             f"{arm} != mirror under absent")
            self.assertEqual(out["counterfactual_cut"], [], f"{arm} cut not empty")
            if arm == "sector-hard-gate":
                self.assertEqual(out["gate_eligible_size"], out["universe_size"])
            else:
                self.assertIsNone(out["gate_eligible_size"])


# ============================================================================
# T20 — universe_size + sector_distribution + NaN 보존
# ============================================================================

class TestSizeAndDistribution(unittest.TestCase):
    def test_universe_size_and_sector_distribution(self):  # T20
        stocks = _universe(350)
        universe = _tickers(stocks)

        for arm, hyp in (
            ("production-mirror", _hyp_absent()),
            ("sector-soft-tilt", _hyp_manual(["반도체"])),
            ("sector-hard-gate", _hyp_manual(["반도체", "바이오"])),
        ):
            out = SG.compute_shadow_selections(universe, stocks, hyp, arm)
            self.assertEqual(out["universe_size"], 350, f"{arm} universe_size")
            total_picks = sum(out["sector_distribution"].values())
            self.assertEqual(total_picks, 150, f"{arm} distribution total")
            # 분포 카운트가 실제 pick sector와 일치.
            from collections import Counter
            expected = dict(Counter(
                sc.sector for b in SS.BUCKETS for sc in out["selections"][b]
            ))
            self.assertEqual(out["sector_distribution"], expected)

    def test_nan_ineligible_leader_never_selected_and_preserved(self):  # T20b (NaN 보존)
        # 주도-섹터지만 closes 너무 짧음 → score=NaN, eligible=False → soft-tilt가 절대 선정 X.
        stocks = _universe(350)
        # index 0을 ineligible로: 너무 짧은 시계열.
        stocks[0] = TF.StockRaw(
            ticker=stocks[0].ticker, sector="반도체", market_cap=stocks[0].market_cap,
            closes=[100.0, 101.0, 102.0],            # 너무 짧음 → trend NaN
            trdvals=[1e6, 1e6, 1e6],                  # 유동성 floor 미달
            highs=[100.0, 101.0, 102.0],
        )
        universe = _tickers(stocks)
        hyp = _hyp_manual(["반도체"])
        out = SG.compute_shadow_selections(universe, stocks, hyp, "sector-soft-tilt")
        picked = {sc.ticker for sc in _flatten(out["selections"])}
        self.assertNotIn(stocks[0].ticker, picked)

        # transform이 NaN을 NaN으로 보존(NaN+10 안 함).
        t = SG._make_soft_tilt_transform(frozenset(["반도체"]))
        nan_sc = TF.ScoredStock(
            ticker="NANX", sector="반도체", market_cap=1e11, sleeve="large",
            score=math.nan, adv60=0.0, eligible=False,
        )
        self.assertTrue(math.isnan(t(nan_sc)))


# ============================================================================
# T21+ — adversarial-review hardening (Claude 적대검토 발견사항 잠금)
# ============================================================================

class TestReviewHardening(unittest.TestCase):
    def setUp(self):
        self.stocks = _universe(350)
        self.universe = _tickers(self.stocks)

    def test_softtilt_rejects_multiplier_param(self):  # #2 — D7 freeze load-bearing 가드
        h = _hyp_manual(["반도체"])
        h["params"] = {"tilt_version": "soft_tilt_v1", "tilt_multiplier": 1.10}
        with self.assertRaises(SG.ShadowInvalidInputError) as ctx:
            SG.compute_shadow_selections(self.universe, self.stocks, h, "sector-soft-tilt")
        self.assertIn("multiplier", str(ctx.exception).lower())

    def test_softtilt_rejects_wrong_tilt_bonus(self):  # L6 — tilt_bonus(≠tilt_addend) 분기
        h = _hyp_manual(["반도체"])
        h["params"] = {"tilt_version": "soft_tilt_v1", "tilt_bonus": 11.0}
        with self.assertRaises(SG.ShadowInvalidInputError):
            SG.compute_shadow_selections(self.universe, self.stocks, h, "sector-soft-tilt")

    def test_softtilt_v1_fixed_version_accepted(self):  # L6 — spec §3.3 stage-0 default 'v1-fixed'
        h = _hyp_manual(["반도체"], tilt_version="v1-fixed")
        out = SG.compute_shadow_selections(self.universe, self.stocks, h, "sector-soft-tilt")
        self.assertEqual(out["universe_size"], 350)  # frozenset에서 'v1-fixed' 빠지면 위에서 raise

    def test_softtilt_unhashable_tilt_version_fail_closed(self):  # R4 MED — unhashable raw TypeError 차단
        for bad in (["soft_tilt_v1"], {"v": 1}):  # truthy unhashable → 구 코드 `x not in frozenset` raw TypeError
            h = _hyp_manual(["반도체"])
            h["params"] = {"tilt_version": bad}
            with self.assertRaises(SG.ShadowInvalidInputError):
                SG.compute_shadow_selections(self.universe, self.stocks, h, "sector-soft-tilt")

    def test_params_non_string_keys_fail_closed(self):  # R4 MED — params 비-str 키 거부(무커버였음)
        h = _hyp_manual(["반도체"])
        h["params"] = {"tilt_version": "soft_tilt_v1", 123: "x"}
        with self.assertRaises(SG.ShadowInvalidInputError) as ctx:
            SG.compute_shadow_selections(self.universe, self.stocks, h, "sector-soft-tilt")
        self.assertIn("keys", str(ctx.exception).lower())

    def test_softtilt_addend_bonus_accept_side(self):  # R4 LOW3 — ACCEPT 경계(==10.0) 폴라리티 고정
        for key in ("tilt_addend", "tilt_bonus"):
            h = _hyp_manual(["반도체"])
            h["params"] = {"tilt_version": "soft_tilt_v1", key: SG.SOFT_TILT_V1_ADDEND}
            out = SG.compute_shadow_selections(self.universe, self.stocks, h, "sector-soft-tilt")
            self.assertEqual(out["universe_size"], 350)  # 10.0은 통과해야 함(거부 polarity 회귀 가드)

    def test_d7_param_freeze_is_arm_agnostic(self):  # R4 LOW1 — forbidden knob은 mirror/hard-gate에서도 거부
        for arm in ("production-mirror", "sector-hard-gate", "sector-soft-tilt"):
            h = _hyp_manual(["반도체", "바이오"])
            h["params"] = {"tilt_version": "soft_tilt_v1", "tilt_multiplier": 1.10}
            with self.assertRaises(SG.ShadowInvalidInputError):
                SG.compute_shadow_selections(self.universe, self.stocks, h, arm)

    def test_asof_z_suffix_instant_equivalence(self):  # R4 LOW2 — 'Z' 정규화 instant 등가
        # 'Z'와 '+00:00'는 동일 instant → 동일 accept/reject. as_of 08:00Z >= selection 00:00Z(=09:00+09:00) → reject.
        for asof in ("2026-06-01T08:00:00Z", "2026-06-01T08:00:00+00:00"):
            h = _hyp_manual(["반도체"])
            h["as_of"] = asof
            h["selection_as_of"] = "2026-06-01T09:00:00+09:00"
            with self.assertRaises(SG.ShadowInvalidInputError):
                SG.compute_shadow_selections(self.universe, self.stocks, h, "production-mirror")
        # 'Z' accept side: as_of 2026-05-01Z < selection 2026-06-01Z.
        h2 = _hyp_manual(["반도체"])
        h2["as_of"] = "2026-05-01T00:00:00Z"
        h2["selection_as_of"] = "2026-06-01T00:00:00Z"
        out = SG.compute_shadow_selections(self.universe, self.stocks, h2, "production-mirror")
        self.assertEqual(out["universe_size"], 350)

    def test_manual_asof_uses_instant_not_lexical(self):  # #4 — instant 비교(문자열 ordering 아님)
        # as_of 08:00Z >= selection 00:00Z(=09:00+09:00) → reject.
        # lexical이었다면 '...08:00:00+00:00' < '...09:00:00+09:00' → accept였을 것.
        h = _hyp_manual(["반도체"])
        h["as_of"] = "2026-06-01T08:00:00+00:00"
        h["selection_as_of"] = "2026-06-01T09:00:00+09:00"
        with self.assertRaises(SG.ShadowInvalidInputError):
            SG.compute_shadow_selections(self.universe, self.stocks, h, "production-mirror")
        # 대칭 accept: as_of 00:00+09:00(=전날 15:00Z) < selection 00:00+00:00.
        h2 = _hyp_manual(["반도체"])
        h2["as_of"] = "2026-06-01T00:00:00+09:00"
        h2["selection_as_of"] = "2026-06-01T00:00:00+00:00"
        out = SG.compute_shadow_selections(self.universe, self.stocks, h2, "production-mirror")
        self.assertEqual(out["universe_size"], 350)

    def test_manual_mixed_baredate_and_kst_offset(self):  # #1 — naive=KST 해석, day-boundary 뒤집힘 방지
        # as_of bare '2026-06-01'(KST 00:00 = 05-31 15:00Z) < selection '...T08:00+09:00'(05-31 23:00Z) → accept.
        h = _hyp_manual(["반도체"])
        h["as_of"] = "2026-06-01"
        h["selection_as_of"] = "2026-06-01T08:00:00+09:00"
        out = SG.compute_shadow_selections(self.universe, self.stocks, h, "production-mirror")
        self.assertEqual(out["universe_size"], 350)
        # 역: as_of '...T08:00+09:00'(05-31 23:00Z) >= selection bare '2026-06-01'(05-31 15:00Z) → reject(hindsight 차단).
        h2 = _hyp_manual(["반도체"])
        h2["as_of"] = "2026-06-01T08:00:00+09:00"
        h2["selection_as_of"] = "2026-06-01"
        with self.assertRaises(SG.ShadowInvalidInputError):
            SG.compute_shadow_selections(self.universe, self.stocks, h2, "production-mirror")

    def test_manual_accepts_date_and_datetime_objects(self):  # L5 — DB deserialize shape(date/datetime)
        h = _hyp_manual(["반도체"])
        h["as_of"] = date(2026, 5, 1)
        h["selection_as_of"] = date(2026, 6, 1)
        out = SG.compute_shadow_selections(self.universe, self.stocks, h, "production-mirror")
        self.assertEqual(out["universe_size"], 350)
        h_naive = _hyp_manual(["반도체"])
        h_naive["as_of"] = datetime(2026, 6, 1, 0, 0)
        h_naive["selection_as_of"] = datetime(
            2026, 6, 1, 8, 0, tzinfo=timezone(timedelta(hours=9))
        )
        out_naive = SG.compute_shadow_selections(
            self.universe, self.stocks, h_naive, "production-mirror"
        )
        self.assertEqual(out_naive["universe_size"], 350)
        # tz-aware datetime 객체 + offset 불일치 → instant 비교로 reject.
        h2 = _hyp_manual(["반도체"])
        h2["as_of"] = datetime(2026, 6, 1, 8, 0, tzinfo=timezone.utc)               # 08:00Z
        h2["selection_as_of"] = datetime(2026, 6, 1, 9, 0, tzinfo=timezone(timedelta(hours=9)))  # 00:00Z
        with self.assertRaises(SG.ShadowInvalidInputError):
            SG.compute_shadow_selections(self.universe, self.stocks, h2, "production-mirror")

    def test_duplicate_leading_sectors_rejected(self):  # L2 — silent dedup 금지(spec §4.5)
        h = _hyp_manual(["반도체", "반도체"])
        with self.assertRaises(SG.ShadowInvalidInputError):
            SG.compute_shadow_selections(self.universe, self.stocks, h, "sector-soft-tilt")

    def test_non_dict_hypothesis_fail_closed(self):  # R3 — hypothesis 비-dict raw AttributeError 누수 차단
        for bad in (None, 5, "반도체", ["반도체"], object()):
            with self.assertRaises(SG.ShadowInvalidInputError):
                SG.compute_shadow_selections(self.universe, self.stocks, bad, "production-mirror")

    def test_non_list_leading_sectors_fail_closed(self):  # R3 — leading_sectors 비-list raw 누수/silent coerce 차단
        # int → 구 코드 list(5) raw TypeError.
        h = _hyp_manual(["반도체"]); h["leading_sectors"] = 5
        with self.assertRaises(SG.ShadowInvalidInputError):
            SG.compute_shadow_selections(self.universe, self.stocks, h, "production-mirror")
        # dict → 구 코드 list({..}) = key list silent coercion.
        h2 = _hyp_manual(["반도체"]); h2["leading_sectors"] = {"반도체": 1}
        with self.assertRaises(SG.ShadowInvalidInputError):
            SG.compute_shadow_selections(self.universe, self.stocks, h2, "production-mirror")
        # bare string → list('반도체') per-char (silent) 대신 명시 거부.
        h3 = _hyp_manual(["반도체"]); h3["leading_sectors"] = "반도체"
        with self.assertRaises(SG.ShadowInvalidInputError):
            SG.compute_shadow_selections(self.universe, self.stocks, h3, "production-mirror")

    def test_non_string_leading_sector_element_fail_closed(self):  # R3 — leading_sectors 비-str 원소 거부
        h = _hyp_manual(["반도체"]); h["leading_sectors"] = ["반도체", 123]
        with self.assertRaises(SG.ShadowInvalidInputError):
            SG.compute_shadow_selections(self.universe, self.stocks, h, "production-mirror")

    def test_universe_mixed_kinds_rejected(self):  # L4 — dict/str 혼용 거부(omxy fix b)
        mixed = [self.universe[0], {"ticker": self.universe[1]}, *self.universe[2:]]
        with self.assertRaises(SG.ShadowInvalidInputError):
            SG.compute_shadow_selections(mixed, self.stocks, _hyp_absent(), "production-mirror")

    def test_universe_container_must_be_list_fail_closed(self):
        universe_by_ticker = {ticker: {"ticker": ticker} for ticker in self.universe}
        with self.assertRaises(SG.ShadowInvalidInputError):
            SG.compute_shadow_selections(
                universe_by_ticker, self.stocks, _hyp_absent(), "production-mirror"
            )

    def test_universe_row_bad_ticker_rejected(self):  # L4 — 빈/누락 ticker row 거부
        rows = _universe_rows(self.stocks)
        rows[0] = {"ticker": ""}
        with self.assertRaises(SG.ShadowInvalidInputError):
            SG.compute_shadow_selections(rows, self.stocks, _hyp_absent(), "production-mirror")
        rows2 = _universe_rows(self.stocks)
        rows2[0] = {"sector": "반도체"}  # 'ticker' 키 누락
        with self.assertRaises(SG.ShadowInvalidInputError):
            SG.compute_shadow_selections(rows2, self.stocks, _hyp_absent(), "production-mirror")
        malformed = list(self.universe)
        malformed[0] = 123
        with self.assertRaises(SG.ShadowInvalidInputError):
            SG.compute_shadow_selections(
                malformed, self.stocks, _hyp_absent(), "production-mirror"
            )

    def test_mirror_and_softtilt_propagate_raw_sleeveshortfall(self):  # #5 — raw 전파(wrap 아님)
        small = _universe(40)  # 40 < 150 → sleeve quota 미충족
        uni = _tickers(small)
        with self.assertRaises(TF.SleeveShortfallError) as ctx:
            SG.compute_shadow_selections(uni, small, _hyp_absent(), "production-mirror")
        self.assertNotIsInstance(ctx.exception, SG.ShadowIncompleteRunError)
        # soft-tilt(leading sector 있음)도 raw 전파.
        h = _hyp_manual(["반도체"])
        with self.assertRaises(TF.SleeveShortfallError) as ctx2:
            SG.compute_shadow_selections(uni, small, h, "sector-soft-tilt")
        self.assertNotIsInstance(ctx2.exception, SG.ShadowIncompleteRunError)

    def test_hardgate_cuts_unresolved_sector_stock(self):  # L7 — 'unresolved'는 leading 불가 → 항상 cut
        stocks = _universe(350)
        first = stocks[0]
        stocks[0] = TF.StockRaw(
            ticker=first.ticker, sector="unresolved", market_cap=first.market_cap,
            closes=list(first.closes), trdvals=list(first.trdvals), highs=list(first.highs),
            foreign_net_60d=first.foreign_net_60d, earnings_raw=first.earnings_raw,
            quality_composite_raw=first.quality_composite_raw,
        )
        uni = _tickers(stocks)
        out = SG.compute_shadow_selections(
            uni, stocks, _hyp_manual(["반도체", "바이오"]), "sector-hard-gate"
        )
        self.assertIn(first.ticker, out["counterfactual_cut"])
        picked = {sc.ticker for sc in _flatten(out["selections"])}
        self.assertNotIn(first.ticker, picked)


if __name__ == "__main__":
    unittest.main(verbosity=2)
